import OpenAI from 'openai';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';
import { downloadMedia } from './whatsapp.js';

const log = agentLogger('whisper');

const openai = config.llm.openaiKey
  ? new OpenAI({ apiKey: config.llm.openaiKey })
  : null;

// Custom vocabulary for better transcription
const VOCABULARY = [
  'Kreoon', 'Jarvis', 'UGC', 'KREOON', 'Alexander',
  'Brian', 'n8n', 'Supabase', 'Vercel', 'Meta Ads',
  'Instagram', 'TikTok', 'Reels', 'contenido', 'pauta',
].join(', ');

export async function transcribeAudio(mediaId: string): Promise<string> {
  if (!openai) {
    log.warn('OpenAI not configured, cannot transcribe');
    return '(Audio recibido pero no puedo transcribirlo - OpenAI no configurado)';
  }

  try {
    const buffer = await downloadMedia(mediaId);

    const file = new File([buffer], 'audio.ogg', { type: 'audio/ogg' });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'es',
      prompt: VOCABULARY,
    });

    log.info({ length: transcription.text.length }, 'Audio transcribed');
    return transcription.text;
  } catch (error: any) {
    log.error({ error: error.message }, 'Transcription failed');
    return '(Error transcribiendo audio)';
  }
}
