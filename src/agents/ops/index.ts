import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { BaseAgent } from '../../core/base-agent.js';
import { config } from '../../shared/config.js';
import { getGoogleAccessToken, readEmailFull, searchEmails, listAccounts } from '../../shared/google-api.js';
import type { AgentRequest, LLMTool } from '../../shared/types.js';
import { sendText } from '../../connectors/whatsapp.js';

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const tools: LLMTool[] = [
  // === Email Tools ===
  {
    name: 'send_email',
    description: 'Envía un email mediante la API de Gmail',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Dirección de correo del destinatario' },
        subject: { type: 'string', description: 'Asunto del correo' },
        body: { type: 'string', description: 'Cuerpo del correo (puede incluir HTML)' },
        from_account: {
          type: 'string',
          description: 'Nombre de la cuenta Google desde la que enviar (ej: founder, ops, diana). Default: founder',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },
  {
    name: 'read_emails',
    description: 'Lee correos recientes de Gmail (solo metadata y snippet)',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filtro de búsqueda estilo Gmail (p.ej. "from:cliente@empresa.com")' },
        maxResults: { type: 'number', description: 'Número máximo de correos a retornar (por defecto 10)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Default: founder',
        },
      },
      required: [],
    },
  },
  {
    name: 'read_email_full',
    description: 'Lee el contenido completo de un email específico por su ID. Incluye body, threadId, labels.',
    parameters: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID del mensaje de Gmail' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Default: founder',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'reply_to_email',
    description: 'Responde a un email existente manteniendo el hilo de conversación',
    parameters: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'ID del mensaje al que responder' },
        body: { type: 'string', description: 'Cuerpo de la respuesta (puede incluir HTML)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Default: founder',
        },
      },
      required: ['messageId', 'body'],
    },
  },
  {
    name: 'create_draft',
    description: 'Crea un borrador de email en Gmail sin enviarlo',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Dirección de correo del destinatario' },
        subject: { type: 'string', description: 'Asunto del correo' },
        body: { type: 'string', description: 'Cuerpo del borrador (puede incluir HTML)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Default: founder',
        },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // === Calendar Tools ===
  {
    name: 'create_calendar_event',
    description: 'Crea un evento en Google Calendar. Envía notificaciones a los asistentes.',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'ID del calendario (usa list_calendars para ver IDs). Default: primary' },
        title: { type: 'string', description: 'Título del evento' },
        start: { type: 'string', description: 'Fecha/hora de inicio en formato ISO 8601' },
        end: { type: 'string', description: 'Fecha/hora de fin en formato ISO 8601' },
        description: { type: 'string', description: 'Descripción o notas del evento' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de emails de los asistentes',
        },
        colorId: {
          type: 'string',
          enum: ['1','2','3','4','5','6','7','8','9','10','11'],
          description: 'Color del evento: 1=Lavanda, 2=Salvia, 3=Uva, 4=Flamenco, 5=Banana, 6=Mandarina, 7=Pavo real, 8=Grafito, 9=Arandano, 10=Albahaca, 11=Tomate',
        },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Usa list_google_accounts para ver todas. Default: founder',
        },
      },
      required: ['title', 'start', 'end'],
    },
  },
  {
    name: 'list_calendar_events',
    description: 'Lista los próximos eventos del calendario con asistentes y links',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'ID del calendario (usa list_calendars para ver IDs). Default: primary' },
        days: { type: 'number', description: 'Número de días hacia adelante a consultar (por defecto 7)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Usa list_google_accounts para ver todas. Default: founder',
        },
      },
      required: [],
    },
  },
  {
    name: 'update_calendar_event',
    description: 'Actualiza un evento existente en Google Calendar',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'ID del calendario donde está el evento. Default: primary' },
        eventId: { type: 'string', description: 'ID del evento a actualizar' },
        title: { type: 'string', description: 'Nuevo título (opcional)' },
        start: { type: 'string', description: 'Nueva fecha/hora de inicio ISO 8601 (opcional)' },
        end: { type: 'string', description: 'Nueva fecha/hora de fin ISO 8601 (opcional)' },
        description: { type: 'string', description: 'Nueva descripción (opcional)' },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Nueva lista de emails de asistentes (opcional)',
        },
        colorId: {
          type: 'string',
          enum: ['1','2','3','4','5','6','7','8','9','10','11'],
          description: 'Color del evento: 1=Lavanda, 2=Salvia, 3=Uva, 4=Flamenco, 5=Banana, 6=Mandarina, 7=Pavo real, 8=Grafito, 9=Arandano, 10=Albahaca, 11=Tomate',
        },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Usa list_google_accounts para ver todas. Default: founder',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'delete_calendar_event',
    description: 'Elimina un evento de Google Calendar',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'ID del calendario donde está el evento. Default: primary' },
        eventId: { type: 'string', description: 'ID del evento a eliminar' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Usa list_google_accounts para ver todas. Default: founder',
        },
      },
      required: ['eventId'],
    },
  },
  {
    name: 'search_calendar_events',
    description: 'Busca eventos en el calendario por texto',
    parameters: {
      type: 'object',
      properties: {
        calendarId: { type: 'string', description: 'ID del calendario donde buscar. Default: primary' },
        q: { type: 'string', description: 'Texto a buscar en los eventos' },
        days: { type: 'number', description: 'Rango de días hacia adelante (por defecto 30)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google (ej: founder, ops, diana). Usa list_google_accounts para ver todas. Default: founder',
        },
      },
      required: ['q'],
    },
  },

  // === Google Account Management Tools ===
  {
    name: 'connect_google_account',
    description: 'Genera un link para conectar una nueva cuenta Google a Jarvis (calendario + email)',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre para la cuenta (ej: diana, brian_personal, marketing)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_google_accounts',
    description: 'Lista todas las cuentas Google conectadas a Jarvis con su email y nombre',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  // === Calendar Management Tools ===
  {
    name: 'list_calendars',
    description: 'Lista todos los calendarios disponibles de una cuenta Google (primarios, secundarios y compartidos)',
    parameters: {
      type: 'object',
      properties: {
        account: {
          type: 'string',
          description: 'Nombre de cuenta Google o "all" para ver todas. Default: all',
        },
      },
    },
  },
  {
    name: 'create_calendar',
    description: 'Crea un nuevo calendario secundario en Google Calendar',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre del calendario (ej: Contenido, Proyectos KREOON, Personal)' },
        description: { type: 'string', description: 'Descripcion del calendario (opcional)' },
        account: {
          type: 'string',
          description: 'Nombre de la cuenta Google donde crear el calendario. Default: founder',
        },
      },
      required: ['name'],
    },
  },

  // === Other Tools ===
  {
    name: 'set_reminder',
    description: 'Crea un recordatorio que será enviado por WhatsApp a la hora indicada',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto del recordatorio' },
        when: { type: 'string', description: 'Cuándo enviar el recordatorio en formato ISO 8601 (ej: 2026-03-20T15:00:00-05:00)' },
        recurring: { type: 'string', description: 'Expresión cron para recordatorios recurrentes (opcional)' },
      },
      required: ['text', 'when'],
    },
  },
  {
    name: 'check_meta_ads',
    description: 'Consulta el estado, métricas o presupuesto de campañas de Meta Ads',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['status', 'metrics', 'budget'],
          description: 'Tipo de consulta: status, metrics o budget',
        },
        campaign_id: { type: 'string', description: 'ID de la campaña específica (opcional)' },
      },
      required: ['action'],
    },
  },
  {
    name: 'send_team_message',
    description: 'Envía un mensaje de WhatsApp a un miembro del equipo',
    parameters: {
      type: 'object',
      properties: {
        to_phone: { type: 'string', description: 'Número de teléfono del destinatario (formato internacional sin +)' },
        message: { type: 'string', description: 'Texto del mensaje a enviar' },
      },
      required: ['to_phone', 'message'],
    },
  },
  {
    name: 'github_action',
    description: 'Ejecuta operaciones en GitHub: listar repos, issues, commits o crear issues',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['repos', 'issues', 'commits', 'create_issue'],
          description: 'Acción a realizar en GitHub',
        },
        repo: { type: 'string', description: 'Nombre del repositorio en formato owner/repo (requerido para issues, commits, create_issue)' },
        title: { type: 'string', description: 'Título del issue (requerido para create_issue)' },
        body: { type: 'string', description: 'Cuerpo del issue (opcional para create_issue)' },
      },
      required: ['action'],
    },
  },
];

// ─── MIME encoding helper ────────────────────────────────────────────────────

function encodeRawEmail(lines: string[]): string {
  return Buffer.from(lines.join('\r\n'))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ─── Tool Handlers ────────────────────────────────────────────────────────────

const toolHandlers: Record<string, (args: Record<string, unknown>, req: AgentRequest) => Promise<unknown>> = {

  // === Email Handlers ===

  async send_email(args) {
    const { to, subject, body, from_account = 'founder' } = args as {
      to: string; subject: string; body: string; from_account?: string;
    };

    const accessToken = await getGoogleAccessToken(from_account);

    const raw = encodeRawEmail([
      `To: ${to}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      `Subject: ${subject}`,
      '',
      body,
    ]);

    const { data } = await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return { success: true, messageId: data.id, threadId: data.threadId };
  },

  async read_emails(args) {
    const { query = '', maxResults = 10, account = 'founder' } = args as {
      query?: string; maxResults?: number; account?: string;
    };
    const details = await searchEmails(query, maxResults, account);
    return { count: details.length, emails: details };
  },

  async read_email_full(args) {
    const { messageId, account = 'founder' } = args as {
      messageId: string; account?: string;
    };
    return await readEmailFull(messageId, account);
  },

  async reply_to_email(args) {
    const { messageId, body, account = 'founder' } = args as {
      messageId: string; body: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);

    // Get original message to extract thread info
    const { data: original } = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Message-ID', 'References', 'To'] },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const headers: { name: string; value: string }[] = original.payload?.headers ?? [];
    const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';

    const originalFrom = get('From');
    const originalSubject = get('Subject');
    const originalMessageId = get('Message-ID');
    const originalReferences = get('References');
    const threadId = original.threadId;

    // Build reply-to address (the original sender)
    const replyTo = originalFrom;
    const subject = originalSubject.startsWith('Re:') ? originalSubject : `Re: ${originalSubject}`;
    const references = originalReferences
      ? `${originalReferences} ${originalMessageId}`
      : originalMessageId;

    const raw = encodeRawEmail([
      `To: ${replyTo}`,
      `Subject: ${subject}`,
      `In-Reply-To: ${originalMessageId}`,
      `References: ${references}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ]);

    const { data } = await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw, threadId },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return { success: true, messageId: data.id, threadId: data.threadId, replyTo };
  },

  async create_draft(args) {
    const { to, subject, body, account = 'founder' } = args as {
      to: string; subject: string; body: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);

    const raw = encodeRawEmail([
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body,
    ]);

    const { data } = await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
      { message: { raw } },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return { success: true, draftId: data.id, messageId: data.message?.id };
  },

  // === Calendar Handlers ===

  async create_calendar_event(args) {
    const { calendarId = 'primary', title, start, end, description, attendees, colorId, account = 'founder' } = args as {
      calendarId?: string; title: string; start: string; end: string; description?: string;
      attendees?: string[]; colorId?: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);
    const calId = encodeURIComponent(calendarId);

    // Check for conflicts in the same time range
    const conflictCheck = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
      {
        params: {
          timeMin: new Date(start).toISOString(),
          timeMax: new Date(end).toISOString(),
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 10,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const conflicts = (conflictCheck.data.items ?? [])
      .filter((ev: Record<string, unknown>) => ev.status !== 'cancelled')
      .map((ev: Record<string, unknown>) => ({
        summary: ev.summary,
        start: (ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date,
        end: (ev.end as Record<string, string>)?.dateTime ?? (ev.end as Record<string, string>)?.date,
      }));

    if (conflicts.length > 0) {
      return {
        success: false,
        conflict: true,
        message: `Hay ${conflicts.length} evento(s) en ese horario. Revisa antes de crear.`,
        existingEvents: conflicts,
        proposedEvent: { title, start, end },
      };
    }

    const event: Record<string, unknown> = {
      summary: title,
      start: { dateTime: start, timeZone: 'America/Bogota' },
      end: { dateTime: end, timeZone: 'America/Bogota' },
      conferenceData: {
        createRequest: {
          requestId: `jarvis-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    };

    if (description) event.description = description;
    if (colorId) event.colorId = colorId;
    if (attendees?.length) {
      event.attendees = attendees.map(email => ({ email }));
    }

    const { data } = await axios.post(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
      event,
      {
        params: { sendNotifications: true, conferenceDataVersion: 1 },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const meetLink = data.conferenceData?.entryPoints?.find(
      (e: Record<string, string>) => e.entryPointType === 'video'
    )?.uri || null;

    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
      meetLink,
      summary: data.summary,
      start: data.start,
      end: data.end,
    };
  },

  async list_calendar_events(args) {
    const { calendarId = 'primary', days = 7, account = 'founder' } = args as {
      calendarId?: string; days?: number; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);
    const calId = encodeURIComponent(calendarId);

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
      {
        params: {
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const events = (data.items ?? []).map((ev: Record<string, unknown>) => ({
      id: ev.id,
      summary: ev.summary,
      start: (ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date,
      end: (ev.end as Record<string, string>)?.dateTime ?? (ev.end as Record<string, string>)?.date,
      description: ev.description,
      attendees: ((ev.attendees as Record<string, string>[]) ?? []).map(a => a.email),
      htmlLink: ev.htmlLink,
    }));

    return { count: events.length, events };
  },

  async update_calendar_event(args) {
    const { calendarId = 'primary', eventId, title, start, end, description, attendees, colorId, account = 'founder' } = args as {
      calendarId?: string; eventId: string; title?: string; start?: string; end?: string;
      description?: string; attendees?: string[]; colorId?: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);
    const calId = encodeURIComponent(calendarId);

    const patch: Record<string, unknown> = {};
    if (title) patch.summary = title;
    if (start) patch.start = { dateTime: start, timeZone: 'America/Bogota' };
    if (end) patch.end = { dateTime: end, timeZone: 'America/Bogota' };
    if (description !== undefined) patch.description = description;
    if (colorId) patch.colorId = colorId;
    if (attendees) patch.attendees = attendees.map(email => ({ email }));

    const { data } = await axios.patch(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
      patch,
      {
        params: { sendNotifications: true },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return {
      success: true,
      eventId: data.id,
      htmlLink: data.htmlLink,
      summary: data.summary,
      start: data.start,
      end: data.end,
    };
  },

  async delete_calendar_event(args) {
    const { calendarId = 'primary', eventId, account = 'founder' } = args as {
      calendarId?: string; eventId: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);
    const calId = encodeURIComponent(calendarId);

    await axios.delete(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events/${eventId}`,
      {
        params: { sendNotifications: true },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return { success: true, eventId, deleted: true };
  },

  async search_calendar_events(args) {
    const { calendarId = 'primary', q, days = 30, account = 'founder' } = args as {
      calendarId?: string; q: string; days?: number; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);
    const calId = encodeURIComponent(calendarId);

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await axios.get(
      `https://www.googleapis.com/calendar/v3/calendars/${calId}/events`,
      {
        params: {
          q,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 20,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    const events = (data.items ?? []).map((ev: Record<string, unknown>) => ({
      id: ev.id,
      summary: ev.summary,
      start: (ev.start as Record<string, string>)?.dateTime ?? (ev.start as Record<string, string>)?.date,
      end: (ev.end as Record<string, string>)?.dateTime ?? (ev.end as Record<string, string>)?.date,
      description: ev.description,
      htmlLink: ev.htmlLink,
    }));

    return { count: events.length, events };
  },

  // === Google Account Management Handlers ===

  async connect_google_account(args) {
    const { name } = args as { name: string };
    const key = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const link = `https://jarvis.kreoon.com/auth/google/start?account=${encodeURIComponent(key)}`;
    return {
      success: true,
      accountKey: key,
      authLink: link,
      instructions: `Envia este link a la persona para que autorice su cuenta Google. Una vez autoricen, podras usar account: "${key}" en calendario y email.`,
    };
  },

  async list_google_accounts() {
    const accounts = listAccounts();
    return {
      count: Object.keys(accounts).length,
      accounts,
    };
  },

  // === Calendar Management Handlers ===

  async list_calendars(args) {
    const { account = 'all' } = args as { account?: string | 'all' };

    const allAccounts = listAccounts();
    const accountKeys: string[] = account === 'all' ? Object.keys(allAccounts) : [account];

    const results: Record<string, unknown[]> = {};

    for (const acc of accountKeys) {
      try {
        const accessToken = await getGoogleAccessToken(acc);
        const { data } = await axios.get(
          'https://www.googleapis.com/calendar/v3/users/me/calendarList',
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        results[acc] = (data.items ?? [])
          .filter((cal: Record<string, unknown>) => {
            const id = (cal.id as string) || '';
            return !id.includes('#holiday') && !id.includes('#contacts') && !id.includes('addressbook') && !id.includes('#weather');
          })
          .map((cal: Record<string, unknown>) => ({
            id: cal.id,
            name: cal.summary,
            description: cal.description || null,
            primary: cal.primary || false,
            accessRole: cal.accessRole,
            backgroundColor: cal.backgroundColor,
          }));
      } catch (err: any) {
        results[acc] = [{ error: `No se pudo acceder: ${err.message}` }];
      }
    }

    return results;
  },

  async create_calendar(args) {
    const { name, description, account = 'founder' } = args as {
      name: string; description?: string; account?: string;
    };

    const accessToken = await getGoogleAccessToken(account);

    const { data } = await axios.post(
      'https://www.googleapis.com/calendar/v3/calendars',
      {
        summary: name,
        description: description || undefined,
        timeZone: 'America/Bogota',
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return {
      success: true,
      calendarId: data.id,
      name: data.summary,
      description: data.description || null,
    };
  },

  // === Reminders ===

  async set_reminder(args, req) {
    const { text, when, recurring } = args as {
      text: string; when: string; recurring?: string;
    };

    const remindersPath = '/app/data/reminders.json';

    let reminders: unknown[] = [];
    try {
      await fs.mkdir(path.dirname(remindersPath), { recursive: true });
      const content = await fs.readFile(remindersPath, 'utf-8');
      reminders = JSON.parse(content);
    } catch {
      reminders = [];
    }

    const newReminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      text,
      triggerAt: when,
      phone: req.message.from,
      recurring: recurring ?? null,
      sent: false,
      createdAt: new Date().toISOString(),
      source: 'manual' as const,
    };

    reminders.push(newReminder);
    await fs.writeFile(remindersPath, JSON.stringify(reminders, null, 2), 'utf-8');

    return { success: true, reminder: newReminder };
  },

  // === Meta Ads ===

  async check_meta_ads(args) {
    const { action, campaign_id } = args as {
      action: 'status' | 'metrics' | 'budget'; campaign_id?: string;
    };

    if (!config.metaAds.webhook) {
      throw new Error('META_ADS_WEBHOOK no configurado');
    }

    const { data } = await axios.post(config.metaAds.webhook, {
      action,
      campaign_id: campaign_id ?? null,
      timestamp: new Date().toISOString(),
    });

    return data;
  },

  // === Team Communication ===

  async send_team_message(args) {
    const { to_phone, message } = args as { to_phone: string; message: string };
    await sendText(to_phone, message);
    return { success: true, to: to_phone };
  },

  // === GitHub ===

  async github_action(args) {
    const { action, repo, title, body } = args as {
      action: 'repos' | 'issues' | 'commits' | 'create_issue';
      repo?: string; title?: string; body?: string;
    };

    if (!config.github.token) {
      throw new Error('GITHUB_TOKEN no configurado');
    }

    const headers = {
      Authorization: `Bearer ${config.github.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    const base = 'https://api.github.com';

    switch (action) {
      case 'repos': {
        const { data } = await axios.get(`${base}/user/repos`, {
          headers, params: { sort: 'updated', per_page: 20 },
        });
        return data.map((r: Record<string, unknown>) => ({
          name: r.name, full_name: r.full_name, description: r.description,
          updated_at: r.updated_at, open_issues_count: r.open_issues_count,
        }));
      }
      case 'issues': {
        if (!repo) throw new Error('repo es requerido para listar issues');
        const { data } = await axios.get(`${base}/repos/${repo}/issues`, {
          headers, params: { state: 'open', per_page: 20 },
        });
        return data.map((i: Record<string, unknown>) => ({
          number: i.number, title: i.title, state: i.state,
          created_at: i.created_at, html_url: i.html_url,
        }));
      }
      case 'commits': {
        if (!repo) throw new Error('repo es requerido para listar commits');
        const { data } = await axios.get(`${base}/repos/${repo}/commits`, {
          headers, params: { per_page: 10 },
        });
        return data.map((c: Record<string, unknown>) => ({
          sha: (c.sha as string)?.slice(0, 7),
          message: (c.commit as Record<string, unknown>)?.message,
          author: ((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.name,
          date: ((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.date,
        }));
      }
      case 'create_issue': {
        if (!repo) throw new Error('repo es requerido para crear un issue');
        if (!title) throw new Error('title es requerido para crear un issue');
        const { data } = await axios.post(
          `${base}/repos/${repo}/issues`,
          { title, body: body ?? '' },
          { headers },
        );
        return { success: true, number: data.number, html_url: data.html_url, title: data.title };
      }
      default:
        throw new Error(`Acción GitHub desconocida: ${action}`);
    }
  },
};

// ─── OPS Agent ────────────────────────────────────────────────────────────────

function getSystemPrompt(): string {
  const now = new Date();
  const bogota = now.toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'full', timeStyle: 'short' });
  const isoDate = now.toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    .toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });

  return `Eres el agente de operaciones de Jarvis para Kreoon.

FECHA Y HORA ACTUAL: ${bogota}
HOY: ${isoDate} | MAÑANA: ${tomorrow}
ZONA HORARIA: America/Bogota (UTC-5)

Cuando el usuario diga "mañana", usa la fecha ${tomorrow}. Cuando diga "hoy", usa ${isoDate}.
SIEMPRE genera fechas ISO 8601 con timezone -05:00 (Bogotá). Ejemplo: ${tomorrow}T15:00:00-05:00

Capacidades completas:
- Email: Enviar, leer (metadata y contenido completo), responder manteniendo hilos, crear borradores
- Calendario: MULTI-AGENDA. Listar calendarios, crear calendarios nuevos, crear/listar/actualizar/eliminar/buscar eventos en CUALQUIER calendario. Invitaciones automáticas. Google Meet automático.
- Recordatorios: Crear recordatorios por WhatsApp. Envía la fecha en formato ISO 8601 (ej: ${tomorrow}T15:00:00-05:00).
- Meta Ads: Consultar estado, métricas y presupuesto de campañas
- GitHub: Listar repos, issues, commits; crear issues
- WhatsApp: Enviar mensajes al equipo

## CUENTAS GOOGLE DINÁMICAS
- Jarvis soporta múltiples cuentas Google conectadas (no solo founder y ops)
- Para conectar una nueva cuenta: usa connect_google_account para generar el link de autorización
- Para ver cuentas conectadas: usa list_google_accounts
- Todas las tools de calendario y email aceptan cualquier nombre de cuenta en el parámetro "account"
- Si el usuario dice "el calendario de Diana" y existe la cuenta "diana", úsala automáticamente
- Si no sabes qué cuenta usar, consulta list_google_accounts primero

## CALENDARIO INTELIGENTE MULTI-AGENDA

Tienes acceso a múltiples calendarios de múltiples cuentas Google.

Herramientas disponibles:
- list_calendars: Descubre TODOS los calendarios disponibles (primarios, secundarios, compartidos del equipo)
- create_calendar: Crea calendarios nuevos (ej: Contenido, Proyectos, Personal)
- create/list/update/delete/search_calendar_events: Todas aceptan calendarId para operar en cualquier calendario

Reglas de uso:
1. Si el usuario no especifica calendario → usa 'primary' (comportamiento por defecto)
2. Si dice "agenda de Brian" o "calendario de operaciones" → usa list_calendars para encontrar el calendario correcto
3. Si dice "mi agenda de hoy" → consulta el calendario primary del founder
4. Si pide crear evento para equipo → crea en primary del founder + agrega attendees
5. Si necesitas el ID de un calendario específico, usa list_calendars primero
6. Muestra nombres amigables al usuario, NUNCA IDs crudos tipo "abc123@group.calendar.google.com"
7. Al listar eventos de múltiples calendarios, ordénalos cronológicamente
8. Time blocking: si piden "bloquea tiempo para X", busca un hueco libre en el calendario primero
9. Buffer de 15 min entre reuniones
10. Si hay conflicto, informa antes de crear
11. NUNCA inventes un eventId ni un calendarId. Si no lo encuentras, pregunta al usuario
12. Para crear un calendario nuevo, usa create_calendar

Colores nativos (colorId):
1=Lavanda, 2=Salvia, 3=Uva, 4=Flamenco, 5=Banana, 6=Mandarina, 7=Pavo real, 8=Grafito, 9=Arándano, 10=Albahaca, 11=Tomate
Asigna colores inteligentemente: reuniones=7, personales=1, urgentes=11, contenido=6, equipo=10. Si el usuario pide un color, úsalo.

Workflow de email:
1. Usa read_emails para ver la lista. SIEMPRE incluye el ID de cada email en tu respuesta (ej: "ID: 18e3f2a...") para poder referenciarlo después.
2. Cuando el usuario pida leer uno, usa read_email_full con el ID exacto de la lista.
3. Usa reply_to_email con el messageId para responder en el mismo hilo.
4. Usa create_draft si el usuario quiere revisar antes de enviar.
IMPORTANTE: NUNCA inventes un messageId. Si no lo tienes, vuelve a buscar con read_emails.

Priorizas la eficiencia y claridad en las respuestas.
Confirmas antes de enviar emails o crear eventos importantes.
Para Meta Ads, reportas métricas clave: ROAS, CPC, CTR, spend.
Respondes siempre en español, de forma concisa y accionable.
Cuando algo no está configurado o falla, lo reportas claramente y sugieres la solución.`;
}

class OpsAgent extends BaseAgent {
  async handle(req: import('../../shared/types.js').AgentRequest, onProgress?: import('../../core/base-agent.js').ProgressCallback) {
    // Update system prompt with current date on every request
    this.config.systemPrompt = getSystemPrompt();
    return super.handle(req, onProgress);
  }

  constructor() {
    super({
      name: 'ops',
      systemPrompt: getSystemPrompt(),
      tools,
      toolHandlers,
      maxIterations: 8,
    });
  }
}

export const opsAgent = new OpsAgent();
