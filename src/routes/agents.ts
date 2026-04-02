import { Router } from 'express';
import { coreAgent } from '../agents/core/index.js';
import { memoryAgent } from '../agents/memory/index.js';
import { contentAgent } from '../agents/content/index.js';
import { opsAgent } from '../agents/ops/index.js';
import { analystAgent } from '../agents/analyst/index.js';
import { routeMessage } from '../core/router.js';
import { logger } from '../shared/logger.js';
import { team } from '../shared/config.js';
import { incrementMessages, incrementAgent } from '../shared/metrics.js';
import type { WAMessage, AgentRequest, AgentName, ConversationContext } from '../shared/types.js';

let getContext: (phone: string) => ConversationContext;
let addToContext: (phone: string, role: 'user' | 'assistant', content: string) => void;

export function initAgentsRouter(
  ctx: { getContext: typeof getContext; addToContext: typeof addToContext },
) {
  getContext = ctx.getContext;
  addToContext = ctx.addToContext;
}

const agentMap: Record<string, any> = {
  core: coreAgent,
  memory: memoryAgent,
  content: contentAgent,
  ops: opsAgent,
  analyst: analystAgent,
};

const agentDescriptions: Record<string, { name: string; desc: string; tools: string[] }> = {
  core: { name: 'Core Agent', desc: 'Jefe de staff, conversacion general, delegacion inteligente', tools: ['route_to_agent', 'web_search'] },
  memory: { name: 'Memory Agent', desc: 'Memoria persistente, Obsidian vault, CouchDB', tools: ['store_memory', 'retrieve_memory', 'search_memory', 'list_memories', 'save_note', 'read_note', 'search_notes', 'list_notes'] },
  content: { name: 'Content Agent', desc: 'Generacion creativa de contenido, copy, guiones', tools: ['web_search', 'generate_caption', 'content_calendar'] },
  ops: { name: 'Ops Agent', desc: 'Email, calendario, Meta Ads, GitHub, recordatorios', tools: ['send_email', 'list_calendar_events', 'create_calendar_event', 'send_whatsapp', 'create_reminder', 'list_reminders'] },
  analyst: { name: 'Analyst Agent', desc: 'Analisis de redes sociales, A/B testing, Gemini Vision', tools: ['extract_content', 'analyze_strategy', 'replicate_content', 'generate_pdf', 'batch_analyze'] },
  engine: { name: 'Engine Agent', desc: 'Motor de inteligencia diaria, escanea emails + tendencias', tools: ['scan_emails', 'search_trends', 'generate_ideas'] },
  'brand-researcher': { name: 'Brand Researcher', desc: 'Investigacion de marcas, scraping, diagnosticos', tools: ['scrape_profile', 'analyze_posts', 'enrich_brand', 'generate_diagnosis'] },
};

const router = Router();

// === List all agents with status ===
router.get('/', (_req, res) => {
  const agents = Object.entries(agentDescriptions).map(([id, info]) => ({
    id,
    ...info,
    status: 'active',
  }));
  res.json(agents);
});

// === Individual agent status ===
router.get('/:name/status', (req, res) => {
  const { name } = req.params;
  const info = agentDescriptions[name];
  if (!info) {
    return res.status(404).json({ error: `Agent "${name}" not found.` });
  }
  res.json({
    id: name,
    ...info,
    status: 'active',
    loaded: !!agentMap[name],
  });
});

// === Direct agent interaction ===
router.post('/:name/interact', async (req, res) => {
  const { name } = req.params;
  const { message, from = '573132947776' } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message required.' });
  }

  if (!agentDescriptions[name]) {
    return res.status(404).json({ error: `Agent "${name}" not found.` });
  }

  const member = team[from] || team['573132947776'];
  const messageId = `web_agent_${Date.now()}`;

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
    agent: name as AgentName,
    message: waMessage,
    member,
    context: getContext(from),
  };

  // SSE for progress
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const onProgress = async (text: string) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'progress', text })}\n\n`);
    }
  };

  try {
    // Route through the main router so pre-routing logic still works
    const response = await routeMessage(agentReq, onProgress);
    addToContext(from, 'assistant', response.text);
    incrementAgent(name);

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'complete', text: response.text, id: messageId })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    logger.error({ error: err.message, agent: name }, 'Agent interaction error');
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: 'Error interno.' })}\n\n`);
      res.end();
    }
  }
});

export { router as agentsRouter };
