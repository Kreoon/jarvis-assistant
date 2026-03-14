import dotenv from "dotenv";
dotenv.config();

export const config = {
  // WhatsApp Meta Cloud API
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN!,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID!,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "jarvis-verify-2024",
    allowedNumbers: (process.env.WHATSAPP_ALLOWED_NUMBERS || "")
      .split(",")
      .filter(Boolean),
  },

  // AI
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY!,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
  },

  // Obsidian
  obsidian: {
    repoUrl: process.env.OBSIDIAN_REPO_URL!,
    vaultPath: process.env.OBSIDIAN_VAULT_PATH || "./vault",
  },

  // Server
  port: parseInt(process.env.PORT || "3000"),
};
