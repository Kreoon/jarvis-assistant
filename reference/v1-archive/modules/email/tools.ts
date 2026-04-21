import { registerTool } from "../../core/tool-registry.js";
import { searchMessages, readMessage, sendGmail, createCalendarEvent, listCalendarEvents, deleteCalendarEvent, updateCalendarEvent } from "../../connectors/gmail.js";

registerTool(
  { name: "search_email", description: "Search Gmail inbox.", input_schema: { type: "object" as const, properties: { query: { type: "string", description: "Gmail search query (supports from:, subject:, after:, is:unread)" }, max_results: { type: "number" } }, required: ["query"] } },
  async (input) => {
    try {
      const msgs = await searchMessages(input.query, input.max_results || 5);
      if (msgs.length === 0) return "No emails found.";
      return msgs.map(m => "**" + m.subject + "**\nDe: " + m.from + "\n" + m.snippet + "\n_ID: " + m.id + "_").join("\n\n");
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  { name: "read_email", description: "Read full email content by ID.", input_schema: { type: "object" as const, properties: { message_id: { type: "string" } }, required: ["message_id"] } },
  async (input) => {
    try {
      const m = await readMessage(input.message_id);
      return "**" + m.subject + "**\nDe: " + m.from + "\nFecha: " + m.date + "\n\n" + m.body;
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  { name: "send_email", description: "Send an email from founder@kreoon.com via Gmail.", input_schema: { type: "object" as const, properties: { to: { type: "string", description: "Recipient email" }, subject: { type: "string" }, body: { type: "string", description: "Email body (HTML supported)" } }, required: ["to", "subject", "body"] } },
  async (input) => {
    try {
      await sendGmail(input.to, input.subject, input.body);
      return "Email enviado a " + input.to + ": \"" + input.subject + "\"";
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "create_calendar_event",
    description: "Create a Google Calendar event. IMPORTANT: The current year is 2026. duration_min defaults to 30. ALWAYS include the requesting user's email in attendees. Team emails: Alexander=founder@kreoon.com, Brian=operaciones@kreoon.com.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string", description: "Event title" },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        start_time: { type: "string", description: "Start time HH:mm in 24h format, Bogota timezone. Example: 09:00, 14:30, 18:00" },
        duration_min: { type: "number", description: "Duration in minutes. Default 30. Examples: 30 for half hour, 60 for 1 hour, 15 for quick call" },
        description: { type: "string" },
        attendees: { type: "array", items: { type: "string" }, description: "Attendee email addresses" },
      },
      required: ["title", "date", "start_time"],
    },
  },
  async (input) => {
    try {
      // Normalize field names (Gemini sometimes uses different names)
      const date = input.date || input.start_date;
      const startTime = input.start_time;
      const duration = input.duration_min || input.duration || input.duration_minutes || 30;
      const attendees = input.attendees || input.attendee_emails || input.attendees_emails || [];

      if (!date || !startTime) return "Error: necesito fecha (date) y hora (start_time)";

      // Build start and end times
      const [hours, minutes] = startTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + duration;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMins = totalMinutes % 60;
      const endTime = String(endHours).padStart(2, "0") + ":" + String(endMins).padStart(2, "0");

      const startStr = date + "T" + startTime + ":00-05:00";
      const endStr = date + "T" + endTime + ":00-05:00";

      // Check for conflicts before creating
      const existing = await listCalendarEvents(date);
      const conflicts = existing.filter((e: any) => {
        if (!e.start?.dateTime || !e.end?.dateTime) return false;
        const eStart = new Date(e.start.dateTime).getTime();
        const eEnd = new Date(e.end.dateTime).getTime();
        const newStart = new Date(startStr).getTime();
        const newEnd = new Date(endStr).getTime();
        return newStart < eEnd && newEnd > eStart;
      });

      if (conflicts.length > 0) {
        const conflictList = conflicts.map((c: any) => {
          const cs = new Date(c.start.dateTime).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
          const ce = new Date(c.end.dateTime).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
          return "  - " + cs + "-" + ce + " **" + (c.summary || "Sin titulo") + "**";
        }).join("\n");
        return "Ya tienes eventos a esa hora:\n" + conflictList + "\n\nEl horario " + startTime + "-" + endTime + " se cruza. Quieres que la agende de todas formas o prefieres otro horario?";
      }

      const event = await createCalendarEvent(
        input.title, startStr, endStr, input.description, attendees.length > 0 ? attendees : undefined
      );

      return "Evento creado: **" + input.title + "**\n" +
        date + " de " + startTime + " a " + endTime + " (" + duration + " min)" +
        (attendees.length > 0 ? "\nAsistentes: " + attendees.join(", ") : "") +
        (event.htmlLink ? "\n" + event.htmlLink : "");
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "list_calendar_events",
    description: "List Google Calendar events for a specific date. Use when user asks about their agenda, meetings, schedule, or what they have today.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Date YYYY-MM-DD. Default: today." },
      },
      required: [],
    },
  },
  async (input) => {
    try {
      const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
      const date = input.date || now.toISOString().split("T")[0];
      const events = await listCalendarEvents(date);
      if (events.length === 0) return "No hay eventos para " + date;
      return "**Agenda " + date + ":**\n\n" + events.map((e: any) => {
        if (e.start?.dateTime) {
          const start = new Date(e.start.dateTime).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" });
          const end = e.end?.dateTime ? new Date(e.end.dateTime).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" }) : "";
          return start + (end ? "-" + end : "") + " — **" + (e.summary || "Sin titulo") + "**" +
            (e.attendees?.length ? " (" + e.attendees.length + " asistentes)" : "") +
            "\n  _ID: " + e.id + "_";
        }
        return "Todo el dia — **" + (e.summary || "Sin titulo") + "**\n  _ID: " + e.id + "_";
      }).join("\n");
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "cancel_calendar_event",
    description: "Cancel/delete a Google Calendar event. Use when the user wants to cancel, delete, or remove a meeting. First use list_calendar_events to get the event ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "The event ID from list_calendar_events" },
      },
      required: ["event_id"],
    },
  },
  async (input) => {
    try {
      await deleteCalendarEvent(input.event_id);
      return "Evento cancelado.";
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "move_calendar_event",
    description: "Reschedule/move a Google Calendar event to a new date or time. First use list_calendar_events to get the event ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        event_id: { type: "string", description: "The event ID to move" },
        new_date: { type: "string", description: "New date YYYY-MM-DD" },
        new_start_time: { type: "string", description: "New start time HH:mm (24h, Bogota)" },
        duration_min: { type: "number", description: "Duration in minutes (default 30)" },
        new_title: { type: "string", description: "Optional new title" },
      },
      required: ["event_id", "new_date", "new_start_time"],
    },
  },
  async (input) => {
    try {
      const duration = input.duration_min || 30;
      const [h, m] = input.new_start_time.split(":").map(Number);
      const total = h * 60 + m + duration;
      const endH = String(Math.floor(total / 60) % 24).padStart(2, "0");
      const endM = String(total % 60).padStart(2, "0");

      const updates: any = {
        start: input.new_date + "T" + input.new_start_time + ":00-05:00",
        end: input.new_date + "T" + endH + ":" + endM + ":00-05:00",
      };
      if (input.new_title) updates.summary = input.new_title;

      const event = await updateCalendarEvent(input.event_id, updates);
      return "Evento movido: **" + (event.summary || input.new_title || "?") + "**\n" +
        input.new_date + " de " + input.new_start_time + " a " + endH + ":" + endM + " (" + duration + " min)";
    } catch (e: any) { return "Error: " + e.message; }
  }
);
