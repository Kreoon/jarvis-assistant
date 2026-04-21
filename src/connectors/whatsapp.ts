import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';
import type { MediaAttachment } from '../shared/types.js';

const log = agentLogger('whatsapp');
const API_URL = `https://graph.facebook.com/v21.0/${config.wa.phoneNumberId}`;

const headers = {
  Authorization: `Bearer ${config.wa.accessToken}`,
  'Content-Type': 'application/json',
};

export async function sendText(to: string, text: string): Promise<void> {
  // WhatsApp max message length is ~4096
  const chunks = splitMessage(text, 4000);

  for (const chunk of chunks) {
    await axios.post(`${API_URL}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: chunk },
    }, { headers });
  }

  log.info({ to, length: text.length }, 'Message sent');
}

export async function sendReaction(to: string, messageId: string, emoji: string): Promise<void> {
  await axios.post(`${API_URL}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'reaction',
    reaction: { message_id: messageId, emoji },
  }, { headers });
}

export async function sendMedia(to: string, media: MediaAttachment): Promise<void> {
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: media.type,
  };

  if (media.url) {
    payload[media.type] = { link: media.url, caption: media.caption };
  }

  await axios.post(`${API_URL}/messages`, payload, { headers });
  log.info({ to, type: media.type }, 'Media sent');
}

export async function downloadMedia(mediaId: string): Promise<Buffer> {
  // Step 1: Get media URL
  const { data: mediaInfo } = await axios.get(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    { headers }
  );

  // Step 2: Download media
  const { data } = await axios.get(mediaInfo.url, {
    headers,
    responseType: 'arraybuffer',
  });

  return Buffer.from(data);
}

export async function downloadMediaToFile(
  mediaId: string,
  ext: string,
  dir: string = '/app/data/tmp'
): Promise<string> {
  const buffer = await downloadMedia(mediaId);
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `wa-${mediaId}-${Date.now()}.${ext}`);
  await fs.writeFile(filePath, buffer);
  log.info({ filePath, size: buffer.length }, 'Media downloaded to file');
  return filePath;
}

export async function markAsRead(messageId: string): Promise<void> {
  await axios.post(`${API_URL}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId,
  }, { headers }).catch(() => {});
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

    // Find last newline before maxLength
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt === -1 || splitAt < maxLength * 0.5) {
      splitAt = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitAt === -1) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
