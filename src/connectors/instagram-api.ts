/**
 * Instagram Graph API Connector
 * Requires: Meta Business Suite + Instagram Professional Account
 *
 * ENV vars needed:
 * - META_GRAPH_TOKEN: Long-lived token with instagram_basic, instagram_manage_comments,
 *   instagram_manage_messages, pages_manage_engagement permissions
 * - Meta Business accounts linked to each IG account
 *
 * STATUS: Prepared but NOT active until Meta Business Suite is confirmed
 */

import { agentLogger } from '../shared/logger.js';

const log = agentLogger('instagram-api');

const GRAPH_API = 'https://graph.facebook.com/v21.0';

// Social accounts config
export const SOCIAL_ACCOUNTS: Record<string, { instagram: string; igId?: string; pageId?: string }> = {
  alexander_cast: { instagram: 'alexemprendee' },
  reyes_contenido: { instagram: 'reyesdelcontenidoo' },
  ugc_colombia: { instagram: 'agenciaugccolombia' },
  esposa: { instagram: 'militougc' },
  infiny_latam: { instagram: 'infinylatam' },
  kreoon: { instagram: 'somoskreoon' },
  prolab: { instagram: 'saludprolab' },
};

function getToken(): string {
  const token = process.env.META_GRAPH_TOKEN;
  if (!token) throw new Error('META_GRAPH_TOKEN not configured. Connect accounts to Meta Business Suite first.');
  return token;
}

// Get Instagram Business Account ID from username
export async function getIgBusinessId(username: string): Promise<string | null> {
  try {
    const token = getToken();
    const res = await fetch(
      `${GRAPH_API}/ig_hashtag_search?user_id=me&q=${username}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    // This is a placeholder — actual implementation needs the Page ID
    // linked to the IG account via /me/accounts endpoint
    log.info({ username }, 'Looking up IG business ID');
    return null; // Will be populated when Meta Business Suite is configured
  } catch (error: any) {
    log.error({ error: error.message, username }, 'Failed to get IG business ID');
    return null;
  }
}

// Get recent comments on a media post
export async function getComments(mediaId: string, limit = 50): Promise<any[]> {
  const token = getToken();
  const res = await fetch(
    `${GRAPH_API}/${mediaId}/comments?fields=id,text,username,timestamp,like_count,replies{id,text,username,timestamp}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.data || [];
}

// Reply to a comment
export async function replyToComment(commentId: string, message: string): Promise<string> {
  const token = getToken();
  const res = await fetch(`${GRAPH_API}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  log.info({ commentId, replyId: data.id }, 'Comment replied');
  return data.id;
}

// Get recent media posts for an IG account
export async function getRecentMedia(igAccountId: string, limit = 25): Promise<any[]> {
  const token = getToken();
  const res = await fetch(
    `${GRAPH_API}/${igAccountId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,permalink&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
  const data = await res.json() as any;
  return data.data || [];
}

// Get Instagram account insights
export async function getAccountInsights(igAccountId: string, metrics: string[], period = 'day'): Promise<any> {
  const token = getToken();
  const res = await fetch(
    `${GRAPH_API}/${igAccountId}/insights?metric=${metrics.join(',')}&period=${period}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
  return (await res.json() as any).data || [];
}

// Send a DM reply (Instagram Messaging API)
export async function sendIgMessage(igScopedId: string, message: string, pageId: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${GRAPH_API}/${pageId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      recipient: { id: igScopedId },
      message: { text: message },
    }),
  });
  if (!res.ok) throw new Error(`Instagram DM API ${res.status}: ${await res.text()}`);
  log.info({ igScopedId }, 'DM sent');
}

// Get conversations (DMs)
export async function getConversations(igAccountId: string, limit = 20): Promise<any[]> {
  const token = getToken();
  const res = await fetch(
    `${GRAPH_API}/${igAccountId}/conversations?fields=id,participants,messages{id,message,from,created_time}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text()}`);
  return (await res.json() as any).data || [];
}

// Check if API is configured
export function isInstagramApiReady(): boolean {
  return !!process.env.META_GRAPH_TOKEN;
}
