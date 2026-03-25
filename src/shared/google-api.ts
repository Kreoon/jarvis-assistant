import axios from 'axios';
import fs from 'fs';
import { config } from './config.js';

// ─── Dynamic Google Accounts ────────────────────────────────────────────────

const ACCOUNTS_FILE = '/app/data/google-accounts.json';

export interface GoogleAccount {
  email: string;
  refreshToken: string;
  name: string;
  connectedAt: string;
}

function loadAccounts(): Record<string, GoogleAccount> {
  try {
    return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf-8'));
  } catch {
    // Bootstrap: create file from existing env vars
    const accounts: Record<string, GoogleAccount> = {};
    if (config.google.refreshTokenFounder) {
      accounts.founder = {
        email: 'founder@kreoon.com',
        refreshToken: config.google.refreshTokenFounder,
        name: 'Alexander',
        connectedAt: new Date().toISOString(),
      };
    }
    if (config.google.refreshTokenOps) {
      accounts.ops = {
        email: 'operaciones@kreoon.com',
        refreshToken: config.google.refreshTokenOps,
        name: 'Brian',
        connectedAt: new Date().toISOString(),
      };
    }
    try {
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
    } catch { /* data dir may not exist yet */ }
    return accounts;
  }
}

export function saveAccount(key: string, account: GoogleAccount): void {
  const accounts = loadAccounts();
  accounts[key] = account;
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

export function listAccounts(): Record<string, { email: string; name: string; connectedAt: string }> {
  const accounts = loadAccounts();
  const safe: Record<string, { email: string; name: string; connectedAt: string }> = {};
  for (const [key, acc] of Object.entries(accounts)) {
    safe[key] = { email: acc.email, name: acc.name, connectedAt: acc.connectedAt };
  }
  return safe;
}

// ─── OAuth Token ─────────────────────────────────────────────────────────────

export async function getGoogleAccessToken(account: string): Promise<string> {
  const accounts = loadAccounts();
  const acc = accounts[account];

  if (!acc?.refreshToken) {
    const available = Object.keys(accounts).join(', ');
    throw new Error(`No hay cuenta Google conectada con el nombre: "${account}". Cuentas disponibles: ${available || 'ninguna'}`);
  }

  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    refresh_token: acc.refreshToken,
    grant_type: 'refresh_token',
  });

  return data.access_token as string;
}

// ─── Gmail Helpers ───────────────────────────────────────────────────────────

export async function searchEmails(
  query: string,
  maxResults: number = 10,
  account: string = 'founder'
): Promise<{ id: string; from: string; subject: string; date: string; snippet: string }[]> {
  const accessToken = await getGoogleAccessToken(account);

  const listRes = await axios.get(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages',
    {
      params: { q: query, maxResults },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const messages = listRes.data.messages ?? [];

  const details = await Promise.all(
    messages.slice(0, maxResults).map(async (msg: { id: string }) => {
      const msgRes = await axios.get(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        {
          params: { format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] },
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const headers: { name: string; value: string }[] = msgRes.data.payload?.headers ?? [];
      const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
      return {
        id: msg.id,
        from: get('From'),
        subject: get('Subject'),
        date: get('Date'),
        snippet: msgRes.data.snippet,
      };
    }),
  );

  return details;
}

export async function readEmailFull(
  messageId: string,
  account: string = 'founder'
): Promise<{
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labels: string[];
}> {
  const accessToken = await getGoogleAccessToken(account);

  const { data } = await axios.get(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      params: { format: 'full' },
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const headers: { name: string; value: string }[] = data.payload?.headers ?? [];
  const get = (name: string) => headers.find((h: { name: string; value: string }) => h.name === name)?.value ?? '';

  // Parse MIME parts to extract body
  let body = '';
  const extractBody = (part: Record<string, unknown>): void => {
    if (part.mimeType === 'text/plain' && (part.body as Record<string, unknown>)?.data) {
      const decoded = Buffer.from(
        ((part.body as Record<string, unknown>).data as string).replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf-8');
      body = decoded;
    }
    if (part.mimeType === 'text/html' && !body && (part.body as Record<string, unknown>)?.data) {
      const decoded = Buffer.from(
        ((part.body as Record<string, unknown>).data as string).replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf-8');
      body = decoded.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const parts = part.parts as Record<string, unknown>[] | undefined;
    if (parts) {
      for (const sub of parts) {
        extractBody(sub);
      }
    }
  };

  extractBody(data.payload);

  // Fallback to snippet if no body found
  if (!body) body = data.snippet || '';

  return {
    id: data.id,
    threadId: data.threadId,
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
    body: body.slice(0, 5000), // Limit body length
    labels: data.labelIds ?? [],
  };
}
