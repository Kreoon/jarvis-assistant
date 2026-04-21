import cron from "node-cron";
import { getDueReminders, markSent, cleanOldReminders } from "./store.js";
import { sendMessage } from "../../connectors/whatsapp.js";
import { listCalendarEvents } from "../../connectors/gmail.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const OWNER_PHONE = process.env.ROLE_PHONES_OWNER || "";
const SENT_FILE = "/app/data/calendar-reminders-sent.json";

async function loadSentReminders(): Promise<Set<string>> {
  try {
    if (!existsSync(SENT_FILE)) return new Set();
    const raw = await readFile(SENT_FILE, "utf-8");
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

async function saveSentReminder(key: string): Promise<void> {
  const sent = await loadSentReminders();
  sent.add(key);
  // Keep only last 500 entries to prevent file growth
  const arr = Array.from(sent).slice(-500);
  await mkdir("/app/data", { recursive: true });
  await writeFile(SENT_FILE, JSON.stringify(arr), "utf-8");
}

/**
 * Check Google Calendar and send WhatsApp reminders
 * at 30 min, 10 min, and at meeting time
 */
async function checkCalendarReminders(): Promise<void> {
  if (!OWNER_PHONE) return;

  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }));
    const today = now.toISOString().split("T")[0];
    const events = await listCalendarEvents(today);
    const sent = await loadSentReminders();
    const nowMs = now.getTime();

    for (const event of events) {
      if (!event.start?.dateTime) continue;

      const eventStart = new Date(event.start.dateTime);
      const eventStartMs = new Date(
        eventStart.toLocaleString("en-US", { timeZone: "America/Bogota" })
      ).getTime();
      const diffMin = Math.round((eventStartMs - nowMs) / 60000);

      const title = event.summary || "Reunión";
      const startTime = eventStart.toLocaleTimeString("es-CO", {
        timeZone: "America/Bogota",
        hour: "2-digit",
        minute: "2-digit",
      });

      // Get meeting link
      const meetLink = event.hangoutLink
        || event.conferenceData?.entryPoints?.[0]?.uri
        || event.location
        || "";

      const linkLine = meetLink ? "\n\n🔗 " + meetLink : "";

      // 30 min reminder
      const key30 = event.id + "_30";
      if (diffMin <= 30 && diffMin > 25 && !sent.has(key30)) {
        await sendMessage(
          OWNER_PHONE,
          "⏰ *En 30 minutos:*\n\n📅 *" + title + "*\n🕐 " + startTime + linkLine
        );
        await saveSentReminder(key30);
        console.log("📅 30min reminder: " + title);
      }

      // 10 min reminder
      const key10 = event.id + "_10";
      if (diffMin <= 10 && diffMin > 5 && !sent.has(key10)) {
        await sendMessage(
          OWNER_PHONE,
          "⏰ *En 10 minutos:*\n\n📅 *" + title + "*\n🕐 " + startTime + linkLine
        );
        await saveSentReminder(key10);
        console.log("📅 10min reminder: " + title);
      }

      // At meeting time
      const key0 = event.id + "_0";
      if (diffMin <= 1 && diffMin >= -2 && !sent.has(key0)) {
        await sendMessage(
          OWNER_PHONE,
          "🔴 *AHORA:*\n\n📅 *" + title + "*\n🕐 " + startTime + linkLine
        );
        await saveSentReminder(key0);
        console.log("📅 NOW reminder: " + title);
      }
    }
  } catch (error) {
    // Silent fail - don't spam logs if calendar is temporarily unavailable
  }
}

export function startReminderScheduler(): void {
  // Check custom reminders every minute
  cron.schedule("* * * * *", async () => {
    try {
      const due = await getDueReminders();
      for (const reminder of due) {
        try {
          await sendMessage(reminder.phone, "⏰ *Recordatorio*\n\n" + reminder.message);
          await markSent(reminder.id);
          console.log("Reminder sent: " + reminder.message);
        } catch (error) {
          console.error("Failed to send reminder:", error);
        }
      }
    } catch (error) {
      console.error("Reminder error:", error);
    }
  });

  // Check Google Calendar reminders every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    await checkCalendarReminders();
  });

  // Clean old data daily at 3 AM Bogota (8 UTC)
  cron.schedule("0 8 * * *", async () => {
    try {
      await cleanOldReminders();
      // Reset sent calendar reminders daily
      if (existsSync(SENT_FILE)) {
        await writeFile(SENT_FILE, "[]", "utf-8");
      }
      console.log("Old reminders cleaned");
    } catch (error) {
      console.error("Cleanup error:", error);
    }
  });

  console.log("Reminder scheduler started (custom + Google Calendar)");
}
