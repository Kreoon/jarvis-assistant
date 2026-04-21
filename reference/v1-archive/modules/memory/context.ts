interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface Conversation {
  messages: Message[];
  lastActivity: number;
}

const MAX_MESSAGES = 20;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

const conversations = new Map<string, Conversation>();

/**
 * Add a message to conversation history
 */
export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): void {
  let conv = conversations.get(conversationId);

  if (!conv || Date.now() - conv.lastActivity > EXPIRY_MS) {
    conv = { messages: [], lastActivity: Date.now() };
    conversations.set(conversationId, conv);
  }

  conv.messages.push({ role, content, timestamp: Date.now() });
  conv.lastActivity = Date.now();

  // Trim to max messages
  if (conv.messages.length > MAX_MESSAGES) {
    conv.messages = conv.messages.slice(-MAX_MESSAGES);
  }
}

/**
 * Get conversation history
 */
export function getHistory(conversationId: string): Message[] {
  const conv = conversations.get(conversationId);
  if (!conv) return [];

  // Check expiry
  if (Date.now() - conv.lastActivity > EXPIRY_MS) {
    conversations.delete(conversationId);
    return [];
  }

  return conv.messages;
}

/**
 * Clear conversation history
 */
export function clearHistory(conversationId: string): void {
  conversations.delete(conversationId);
}
