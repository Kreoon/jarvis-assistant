// @ts-ignore - node-cron has no type declarations
import cron from 'node-cron';
import fs from 'fs/promises';
import { logger } from '../shared/logger.js';
import { config } from '../shared/config.js';
import { sendText } from '../connectors/whatsapp.js';
import type { ScheduledJob } from '../shared/types.js';

// ─── Job Registry ────────────────────────────────────────────────────────────

interface RegisteredJob {
  id: string;
  cronExpr: string;
  description: string;
  task: { stop: () => void };
  handler: () => Promise<void>;
  lastRun?: string;
  enabled: boolean;
}

const jobs = new Map<string, RegisteredJob>();

export function registerJob(
  id: string,
  cronExpr: string,
  description: string,
  handler: () => Promise<void>,
): void {
  // Unregister existing job if any
  unregisterJob(id);

  const task = cron.schedule(cronExpr, async () => {
    const job = jobs.get(id);
    if (!job || !job.enabled) return;

    logger.info({ jobId: id }, `Scheduler: running job "${id}"`);
    try {
      await handler();
      if (job) job.lastRun = new Date().toISOString();
    } catch (error: any) {
      logger.error({ jobId: id, error: error.message }, `Scheduler: job "${id}" failed`);
    }
  }, { timezone: 'America/Bogota' });

  jobs.set(id, { id, cronExpr, description, task, handler, enabled: true });
  logger.info({ jobId: id, cron: cronExpr }, `Scheduler: registered job "${id}"`);
}

export function unregisterJob(id: string): void {
  const existing = jobs.get(id);
  if (existing) {
    existing.task.stop();
    jobs.delete(id);
    logger.info({ jobId: id }, `Scheduler: unregistered job "${id}"`);
  }
}

export function getJobs(): ScheduledJob[] {
  return Array.from(jobs.values()).map(j => ({
    id: j.id,
    cron: j.cronExpr,
    description: j.description,
    enabled: j.enabled,
    lastRun: j.lastRun,
  }));
}

// ─── Built-in Jobs ───────────────────────────────────────────────────────────

const REMINDERS_PATH = '/app/data/reminders.json';

interface ReminderEntry {
  id: string;
  text: string;
  triggerAt: string;
  phone: string;
  recurring?: string | null;
  sent: boolean;
  source: string;
}

async function checkReminders(): Promise<void> {
  let reminders: ReminderEntry[];
  try {
    const content = await fs.readFile(REMINDERS_PATH, 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return; // Invalid format, skip
    reminders = parsed;
  } catch {
    return; // No reminders file yet
  }

  const now = new Date();
  let changed = false;

  for (const rem of reminders) {
    if (rem.sent) continue;

    const triggerTime = new Date(rem.triggerAt);
    if (isNaN(triggerTime.getTime())) continue;

    if (triggerTime <= now) {
      try {
        await sendText(rem.phone, `⏰ *Recordatorio*\n\n${rem.text}`);
        rem.sent = true;
        changed = true;
        logger.info({ reminderId: rem.id, phone: rem.phone }, 'Reminder sent');
      } catch (error: any) {
        logger.error({ reminderId: rem.id, error: error.message }, 'Failed to send reminder');
      }
    }
  }

  if (changed) {
    // Remove sent non-recurring reminders, keep recurring ones
    const updated = reminders.filter(r => !r.sent || r.recurring);
    await fs.writeFile(REMINDERS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  }
}

// Session cleanup: clear old conversation contexts
const conversations = new Map<string, { recentMessages: unknown[] }>();

export function setConversationsRef(ref: Map<string, unknown>): void {
  // This allows server.ts to pass its conversations map for cleanup
  (globalThis as Record<string, unknown>).__jarvisConversations = ref;
}

async function cleanupSessions(): Promise<void> {
  // Cleanup is handled by the 20-message window in server.ts
  // This job exists as a hook point for future cleanup logic
  logger.debug('Session cleanup check completed');
}

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initScheduler(): void {
  logger.info('Initializing scheduler...');

  // Check reminders every minute
  registerJob(
    'reminder-checker',
    '* * * * *',
    'Verifica y envía recordatorios pendientes cada minuto',
    checkReminders,
  );

  // Session cleanup every 30 minutes
  registerJob(
    'session-cleanup',
    '*/30 * * * *',
    'Limpieza de sesiones inactivas cada 30 minutos',
    cleanupSessions,
  );

  // Daily content engine placeholder — will be registered from engine module
  // registerJob('daily-content-engine', config.dailyEngine.cron, ...);

  logger.info({ jobCount: jobs.size }, 'Scheduler initialized');
}
