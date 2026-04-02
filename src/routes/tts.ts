import { Router } from 'express';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

const router = Router();

// === ElevenLabs TTS Proxy (streaming) ===
router.post('/', async (req, res) => {
  const { text, voice_id } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Text required.' });
  }

  if (!config.elevenlabs.apiKey) {
    return res.status(503).json({ error: 'ElevenLabs not configured.' });
  }

  const voiceId = voice_id || config.elevenlabs.kiroVoiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default: Bella

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': config.elevenlabs.apiKey,
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
      return res.status(response.status).json({ error: 'TTS generation failed.' });
    }

    // Stream audio back to client
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
    });

    const reader = response.body?.getReader();
    if (!reader) {
      return res.status(500).json({ error: 'No response body from ElevenLabs.' });
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!res.writableEnded) {
        res.write(Buffer.from(value));
      }
    }

    if (!res.writableEnded) {
      res.end();
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'TTS proxy error');
    if (!res.headersSent) {
      res.status(500).json({ error: 'TTS proxy error.' });
    }
  }
});

// === Check TTS availability ===
router.get('/status', (_req, res) => {
  res.json({
    available: !!config.elevenlabs.apiKey,
    voiceId: config.elevenlabs.kiroVoiceId || null,
  });
});

export { router as ttsRouter };
