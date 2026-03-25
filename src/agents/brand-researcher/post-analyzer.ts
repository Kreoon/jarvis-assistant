import axios from 'axios';
import * as fs from 'fs';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../shared/config.js';
import { agentLogger } from '../../shared/logger.js';
import type { AnalyzedPost } from './types.js';

const log = agentLogger('post-analyzer');

const MAX_VIDEO_SIZE = 20 * 1024 * 1024; // 20MB
const CONCURRENCY = 2;
const GEMINI_MODEL = 'gemini-2.5-flash';

const fileManager = new GoogleAIFileManager(config.llm.geminiKey);
const genai = new GoogleGenerativeAI(config.llm.geminiKey);

function buildPrompt(post: AnalyzedPost, brandName: string): string {
  return `Analiza este video/reel de Instagram de la marca "${brandName}".
Caption: "${(post.caption || '').slice(0, 300)}"
Metricas: ${post.likes ?? 0} likes, ${post.views ?? 0} views, ${post.comments ?? 0} comments

Evalua en detalle:
1. HOOK (primeros 3 segundos): Captura atencion? Que tecnica usa?
2. ESTRUCTURA: Tiene desarrollo claro y CTA?
3. PRODUCCION: Calidad visual, audio, edicion, ritmo de cortes
4. TEXTO EN PANTALLA: Hay? Es efectivo?
5. ENGAGEMENT: El contenido justifica las metricas?

Score general (0-100) y resumen en 3 lineas.
Responde SOLO en JSON valido: { "score": N, "analysis": "..." }`;
}

async function downloadVideo(url: string, index: number): Promise<string | null> {
  const filePath = `/tmp/post-${index}.mp4`;
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: MAX_VIDEO_SIZE,
    });
    const size = response.data.byteLength;
    if (size > MAX_VIDEO_SIZE) {
      log.warn({ index, size }, 'Video too large, skipping');
      return null;
    }
    fs.writeFileSync(filePath, Buffer.from(response.data));
    log.info({ index, size: Math.round(size / 1024) + 'KB' }, 'Video downloaded');
    return filePath;
  } catch (err: any) {
    log.warn({ index, error: err.message }, 'Video download failed');
    return null;
  }
}

async function uploadToGemini(filePath: string): Promise<string> {
  const uploadResult = await fileManager.uploadFile(filePath, {
    mimeType: 'video/mp4',
    displayName: filePath.split('/').pop() || 'video.mp4',
  });

  let file = uploadResult.file;
  let attempts = 0;
  while (file.state === 'PROCESSING' && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    file = await fileManager.getFile(file.name);
    attempts++;
  }

  if (file.state !== 'ACTIVE') {
    throw new Error(`File upload failed: state=${file.state}`);
  }

  return file.uri;
}

async function analyzeWithThumbnail(post: AnalyzedPost, brandName: string): Promise<{ score: number; analysis: string } | null> {
  if (!post.thumbnail_url) return null;

  try {
    const model = genai.getGenerativeModel({ model: GEMINI_MODEL });
    const prompt = buildPrompt(post, brandName).replace('video/reel', 'imagen/post');

    const imageResponse = await axios.get(post.thumbnail_url, {
      responseType: 'arraybuffer',
      timeout: 15_000,
    });

    const base64 = Buffer.from(imageResponse.data).toString('base64');
    const mimeType = 'image/jpeg';

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType } },
    ]);

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    log.warn({ url: post.url, error: err.message }, 'Thumbnail analysis failed');
    return null;
  }
}

async function analyzePost(post: AnalyzedPost, brandName: string, index: number): Promise<void> {
  const isVideo = post.content_type === 'video' || post.content_type === 'reel';
  const videoUrl = post.video_url;

  if (isVideo && videoUrl) {
    try {
      const filePath = await downloadVideo(videoUrl, index);
      if (!filePath) {
        const fallback = await analyzeWithThumbnail(post, brandName);
        if (fallback) { post.score = fallback.score; post.analysis = fallback.analysis; }
        return;
      }

      const fileUri = await uploadToGemini(filePath);
      fs.unlinkSync(filePath);

      const model = genai.getGenerativeModel({ model: GEMINI_MODEL });
      const prompt = buildPrompt(post, brandName);

      const result = await model.generateContent([
        prompt,
        { fileData: { fileUri, mimeType: 'video/mp4' } },
      ]);

      const text = result.response.text().trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        post.score = parsed.score;
        post.analysis = parsed.analysis;
        log.info({ index, score: parsed.score }, 'Video analysis complete');
      }
    } catch (err: any) {
      log.warn({ index, error: err.message }, 'Video analysis failed, trying thumbnail');
      const fallback = await analyzeWithThumbnail(post, brandName);
      if (fallback) { post.score = fallback.score; post.analysis = fallback.analysis; }
    }
  } else {
    const result = await analyzeWithThumbnail(post, brandName);
    if (result) { post.score = result.score; post.analysis = result.analysis; }
  }
}

export async function analyzePostBatch(
  posts: AnalyzedPost[],
  brandName: string,
  maxPosts: number = 10,
): Promise<AnalyzedPost[]> {
  const toAnalyze = posts.slice(0, maxPosts);
  log.info({ total: toAnalyze.length, brand: brandName }, 'Starting post batch analysis');

  for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
    const batch = toAnalyze.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.map((post, j) => analyzePost(post, brandName, i + j)),
    );
  }

  const analyzed = toAnalyze.filter(p => p.score !== undefined).length;
  log.info({ analyzed, total: toAnalyze.length }, 'Batch analysis complete');
  return posts;
}
