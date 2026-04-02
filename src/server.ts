import express from 'express';
import cors from 'cors';
import axios from 'axios';
import fs from 'fs';
import crypto from 'crypto';
import { config, team } from './shared/config.js';
import { logger } from './shared/logger.js';
import { routeMessage } from './core/router.js';
import { initScheduler, getJobs } from './core/scheduler.js';
import { sendText, sendReaction, markAsRead } from './connectors/whatsapp.js';
import { transcribeAudio } from './connectors/whisper.js';
import { saveAccount } from './shared/google-api.js';
import { pushLog } from './shared/log-buffer.js';
import { incrementMessages, incrementErrors } from './shared/metrics.js';
import type { WAMessage, AgentRequest, ConversationContext } from './shared/types.js';

// Route modules
import { chatRouter, initChatRouter } from './routes/chat.js';
import { ttsRouter } from './routes/tts.js';
import { systemRouter } from './routes/system.js';
import { agentsRouter, initAgentsRouter } from './routes/agents.js';
import { memoryRouter } from './routes/memory.js';
import { engineRouter } from './routes/engine.js';
import { calendarRouter } from './routes/calendar.js';
import { analystRouter, initAnalystRouter } from './routes/analyst.js';

const app = express();
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(cors());

// === Auth Middleware for Web Platform ===
const webAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader === `Bearer ${config.webPlatformToken}`) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Stark Industries credentials required.' });
};

// === Conversation persistence ===
const CONVERSATIONS_FILE = '/app/data/conversations.json';

function loadConversations(): Map<string, ConversationContext> {
  try {
    const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

let saveTimer: NodeJS.Timeout | null = null;
function saveConversations(): void {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    const obj = Object.fromEntries(conversations);
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(obj), 'utf-8');
    saveTimer = null;
  }, 5000);
}

const conversations = loadConversations();

function getContext(phone: string): ConversationContext {
  if (!conversations.has(phone)) {
    conversations.set(phone, { recentMessages: [] });
  }
  return conversations.get(phone)!;
}

function addToContext(phone: string, role: 'user' | 'assistant', content: string): void {
  const ctx = getContext(phone);
  ctx.recentMessages.push({ role, content });
  if (ctx.recentMessages.length > 20) {
    ctx.recentMessages = ctx.recentMessages.slice(-20);
  }
  saveConversations();
}

// === Initialize route modules with shared conversation state ===
const conversationCtx = { getContext, addToContext };
initChatRouter(conversationCtx);
initAgentsRouter(conversationCtx);
initAnalystRouter(conversationCtx);

// === Log buffer: capture pino-like logs ===
const originalLog = logger;
// Intercept info/warn/error to also push to log buffer
const logProxy = new Proxy(logger, {
  get(target, prop) {
    const original = (target as any)[prop];
    if (typeof original === 'function' && ['info', 'warn', 'error', 'debug'].includes(prop as string)) {
      return (...args: any[]) => {
        // Push to log buffer
        const obj = typeof args[0] === 'object' ? args[0] : {};
        const msg = typeof args[args.length - 1] === 'string' ? args[args.length - 1] : '';
        pushLog({ level: prop as string, msg, time: Date.now(), ...obj });
        return original.apply(target, args);
      };
    }
    return original;
  },
});

// === Webhook verification ===
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.webhookVerifyToken) {
    logger.info('Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// === Message processing lock (prevent duplicate processing) ===
const processing = new Set<string>();

// === Webhook receiver ===
app.post('/webhook', async (req, res) => {
  // Validate HMAC signature from Meta
  const signature = req.headers['x-hub-signature-256'] as string;
  if (signature && config.wa.appSecret) {
    const rawBody = (req as any).rawBody as Buffer;
    const expected = 'sha256=' + crypto
      .createHmac('sha256', config.wa.appSecret)
      .update(rawBody)
      .digest('hex');
    if (signature !== expected) {
      logger.warn({ signature }, 'Invalid webhook signature');
      return res.sendStatus(401);
    }
  }

  // Respond immediately
  res.sendStatus(200);

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value?.messages?.[0]) return;

    const msg = value.messages[0];
    const contact = value.contacts?.[0];
    const messageId = msg.id;

    // Dedup
    if (processing.has(messageId)) return;
    processing.add(messageId);
    setTimeout(() => processing.delete(messageId), 60_000);

    // Build WAMessage
    const waMessage: WAMessage = {
      from: msg.from,
      name: contact?.profile?.name,
      type: msg.type,
      text: msg.text?.body || msg.caption || '',
      mediaId: msg.audio?.id || msg.image?.id || msg.document?.id || msg.video?.id,
      mimeType: msg.audio?.mime_type || msg.image?.mime_type,
      caption: msg.image?.caption || msg.document?.caption,
      timestamp: parseInt(msg.timestamp) * 1000,
      messageId,
      platform: 'whatsapp',
    };

    // Get team member or reject
    const member = team[waMessage.from];
    if (!member) {
      logger.warn({ from: waMessage.from }, 'Unknown number, ignoring');
      return;
    }

    // Mark as read + thinking reaction
    await markAsRead(messageId);
    await sendReaction(waMessage.from, messageId, '🤔');

    // Transcribe audio if needed
    if (waMessage.type === 'audio' && waMessage.mediaId) {
      waMessage.text = await transcribeAudio(waMessage.mediaId);
    }

    // Add to conversation context
    addToContext(waMessage.from, 'user', waMessage.text || '(media)');
    incrementMessages();

    // Build agent request
    const agentReq: AgentRequest = {
      agent: 'core',
      message: waMessage,
      member,
      context: getContext(waMessage.from),
    };

    // Progress callback — sends status updates via WhatsApp
    let lastProgressTime = 0;
    const MIN_PROGRESS_INTERVAL = 2000; // Min 2s between progress messages
    const onProgress = async (message: string) => {
      const now = Date.now();
      if (now - lastProgressTime < MIN_PROGRESS_INTERVAL) return;
      lastProgressTime = now;
      await sendText(waMessage.from, message).catch(() => {});
    };

    // Route and process with progress reporting
    const response = await routeMessage(agentReq, onProgress);

    // Add response to context
    addToContext(waMessage.from, 'assistant', response.text);

    // Send response
    await sendText(waMessage.from, response.text);

    // Clear thinking reaction
    await sendReaction(waMessage.from, messageId, '');

    logger.info({ from: member.name, agent: agentReq.agent }, 'Message processed');

  } catch (error: any) {
    logger.error({ error: error.message, stack: error.stack }, 'Error processing message');
    incrementErrors();
  }
});

// === Google OAuth Flow ===
app.get('/auth/google/start', (req, res) => {
  const account = req.query.account as string;
  if (!account) {
    res.status(400).send('Falta parámetro "account"');
    return;
  }

  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${config.google.clientId}` +
    `&redirect_uri=${encodeURIComponent(config.google.redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&access_type=offline` +
    `&prompt=consent` +
    `&state=${encodeURIComponent(account)}`;

  logger.info({ account }, 'OAuth flow started');
  res.redirect(authUrl);
});

app.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  const account = req.query.state as string;
  const error = req.query.error as string;

  if (error) {
    logger.warn({ error, account }, 'OAuth denied by user');
    res.status(400).send(`<h1>Autorizacion cancelada</h1><p>${error}</p>`);
    return;
  }

  if (!code || !account) {
    res.status(400).send('Faltan parametros');
    return;
  }

  try {
    // Exchange code for tokens
    const { data: tokenData } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.google.redirectUri,
    });

    if (!tokenData.refresh_token) {
      res.status(400).send('<h1>Error</h1><p>No se obtuvo refresh token. Intenta de nuevo.</p>');
      return;
    }

    // Get user info
    const { data: userInfo } = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    // Save account
    saveAccount(account, {
      email: userInfo.email,
      refreshToken: tokenData.refresh_token,
      name: userInfo.name || account,
      connectedAt: new Date().toISOString(),
    });

    logger.info({ account, email: userInfo.email }, 'Google account connected');

    // Notify owner via WhatsApp
    await sendText('573132947776',
      `Listo parce, cuenta conectada:\n\n${account} -> ${userInfo.email}\n\nYa tengo acceso a calendario, email y Drive de esa cuenta.`
    ).catch(() => {});

    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Jarvis - Cuenta conectada</title></head>
        <body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;">
          <h1>Cuenta conectada</h1>
          <p><strong>${userInfo.email}</strong> conectada como <strong>"${account}"</strong></p>
          <p style="color: #666;">Puedes cerrar esta ventana. Jarvis ya tiene acceso a tu calendario, email y Drive.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error({ error: err.message, account }, 'OAuth callback error');
    res.status(500).send(`<h1>Error</h1><p>${err.message}</p>`);
  }
});

// === Serve audio files (TTS output for WhatsApp) ===
app.get('/audio/:filename', (req, res) => {
  const filePath = `/app/data/tmp/${req.params.filename}`;
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Audio not found');
  }
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `inline; filename="${req.params.filename}"`);
  fs.createReadStream(filePath).pipe(res);
});

// === Serve audio files ===
app.get('/audio/:filename', (req, res) => {
  const fp = '/app/data/tmp/' + req.params.filename;
  if (!fs.existsSync(fp)) return res.status(404).send('not found');
  res.setHeader('Content-Type', 'audio/mpeg');
  fs.createReadStream(fp).pipe(res);
});

// === Serve daily briefing reports as HTML ===
app.get('/report/:id', (req, res) => {
  const fp = `/app/data/reports/${req.params.id}.json`;
  if (!fs.existsSync(fp)) return res.status(404).send(`<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Not Found</title>
<style>body{font-family:system-ui;background:#000810;color:#00e5ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}h1{font-size:1.2rem;letter-spacing:0.3em;text-transform:uppercase;opacity:0.6}</style>
</head><body><h1>Reporte no encontrado</h1></body></html>`);

  let report: any;
  try {
    report = JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch {
    return res.status(500).send('<h1>Error leyendo reporte</h1>');
  }

  const ideas = report.ideas || [];

  // Helper: safely get videoScript (handle string, nested object, or missing)
  function getScript(idea: any): any {
    let s = idea.videoScript || idea.video_script || idea.script || {};
    if (typeof s === 'string') {
      try { s = JSON.parse(s); } catch { s = { voiceScript: s }; }
    }
    return s;
  }

  // Helper: escape HTML
  function esc(str: any): string {
    if (!str || typeof str !== 'string') return '-';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const scriptsHtml = ideas.map((idea: any, i: number) => {
    const s = getScript(idea);
    const hook = s.hook || idea.hook || '';
    const voiceScript = s.voiceScript || s.voice_script || s.script || '';
    const visualScript = s.visualScript || s.visual_script || s.visual || '';
    const editingScript = s.editingScript || s.editing_script || s.editing || '';
    const caption = s.caption || idea.caption || '';
    const hashtags = s.hashtags || idea.hashtags || '';
    const cta = s.cta || idea.cta || '';
    const duration = s.duration || idea.duration || '60s';
    const platform = idea.platform || '';
    const viralScore = idea.viralScore ?? idea.viral_score ?? '?';

    return `
      <div class="card">
        <div class="card-header">
          <span class="num">${i + 1}</span>
          <div class="card-title">
            <h2>${esc(idea.title || 'Sin titulo')}</h2>
            <div class="meta">
              <span class="tag platform">${esc(platform)}</span>
              <span class="tag">${esc(duration)}</span>
              <span class="tag viral">Viral: ${viralScore}/10</span>
            </div>
          </div>
        </div>

        <div class="hook">${esc(hook)}</div>

        <div class="info-row">
          <div class="info-item"><span class="info-label">Angulo</span>${esc(idea.angle)}</div>
          <div class="info-item"><span class="info-label">Por que hoy</span>${esc(idea.whyToday || idea.why_today)}</div>
        </div>

        <div class="sections">
          <details open>
            <summary><span class="icon">🎙</span> Guion de Voz</summary>
            <div class="section-content"><pre>${esc(voiceScript)}</pre></div>
          </details>
          <details>
            <summary><span class="icon">🎬</span> Guion Visual</summary>
            <div class="section-content"><pre>${esc(visualScript)}</pre></div>
          </details>
          <details>
            <summary><span class="icon">✂️</span> Guion de Edicion</summary>
            <div class="section-content"><pre>${esc(editingScript)}</pre></div>
          </details>
          <details>
            <summary><span class="icon">📝</span> Caption</summary>
            <div class="section-content"><pre>${esc(caption)}</pre></div>
          </details>
          ${hashtags && hashtags !== '-' ? `
          <div class="hashtags">${esc(hashtags)}</div>` : ''}
          ${cta && cta !== '-' ? `
          <div class="cta-box"><strong>CTA:</strong> ${esc(cta)}</div>` : ''}
        </div>
      </div>`;
  }).join('');

  // Email/trends summary
  const emailSummary = report.emailSummary || report.email_summary || '';
  const webTrends = report.webTrends || report.web_trends || '';

  const summaryHtml = (emailSummary || webTrends) ? `
    <div class="summary-section">
      ${emailSummary ? `
      <div class="summary-block">
        <h3>Newsletters del dia</h3>
        <pre>${esc(emailSummary)}</pre>
      </div>` : ''}
      ${webTrends ? `
      <div class="summary-block">
        <h3>Tendencias detectadas</h3>
        <pre>${esc(webTrends)}</pre>
      </div>` : ''}
    </div>` : '';

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Daily Briefing — ${report.date} — Jarvis</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Share Tech Mono', monospace;
      background: #000810;
      color: #b0d4e8;
      padding: 0;
      min-height: 100vh;
      background-image:
        radial-gradient(circle at 50% 0%, rgba(0,119,255,0.08) 0%, transparent 60%),
        linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px);
      background-size: 100% 100%, 40px 40px, 40px 40px;
    }

    .container { max-width: 820px; margin: 0 auto; padding: 24px 20px 60px; }

    /* Header */
    .header {
      border: 1px solid rgba(0,229,255,0.15);
      background: rgba(0,20,40,0.6);
      backdrop-filter: blur(8px);
      padding: 24px 28px;
      margin-bottom: 24px;
      position: relative;
    }
    .header::before, .header::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: #00e5ff; border-style: solid; }
    .header::before { top: 0; left: 0; border-width: 2px 0 0 2px; }
    .header::after { top: 0; right: 0; border-width: 2px 2px 0 0; }
    .header h1 {
      font-size: 1.3rem;
      color: #00e5ff;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      text-shadow: 0 0 15px rgba(0,229,255,0.4);
      margin-bottom: 6px;
    }
    .header .subtitle {
      color: rgba(0,229,255,0.4);
      font-size: 0.75rem;
      letter-spacing: 0.1em;
    }
    .jarvis-badge {
      position: absolute; bottom: 0; right: 0;
      background: rgba(0,229,255,0.08);
      border-left: 1px solid rgba(0,229,255,0.15);
      border-top: 1px solid rgba(0,229,255,0.15);
      padding: 6px 14px;
      font-size: 0.6rem;
      color: rgba(0,229,255,0.5);
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }

    /* Summary blocks */
    .summary-section { margin-bottom: 24px; }
    .summary-block {
      border: 1px solid rgba(0,229,255,0.1);
      background: rgba(0,20,40,0.4);
      padding: 16px 20px;
      margin-bottom: 12px;
    }
    .summary-block h3 {
      font-size: 0.7rem;
      color: rgba(0,229,255,0.5);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 10px;
    }
    .summary-block pre {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.82rem;
      line-height: 1.65;
      color: #8ab4c8;
    }

    /* Script cards */
    .card {
      border: 1px solid rgba(0,229,255,0.12);
      background: rgba(0,20,40,0.5);
      backdrop-filter: blur(6px);
      margin-bottom: 20px;
      padding: 20px 24px;
      position: relative;
      transition: border-color 0.3s;
    }
    .card:hover { border-color: rgba(0,229,255,0.3); }
    .card-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .num {
      background: rgba(0,229,255,0.12);
      border: 1px solid rgba(0,229,255,0.3);
      color: #00e5ff;
      width: 38px; height: 38px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 1rem;
      flex-shrink: 0;
      text-shadow: 0 0 8px rgba(0,229,255,0.5);
    }
    .card-title h2 { font-size: 1rem; color: #fff; letter-spacing: 0.02em; margin-bottom: 6px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; }
    .tag {
      display: inline-block;
      font-size: 0.65rem;
      padding: 2px 8px;
      border: 1px solid rgba(0,229,255,0.2);
      color: rgba(0,229,255,0.6);
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .tag.platform { background: rgba(0,229,255,0.08); color: #00e5ff; }
    .tag.viral { border-color: rgba(255,200,0,0.3); color: rgba(255,200,0,0.7); }

    /* Hook */
    .hook {
      background: rgba(0,229,255,0.04);
      border-left: 3px solid #00e5ff;
      padding: 14px 18px;
      font-style: italic;
      color: #00e5ff;
      font-size: 0.95rem;
      margin-bottom: 16px;
      text-shadow: 0 0 6px rgba(0,229,255,0.2);
      line-height: 1.5;
    }

    /* Info row */
    .info-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    @media (max-width: 600px) { .info-row { grid-template-columns: 1fr; } }
    .info-item { font-size: 0.82rem; color: #8ab4c8; line-height: 1.5; }
    .info-label {
      display: block;
      font-size: 0.6rem;
      color: rgba(0,229,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin-bottom: 4px;
    }

    /* Sections (details) */
    .sections { margin-top: 8px; }
    details { margin-top: 8px; border: 1px solid rgba(0,229,255,0.08); overflow: hidden; }
    summary {
      padding: 10px 16px;
      background: rgba(0,229,255,0.04);
      cursor: pointer;
      font-size: 0.8rem;
      color: #8ab4c8;
      letter-spacing: 0.05em;
      transition: background 0.2s;
      display: flex; align-items: center; gap: 8px;
    }
    summary:hover { background: rgba(0,229,255,0.08); }
    summary .icon { font-size: 0.9rem; }
    .section-content { padding: 0; }
    .section-content pre {
      padding: 16px 20px;
      white-space: pre-wrap;
      word-wrap: break-word;
      font-size: 0.82rem;
      line-height: 1.7;
      color: #8ab4c8;
      background: rgba(0,0,0,0.3);
      border-top: 1px solid rgba(0,229,255,0.05);
    }

    /* Hashtags + CTA */
    .hashtags {
      margin-top: 12px;
      padding: 10px 14px;
      background: rgba(0,229,255,0.03);
      border: 1px solid rgba(0,229,255,0.08);
      font-size: 0.78rem;
      color: rgba(0,229,255,0.5);
      line-height: 1.6;
      word-wrap: break-word;
    }
    .cta-box {
      margin-top: 8px;
      padding: 10px 14px;
      border: 1px solid rgba(255,200,0,0.15);
      background: rgba(255,200,0,0.03);
      font-size: 0.8rem;
      color: rgba(255,200,0,0.7);
    }

    /* Footer */
    .footer {
      text-align: center;
      color: rgba(0,229,255,0.2);
      font-size: 0.65rem;
      margin-top: 40px;
      padding: 20px 0;
      border-top: 1px solid rgba(0,229,255,0.08);
      letter-spacing: 0.2em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Daily Briefing — ${report.date}</h1>
      <p class="subtitle">${ideas.length} guiones | ${(report.accountsScanned || []).length} cuentas escaneadas | ${report.generatedAt || ''}</p>
      <div class="jarvis-badge">Jarvis Intelligence Engine</div>
    </div>
    ${summaryHtml}
    ${scriptsHtml}
    <div class="footer">Jarvis AI | Alexander Cast | Kreoon</div>
  </div>
</body>
</html>`);
});

// === Health check ===
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    agents: ['core', 'memory', 'content', 'ops', 'analyst', 'engine', 'brand-researcher'],
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// === Mount Web Platform API routes ===
app.use('/api/chat', webAuth, chatRouter);
app.use('/api/tts', webAuth, ttsRouter);
app.use('/api/system', webAuth, systemRouter);
app.use('/api/agents', webAuth, agentsRouter);
app.use('/api/memory', webAuth, memoryRouter);
app.use('/api/engine', webAuth, engineRouter);
app.use('/api/calendar', webAuth, calendarRouter);
app.use('/api/analyst', webAuth, analystRouter);

// Legacy endpoints (keep for backwards compat)
app.get('/api/status', webAuth, (_req, res) => {
  res.redirect('/api/system/status');
});

app.get('/api/reports', webAuth, (_req, res) => {
  res.redirect('/api/engine/reports');
});

// === Graceful shutdown: persist conversations before Docker stops the process ===
process.on('SIGTERM', () => {
  if (saveTimer) clearTimeout(saveTimer);
  const obj = Object.fromEntries(conversations);
  fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(obj), 'utf-8');
  process.exit(0);
});

// === Start server ===
app.listen(config.port, () => {
  logger.info({ port: config.port }, 'Jarvis v2 is running');
  logger.info(`Agents: core, memory, content, ops, analyst, engine, brand-researcher`);
  logger.info(`LLM primary: ${config.llm.primaryProvider}`);
  logger.info(`Web API routes: /api/chat, /api/tts, /api/system, /api/agents, /api/memory, /api/engine, /api/calendar, /api/analyst`);

  // Initialize scheduler after server is up
  initScheduler();

  // Initialize brand researcher (calendar watcher)
  import('./agents/brand-researcher/index.js').then(({ initBrandResearcher }) => {
    initBrandResearcher();
    logger.info('Brand researcher initialized');
  }).catch(err => {
    logger.error({ error: err.message }, 'Failed to initialize brand researcher');
  });

  // Register daily content engine if enabled
  if (config.dailyEngine.enabled) {
    import('./agents/engine/index.js').then(({ runDailyContentEngine }) => {
      import('./connectors/report-generator.js').then(({ postDailyReport, formatReportMarkdown, formatWhatsAppSummary }) => {
        import('./core/scheduler.js').then(({ registerJob }) => {
          import('./agents/memory/index.js').then(({ memoryAgent }) => {
            registerJob(
              'daily-content-engine',
              config.dailyEngine.cron,
              `Motor de contenido diario (${config.dailyEngine.maxIdeas} ideas, L-V 6AM)`,
              async () => {
                const report = await runDailyContentEngine((msg) => {
                  logger.info({ engine: true }, msg);
                });

                // Post to web app
                await postDailyReport(report).catch(() => {});

                // Save to Obsidian
                const date = report.date;
                const md = formatReportMarkdown(report);
                await memoryAgent.handle({
                  agent: 'memory',
                  message: {
                    from: config.dailyEngine.ownerPhone,
                    type: 'text',
                    text: `[ENGINE] Guardar reporte diario`,
                    timestamp: Date.now(),
                    messageId: `engine_${date}`,
                  },
                  member: { phone: config.dailyEngine.ownerPhone, name: 'Jarvis Engine', role: 'owner', email: 'founder@kreoon.com' },
                  intent: 'save_note',
                }).catch(() => {});

                // Also save directly to CouchDB as fallback
                try {
                  const axios = (await import('axios')).default;
                  const couchUrl = config.couchdb.url || 'http://couchdb:5984';
                  const obsidianDb = process.env.OBSIDIAN_DB || 'obsidian-vault';
                  const docId = `jarvis_daily-engine_${date}.md`.replace(/\//g, '_');
                  const auth = config.couchdb.user
                    ? { Authorization: `Basic ${Buffer.from(`${config.couchdb.user}:${config.couchdb.pass}`).toString('base64')}` }
                    : {};

                  let rev: string | undefined;
                  try {
                    const existing = await axios.get(`${couchUrl}/${obsidianDb}/${encodeURIComponent(docId)}`, { headers: { ...auth } });
                    rev = existing.data._rev;
                  } catch { /* doc doesn't exist */ }

                  const doc: Record<string, unknown> = {
                    _id: docId,
                    path: `jarvis/daily-engine/${date}.md`,
                    content: md,
                    updatedAt: new Date().toISOString(),
                  };
                  if (rev) doc._rev = rev;

                  await axios.put(`${couchUrl}/${obsidianDb}/${encodeURIComponent(docId)}`, doc, {
                    headers: { 'Content-Type': 'application/json', ...auth },
                  });
                } catch (e: any) {
                  logger.warn({ error: e.message }, 'Failed to save engine report to Obsidian');
                }

                // Send WhatsApp summary
                const summary = formatWhatsAppSummary(report);
                await sendText(config.dailyEngine.ownerPhone, summary).catch(() => {});

                logger.info({ date, ideas: report.ideas.length }, 'Daily content engine completed');
              },
            );
            logger.info({ cron: config.dailyEngine.cron }, 'Daily content engine registered');
          });
        });
      });
    }).catch(err => {
      logger.error({ error: err.message }, 'Failed to register daily content engine');
    });
  }
});
