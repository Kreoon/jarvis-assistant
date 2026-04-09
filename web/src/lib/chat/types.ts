export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  thread_id: string;
  role: ChatRole;
  content: string;
  agent: string | null;
  tool_calls: unknown | null;
  created_at: string;
}

export interface ChatThread {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
