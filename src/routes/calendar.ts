import { Router } from 'express';
import { getGoogleAccessToken } from '../shared/google-api.js';
import { logger } from '../shared/logger.js';

const router = Router();

// === Get calendar events ===
router.get('/events', async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30);
  const account = (req.query.account as string) || 'founder';

  try {
    const accessToken = await getGoogleAccessToken(account);
    if (!accessToken) {
      return res.status(503).json({ error: `No Google access token for account "${account}".` });
    }

    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
        `timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&singleEvents=true&orderBy=startTime&maxResults=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'Google Calendar API error');
      return res.status(response.status).json({ error: 'Failed to fetch calendar events.' });
    }

    const data = await response.json() as any;

    const events = (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary,
      start: item.start?.dateTime || item.start?.date,
      end: item.end?.dateTime || item.end?.date,
      location: item.location,
      description: item.description?.slice(0, 200),
      status: item.status,
      htmlLink: item.htmlLink,
    }));

    res.json({ events, total: events.length });
  } catch (err: any) {
    logger.error({ error: err.message }, 'Calendar events error');
    res.status(500).json({ error: 'Error fetching calendar events.' });
  }
});

export { router as calendarRouter };
