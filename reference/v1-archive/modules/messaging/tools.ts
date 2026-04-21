import { registerTool } from "../../core/tool-registry.js";
import { sendToTeamMember, getTeamDirectory, isInWindow } from "../../connectors/whatsapp.js";
import { addReminder } from "../reminders/store.js";

registerTool(
  {
    name: "send_whatsapp",
    description: "Send a WhatsApp message to a team member by name. Use when Alexander says 'dile a Brian', 'enviale mensaje a Brian', 'recuerdale a Brian'. Only works within the 24h window since their last message. Team: Alexander, Brian.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Team member name (e.g., 'Brian', 'Alexander')" },
        message: { type: "string", description: "Message to send" },
      },
      required: ["to", "message"],
    },
  },
  async (input) => {
    try {
      return await sendToTeamMember(input.to, input.message);
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "send_whatsapp_reminder",
    description: "Schedule a WhatsApp reminder for a team member at a specific date and time. Use when Alexander says 'recuerdale a Brian mañana a las 9', 'enviale recordatorio'. The reminder will be sent automatically at the scheduled time.",
    input_schema: {
      type: "object" as const,
      properties: {
        to: { type: "string", description: "Team member name (e.g., 'Brian')" },
        message: { type: "string", description: "Reminder message" },
        date: { type: "string", description: "Date YYYY-MM-DD" },
        time: { type: "string", description: "Time HH:mm 24h (default 09:00)" },
      },
      required: ["to", "message", "date"],
    },
  },
  async (input) => {
    try {
      const dir = getTeamDirectory();
      const q = input.to.toLowerCase();
      const member = dir.find(m => m.name.toLowerCase().includes(q));
      if (!member) return "No encontre a '" + input.to + "' en el equipo.";

      const time = input.time || "09:00";
      await addReminder(
        "Para " + member.name + ": " + input.message,
        input.date,
        time,
        member.phone
      );

      return "Recordatorio programado para *" + member.name + "* el " + input.date + " a las " + time + ":\n" + input.message;
    } catch (e: any) { return "Error: " + e.message; }
  }
);

registerTool(
  {
    name: "list_team",
    description: "List all team members registered in Jarvis with their roles and WhatsApp status.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  async () => {
    try {
      const dir = getTeamDirectory();
      const lines = [];
      for (const m of dir) {
        const inWindow = await isInWindow(m.phone);
        const status = inWindow ? "🟢 activo" : "🔴 sin ventana 24h";
        lines.push("**" + m.name + "** (" + m.role + ")\n  " + m.phone + " | " + m.email + "\n  " + status);
      }
      return lines.join("\n\n");
    } catch (e: any) { return "Error: " + e.message; }
  }
);
