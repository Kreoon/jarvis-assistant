import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  webhookVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'jarvis-kreoon-2024',
  webPlatformToken: process.env.JARVIS_WEB_TOKEN || 'stark-industries-access-2024',

  wa: {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    accessToken: process.env.WHATSAPP_TOKEN!,
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },

  llm: {
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    geminiKey: process.env.GEMINI_API_KEY!,
    openaiKey: process.env.OPENAI_API_KEY,
    primaryProvider: process.env.ANTHROPIC_API_KEY ? 'claude' as const : 'gemini' as const,
  },

  perplexity: {
    apiKey: process.env.PERPLEXITY_API_KEY,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'https://jarvis.kreoon.com/auth/google/callback',
    refreshTokenFounder: process.env.GOOGLE_REFRESH_TOKEN,
    refreshTokenOps: process.env.GOOGLE_REFRESH_TOKEN_OPS,
  },

  couchdb: {
    url: process.env.COUCHDB_URL || 'http://couchdb:5984',
    user: process.env.COUCHDB_USER || 'admin',
    pass: process.env.COUCHDB_PASS || 'KreoonSync2024!',
  },

  metaAds: {
    webhook: process.env.N8N_WEBHOOK_URL,
    accessToken: process.env.META_ADS_ACCESS_TOKEN,
    accountId: process.env.META_ADS_ACCOUNT_ID,
  },

  github: {
    token: process.env.GITHUB_TOKEN,
  },

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
  },

  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },

  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    kiroVoiceId: process.env.ELEVENLABS_KIRO_VOICE_ID,
  },
  dailyEngine: {
    cron: process.env.DAILY_ENGINE_CRON || '0 6 * * 1-5',
    maxIdeas: Number(process.env.DAILY_ENGINE_MAX_IDEAS) || 3,
    ownerPhone: '573132947776',
    brands: ['Alexander Cast', 'UGC Colombia', 'Kreoon', 'Reyes del Contenido'],
    enabled: process.env.DAILY_ENGINE_ENABLED !== 'false',
  },
} as const;

// Team members — parsed from env ROLE_PHONES_*
export const team: Record<string, import('./types.js').TeamMember> = {
  '573132947776': {
    phone: '573132947776',
    name: 'Alexander',
    role: 'owner',
    email: 'founder@kreoon.com',
  },
  '573113842399': {
    phone: '573113842399',
    name: 'Brian',
    role: 'ops',
    email: 'operaciones@kreoon.com',
  },
  '573044174918': {
    phone: '573044174918',
    name: 'Brian2',
    role: 'ops',
    email: 'operaciones@kreoon.com',
  },
  '573126944694': {
    phone: '573126944694',
    name: 'Diana',
    role: 'community',
    email: '',
  },
};
