import axios from 'axios';
import fs from 'fs/promises';
import { registerJob } from '../../core/scheduler.js';
import { getGoogleAccessToken } from '../../shared/google-api.js';
import { agentLogger } from '../../shared/logger.js';
import { config } from '../../shared/config.js';
import type { CalendarEvent, CalendarAttendee, ProcessedMeeting } from './types.js';

const log = agentLogger('calendar-watcher');

const PROCESSED_PATH = '/app/data/processed-meetings.json';
const OWNER_EMAILS = ['founder@kreoon.com', 'alexandercast.co@gmail.com', 'alex@kreoon.com'];

// ─── Processed meetings persistence ──────────────────────────────────────────

async function loadProcessed(): Promise<ProcessedMeeting[]> {
  try {
    const raw = await fs.readFile(PROCESSED_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveProcessed(meetings: ProcessedMeeting[]): Promise<void> {
  await fs.writeFile(PROCESSED_PATH, JSON.stringify(meetings, null, 2), 'utf-8');
}

export async function markMeetingProcessed(
  eventId: string,
  attendeeEmail: string,
  status: ProcessedMeeting['status'],
  reportUrl?: string,
  error?: string,
): Promise<void> {
  const processed = await loadProcessed();
  const existing = processed.find(m => m.eventId === eventId);
  if (existing) {
    existing.status = status;
    existing.reportUrl = reportUrl;
    existing.error = error;
  } else {
    processed.push({
      eventId,
      processedAt: new Date().toISOString(),
      attendeeEmail,
      status,
      reportUrl,
      error,
    });
  }
  await saveProcessed(processed);
}

// ─── Google Calendar API ─────────────────────────────────────────────────────

async function fetchUpcomingEvents(): Promise<CalendarEvent[]> {
  const accessToken = await getGoogleAccessToken('founder');

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data } = await axios.get(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      params: {
        timeMin: now.toISOString(),
        timeMax: sevenDays.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const events: CalendarEvent[] = (data.items ?? []).map((item: Record<string, unknown>) => ({
    id: item.id as string,
    summary: (item.summary as string) || 'Sin título',
    description: item.description as string | undefined,
    start: (item.start as Record<string, string>)?.dateTime || (item.start as Record<string, string>)?.date || '',
    end: (item.end as Record<string, string>)?.dateTime || (item.end as Record<string, string>)?.date || '',
    status: (item.status as string) || 'confirmed',
    attendees: ((item.attendees as CalendarAttendee[]) ?? []).map(a => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      self: a.self,
    })),
    htmlLink: item.htmlLink as string | undefined,
    created: item.created as string | undefined,
  }));

  return events;
}

// ─── Filter logic ────────────────────────────────────────────────────────────

function getExternalAttendees(event: CalendarEvent): CalendarAttendee[] {
  return event.attendees.filter(a => {
    if (a.self) return false;
    if (a.responseStatus === 'declined') return false;
    const emailLower = a.email.toLowerCase();
    if (OWNER_EMAILS.some(oe => emailLower === oe)) return false;
    if (emailLower.endsWith('@kreoon.com')) return false;
    return true;
  });
}

function isConsultancyMeeting(event: CalendarEvent): boolean {
  // Must have external attendees
  if (getExternalAttendees(event).length === 0) return false;
  // Must not be cancelled
  if (event.status === 'cancelled') return false;
  return true;
}

// ─── Main watcher ────────────────────────────────────────────────────────────

export type NewMeetingHandler = (event: CalendarEvent, attendee: CalendarAttendee) => Promise<void>;

let onNewMeeting: NewMeetingHandler | null = null;

export function setNewMeetingHandler(handler: NewMeetingHandler): void {
  onNewMeeting = handler;
}

async function checkCalendar(): Promise<void> {
  log.info('Checking calendar for new meetings...');

  try {
    const events = await fetchUpcomingEvents();
    const processed = await loadProcessed();
    const processedIds = new Set(processed.map(m => m.eventId));

    let newCount = 0;

    for (const event of events) {
      if (processedIds.has(event.id)) continue;
      if (!isConsultancyMeeting(event)) continue;

      const externalAttendees = getExternalAttendees(event);
      const primaryAttendee = externalAttendees[0];

      if (!primaryAttendee) continue;

      log.info(
        { eventId: event.id, summary: event.summary, attendee: primaryAttendee.email },
        'New consultancy meeting detected',
      );

      // Mark as processing immediately to avoid double-processing
      await markMeetingProcessed(event.id, primaryAttendee.email, 'processing');

      if (onNewMeeting) {
        // Fire and forget — the handler manages its own errors
        onNewMeeting(event, primaryAttendee).catch(err => {
          log.error({ err, eventId: event.id }, 'Meeting handler failed');
        });
      }

      newCount++;
    }

    if (newCount > 0) {
      log.info({ newCount }, 'New meetings queued for research');
    } else {
      log.debug('No new meetings found');
    }
  } catch (error: any) {
    log.error({ error: error.message }, 'Calendar check failed');
  }
}

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initCalendarWatcher(): void {
  registerJob(
    'calendar-watcher',
    '*/5 * * * *', // Every 5 minutes
    'Detecta nuevas reuniones de consultoría en Google Calendar',
    checkCalendar,
  );
  log.info('Calendar watcher initialized (every 5 min)');
}

// Manual trigger for testing
export { checkCalendar };
