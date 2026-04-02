// Ring buffer for in-memory log storage (exposed via /api/system/logs)

export interface LogEntry {
  level: string;
  msg: string;
  time: number;
  [key: string]: unknown;
}

const MAX_ENTRIES = 200;
const buffer: LogEntry[] = [];

export function pushLog(entry: LogEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
}

export function getLogs(limit = 100): LogEntry[] {
  return buffer.slice(-limit);
}

export function clearLogs(): void {
  buffer.length = 0;
}
