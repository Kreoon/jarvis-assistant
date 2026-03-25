import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../shared/config.js';
import { agentLogger } from '../shared/logger.js';

const log = agentLogger('gemini-vision');

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
const GEMINI_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';

// === Video Analysis Prompt ===
const VIDEO_ANALYSIS_PROMPT = `Eres un analista experto de contenido audiovisual para redes sociales. Tu trabajo es hacer un desglose EXHAUSTIVO de este video.

Analiza CADA SEGUNDO del video y entrega un reporte detallado con estas secciones:

## 1. TRANSCRIPCIÓN COMPLETA
- Transcribe CADA palabra dicha en el video, con timestamps aproximados
- Incluye tono de voz (entusiasta, serio, conversacional, urgente, etc.)
- Nota si hay música de fondo, efectos de sonido, o silencio

## 2. ESCENAS Y ESTRUCTURA VISUAL
Para CADA escena o cambio significativo:
- Timestamp aproximado (ej: 0:00-0:03)
- Descripción de qué se ve (persona, producto, texto, locación)
- Tipo de plano: primer plano, plano medio, plano general, detalle
- Ángulo de cámara: frontal, cenital, lateral, selfie/POV, drone
- Movimiento de cámara: estático, paneo, zoom in/out, seguimiento
- Iluminación: natural, artificial, cálida, fría, dramática, ring light

## 3. TEXTO EN PANTALLA
- Lista EXACTA de todo texto que aparece en pantalla
- Tipografía/estilo (grande, bold, con efecto, subtítulos)
- Posición (centro, arriba, abajo)
- Tiempo que aparece
- Color y legibilidad

## 4. TRANSICIONES Y EDICIÓN
- Tipo de cortes: corte directo, fade, swipe, zoom transition, jump cut
- Ritmo de edición: rápido/lento, cantidad de cortes por minuto
- Efectos visuales: filtros, color grading, slow motion, speed ramp, split screen
- Sincronización con música/audio (beat sync)

## 5. EMOCIONES Y EXPRESIONES
- Emociones que transmite la persona (si aparece): confianza, vulnerabilidad, emoción, seriedad
- Lenguaje corporal: gesticulación, contacto visual, postura
- Energía general: alta/media/baja, crescendo o decrescendo
- Momentos clave de impacto emocional con timestamp

## 6. MÚSICA Y AUDIO
- Tipo de música: género, ritmo, energía
- Si es trending sound o música original
- Cómo complementa el mensaje (crea urgencia, nostalgia, motivación, etc.)
- Cambios de audio a lo largo del video
- Nivel de música vs voz

## 7. HOOK VISUAL (primeros 3 segundos)
- Qué EXACTAMENTE se ve en los primeros 3 segundos
- Qué técnica visual usa para captar atención
- Texto inicial si lo hay
- Primer frame: qué emoción genera

## 8. FORMATO Y PRODUCCIÓN
- Duración total
- Relación de aspecto (9:16, 16:9, 1:1)
- Calidad de producción (profesional, semi-pro, UGC casero)
- Equipo estimado: teléfono, cámara profesional, gimbal, trípode
- Nivel de edición: básica, intermedia, avanzada

## 9. CAPTION Y CONTEXTO
- Si hay caption/descripción asociada, analízalo
- Hashtags usados
- Call-to-action en el caption
- Cómo complementa el video

## 10. RESUMEN ESTRATÉGICO
- Objetivo probable del contenido (awareness, engagement, venta, educación)
- Audiencia objetivo estimada
- Qué hace bien (top 3)
- Qué podría mejorar (top 3)
- Nivel de producción requerido para replicar (1-10)

Sé MUY específico y detallado. Cada escena, cada corte, cada emoción importa. No resumas — desglosa.
Responde en español.`;

// === Types ===
export interface VideoAnalysis {
  transcription: string;
  scenes: string;
  textOnScreen: string;
  transitions: string;
  emotions: string;
  music: string;
  hookVisual: string;
  format: string;
  captionAnalysis: string;
  strategicSummary: string;
  fullAnalysis: string; // The complete raw response
}

// === Upload file to Gemini File API ===
async function uploadToGemini(filePath: string, mimeType: string): Promise<string> {
  const apiKey = config.llm.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const fileSize = fs.statSync(filePath).size;
  const displayName = path.basename(filePath);

  log.info({ filePath, fileSize, mimeType }, 'Uploading video to Gemini File API');

  // Step 1: Start resumable upload
  const initRes = await axios.post(
    `${GEMINI_API_BASE}/upload/v1beta/files?key=${apiKey}`,
    JSON.stringify({
      file: { display_name: displayName },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(fileSize),
        'X-Goog-Upload-Header-Content-Type': mimeType,
      },
    }
  );

  const uploadUrl = initRes.headers['x-goog-upload-url'];
  if (!uploadUrl) throw new Error('Failed to get upload URL from Gemini');

  // Step 2: Upload the file bytes
  const fileBuffer = fs.readFileSync(filePath);
  const uploadRes = await axios.post(uploadUrl, fileBuffer, {
    headers: {
      'Content-Length': String(fileSize),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const fileUri = uploadRes.data?.file?.uri;
  if (!fileUri) throw new Error('Failed to get file URI from Gemini upload');

  log.info({ fileUri }, 'Video uploaded to Gemini');

  // Step 3: Wait for file to be processed
  const fileName = uploadRes.data.file.name;
  let state = uploadRes.data.file.state;
  let attempts = 0;

  while (state === 'PROCESSING' && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const statusRes = await axios.get(
      `${GEMINI_API_BASE}/v1beta/${fileName}?key=${apiKey}`
    );
    state = statusRes.data.state;
    attempts++;
    log.info({ state, attempt: attempts }, 'Waiting for Gemini to process video');
  }

  if (state !== 'ACTIVE') {
    throw new Error(`Gemini file processing failed. State: ${state}`);
  }

  return fileUri;
}

// === Analyze video with Gemini ===
export async function analyzeVideo(
  filePath: string,
  mimeType: string,
  caption?: string,
  onProgress?: (msg: string) => Promise<void>
): Promise<VideoAnalysis> {
  const apiKey = config.llm.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  // Upload video
  if (onProgress) await onProgress('📤 Subiendo video a Gemini para análisis visual...').catch(() => {});
  const fileUri = await uploadToGemini(filePath, mimeType);

  // Build prompt with caption context if available
  let prompt = VIDEO_ANALYSIS_PROMPT;
  if (caption) {
    prompt += `\n\n## CAPTION DEL POST ORIGINAL:\n${caption}`;
  }

  // Call Gemini with the video
  if (onProgress) await onProgress('🔬 Gemini analizando video: escenas, emociones, cámaras, texto...').catch(() => {});

  log.info('Calling Gemini with video for analysis');

  const response = await axios.post(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          parts: [
            { file_data: { mime_type: mimeType, file_uri: fileUri } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 16384,
        temperature: 0.3,
      },
    },
    {
      timeout: 120000, // 2 min timeout for video analysis
    }
  );

  const fullAnalysis = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!fullAnalysis) {
    throw new Error('Gemini returned empty analysis');
  }

  log.info({ length: fullAnalysis.length }, 'Gemini video analysis complete');
  if (onProgress) await onProgress('✅ Análisis visual de Gemini completo').catch(() => {});

  // Parse sections from the analysis
  return {
    transcription: extractSection(fullAnalysis, 'TRANSCRIPCIÓN COMPLETA', 'ESCENAS'),
    scenes: extractSection(fullAnalysis, 'ESCENAS Y ESTRUCTURA VISUAL', 'TEXTO EN PANTALLA'),
    textOnScreen: extractSection(fullAnalysis, 'TEXTO EN PANTALLA', 'TRANSICIONES'),
    transitions: extractSection(fullAnalysis, 'TRANSICIONES Y EDICIÓN', 'EMOCIONES'),
    emotions: extractSection(fullAnalysis, 'EMOCIONES Y EXPRESIONES', 'MÚSICA'),
    music: extractSection(fullAnalysis, 'MÚSICA Y AUDIO', 'HOOK VISUAL'),
    hookVisual: extractSection(fullAnalysis, 'HOOK VISUAL', 'FORMATO'),
    format: extractSection(fullAnalysis, 'FORMATO Y PRODUCCIÓN', 'CAPTION'),
    captionAnalysis: extractSection(fullAnalysis, 'CAPTION Y CONTEXTO', 'RESUMEN'),
    strategicSummary: extractSection(fullAnalysis, 'RESUMEN ESTRATÉGICO', '---END---'),
    fullAnalysis,
  };
}

// === Analyze image with Gemini ===
export async function analyzeImage(
  filePath: string,
  mimeType: string,
  caption?: string,
  onProgress?: (msg: string) => Promise<void>
): Promise<string> {
  const apiKey = config.llm.geminiKey;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  if (onProgress) await onProgress('🔬 Gemini analizando imagen...').catch(() => {});

  const imageBuffer = fs.readFileSync(filePath);
  const base64Image = imageBuffer.toString('base64');

  const prompt = `Analiza esta imagen de una publicación de redes sociales en detalle:
- Qué se ve exactamente (personas, productos, colores, composición)
- Texto que aparece en la imagen
- Estilo visual (profesional, UGC, minimalista, llamativo, etc.)
- Colores dominantes y paleta
- Emociones que transmite
- Calidad de producción (1-10)
- Si hay marca/logo visible
${caption ? `\nCaption del post: ${caption}` : ''}
Responde en español, sé muy detallado.`;

  const response = await axios.post(
    `${GEMINI_API_BASE}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Image } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.3,
      },
    },
    { timeout: 30000 }
  );

  const analysis = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (onProgress) await onProgress('✅ Análisis visual completo').catch(() => {});
  return analysis;
}

// === Helper: extract section from analysis text ===
function extractSection(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return '';

  const afterStart = startIdx + startMarker.length;
  const endIdx = endMarker === '---END---' ? text.length : text.indexOf(endMarker, afterStart);
  const end = endIdx === -1 ? text.length : endIdx;

  return text.slice(afterStart, end).trim();
}
