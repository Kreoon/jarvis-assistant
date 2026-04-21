import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { analystAgent } from '../agents/analyst/index.js';
import { routeMessage } from '../core/router.js';
import { logger } from '../shared/logger.js';
import { team } from '../shared/config.js';
import { incrementMessages, incrementAgent } from '../shared/metrics.js';
import type { WAMessage, AgentRequest, ConversationContext } from '../shared/types.js';

const upload = multer({
  dest: '/app/data/tmp/',
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

let getContext: (phone: string) => ConversationContext;
let addToContext: (phone: string, role: 'user' | 'assistant', content: string) => void;

export function initAnalystRouter(
  ctx: { getContext: typeof getContext; addToContext: typeof addToContext },
) {
  getContext = ctx.getContext;
  addToContext = ctx.addToContext;
}

const router = Router();

// === Analyze social media URL (SSE) ===
router.post('/analyze', async (req, res) => {
  const { url, message, from = '573132947776' } = req.body;

  if (!url && !message) {
    return res.status(400).json({ error: 'URL or message required.' });
  }

  const member = team[from] || team['573132947776'];
  const messageId = `web_analyst_${Date.now()}`;
  const text = url ? `Analiza este contenido: ${url}` : message;

  // SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const waMessage: WAMessage = {
    from,
    name: member.name,
    type: 'text',
    text,
    timestamp: Date.now(),
    messageId,
    platform: 'web',
  };

  addToContext(from, 'user', text);
  incrementMessages();

  const agentReq: AgentRequest = {
    agent: 'analyst',
    message: waMessage,
    member,
    context: getContext(from),
  };

  const onProgress = async (progressText: string) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'progress', text: progressText })}\n\n`);
    }
  };

  try {
    const response = await routeMessage(agentReq, onProgress);
    addToContext(from, 'assistant', response.text);
    incrementAgent('analyst');

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'complete', text: response.text, id: messageId })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Analyst route error');
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: 'Error en el analisis.' })}\n\n`);
      res.end();
    }
  }
});

// === REST directo: /analyze/direct (URL JSON o video multipart) ===
// Respuesta JSON (no SSE). Si viene { topic, objective, platform, angle, useAlexVoice }
// ejecuta opción B; si no, solo devuelve el análisis inicial (menú wizard).
router.post('/analyze/direct', upload.single('video'), async (req, res) => {
  const body = req.body || {};
  const hasUrl = !!body.url;
  const hasVideo = !!req.file;

  if (!hasUrl && !hasVideo) {
    return res.status(400).json({ error: 'Requiere "url" (JSON) o "video" (multipart form-data)' });
  }

  const from = body.phone || body.from || 'rest-client';
  const member = team[from] || team['573132947776'];
  const messageId = `rest_${Date.now()}`;

  const waMessage: WAMessage = {
    from,
    name: member?.name || body.name || 'REST',
    type: hasVideo ? 'video' : 'text',
    text: hasUrl ? body.url : '',
    mediaId: undefined,
    mimeType: hasVideo ? (req.file!.mimetype || 'video/mp4') : undefined,
    caption: body.caption || '',
    timestamp: Date.now(),
    messageId,
    platform: 'web',
  };

  const agentReq: AgentRequest = {
    agent: 'analyst',
    message: waMessage,
    member,
    context: getContext(from),
  };

  if (hasVideo) {
    agentReq.directMedia = {
      localFilePath: req.file!.path,
      mimeType: req.file!.mimetype || 'video/mp4',
      caption: body.caption || '',
      isVideo: true,
    };
  }

  try {
    incrementMessages();
    addToContext(from, 'user', waMessage.text || '(video directo)');

    // PASO 1: init (descarga/upload + menú)
    const initResponse = await analystAgent.handle(agentReq);
    incrementAgent('analyst');

    // PASO 2: si viene topic → ejecutar opción B automáticamente
    if (body.topic) {
      const wizardInput = [
        `B ${body.topic}`,
        body.objective || 'alcance',
        body.platform || 'Instagram',
        body.angle || '',
        body.useAlexVoice === true || body.useAlexVoice === 'true' ? 'alex' : '',
      ].join(', ');

      const followUpReq: AgentRequest = {
        agent: 'analyst',
        message: { ...waMessage, text: wizardInput, type: 'text' },
        member,
        context: getContext(from),
      };
      const replicaResponse = await analystAgent.handle(followUpReq);
      addToContext(from, 'assistant', replicaResponse.text);
      return res.json({ init: initResponse.text, replica: replicaResponse.text });
    }

    // PASO 2 alterno: analyzeOnly=true → ejecutar opción A
    if (body.analyzeOnly === true || body.analyzeOnly === 'true') {
      const analyzeReq: AgentRequest = {
        agent: 'analyst',
        message: { ...waMessage, text: 'A', type: 'text' },
        member,
        context: getContext(from),
      };
      const analyzeResponse = await analystAgent.handle(analyzeReq);
      addToContext(from, 'assistant', analyzeResponse.text);
      return res.json({ init: initResponse.text, analysis: analyzeResponse.text });
    }

    addToContext(from, 'assistant', initResponse.text);
    return res.json({ init: initResponse.text });
  } catch (err: any) {
    logger.error({ err: err.message, stack: err.stack }, 'Analyst direct route error');
    // Cleanup file temporal si falló
    if (hasVideo && req.file?.path) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({ error: err.message });
  }
});

// === Refinar una versión específica (feedback loop por REST) ===
// POST /analyze/refine  { from, version: "V2", hint: "hook más emocional" }
router.post('/analyze/refine', async (req, res) => {
  const { from = 'rest-client', version, hint } = req.body || {};
  if (!version || !hint) {
    return res.status(400).json({ error: 'Requiere "version" (V1-V5) y "hint"' });
  }
  const member = team[from] || team['573132947776'];
  const waMessage: WAMessage = {
    from,
    name: member?.name || 'REST',
    type: 'text',
    text: `mejora ${version} ${hint}`,
    timestamp: Date.now(),
    messageId: `rest_refine_${Date.now()}`,
    platform: 'web',
  };
  const agentReq: AgentRequest = {
    agent: 'analyst',
    message: waMessage,
    member,
    context: getContext(from),
  };
  try {
    const response = await analystAgent.handle(agentReq);
    return res.json({ refined: response.text });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Analyst refine error');
    return res.status(500).json({ error: err.message });
  }
});

export { router as analystRouter };
