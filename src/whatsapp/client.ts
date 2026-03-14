import { config } from "../config.js";

const GRAPH_API = "https://graph.facebook.com/v21.0";

interface WhatsAppMessage {
  from: string;
  text: string;
  messageId: string;
  timestamp: string;
  type: "text" | "audio";
  mediaId?: string;
}

/**
 * Send a text message via WhatsApp Cloud API
 */
export async function sendMessage(to: string, text: string): Promise<void> {
  // WhatsApp has a 4096 char limit per message
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    const response = await fetch(
      `${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.whatsapp.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: chunk },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      throw new Error(`Failed to send message: ${response.status}`);
    }
  }
}

/**
 * Mark a message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  await fetch(`${GRAPH_API}/${config.whatsapp.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.whatsapp.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
}

/**
 * Extract incoming messages from webhook payload
 */
export function parseWebhookMessage(
  body: any
): WhatsAppMessage | null {
  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages?.[0]) return null;

    const message = value.messages[0];

    if (message.type === "text") {
      return {
        from: message.from,
        text: message.text.body,
        messageId: message.id,
        timestamp: message.timestamp,
        type: "text",
      };
    }

    if (message.type === "audio") {
      return {
        from: message.from,
        text: "",
        messageId: message.id,
        timestamp: message.timestamp,
        type: "audio",
        mediaId: message.audio.id,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if a number is allowed to use the bot
 */
export function isAllowed(phoneNumber: string): boolean {
  if (config.whatsapp.allowedNumbers.length === 0) return true;
  return config.whatsapp.allowedNumbers.includes(phoneNumber);
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split at a newline
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      // Try to split at a space
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex).trimStart();
  }

  return chunks;
}
