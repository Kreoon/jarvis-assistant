import express from "express";
import { config } from "./config.js";
import {
  sendMessage,
  markAsRead,
  parseWebhookMessage,
  isAllowed,
} from "./whatsapp/client.js";
import { processMessage } from "./ai/agent.js";
import { transcribeAudio } from "./ai/transcriber.js";
import { syncVault } from "./obsidian/vault.js";

const app = express();
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
  res.json({ status: "Jarvis is running 🤖" });
});

/**
 * WhatsApp webhook verification (GET)
 * Meta sends a GET request to verify your webhook URL
 */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
    console.log("✅ Webhook verified");
    res.status(200).send(challenge);
  } else {
    console.warn("❌ Webhook verification failed");
    res.sendStatus(403);
  }
});

/**
 * WhatsApp webhook for incoming messages (POST)
 */
app.post("/webhook", async (req, res) => {
  // Always respond 200 quickly to avoid Meta retries
  res.sendStatus(200);

  const message = parseWebhookMessage(req.body);
  if (!message) return;

  console.log(`📩 ${message.type === "audio" ? "🎤 Audio" : "Message"} from ${message.from}: ${message.text || "(audio)"}`);

  // Security: only respond to allowed numbers
  if (!isAllowed(message.from)) {
    console.warn(`🚫 Unauthorized number: ${message.from}`);
    return;
  }

  // Mark as read
  await markAsRead(message.messageId);

  try {
    // Transcribe audio if needed
    let text = message.text;
    if (message.type === "audio" && message.mediaId) {
      console.log("🎤 Transcribing audio...");
      text = await transcribeAudio(message.mediaId);
      console.log(`🎤 Transcription: ${text}`);
    }

    // Sync vault before processing (pull latest changes)
    await syncVault();

    // Process through AI agent
    const reply = await processMessage(message.from, text);

    // Send response
    await sendMessage(message.from, reply);
    console.log(`✅ Reply sent to ${message.from}`);
  } catch (error) {
    console.error("Error processing message:", error);
    await sendMessage(
      message.from,
      "⚠️ Hubo un error procesando tu mensaje. Intenta de nuevo."
    );
  }
});

// Start server
async function start() {
  console.log("🚀 Starting Jarvis...");

  // Initial vault sync
  try {
    await syncVault();
    console.log("📚 Vault synced successfully");
  } catch (error) {
    console.warn("⚠️ Could not sync vault:", error);
    console.warn("Continuing without vault...");
  }

  app.listen(config.port, () => {
    console.log(`🤖 Jarvis listening on port ${config.port}`);
    console.log(`📡 Webhook URL: http://localhost:${config.port}/webhook`);
    console.log(
      `🔑 Verify token: ${config.whatsapp.verifyToken}`
    );
  });
}

start();
