/**
 * Jarvis API client.
 * All SSE methods return an AbortController so the caller can cancel.
 */

function getDefaultBaseUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return "http://localhost:3000";
}

// --- Types ---

export interface ChatResponse {
  id: string;
  response: string;
}

export interface AudioResponse {
  transcription: string;
  response: string;
}

export interface UploadChatResponse {
  response: string;
}

export interface AgentInfo {
  name: string;
  desc: string;
  status?: string;
}

export interface ReportEntry {
  id: string;
  date: string;
  content: string;
  updatedAt: string;
}

export interface MemorySearchResult {
  results: unknown[];
  query: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
}

export interface TTSStatus {
  available: boolean;
  voiceId: string | null;
}

export interface MetricsData {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: unknown;
}

export interface JobEntry {
  id: string;
  name: string;
  status: string;
  scheduledAt?: string;
  [key: string]: unknown;
}

// --- SSE helpers ---

type SSEProgressCallback = (text: string) => void;

function parseSSELine(line: string): string | null {
  if (line.startsWith("data: ")) {
    const raw = line.slice(6).trim();
    if (raw === "[DONE]") return null;
    try {
      const parsed = JSON.parse(raw) as { text?: string; chunk?: string; delta?: string };
      return parsed.text ?? parsed.chunk ?? parsed.delta ?? null;
    } catch {
      // Raw text chunk, not JSON
      return raw;
    }
  }
  return null;
}

async function consumeSSE(
  response: Response,
  onProgress: SSEProgressCallback,
  signal: AbortSignal
): Promise<string> {
  if (!response.body) throw new Error("Response body is null");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const chunk = parseSSELine(line.trim());
        if (chunk) {
          fullText += chunk;
          onProgress(fullText);
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  return fullText;
}

// --- JarvisAPI class ---

export class JarvisAPI {
  private baseUrl: string;

  constructor(
    private token: string,
    baseUrl?: string
  ) {
    this.baseUrl =
      baseUrl ??
      (typeof process !== "undefined"
        ? (process.env.NEXT_PUBLIC_API_URL ?? getDefaultBaseUrl())
        : getDefaultBaseUrl());
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
    };
  }

  private jsonHeaders(): Record<string, string> {
    return {
      ...this.authHeaders(),
      "Content-Type": "application/json",
    };
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json() as Promise<T>;
  }

  // --- Chat ---

  async chat(message: string): Promise<ChatResponse> {
    return this.post<ChatResponse>("/api/chat", { message });
  }

  chatStream(
    message: string,
    onProgress: SSEProgressCallback,
    onComplete: (text: string) => void
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/chat/stream`, {
          method: "POST",
          headers: this.jsonHeaders(),
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`chatStream failed: ${res.status}`);
        const full = await consumeSSE(res, onProgress, controller.signal);
        if (!controller.signal.aborted) onComplete(full);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[JarvisAPI] chatStream error:", err);
        }
      }
    })();

    return controller;
  }

  async sendAudio(blob: Blob): Promise<AudioResponse> {
    const form = new FormData();
    form.append("audio", blob, "recording.webm");

    const res = await fetch(`${this.baseUrl}/api/chat/audio`, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(`sendAudio failed: ${res.status}`);
    return res.json() as Promise<AudioResponse>;
  }

  async uploadAndChat(file: File, message?: string): Promise<UploadChatResponse> {
    const form = new FormData();
    form.append("file", file);
    if (message) form.append("message", message);

    const res = await fetch(`${this.baseUrl}/api/chat/upload`, {
      method: "POST",
      headers: this.authHeaders(),
      body: form,
    });
    if (!res.ok) throw new Error(`uploadAndChat failed: ${res.status}`);
    return res.json() as Promise<UploadChatResponse>;
  }

  // --- System ---

  async getStatus(): Promise<unknown> {
    return this.get<unknown>("/api/system/status");
  }

  async getMetrics(): Promise<MetricsData> {
    return this.get<MetricsData>("/api/system/metrics");
  }

  async getLogs(limit = 50): Promise<LogEntry[]> {
    return this.get<LogEntry[]>(`/api/system/logs?limit=${limit}`);
  }

  async getJobs(): Promise<JobEntry[]> {
    return this.get<JobEntry[]>("/api/system/jobs");
  }

  // --- Agents ---

  async getAgents(): Promise<AgentInfo[]> {
    return this.get<AgentInfo[]>("/api/agents");
  }

  agentInteract(
    name: string,
    message: string,
    onProgress: SSEProgressCallback,
    onComplete: (text: string) => void
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/agents/${encodeURIComponent(name)}/interact`, {
          method: "POST",
          headers: this.jsonHeaders(),
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`agentInteract failed: ${res.status}`);
        const full = await consumeSSE(res, onProgress, controller.signal);
        if (!controller.signal.aborted) onComplete(full);
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[JarvisAPI] agentInteract error:", err);
        }
      }
    })();

    return controller;
  }

  // --- Reports / Engine ---

  async getReports(): Promise<ReportEntry[]> {
    return this.get<ReportEntry[]>("/api/engine/reports");
  }

  async getLatestReport(): Promise<ReportEntry> {
    return this.get<ReportEntry>("/api/engine/latest");
  }

  triggerEngine(
    onProgress: SSEProgressCallback,
    onComplete: (report: ReportEntry) => void
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/engine/trigger`, {
          method: "POST",
          headers: this.jsonHeaders(),
          body: JSON.stringify({}),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`triggerEngine failed: ${res.status}`);
        const full = await consumeSSE(res, onProgress, controller.signal);
        if (!controller.signal.aborted) {
          try {
            const report = JSON.parse(full) as ReportEntry;
            onComplete(report);
          } catch {
            // If the full text isn't JSON, wrap it
            onComplete({
              id: crypto.randomUUID(),
              date: new Date().toISOString().split("T")[0],
              content: full,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          console.error("[JarvisAPI] triggerEngine error:", err);
        }
      }
    })();

    return controller;
  }

  // --- Memory ---

  async searchMemory(query: string): Promise<MemorySearchResult> {
    return this.post<MemorySearchResult>("/api/memory/search", { query });
  }

  async listMemories(namespace?: string): Promise<unknown> {
    const path = namespace
      ? `/api/memory/list?namespace=${encodeURIComponent(namespace)}`
      : "/api/memory/list";
    return this.get<unknown>(path);
  }

  // --- Calendar ---

  async getCalendarEvents(days = 7): Promise<CalendarEvent[]> {
    return this.get<CalendarEvent[]>(`/api/calendar/events?days=${days}`);
  }

  // --- TTS ---

  async getTTSStatus(): Promise<TTSStatus> {
    return this.get<TTSStatus>("/api/tts/status");
  }

  async streamTTS(text: string): Promise<ArrayBuffer> {
    const res = await fetch(`${this.baseUrl}/api/tts`, {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`streamTTS failed: ${res.status}`);
    return res.arrayBuffer();
  }
}
