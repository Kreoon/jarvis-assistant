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
import type { WAMessage, AgentRequest, ConversationContext } from './shared/types.js';

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
    res.status(400).send(`<h1>❌ Autorización cancelada</h1><p>${error}</p>`);
    return;
  }

  if (!code || !account) {
    res.status(400).send('Faltan parámetros');
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
      res.status(400).send('<h1>❌ Error</h1><p>No se obtuvo refresh token. Intenta de nuevo.</p>');
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
      `✅ *Cuenta Google conectada*\n\n• Nombre: ${account}\n• Email: ${userInfo.email}\n• Persona: ${userInfo.name || 'N/A'}\n\nYa puedes usar \`account: "${account}"\` en calendario y email.`
    ).catch(() => {});

    res.send(`
      <html>
        <head><meta charset="utf-8"><title>Jarvis - Cuenta conectada</title></head>
        <body style="font-family: system-ui; max-width: 500px; margin: 80px auto; text-align: center;">
          <h1>✅ Cuenta conectada</h1>
          <p><strong>${userInfo.email}</strong> conectada como <strong>"${account}"</strong></p>
          <p style="color: #666;">Puedes cerrar esta ventana. Jarvis ya tiene acceso a tu calendario y email.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    logger.error({ error: err.message, account }, 'OAuth callback error');
    res.status(500).send(`<h1>❌ Error</h1><p>${err.message}</p>`);
  }
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

// === Web Platform API ===

// System Status (HUD Diagnostic)
app.get('/api/status', webAuth, (_req, res) => {
  res.json({
    status: 'online',
    system: 'JARVIS-V2',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    agents: [
      { name: 'core', status: 'active', desc: 'Central Processing Unit' },
      { name: 'memory', status: 'active', desc: 'LTM & Context Retrieval' },
      { name: 'content', status: 'active', desc: 'Creative Content Engine' },
      { name: 'ops', status: 'active', desc: 'Operational Skills & Tools' },
      { name: 'analyst', status: 'active', desc: 'Social Data Analyst' },
      { name: 'engine', status: 'active', desc: 'Daily Intelligence Engine' },
    ],
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  });
});

// Chat Interface
app.post('/api/chat', webAuth, async (req, res) => {
  const { message, from = '573132947776' } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message payload missing.' });
  }

  const member = team[from] || team['573132947776'];
  const messageId = `web_${Date.now()}`;

  const waMessage: WAMessage = {
    from,
    name: member.name,
    type: 'text',
    text: message,
    timestamp: Date.now(),
    messageId,
  };

  addToContext(from, 'user', message);

  const agentReq: AgentRequest = {
    agent: 'core',
    message: waMessage,
    member,
    context: getContext(from),
  };

  try {
    const response = await routeMessage(agentReq);
    addToContext(from, 'assistant', response.text);
    res.json({
      id: messageId,
      response: response.text,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Web API Chat error');
    res.status(500).json({ error: 'JARVIS core encountered an internal error.' });
  }
});

// Reports Browser (Engine Output)
app.get('/api/reports', webAuth, async (_req, res) => {
  try {
    const couchUrl = config.couchdb.url || 'http://couchdb:5984';
    const obsidianDb = process.env.OBSIDIAN_DB || 'obsidian-vault';
    const auth = config.couchdb.user
      ? { Authorization: `Basic ${Buffer.from(`${config.couchdb.user}:${config.couchdb.pass}`).toString('base64')}` }
      : {};

    const { data } = await axios.get(`${couchUrl}/${obsidianDb}/_all_docs`, {
      params: {
        include_docs: true,
        startkey: '"jarvis_daily-engine_"',
        endkey: '"jarvis_daily-engine_\ufff0"',
      },
      headers: { ...auth },
    });

    const reports = data.rows.map((row: any) => ({
      id: row.id,
      date: row.id.split('_').pop()?.replace('.md', ''),
      content: row.doc.content,
      updatedAt: row.doc.updatedAt,
    })).sort((a: any, b: any) => b.id.localeCompare(a.id));

    res.json(reports);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch reports from CouchDB');
    res.json([]); // Return empty list on failure
  }
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
  logger.info(`Agents: core, memory, content, ops, analyst, engine`);
  logger.info(`LLM primary: ${config.llm.primaryProvider}`);

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
