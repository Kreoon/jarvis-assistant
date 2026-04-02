import { Router } from 'express';
import multer from 'multer';
import { routeMessage } from '../core/router.js';
import { transcribeAudioBuffer } from '../connectors/whisper.js';
import { logger } from '../shared/logger.js';
import { team } from '../shared/config.js';
import { incrementMessages, incrementAgent } from '../shared/metrics.js';
import type { WAMessage, AgentRequest, ConversationContext } from '../shared/types.js';

// Conversation state is passed in from server.ts
let getContext: (phone: string) => ConversationContext;
let addToContext: (phone: string, role: 'user' | 'assistant', content: string) => void;

export function initChatRouter(
  ctx: { getContext: typeof getContext; addToContext: typeof addToContext },
) {
  getContext = ctx.getContext;
  addToContext = ctx.addToContext;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const router = Router();

// === Synchronous chat (existing) ===
router.post('/', async (req, res) => {
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
    platform: 'web',
  };

  addToContext(from, 'user', message);
  incrementMessages();

  const agentReq: AgentRequest = {
    agent: 'core',
    message: waMessage,
    member,
    context: getContext(from),
  };

  try {
    const response = await routeMessage(agentReq);
    addToContext(from, 'assistant', response.text);
    incrementAgent('core');
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

// === SSE Streaming chat ===
router.post('/stream', async (req, res) => {
  const { message, from = '573132947776' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message payload missing.' });
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable Nginx buffering
  });

  const member = team[from] || team['573132947776'];
  const messageId = `web_${Date.now()}`;

  const waMessage: WAMessage = {
    from,
    name: member.name,
    type: 'text',
    text: message,
    timestamp: Date.now(),
    messageId,
    platform: 'web',
  };

  addToContext(from, 'user', message);
  incrementMessages();

  const agentReq: AgentRequest = {
    agent: 'core',
    message: waMessage,
    member,
    context: getContext(from),
  };

  // Progress callback sends SSE events
  const onProgress = async (text: string) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'progress', text })}\n\n`);
    }
  };

  try {
    const response = await routeMessage(agentReq, onProgress);
    addToContext(from, 'assistant', response.text);
    incrementAgent('core');

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'complete', text: response.text, id: messageId })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Web API Chat stream error');
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: 'Error interno de JARVIS.' })}\n\n`);
      res.end();
    }
  }
});

// === Audio chat (transcribe + process) ===
router.post('/audio', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file required.' });
  }

  const from = (req.body.from as string) || '573132947776';
  const member = team[from] || team['573132947776'];
  const messageId = `web_audio_${Date.now()}`;

  try {
    // Transcribe
    const transcription = await transcribeAudioBuffer(req.file.buffer, req.file.mimetype);

    if (!transcription || transcription.startsWith('(')) {
      return res.json({ id: messageId, transcription: '', response: 'No pude transcribir el audio.', timestamp: Date.now() });
    }

    // Process as text message
    const waMessage: WAMessage = {
      from,
      name: member.name,
      type: 'text',
      text: transcription,
      timestamp: Date.now(),
      messageId,
      platform: 'web',
    };

    addToContext(from, 'user', transcription);
    incrementMessages();

    const agentReq: AgentRequest = {
      agent: 'core',
      message: waMessage,
      member,
      context: getContext(from),
    };

    const response = await routeMessage(agentReq);
    addToContext(from, 'assistant', response.text);
    incrementAgent('core');

    res.json({
      id: messageId,
      transcription,
      response: response.text,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Web API Audio chat error');
    res.status(500).json({ error: 'Error procesando audio.' });
  }
});

// === File upload + chat (images for Gemini Vision) ===
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'File required.' });
  }

  const from = (req.body.from as string) || '573132947776';
  const message = (req.body.message as string) || 'Analiza esta imagen';
  const member = team[from] || team['573132947776'];
  const messageId = `web_upload_${Date.now()}`;

  try {
    // For images, include base64 in the message for Gemini Vision
    const isImage = req.file.mimetype.startsWith('image/');
    let processedMessage = message;

    if (isImage) {
      const base64 = req.file.buffer.toString('base64');
      processedMessage = `${message}\n\n[IMAGEN ADJUNTA: data:${req.file.mimetype};base64,${base64}]`;
    }

    const waMessage: WAMessage = {
      from,
      name: member.name,
      type: isImage ? 'image' : 'document',
      text: processedMessage,
      caption: message,
      timestamp: Date.now(),
      messageId,
      platform: 'web',
    };

    addToContext(from, 'user', message);
    incrementMessages();

    const agentReq: AgentRequest = {
      agent: 'core',
      message: waMessage,
      member,
      context: getContext(from),
    };

    const response = await routeMessage(agentReq);
    addToContext(from, 'assistant', response.text);
    incrementAgent('core');

    res.json({
      id: messageId,
      response: response.text,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Web API Upload chat error');
    res.status(500).json({ error: 'Error procesando archivo.' });
  }
});

export { router as chatRouter };
