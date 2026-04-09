import fs from 'fs';
import path from 'path';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';

const logger = agentLogger('tts');
const TMP_DIR = '/app/data/tmp';

export async function generateSpeech(text: string, fileName?: string): Promise<{ url: string; filePath: string } | null> {
  if (!config.elevenlabs.apiKey) {
    logger.warn('ElevenLabs not configured');
    return null;
  }

  // Adam voice — dominant, firm, tipo Jarvis
  const voiceId = 'pNInz6obpgDQGcFmaJgB';
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
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.3,
            speed: 1.15,
          },
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, error: errorText }, 'ElevenLabs API error');
      return null;
    }

    fs.mkdirSync(TMP_DIR, { recursive: true });
    const filePath = path.join(TMP_DIR, safeFileName);
    const arrayBuffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));

    logger.info({ filePath, size: arrayBuffer.byteLength }, 'Audio generated');

    const url = `https://jarvis.kreoon.com/audio/${safeFileName}`;
    return { url, filePath };
  } catch (error: any) {
    logger.error({ error: error.message }, 'TTS generation failed');
    return null;
  }
}
