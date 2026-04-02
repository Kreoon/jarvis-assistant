import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

const MEMORY_BASE_DIR = '/app/data/memory';
const OBSIDIAN_DB = process.env.OBSIDIAN_DB || 'obsidian-vault';

function couchHeaders() {
  const { user, pass } = config.couchdb;
  const auth = user && pass
    ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
    : {};
  return { 'Content-Type': 'application/json', ...auth };
}

function couchBase(): string {
  return config.couchdb.url || 'http://localhost:5984';
}

const router = Router();

// === Search memories (local filesystem) ===
router.post('/search', async (req, res) => {
  const { query, namespace } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Query required.' });
  }

  const queryLower = query.toLowerCase();
  const results: { namespace: string; key: string; value: string }[] = [];

  try {
    const namespacesToSearch: string[] = [];
    if (namespace) {
      namespacesToSearch.push(namespace);
    } else {
      const entries = await fs.readdir(MEMORY_BASE_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) namespacesToSearch.push(entry.name);
      }
    }

    for (const ns of namespacesToSearch) {
      const nsDir = path.join(MEMORY_BASE_DIR, ns);
      try {
        const files = await fs.readdir(nsDir);
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          try {
            const raw = await fs.readFile(path.join(nsDir, file), 'utf-8');
            const data = JSON.parse(raw);
            const combined = `${data.key} ${data.value}`.toLowerCase();
            if (combined.includes(queryLower)) {
              results.push({ namespace: ns, key: data.key, value: data.value });
            }
          } catch { /* skip malformed */ }
        }
      } catch { /* skip missing dirs */ }
    }

    res.json({ results, total: results.length });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Memory search error');
    res.json({ results: [], total: 0 });
  }
});

// === List memories ===
router.get('/list', async (req, res) => {
  const namespace = (req.query.namespace as string) || 'global';

  try {
    const nsDir = path.join(MEMORY_BASE_DIR, namespace);
    const files = await fs.readdir(nsDir);
    const memories = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(nsDir, file), 'utf-8');
        const data = JSON.parse(raw);
        memories.push({ key: data.key, namespace, updatedAt: data.updatedAt });
      } catch { /* skip */ }
    }

    res.json({ memories, total: memories.length });
  } catch {
    res.json({ memories: [], total: 0 });
  }
});

// === Search Obsidian notes ===
router.post('/notes/search', async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query required.' });
  }

  try {
    const { data } = await axios.post(
      `${couchBase()}/${OBSIDIAN_DB}/_find`,
      {
        selector: { content: { $regex: `(?i)${query}` } },
        fields: ['_id', 'path', 'updatedAt'],
        limit: 20,
      },
      { headers: couchHeaders() },
    );
    res.json({ results: data.docs || [] });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Obsidian notes search error');
    res.json({ results: [] });
  }
});

export { router as memoryRouter };
