import { Router } from 'express';
import { analystAgent } from '../agents/analyst/index.js';
import { routeMessage } from '../core/router.js';
import { logger } from '../shared/logger.js';
import { team } from '../shared/config.js';
import { incrementMessages, incrementAgent } from '../shared/metrics.js';
import type { WAMessage, AgentRequest, ConversationContext } from '../shared/types.js';

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

export { router as analystRouter };
