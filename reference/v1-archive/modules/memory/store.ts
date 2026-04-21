import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const DATA_DIR = "/app/data";
const MEMORY_FILE = `${DATA_DIR}/memory.json`;

interface MemoryEntry {
  id: string;
  fact: string;
  category: string;
  created: string;
}

interface MemoryStore {
  entries: MemoryEntry[];
}

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadStore(): Promise<MemoryStore> {
  await ensureDataDir();
  if (!existsSync(MEMORY_FILE)) {
    return { entries: [] };
  }
  const raw = await readFile(MEMORY_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveStore(store: MemoryStore): Promise<void> {
  await ensureDataDir();
  await writeFile(MEMORY_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Save a fact to persistent memory
 */
export async function remember(
  fact: string,
  category: string
): Promise<void> {
  const store = await loadStore();

  // Check for duplicate/similar facts - replace if same category keyword
  const existing = store.entries.findIndex(
    (e) =>
      e.category === category &&
      e.fact
        .toLowerCase()
        .includes(fact.split(" ").slice(0, 3).join(" ").toLowerCase())
  );

  const entry: MemoryEntry = {
    id: Date.now().toString(36),
    fact,
    category,
    created: new Date().toISOString(),
  };

  if (existing >= 0) {
    store.entries[existing] = entry;
  } else {
    store.entries.push(entry);
  }

  await saveStore(store);
}

/**
 * Get all memories formatted for the system prompt
 */
export async function getAllMemories(): Promise<string> {
  const store = await loadStore();
  if (store.entries.length === 0) return "";

  const grouped = new Map<string, string[]>();
  for (const entry of store.entries) {
    if (!grouped.has(entry.category)) {
      grouped.set(entry.category, []);
    }
    grouped.get(entry.category)!.push(entry.fact);
  }

  let result = "\n## Memoria del usuario (cosas que recuerdas)\n";
  for (const [category, facts] of grouped) {
    result += `\n### ${category}\n`;
    for (const fact of facts) {
      result += `- ${fact}\n`;
    }
  }

  return result;
}

/**
 * Search memories
 */
export async function searchMemories(
  query: string
): Promise<MemoryEntry[]> {
  const store = await loadStore();
  const q = query.toLowerCase();
  return store.entries.filter(
    (e) =>
      e.fact.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q)
  );
}

/**
 * Delete a memory by id
 */
export async function forgetMemory(id: string): Promise<boolean> {
  const store = await loadStore();
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => e.id !== id);
  if (store.entries.length < before) {
    await saveStore(store);
    return true;
  }
  return false;
}
