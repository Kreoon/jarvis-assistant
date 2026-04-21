import dotenv from "dotenv";
dotenv.config();

export const config = {
  // --- Core ---
  port: parseInt(process.env.PORT || "3000"),
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY! },
  openai: { apiKey: process.env.OPENAI_API_KEY! },

  // --- WhatsApp ---
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "jarvis-verify-2024",
    allowedNumbers: (process.env.WHATSAPP_ALLOWED_NUMBERS || "").split(",").filter(Boolean),
  },

  // --- Obsidian ---
  obsidian: {
    repoUrl: process.env.OBSIDIAN_REPO_URL!,
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || "./vault",
  },

  // --- Whisper ---
  whisper: {
    vocabulary: process.env.WHISPER_VOCABULARY ||
      "KREOON, Infiny, Infiny Latam, Obsidian, Supabase, Vercel, UGC Colombia, Alexander Cast, Los Reyes del Contenido, Sanavi, Metrik, Cafetiando",
  },

  // --- Connectors (API keys) ---
  perplexity: { apiKey: process.env.PERPLEXITY_API_KEY || "" },
  resend: {
    apiKey: process.env.RESEND_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "jarvis@kreoon.com",
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || "",
  },
  github: { token: process.env.GITHUB_TOKEN || "" },
  stripe: { secretKey: process.env.STRIPE_SECRET_KEY || "" },
  cal: {
    apiKey: process.env.CAL_API_KEY || "",
    eventTypeId: process.env.CAL_EVENT_TYPE_ID || "",
  },
  metaAds: {
    accessToken: process.env.META_ADS_ACCESS_TOKEN || "",
    accountId: process.env.META_ADS_ACCOUNT_ID || "",
    apiBaseUrl: process.env.META_ADS_API_URL || "https://meta-ads-agent-lyart.vercel.app",
  },
  gemini: { apiKey: process.env.GEMINI_API_KEY || "" },
  n8n: { webhookUrl: process.env.N8N_WEBHOOK_URL || "" },
  kreoon: {
    url: process.env.KREOON_SUPABASE_URL || "https://wjkbqcrxwsmvtxmqgiqc.supabase.co",
    serviceKey: process.env.KREOON_SERVICE_KEY || "",
  },
  services: {
    urls: (process.env.SERVICES_TO_CHECK || "https://kreoon.app,https://dev.kreoon.com")
      .split(",").filter(Boolean),
  },
};
