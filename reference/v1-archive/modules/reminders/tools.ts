import { registerTool } from "../../core/tool-registry.js";
import * as vault from "../obsidian/vault.js";
import {
  addReminder,
  getPendingReminders,
  deleteReminder,
} from "./store.js";

// --- set_reminder ---
registerTool(
  {
    name: "set_reminder",
    description:
      "Set a reminder that will be sent via WhatsApp at the specified date and time. Also saves to Obsidian daily note. Use when the user says 'recuerdame', 'reminder', 'avisame', or wants to be notified about something.",
    input_schema: {
      type: "object" as const,
      properties: {
        reminder: {
          type: "string",
          description: "What to remind about",
        },
        date: {
          type: "string",
          description:
            "Date for the reminder in YYYY-MM-DD format. Use today's date if the user says 'hoy', tomorrow if 'manana', etc.",
        },
        time: {
          type: "string",
          description:
            "Time for the WhatsApp notification in HH:mm 24h format (Bogota timezone). Default '09:00' if not specified.",
        },
        phone: {
          type: "string",
          description:
            "The user's phone number (from the conversation). Required for WhatsApp delivery.",
        },
      },
      required: ["reminder", "date", "phone"],
    },
  },
  async (input) => {
    const time = input.time || "09:00";
    const date = input.date;

    // Save to reminder scheduler for WhatsApp notification
    const reminder = await addReminder(
      input.reminder,
      date,
      time,
      input.phone
    );

    // Also save to Obsidian daily note
    const dailyPath = `07 - Diario/${date}.md`;
    const nowTime = new Date().toLocaleTimeString("es-CO", {
      timeZone: "America/Bogota",
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      const existing = await vault.readNote(dailyPath);
      if (existing && existing.content.includes("## Recordatorios")) {
        await vault.appendToNote(
          dailyPath,
          `\n- [${time}] ${input.reminder} _(creado ${nowTime})_`
        );
      } else if (existing) {
        await vault.appendToNote(
          dailyPath,
          `\n\n## Recordatorios\n- [${time}] ${input.reminder} _(creado ${nowTime})_`
        );
      } else {
        await vault.writeNote(
          dailyPath,
          `# ${date}\n\n## Recordatorios\n- [${time}] ${input.reminder} _(creado ${nowTime})_`,
          { date, type: "daily" }
        );
      }
    } catch {
      // If vault fails, reminder is still saved in scheduler
    }

    return `Recordatorio configurado para *${date}* a las *${time}*:\n${input.reminder}\n\n_Te enviare un mensaje por WhatsApp a esa hora._`;
  }
);

// --- list_reminders ---
registerTool(
  {
    name: "list_reminders",
    description:
      "List all pending (unsent) reminders for the user. Use when the user asks 'que recordatorios tengo', 'mis reminders', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        phone: {
          type: "string",
          description: "The user's phone number",
        },
      },
      required: ["phone"],
    },
  },
  async (input) => {
    const reminders = await getPendingReminders(input.phone);

    if (reminders.length === 0) {
      return "No tienes recordatorios pendientes.";
    }

    return (
      "*Recordatorios pendientes:*\n\n" +
      reminders
        .map(
          (r) =>
            `*${r.date}* a las *${r.time}*\n${r.message}\n_(id: ${r.id})_`
        )
        .join("\n\n")
    );
  }
);

// --- delete_reminder ---
registerTool(
  {
    name: "delete_reminder",
    description:
      "Delete a specific reminder by ID. Use when the user wants to cancel a reminder.",
    input_schema: {
      type: "object" as const,
      properties: {
        reminder_id: {
          type: "string",
          description: "The reminder ID to delete",
        },
      },
      required: ["reminder_id"],
    },
  },
  async (input) => {
    const deleted = await deleteReminder(input.reminder_id);
    return deleted
      ? "Recordatorio eliminado."
      : "No encontre ese recordatorio.";
  }
);
