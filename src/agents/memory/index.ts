import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import { BaseAgent } from '../../core/base-agent.js';
import { config } from '../../shared/config.js';
import type { AgentRequest, LLMTool } from '../../shared/types.js';

const MEMORY_BASE_DIR = '/app/data/memory';
const OBSIDIAN_DB = process.env.OBSIDIAN_DB || 'obsidian-vault';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function memoryPath(namespace: string, key: string): string {
  return path.join(MEMORY_BASE_DIR, namespace, `${key}.json`);
}

function couchHeaders() {
  const { user, pass } = config.couchdb;
  const auth =
    user && pass
      ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
      : {};
  return { 'Content-Type': 'application/json', ...auth };
}

function couchBase(): string {
  return config.couchdb.url || 'http://localhost:5984';
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const tools: LLMTool[] = [
  {
    name: 'store_memory',
    description: 'Almacena un par clave-valor en la memoria persistente del agente.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Clave única para identificar la memoria' },
        value: { type: 'string', description: 'Valor a almacenar' },
        namespace: { type: 'string', description: 'Espacio de nombres (default: "global")' },
      },
      required: ['key', 'value'],
    },
  },
  {
    name: 'retrieve_memory',
    description: 'Recupera un valor almacenado por su clave.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Clave a recuperar' },
        namespace: { type: 'string', description: 'Espacio de nombres (default: "global")' },
      },
      required: ['key'],
    },
  },
  {
    name: 'search_memory',
    description: 'Busca en la memoria por contenido textual.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en las memorias' },
        namespace: { type: 'string', description: 'Espacio de nombres donde buscar (opcional)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_memories',
    description: 'Lista todas las claves almacenadas en un namespace.',
    parameters: {
      type: 'object',
      properties: {
        namespace: { type: 'string', description: 'Espacio de nombres a listar (default: "global")' },
      },
    },
  },
  {
    name: 'save_note',
    description: 'Guarda una nota en el vault de Obsidian via CouchDB.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta de la nota dentro del vault (ej: "proyectos/jarvis.md")' },
        content: { type: 'string', description: 'Contenido de la nota en formato Markdown' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_note',
    description: 'Lee una nota desde el vault de Obsidian.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta de la nota dentro del vault' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_notes',
    description: 'Busca notas en el vault de Obsidian por contenido o título.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Texto a buscar en las notas' },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_notes',
    description: 'Lista notas del vault de Obsidian con paginación.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Número máximo de notas a listar (por defecto 50)' },
        startkey: { type: 'string', description: 'Doc ID desde donde empezar la lista (para paginación)' },
        endkey: { type: 'string', description: 'Doc ID donde terminar la lista (para filtrar por prefijo)' },
      },
    },
  },
  {
    name: 'verify_obsidian',
    description: 'Verifica la conexión con CouchDB/Obsidian y reporta estado del vault.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];

// ─── Tool handlers ───────────────────────────────────────────────────────────

const toolHandlers: Record<string, (args: Record<string, unknown>, req: AgentRequest) => Promise<unknown>> = {

  async store_memory(args) {
    const key = args.key as string;
    const value = args.value as string;
    const namespace = (args.namespace as string | undefined) || 'global';
    const dir = path.join(MEMORY_BASE_DIR, namespace);
    await ensureDir(dir);
    const filePath = memoryPath(namespace, key);
    const data = {
      key,
      value,
      namespace,
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, key, namespace };
  },

  async retrieve_memory(args) {
    const key = args.key as string;
    const namespace = (args.namespace as string | undefined) || 'global';
    const filePath = memoryPath(namespace, key);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return { found: true, key, value: data.value, updatedAt: data.updatedAt };
    } catch {
      return { found: false, key, namespace };
    }
  },

  async search_memory(args) {
    const query = (args.query as string).toLowerCase();
    const namespace = args.namespace as string | undefined;
    const results: { namespace: string; key: string; value: string; score: number }[] = [];

    const namespacesToSearch: string[] = [];
    if (namespace) {
      namespacesToSearch.push(namespace);
    } else {
      try {
        const entries = await fs.readdir(MEMORY_BASE_DIR, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) namespacesToSearch.push(entry.name);
        }
      } catch {
        return { results: [] };
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
            if (combined.includes(query)) {
              results.push({ namespace: ns, key: data.key, value: data.value, score: 1 });
            }
          } catch {
            // skip malformed files
          }
        }
      } catch {
        // skip missing directories
      }
    }

    return { results, total: results.length };
  },

  async list_memories(args) {
    const namespace = (args.namespace as string | undefined) || 'global';
    const nsDir = path.join(MEMORY_BASE_DIR, namespace);
    try {
      const files = await fs.readdir(nsDir);
      const keys = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''));
      return { namespace, keys, total: keys.length };
    } catch {
      return { namespace, keys: [], total: 0 };
    }
  },

  async save_note(args) {
    const notePath = args.path as string;
    const content = args.content as string;
    const docId = notePath.replace(/\//g, '_').replace(/\s+/g, '-');

    const url = `${couchBase()}/${OBSIDIAN_DB}/${encodeURIComponent(docId)}`;
    const headers = couchHeaders();

    // Check if document exists to get _rev
    let rev: string | undefined;
    try {
      const existing = await axios.get(url, { headers });
      rev = existing.data._rev as string;
    } catch {
      // Document doesn't exist yet
    }

    const doc: Record<string, unknown> = {
      _id: docId,
      path: notePath,
      content,
      updatedAt: new Date().toISOString(),
    };
    if (rev) doc._rev = rev;

    await axios.put(url, doc, { headers });
    return { success: true, path: notePath, docId };
  },

  async read_note(args) {
    const notePath = args.path as string;
    const docId = notePath.replace(/\//g, '_').replace(/\s+/g, '-');
    const url = `${couchBase()}/${OBSIDIAN_DB}/${encodeURIComponent(docId)}`;

    try {
      const res = await axios.get(url, { headers: couchHeaders() });
      return { found: true, path: notePath, content: res.data.content, updatedAt: res.data.updatedAt };
    } catch {
      return { found: false, path: notePath };
    }
  },

  async search_notes(args) {
    const query = (args.query as string).toLowerCase();
    const url = `${couchBase()}/${OBSIDIAN_DB}/_all_docs?include_docs=true`;

    try {
      const res = await axios.get(url, { headers: couchHeaders() });
      const rows = res.data.rows as { doc: Record<string, unknown> }[];
      const matches = rows
        .filter((row) => {
          if (!row.doc) return false;
          const content = String(row.doc.content || '').toLowerCase();
          const notePath = String(row.doc.path || '').toLowerCase();
          return content.includes(query) || notePath.includes(query);
        })
        .map((row) => ({
          path: row.doc.path,
          snippet: String(row.doc.content || '').slice(0, 200),
          updatedAt: row.doc.updatedAt,
        }));
      return { results: matches, total: matches.length };
    } catch (err: any) {
      return { results: [], error: err.message };
    }
  },

  async list_notes(args) {
    const limit = (args.limit as number) ?? 50;
    const startkey = args.startkey as string | undefined;
    const endkey = args.endkey as string | undefined;

    const params: Record<string, unknown> = { limit, include_docs: false };
    if (startkey) params.startkey = JSON.stringify(startkey);
    if (endkey) params.endkey = JSON.stringify(endkey);

    try {
      const res = await axios.get(
        `${couchBase()}/${OBSIDIAN_DB}/_all_docs`,
        { headers: couchHeaders(), params },
      );
      const rows = (res.data.rows as { id: string; key: string }[])
        .filter(r => !r.id.startsWith('_design/'))
        .map(r => ({ id: r.id, path: r.id.replace(/_/g, '/') }));
      return { notes: rows, total: res.data.total_rows, returned: rows.length };
    } catch (err: any) {
      return { notes: [], error: err.message };
    }
  },

  async verify_obsidian() {
    const base = couchBase();
    const headers = couchHeaders();

    try {
      // Check CouchDB is up
      const upRes = await axios.get(`${base}/_up`, { headers });
      const isUp = upRes.data?.status === 'ok';

      // Check vault database
      const dbRes = await axios.get(`${base}/${OBSIDIAN_DB}`, { headers });
      const docCount = dbRes.data?.doc_count ?? 0;
      const dbName = dbRes.data?.db_name ?? OBSIDIAN_DB;

      return {
        status: 'ok',
        couchdb: isUp,
        database: dbName,
        docCount,
        url: base,
        note: 'Obsidian LiveSync uses file path as _id directly (slashes replaced with underscores)',
      };
    } catch (err: any) {
      return {
        status: 'error',
        error: err.message,
        url: base,
        database: OBSIDIAN_DB,
      };
    }
  },
};

// ─── Agent ───────────────────────────────────────────────────────────────────

class MemoryAgent extends BaseAgent {
  constructor() {
    super({
      name: 'memory',
      systemPrompt: `Eres el agente de memoria de Jarvis, el sistema de inteligencia del equipo Kreoon.

Tu trabajo es almacenar, buscar y recuperar información de forma inteligente y organizada.

Capacidades:
- Guardar y recuperar memorias clave-valor organizadas por namespace
- Guardar notas en el vault de Obsidian (sincronizado via CouchDB)
- Buscar información en memoria local y en las notas de Obsidian
- Listar notas del vault con paginación (list_notes)
- Verificar conexión CouchDB/Obsidian (verify_obsidian)

Principios:
- Organiza la información de forma semántica: usa namespaces descriptivos (ej: "clientes", "proyectos", "tareas", "decisiones")
- Cuando guardes información, usa claves claras y descriptivas
- Cuando busques, intenta encontrar la información más relevante aunque no sea una coincidencia exacta
- Si guardas una nota en Obsidian, usa rutas organizadas (ej: "proyectos/jarvis-v2.md", "clientes/kreoon.md")
- Siempre confirma las operaciones realizadas con un resumen claro

Responde siempre en español.`,
      tools,
      toolHandlers,
    });
  }
}

export const memoryAgent = new MemoryAgent();
