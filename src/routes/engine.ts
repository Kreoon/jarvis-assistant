import { Router } from 'express';
import axios from 'axios';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

const router = Router();

function couchHeaders() {
  const { user, pass } = config.couchdb;
  const auth = user && pass
    ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
    : {};
  return { ...auth };
}

function couchBase(): string {
  return config.couchdb.url || 'http://localhost:5984';
}

const obsidianDb = process.env.OBSIDIAN_DB || 'obsidian-vault';

// === Latest engine report ===
router.get('/latest', async (_req, res) => {
  try {
    const { data } = await axios.get(`${couchBase()}/${obsidianDb}/_all_docs`, {
      params: {
        include_docs: true,
        startkey: '"jarvis_daily-engine_"',
        endkey: '"jarvis_daily-engine_\ufff0"',
        descending: false,
        limit: 50,
      },
      headers: couchHeaders(),
    });

    const reports = data.rows
      .map((row: any) => ({
        id: row.id,
        date: row.id.split('_').pop()?.replace('.md', ''),
        content: row.doc.content,
        updatedAt: row.doc.updatedAt,
      }))
      .sort((a: any, b: any) => b.id.localeCompare(a.id));

    res.json(reports[0] || null);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch latest engine report');
    res.json(null);
  }
});

// === All reports ===
router.get('/reports', async (_req, res) => {
  try {
    const { data } = await axios.get(`${couchBase()}/${obsidianDb}/_all_docs`, {
      params: {
        include_docs: true,
        startkey: '"jarvis_daily-engine_"',
        endkey: '"jarvis_daily-engine_\ufff0"',
      },
      headers: couchHeaders(),
    });

    const reports = data.rows
      .map((row: any) => ({
        id: row.id,
        date: row.id.split('_').pop()?.replace('.md', ''),
        content: row.doc.content,
        updatedAt: row.doc.updatedAt,
      }))
      .sort((a: any, b: any) => b.id.localeCompare(a.id));

    res.json(reports);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to fetch reports');
    res.json([]);
  }
});

// === Trigger engine manually (SSE for progress) ===
router.post('/trigger', async (_req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const { runDailyContentEngine } = await import('../agents/engine/index.js');
    const { postDailyReport, formatReportMarkdown, formatWhatsAppSummary } = await import('../connectors/report-generator.js');

    const onProgress = (msg: string) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'progress', text: msg })}\n\n`);
      }
    };

    const report = await runDailyContentEngine(onProgress);

    // Post to CouchDB
    await postDailyReport(report).catch(() => {});

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'complete', report: { date: report.date, ideas: report.ideas.length, generatedAt: report.generatedAt } })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Engine trigger error');
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', text: `Error: ${err.message}` })}\n\n`);
      res.end();
    }
  }
});

export { router as engineRouter };
