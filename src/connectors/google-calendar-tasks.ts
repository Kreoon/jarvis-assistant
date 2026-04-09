import cron from 'node-cron';
import { getGoogleAccessToken } from '../shared/google-api.js';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { createTask, updateTask, listTasks } from '../modules/tasks/service.js';
import type { Task } from '../modules/tasks/types.js';

const log = logger.child({ module: 'google-calendar-tasks' });

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string | null> {
  try {
    return await getGoogleAccessToken('founder');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ error: msg }, 'No Google token for calendar sync — skipping');
    return null;
  }
}

async function calendarRequest<T>(
  url: string,
  options: RequestInit,
): Promise<T | null> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Sync task → Google Calendar ─────────────────────────────────────────────

export async function syncTaskToCalendar(task: Task): Promise<void> {
  if (!task.due_date || task.google_event_id) return;

  const token = await getToken();
  if (!token) return;

  try {
    const eventBody = {
      summary: `Task: ${task.title}`,
      description: task.description ?? '',
      start: { date: task.due_date.split('T')[0] },
      end: { date: task.due_date.split('T')[0] },
    };

    const created = await calendarRequest<{ id: string }>(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      },
    );

    if (created?.id) {
      await updateTask(task.id, { google_event_id: created.id });
      log.info({ taskId: task.id, eventId: created.id }, 'Task synced to Google Calendar');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ error: msg, taskId: task.id }, 'Failed to sync task to Calendar');
  }
}

// ─── Pull calendar events → tasks ────────────────────────────────────────────

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

interface CalendarListResponse {
  items?: CalendarEvent[];
}

export async function pullCalendarTasks(): Promise<void> {
  const token = await getToken();
  if (!token) return;

  const now = new Date();
  const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    const data = await calendarRequest<CalendarListResponse>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&timeMax=${future.toISOString()}` +
        `&singleEvents=true&orderBy=startTime&maxResults=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    const events = data?.items ?? [];

    // Filtrar eventos con prefijo "Task:" o "[ ]"
    const taskEvents = events.filter((e) =>
      e.summary?.startsWith('Task:') || e.summary?.startsWith('[ ]'),
    );

    if (!taskEvents.length) return;

    // Cargar tasks existentes con google_event_id para deduplicar
    const existingTasks = await listTasks({ includeCompleted: true });
    const knownEventIds = new Set(
      existingTasks.map((t) => t.google_event_id).filter(Boolean),
    );

    for (const event of taskEvents) {
      if (knownEventIds.has(event.id)) continue;

      const rawTitle = event.summary ?? 'Sin título';
      const title = rawTitle.replace(/^(Task:|(\[ \]))\s*/i, '').trim();
      const dueDate = event.start?.dateTime ?? event.start?.date ?? null;

      try {
        await createTask({
          title,
          workspaceSlug: 'personal',
          description: event.description ?? undefined,
          dueDate: dueDate ?? undefined,
          source: 'calendar',
        });
        log.info({ eventId: event.id, title }, 'Calendar event imported as task');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ error: msg, eventId: event.id }, 'Failed to import calendar event as task');
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn({ error: msg }, 'pullCalendarTasks failed');
  }
}

// ─── Cron init ───────────────────────────────────────────────────────────────

export function initCalendarTaskSync(): void {
  const cronExpr = config.tasks.calendarSyncCron;

  if (!cron.validate(cronExpr)) {
    log.warn({ cron: cronExpr }, 'Invalid TASKS_CALENDAR_SYNC_CRON — calendar sync disabled');
    return;
  }

  cron.schedule(cronExpr, async () => {
    log.info('Running calendar task pull');
    await pullCalendarTasks().catch((err: Error) =>
      log.error({ error: err.message }, 'Calendar task pull failed'),
    );
  });

  log.info({ cron: cronExpr }, 'Calendar task sync cron initialized');
}
