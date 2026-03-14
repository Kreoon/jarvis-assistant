interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ConversationContext {
  messages: Message[];
  lastActive: number;
}

/**
 * In-memory conversation store per phone number.
 * Messages expire after 1 hour of inactivity.
 */
const conversations = new Map<string, ConversationContext>();

const MAX_MESSAGES = 20;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export function getHistory(phoneNumber: string): Message[] {
  const ctx = conversations.get(phoneNumber);
  if (!ctx) return [];

  // Expire old conversations
  if (Date.now() - ctx.lastActive > EXPIRY_MS) {
    conversations.delete(phoneNumber);
    return [];
  }

  return ctx.messages;
}

export function addMessage(
  phoneNumber: string,
  role: "user" | "assistant",
  content: string
): void {
  let ctx = conversations.get(phoneNumber);

  if (!ctx) {
    ctx = { messages: [], lastActive: Date.now() };
    conversations.set(phoneNumber, ctx);
  }

  ctx.messages.push({ role, content, timestamp: Date.now() });
  ctx.lastActive = Date.now();

  // Keep only recent messages
  if (ctx.messages.length > MAX_MESSAGES) {
    ctx.messages = ctx.messages.slice(-MAX_MESSAGES);
  }
}

export function clearHistory(phoneNumber: string): void {
  conversations.delete(phoneNumber);
}
