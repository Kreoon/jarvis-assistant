import OpenAI from "openai";
import { config } from "../config.js";

const openai = new OpenAI({ apiKey: config.openai.apiKey });

/**
 * Download audio from WhatsApp Media API and transcribe with Whisper
 */
export async function transcribeAudio(mediaId: string): Promise<string> {
  // Step 1: Get media URL from Meta
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}`,
    {
      headers: { Authorization: `Bearer ${config.whatsapp.token}` },
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(`Failed to get media URL: ${mediaResponse.status}`);
  }

  const mediaData = (await mediaResponse.json()) as { url: string };

  // Step 2: Download the audio file
  const audioResponse = await fetch(mediaData.url, {
    headers: { Authorization: `Bearer ${config.whatsapp.token}` },
  });

  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.status}`);
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

  // Step 3: Transcribe with Whisper
  const file = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "es",
  });

  return transcription.text;
}
