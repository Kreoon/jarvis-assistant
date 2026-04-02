import fs from 'fs';
import path from 'path';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';

const logger = agentLogger('tts');

const TMP_DIR = '/app/data/tmp';

/**
 * Generate speech audio from text via ElevenLabs.
 * Returns a public URL served from Jarvis itself.
 */
export async function generateSpeech(text: string, fileName?: string): Promise<{ url: string; filePath: string } | null> {
  if (!config.elevenlabs.apiKey) {
    logger.warn('ElevenLabs API key not configured, skipping TTS');
    return null;
  }

  const voiceId = config.elevenlabs.kiroVoiceId || 'EXAVITQu4vr4xnSDxMaL';
  const safeFileName = fileName || `jarvis-voice-${Date.now()}.mp3`;

  try {
    logger.info({ textLength: text.length }, 'Generating speech with ElevenLabs');

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenlabs.apiKey,
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'ElevenLabs API error');
      return null;
    }

    // Save to tmp file
    fs.mkdirSync(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, safeFileName);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    logger.info({ filePath, size: arrayBuffer.byteLength }, 'Audio generated and saved');

    // Serve from Jarvis itself — the /audio/ route serves files from /app/data/tmp/
    const url = `https://jarvis.kreoon.com/audio/${safeFileName}`;

    return { url, filePath };
  } catch (error: any) {
    logger.error({ error: error.message }, 'TTS generation failed');
    return null;
  }
}
