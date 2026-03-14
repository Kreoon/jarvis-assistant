import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, relative, extname } from "path";
import { existsSync } from "fs";
import simpleGit from "simple-git";
import matter from "gray-matter";
import { glob } from "glob";
import { config } from "../config.js";

const git = simpleGit();

/**
 * Clone or pull the Obsidian vault from GitHub
 */
export async function syncVault(): Promise<void> {
  const vaultPath = config.obsidian.vaultPath;

  if (existsSync(join(vaultPath, ".git"))) {
    console.log("Pulling latest vault changes...");
    await simpleGit(vaultPath).pull();
  } else {
    console.log("Cloning vault...");
    await mkdir(vaultPath, { recursive: true });
    await simpleGit().clone(config.obsidian.repoUrl, vaultPath);
  }
  console.log("Vault synced.");
}

/**
 * Push changes back to GitHub
 */
export async function pushChanges(commitMessage: string): Promise<void> {
  const vaultGit = simpleGit(config.obsidian.vaultPath);
  await vaultGit.add(".");
  await vaultGit.commit(commitMessage);
  await vaultGit.push();
}

/**
 * Search notes by content
 */
export async function searchNotes(
  query: string
): Promise<{ path: string; excerpt: string }[]> {
  const vaultPath = config.obsidian.vaultPath;
  const files = await glob("**/*.md", { cwd: vaultPath });
  const results: { path: string; excerpt: string }[] = [];
  const queryLower = query.toLowerCase();

  for (const file of files) {
    const content = await readFile(join(vaultPath, file), "utf-8");
    const contentLower = content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      const index = contentLower.indexOf(queryLower);
      const start = Math.max(0, index - 100);
      const end = Math.min(content.length, index + query.length + 100);
      const excerpt = content.substring(start, end).trim();

      results.push({ path: file, excerpt: `...${excerpt}...` });
    }

    if (results.length >= 10) break;
  }

  return results;
}

/**
 * Read a specific note
 */
export async function readNote(
  notePath: string
): Promise<{ content: string; frontmatter: Record<string, any> } | null> {
  const fullPath = join(config.obsidian.vaultPath, notePath);

  if (!existsSync(fullPath)) return null;

  const raw = await readFile(fullPath, "utf-8");
  const { data, content } = matter(raw);

  return { content, frontmatter: data };
}

/**
 * Create or update a note
 */
export async function writeNote(
  notePath: string,
  content: string,
  frontmatter?: Record<string, any>
): Promise<void> {
  const fullPath = join(config.obsidian.vaultPath, notePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));

  await mkdir(dir, { recursive: true });

  let fileContent = content;
  if (frontmatter && Object.keys(frontmatter).length > 0) {
    fileContent = matter.stringify(content, frontmatter);
  }

  await writeFile(fullPath, fileContent, "utf-8");
  await pushChanges(`Jarvis: update ${notePath}`);
}

/**
 * List notes in a folder
 */
export async function listNotes(
  folder: string = ""
): Promise<string[]> {
  const targetPath = join(config.obsidian.vaultPath, folder);
  const files = await glob("**/*.md", { cwd: targetPath });
  return files;
}

/**
 * Get daily note for today
 */
export async function getDailyNote(): Promise<string | null> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const possiblePaths = [
    `Daily/${today}.md`,
    `daily/${today}.md`,
    `Daily Notes/${today}.md`,
    `${today}.md`,
  ];

  for (const p of possiblePaths) {
    const note = await readNote(p);
    if (note) return note.content;
  }

  return null;
}

/**
 * Append text to a note (useful for daily notes, logs)
 */
export async function appendToNote(
  notePath: string,
  text: string
): Promise<void> {
  const fullPath = join(config.obsidian.vaultPath, notePath);

  let existing = "";
  if (existsSync(fullPath)) {
    existing = await readFile(fullPath, "utf-8");
  }

  const newContent = existing + "\n" + text;
  await writeFile(fullPath, newContent, "utf-8");
  await pushChanges(`Jarvis: append to ${notePath}`);
}
