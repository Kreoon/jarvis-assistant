import { registerTool } from "../../core/tool-registry.js";
import * as cal from "../../connectors/cal.js";

registerTool(
  { name: "create_cal_event", description: "Create calendar event.", input_schema: { type: "object" as const, properties: { title: { type: "string" }, datetime: { type: "string" }, duration_min: { type: "number" }, attendee_name: { type: "string" }, attendee_email: { type: "string" }, description: { type: "string" } }, required: ["title","datetime","attendee_email","attendee_name"] } },
  async (input) => {
    try {
      const b = await cal.createBooking(input.title, input.datetime, input.duration_min || 30, input.attendee_name, input.attendee_email, input.description || "");
      return `📅 Reunión: **${input.title}**\n📆 ${input.datetime}\n⏱ ${input.duration_min||30}min\n👤 ${input.attendee_name}`;
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);

registerTool(
  { name: "list_today_events", description: "List today calendar events.", input_schema: { type: "object" as const, properties: {}, required: [] } },
  async () => {
    try {
      const bookings = await cal.listTodayBookings();
      if (bookings.length === 0) return "No hay reuniones hoy.";
      return "📅 *Hoy:*\n" + bookings.map((b: any) => `⏰ ${new Date(b.startTime).toLocaleTimeString("es-CO",{timeZone:"America/Bogota",hour:"2-digit",minute:"2-digit"})} — **${b.title}**`).join("\n");
    } catch (e: any) { return `Error: ${e.message}`; }
  }
);
