import axios from 'axios';
import matter from 'gray-matter';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { registerOnTaskCompleted } from '../modules/tasks/service.js';
import type { Task, WeeklyReport } from '../modules/tasks/types.js';

const log = logger.child({ module: 'obsidian-sync' });

// ─── CouchDB helpers (mismo patrón que memory agent) ─────────────────────────

function couchBase(): string {
  return config.couchdb.url || 'http://couchdb:5984';
}

function couchHeaders(): Record<string, string> {
  const { user, pass } = config.couchdb;
  const auth =
    user && pass
      ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` }
      : {};
  return { 'Content-Type': 'application/json', ...auth };
}

function obsidianDb(): string {
  return config.tasks.obsidianDb;
}

async function putDoc(docPath: string, content: string): Promise<void> {
  const docId = docPath.replace(/\//g, '_');
  const url = `${couchBase()}/${obsidianDb()}/${encodeURIComponent(docId)}`;
  const headers = couchHeaders();

  let rev: string | undefined;
  try {
    const existing = await axios.get(url, { headers });
    rev = existing.data._rev as string;
  } catch {
    // Documento nuevo
  }

  const doc: Record<string, unknown> = {
    _id: docId,
    path: docPath,
    content,
    updatedAt: new Date().toISOString(),
  };
  if (rev) doc._rev = rev;

  await axios.put(url, doc, { headers });
}

// ─── Formateo de notas ────────────────────────────────────────────────────────

function taskToMarkdown(task: Task): string {
  const frontmatter = {
    title: task.title,
    date: task.completed_at?.split('T')[0] ?? new Date().toISOString().split('T')[0],
    workspace_id: task.workspace_id,
    project_id: task.project_id ?? null,
    tags: task.tags,
    pomodoros: task.pomodoros_completed,
    priority: task.priority,
    source: task.source,
    status: task.status,
  };

  // gray-matter stringify genera el bloque --- YAML ---
  const withFrontmatter = matter.stringify('', frontmatter);

  const body = [
    `# ${task.title}`,
    '',
    task.description ? task.description : '',
    '',
    '## Completada',
    '',
    `Completada el ${task.completed_at ? new Date(task.completed_at).toLocaleString('es-CO') : 'N/A'}.`,
    `Pomodoros: ${task.pomodoros_completed}`,
  ].join('\n');

  return withFrontmatter + body;
}

function weeklyReportToMarkdown(report: WeeklyReport): string {
  const frontmatter = {
    title: `Reporte semanal ${report.weekLabel}`,
    week: report.weekLabel,
    start_date: report.startDate,
    end_date: report.endDate,
    total_completed: report.totalCompleted,
  };

  const withFrontmatter = matter.stringify('', frontmatter);

  const sections = report.byWorkspace.map((ws) => {
    const taskList = ws.tasks
      .map((t) => `- [x] ${t.title} _(${t.completed_at.split('T')[0]})_`)
      .join('\n');
    return `## ${ws.workspace} (${ws.completed})\n\n${taskList}`;
  });

  const body = [
    `# Reporte Semanal — ${report.weekLabel}`,
    '',
    `**Período:** ${report.startDate} → ${report.endDate}`,
    `**Total completadas:** ${report.totalCompleted}`,
    '',
    ...sections,
  ].join('\n');

  return withFrontmatter + body;
}

// ─── Funciones exportadas ────────────────────────────────────────────────────

export async function saveTaskToObsidian(task: Task): Promise<void> {
  const datePrefix = (task.completed_at ?? new Date().toISOString()).slice(0, 7); // YYYY-MM
  const slug = task.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

  const docPath = `jarvis/tasks/${datePrefix}/${slug}-${task.id.slice(0, 8)}.md`;
  const content = taskToMarkdown(task);

  try {
    await putDoc(docPath, content);
    log.info({ taskId: task.id, path: docPath }, 'Task saved to Obsidian');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ error: msg, taskId: task.id }, 'Failed to save task to Obsidian');
  }
}

export async function saveWeeklyReport(report: WeeklyReport): Promise<void> {
  const docPath = `jarvis/reports/${report.weekLabel}.md`;
  const content = weeklyReportToMarkdown(report);

  try {
    await putDoc(docPath, content);
    log.info({ week: report.weekLabel, path: docPath }, 'Weekly report saved to Obsidian');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ error: msg, week: report.weekLabel }, 'Failed to save weekly report to Obsidian');
  }
}

export function initObsidianTaskSync(): void {
  registerOnTaskCompleted(async (task) => {
    await saveTaskToObsidian(task);
  });
  log.info('Obsidian task sync hook registered');
}
