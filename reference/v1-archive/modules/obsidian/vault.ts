import * as couchdb from "../../connectors/couchdb.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import simpleGit from "simple-git";
import matter from "gray-matter";
import { glob } from "glob";
import { config } from "../../config/index.js";

export async function syncVault(): Promise<void> {
  const vaultPath = config.obsidian.vaultPath;
  try {
    if (existsSync(join(vaultPath, ".git"))) {
      await simpleGit(vaultPath).pull();
    } else {
      await mkdir(vaultPath, { recursive: true });
      await simpleGit().clone(config.obsidian.repoUrl, vaultPath);
    }
  } catch (e) {
    console.warn("Git pull failed, continuing with local copy");
  }
}

export async function searchNotes(query: string): Promise<{ path: string; excerpt: string }[]> {
  try {
    return await couchdb.searchDocs(query);
  } catch {
    const files = await glob("**/*.md", { cwd: config.obsidian.vaultPath });
    const results: { path: string; excerpt: string }[] = [];
    const qN = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const f of files) {
      if (f.startsWith(".")) continue;
      const content = await readFile(join(config.obsidian.vaultPath, f), "utf-8");
      const cN = content.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cN.includes(qN) || f.toLowerCase().includes(qN)) {
        const idx = cN.indexOf(qN);
        const s = Math.max(0, idx - 100);
        const e = Math.min(content.length, idx + query.length + 100);
        results.push({ path: f, excerpt: "..." + content.substring(s, e).trim() + "..." });
        if (results.length >= 10) break;
      }
    }
    return results;
  }
}

export async function readNote(notePath: string): Promise<{ content: string; frontmatter: Record<string, any> } | null> {
  try {
    const doc = await couchdb.readDoc(notePath);
    if (!doc) return null;
    const { data, content } = matter(doc.content);
    return { content, frontmatter: data };
  } catch {
    const fullPath = join(config.obsidian.vaultPath, notePath);
    if (!existsSync(fullPath)) return null;
    const raw = await readFile(fullPath, "utf-8");
    const { data, content } = matter(raw);
    return { content, frontmatter: data };
  }
}

export async function writeNote(notePath: string, content: string, frontmatter?: Record<string, any>): Promise<void> {
  let fileContent = content;
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    fileContent = matter.stringify(content, frontmatter);
  }
  try { await couchdb.writeDoc(notePath, fileContent); } catch (e) { console.warn("CouchDB write failed:", e); }
  try {
    const fullPath = join(config.obsidian.vaultPath, notePath);
    const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, fileContent, "utf-8");
    const g = simpleGit(config.obsidian.vaultPath);
    await g.add("."); await g.commit("Jarvis: update " + notePath); await g.push();
  } catch (e) { console.warn("Git backup failed:", e); }
}

export async function appendToNote(notePath: string, text: string): Promise<void> {
  try { await couchdb.appendDoc(notePath, text); } catch (e) { console.warn("CouchDB append failed:", e); }
  try {
    const fullPath = join(config.obsidian.vaultPath, notePath);
    let existing = "";
    if (existsSync(fullPath)) existing = await readFile(fullPath, "utf-8");
    await writeFile(fullPath, existing + "\n" + text, "utf-8");
    const g = simpleGit(config.obsidian.vaultPath);
    await g.add("."); await g.commit("Jarvis: append to " + notePath); await g.push();
  } catch (e) { console.warn("Git backup failed:", e); }
}

export async function listNotes(folder: string = ""): Promise<string[]> {
  try { return await couchdb.listDocs(folder); }
  catch { return glob("**/*.md", { cwd: join(config.obsidian.vaultPath, folder) }); }
}

export async function getDailyNote(): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0];
  for (const p of ["07 - Diario/" + today + ".md", "Daily/" + today + ".md", today + ".md"]) {
    const note = await readNote(p);
    if (note) return note.content;
  }
  return null;
}
