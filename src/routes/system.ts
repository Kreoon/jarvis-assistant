import { Router } from 'express';
import { getJobs } from '../core/scheduler.js';
import { getLogs } from '../shared/log-buffer.js';
import { getMetrics } from '../shared/metrics.js';
import { config } from '../shared/config.js';

const router = Router();

// === System status (enhanced) ===
router.get('/status', (_req, res) => {
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
      { name: 'brand-researcher', status: 'active', desc: 'Brand Research & Diagnosis' },
    ],
    providers: {
      anthropic: !!config.llm.anthropicKey,
      gemini: !!config.llm.geminiKey,
      openai: !!config.llm.openaiKey,
      elevenlabs: !!config.elevenlabs.apiKey,
      perplexity: !!config.perplexity.apiKey,
    },
    primaryLLM: config.llm.primaryProvider,
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
  });
});

// === System logs (from ring buffer) ===
router.get('/logs', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  res.json(getLogs(limit));
});

// === System metrics ===
router.get('/metrics', (_req, res) => {
  res.json(getMetrics());
});

// === Scheduled jobs ===
router.get('/jobs', (_req, res) => {
  res.json(getJobs());
});

export { router as systemRouter };
