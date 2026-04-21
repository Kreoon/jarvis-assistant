import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const DATA_DIR = "/app/data";
const REMINDERS_FILE = `${DATA_DIR}/reminders.json`;

export interface Reminder {
  id: string;
  message: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h, Bogota timezone)
  phone: string;
  sent: boolean;
  created: string;
}

interface ReminderStore {
  reminders: Reminder[];
}

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
}

async function loadStore(): Promise<ReminderStore> {
  await ensureDataDir();
  if (!existsSync(REMINDERS_FILE)) {
    return { reminders: [] };
  }
  const raw = await readFile(REMINDERS_FILE, "utf-8");
  return JSON.parse(raw);
}

async function saveStore(store: ReminderStore): Promise<void> {
  await ensureDataDir();
  await writeFile(REMINDERS_FILE, JSON.stringify(store, null, 2), "utf-8");
}

/**
 * Add a new reminder
 */
export async function addReminder(
  message: string,
  date: string,
  time: string,
  phone: string
): Promise<Reminder> {
  const store = await loadStore();

  const reminder: Reminder = {
    id: Date.now().toString(36),
    message,
    date,
    time,
    phone,
    sent: false,
    created: new Date().toISOString(),
  };

  store.reminders.push(reminder);
  await saveStore(store);
  return reminder;
}

/**
 * Get reminders due now (within the current minute)
 */
export async function getDueReminders(): Promise<Reminder[]> {
  const store = await loadStore();

  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })
  );
  const today = now.toISOString().split("T")[0];
  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return store.reminders.filter(
    (r) => !r.sent && r.date === today && r.time === currentTime
  );
}

/**
 * Mark a reminder as sent
 */
export async function markSent(id: string): Promise<void> {
  const store = await loadStore();
  const reminder = store.reminders.find((r) => r.id === id);
  if (reminder) {
    reminder.sent = true;
    await saveStore(store);
  }
}

/**
 * Get all pending reminders for a phone number
 */
export async function getPendingReminders(
  phone: string
): Promise<Reminder[]> {
  const store = await loadStore();
  return store.reminders.filter((r) => !r.sent && r.phone === phone);
}

/**
 * Delete a reminder
 */
export async function deleteReminder(id: string): Promise<boolean> {
  const store = await loadStore();
  const before = store.reminders.length;
  store.reminders = store.reminders.filter((r) => r.id !== id);
  if (store.reminders.length < before) {
    await saveStore(store);
    return true;
  }
  return false;
}

/**
 * Clean up old sent reminders (older than 7 days)
 */
export async function cleanOldReminders(): Promise<void> {
  const store = await loadStore();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  store.reminders = store.reminders.filter(
    (r) => !r.sent || r.date >= weekAgo
  );
  await saveStore(store);
}
