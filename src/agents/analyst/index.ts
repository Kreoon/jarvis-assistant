import { callLLM } from '../../core/llm.js';
import { extractContent, isSocialMediaUrl } from '../../connectors/social-extractor.js';
import { analyzeVideo, analyzeImage } from '../../connectors/gemini-vision.js';
import { uploadMediaToDrive, uploadReportToDrive, deleteLocalFile } from '../../connectors/google-drive.js';
import axios from 'axios';
import { agentLogger } from '../../shared/logger.js';
import type { AgentRequest, AgentResponse } from '../../shared/types.js';
import type { ProgressCallback } from '../../core/base-agent.js';
import { ALEXANDER_VOICE_PROFILE } from './voice-profile.js';

export { isSocialMediaUrl } from '../../connectors/social-extractor.js';

const log = agentLogger('analyst');

// ─── Helper functions for report payload ─────────────────────────────────────

function calculateER(content: any): number | null {
  const likes = content.likes || 0;
  const comments = content.comments || 0;
  const shares = content.shares || 0;
  const views = content.views;
  if (views && views > 0) {
    return Math.round(((likes + comments + shares) / views) * 10000) / 100; // 2 decimals
  }
  return null;
}

function extractSection(text: string, startMarker: string, endMarker: string): string | null {
  if (!text) return null;
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;
  const endIdx = endMarker ? text.indexOf(endMarker, startIdx + startMarker.length) : text.length;
  return text.substring(startIdx, endIdx > startIdx ? endIdx : text.length).trim();
}

function extractEmotions(geminiText: string): any {
  if (!geminiText) return null;
  const emotions: { timestamp: string; emotion: string }[] = [];
  const regex = /\*?\*?(\d+:\d+[-–]\d+:\d+)\*?\*?[:\s]*.*?(Tono|Emoción|emoción)[:\s]*([^)}\n,]+)/gi;
  let match;
  while ((match = regex.exec(geminiText)) !== null) {
    emotions.push({ timestamp: match[1], emotion: match[3].trim() });
  }
  return emotions.length > 0 ? emotions : null;
}

function extractProductionSpecs(geminiText: string): any {
  if (!geminiText) return null;
  const specs: Record<string, string> = {};
  const patterns = [
    { key: 'plano', regex: /tipo de plano[:\s]*([^\n.]+)/i },
    { key: 'angulo', regex: /ángulo[:\s]*([^\n.]+)/i },
    { key: 'movimiento', regex: /movimiento de cámara[:\s]*([^\n.]+)/i },
    { key: 'iluminacion', regex: /iluminación[:\s]*([^\n.]+)/i },
    { key: 'audio', regex: /tipo de música[:\s]*([^\n.]+)/i },
    { key: 'aspecto', regex: /relación de aspecto[:\s]*([^\n.]+)/i },
    { key: 'calidad', regex: /calidad de producción[:\s]*([^\n.]+)/i },
    { key: 'duracion', regex: /duración total[:\s]*([^\n.]+)/i },
  ];
  for (const { key, regex } of patterns) {
    const m = geminiText.match(regex);
    if (m) specs[key] = m[1].trim();
  }
  return Object.keys(specs).length > 0 ? specs : null;
}

function detectNiche(content: any): string {
  const text = `${content.caption || ''} ${(content.hashtags || []).join(' ')}`.toLowerCase();
  if (text.match(/fitness|gym|workout|ejercicio|entrena/)) return 'fitness';
  if (text.match(/food|comida|receta|cocina|restaurant/)) return 'food';
  if (text.match(/fashion|moda|outfit|style|ropa/)) return 'fashion';
  if (text.match(/finanz|dinero|invers|money|crypto|bitcoin/)) return 'finance';
  if (text.match(/educa|aprend|curso|clase|enseñ/)) return 'education';
  if (text.match(/emprendimiento|negocio|empresa|startup|emprend/)) return 'business';
  if (text.match(/belleza|beauty|skincare|maquillaje|makeup/)) return 'beauty';
  if (text.match(/viaje|travel|turismo|destino/)) return 'travel';
  if (text.match(/motiv|superación|mindset|mentalidad|éxito/)) return 'motivation';
  if (text.match(/tech|tecnolog|software|programar|código/)) return 'tech';
  if (text.match(/salud|health|bienestar|wellness/)) return 'health';
  return 'general';
}

function extractContentTags(content: any, analysis: string): string[] {
  const tags: string[] = [];
  // From content type
  if (content.type) tags.push(content.type);
  if (content.platform) tags.push(content.platform);
  // From analysis patterns
  if (analysis.match(/storytelling|historia|narrativ/i)) tags.push('storytelling');
  if (analysis.match(/talking.?head|hablando.?cámara/i)) tags.push('talking-head');
  if (analysis.match(/tutorial|paso.?a.?paso|how.?to/i)) tags.push('tutorial');
  if (analysis.match(/motivaci|inspir/i)) tags.push('motivational');
  if (analysis.match(/educati|enseñ|explica/i)) tags.push('educational');
  if (analysis.match(/trend|viral|challenge/i)) tags.push('trending');
  if (analysis.match(/UGC|user.generated/i)) tags.push('ugc');
  if (analysis.match(/b-roll|transicio/i)) tags.push('edited');
  return [...new Set(tags)];
}

function detectSentiment(text: string): string {
  if (!text) return 'neutral';
  const positive = (text.match(/positiv|inspir|motiv|excelente|bien|bueno|éxito|genial|perfecto/gi) || []).length;
  const negative = (text.match(/negativ|problem|error|falt|malo|débil|mejorar|crítica/gi) || []).length;
  if (positive > negative * 2) return 'positive';
  if (negative > positive * 2) return 'negative';
  return 'mixed';
}

// ─── Estado pendiente por usuario (phone → session) ─────────────────────────

interface AnalystSession {
  url: string;
  localFilePath: string;
  driveLink: string;
  mimeType: string;
  isVideo: boolean;
  content: any;
  createdAt: number;
  lastReplica?: {
    strategicAnalysis: string;
    geminiAnalysis: string;
    topic: string;
    objective: string;
    platform: string;
    angle: string;
    useAlexVoice: boolean;
  };
}

const pendingSessions = new Map<string, AnalystSession>();

// TTL: 2h para permitir feedback loop (antes 30 min)
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

// Exported for router to check if user has pending session
export function hasAnalystSession(phone: string): boolean {
  const session = pendingSessions.get(phone);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    pendingSessions.delete(phone);
    return false;
  }
  return true;
}

// Limpiar sesiones viejas
function cleanOldSessions() {
  const now = Date.now();
  for (const [phone, session] of pendingSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      deleteLocalFile(session.localFilePath).catch(() => {});
      pendingSessions.delete(phone);
    }
  }
}

// ─── Texto del menú wizard (reutilizable para URL y video directo) ──────────

function wizardMenuText(meta: { platform: string; type: string; creator?: string; duration?: number | null; driveLink: string }): string {
  const creator = meta.creator || 'desconocido';
  const duration = meta.duration ? ` | ⏱️ ${meta.duration}s` : '';
  return `✅ Contenido recibido y guardado en Drive
📱 ${meta.platform} ${meta.type} | 👤 @${creator}${duration}
📁 ${meta.driveLink}

¿Qué quieres hacer?

*A)* Solo análisis estratégico (12 dimensiones)

*B)* Análisis + replicar para otro tema
  → Formato: tema, objetivo, plataforma, ángulo, voz
  Ej: "B coaching financiero, leads, Instagram, contrarian, alex"
  • Objetivo: alcance/leads/venta/autoridad
  • Ángulo (opcional): mainstream, contrarian, educativo, emocional, storytelling
  • Voz (opcional): "alex" → usar tono y 5 pilares de Alexander Cast`;
}

// ─── Pipeline principal ─────────────────────────────────────────────────────

export const analystAgent = {
  async handle(req: AgentRequest, onProgress?: ProgressCallback): Promise<AgentResponse> {
    const phone = req.message.from;
    const messageText = (req.message.text || '').trim();
    const urlMatch = messageText.match(/https?:\/\/[^\s]+/i);

    cleanOldSessions();

    // ═══════════════════════════════════════════════════════════════
    // CASO 1: Usuario tiene sesión pendiente (ya descargó, está respondiendo)
    // ═══════════════════════════════════════════════════════════════
    const session = pendingSessions.get(phone);
    if (session && !urlMatch && !req.directMedia) {
      return await executeAnalysisAndReport(session, phone, onProgress, messageText);
    }

    // ═══════════════════════════════════════════════════════════════
    // CASO 1.5: Video/imagen directo sin URL (WhatsApp o REST multipart)
    // Skip Drive upload — el video queda embebido en la página del reporte.
    // Skip wizard A/B — análisis directo siempre; réplicas se generan desde la web.
    // ═══════════════════════════════════════════════════════════════
    if (req.directMedia) {
      const { localFilePath, mimeType, caption, isVideo } = req.directMedia;
      log.info({ localFilePath, mimeType, isVideo }, 'Starting analyst pipeline - direct media');

      const session: AnalystSession = {
        url: '',
        localFilePath,
        driveLink: '',
        mimeType,
        isVideo,
        content: {
          platform: 'whatsapp-direct',
          type: isVideo ? 'video' : 'image',
          caption: caption || '',
          creator: { username: req.member?.name || 'direct' },
          duration: null,
          hashtags: [],
        },
        createdAt: Date.now(),
      };
      pendingSessions.set(phone, session);
      return await executeAnalysisAndReport(session, phone, onProgress);
    }

    // ═══════════════════════════════════════════════════════════════
    // CASO 2: Nuevo link — descargar + preguntar
    // ═══════════════════════════════════════════════════════════════
    if (!urlMatch) {
      return {
        text: 'Envíame un link de Instagram, TikTok, YouTube, Twitter/X, LinkedIn o Facebook (o un video directo) y lo analizo completo.',
      };
    }

    const url = urlMatch[0];
    log.info({ url }, 'Starting analyst pipeline - download phase');

    try {
      // PASO 1: Descargar (yt-dlp con fallback Apify)
      if (onProgress) await onProgress('📥 Descargando contenido...').catch(() => {});

      const content = await extractContent(url);

      if (!content.localFilePath) {
        return { text: '❌ No pude descargar el contenido de ese link. Verifica que sea público y vuelve a intentar.' };
      }

      log.info({ platform: content.platform, type: content.type, file: content.localFilePath }, 'Content extracted');
      if (onProgress) await onProgress(`✅ Descargado: ${content.platform} ${content.type}`).catch(() => {});

      // Skip upload a Drive — el video queda embebido en el reporte web (se sube a Supabase Storage).
      const ext = content.localFilePath.split('.').pop() || 'mp4';
      const isVideo = ['mp4', 'webm', 'mkv', 'mov'].includes(ext);
      const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
      const mimeType = isVideo ? `video/${ext === 'mov' ? 'quicktime' : ext}`
        : isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
        : 'application/octet-stream';

      // PASO 2: Crear sesión y ejecutar análisis directo (sin wizard A/B)
      const session: AnalystSession = {
        url,
        localFilePath: content.localFilePath,
        driveLink: '',
        mimeType,
        isVideo,
        content,
        createdAt: Date.now(),
      };
      pendingSessions.set(phone, session);
      return await executeAnalysisAndReport(session, phone, onProgress);

    } catch (error: any) {
      log.error({ error: error.message, stack: error.stack }, 'Analyst download failed');
      return { text: `❌ Error descargando: ${error.message}\nIntenta de nuevo.` };
    }
  },
};

// ─── Manejar respuesta del wizard ───────────────────────────────────────────

/**
 * Ejecuta análisis completo + crea reporte web.
 * Se llama directamente desde handle() (sin wizard A/B).
 * Si hay `response` (usuario respondió después), detecta refine loops
 * y opción B legacy (para REST endpoint). Por default (response=''),
 * solo análisis + reporte web (las réplicas se hacen desde la web UI).
 */
async function executeAnalysisAndReport(
  session: AnalystSession,
  phone: string,
  onProgress?: ProgressCallback,
  response: string = ''
): Promise<AgentResponse> {
  const lower = response.toLowerCase().trim();

  // Feedback loop: detectar "mejora V2", "otra V3", "V4 más provocador"
  const refineMatch = lower.match(/^(mejora|otra|dame|reescribe|refina)\s+(v[1-5])(.*)?$/i);
  if (refineMatch && session.lastReplica) {
    const targetVersion = refineMatch[2].toUpperCase();
    const refinementHint = (refineMatch[3] || '').trim() || 'optimiza más y mejora hook/CTA';
    if (onProgress) await onProgress(`🔄 Refinando ${targetVersion}: ${refinementHint}...`).catch(() => {});
    const refined = await refineReplica(session.lastReplica, targetVersion, refinementHint);
    if (onProgress) await onProgress(`✅ ${targetVersion} refinada`).catch(() => {});
    // Extender TTL al refinar
    session.createdAt = Date.now();
    return { text: `🔁 **${targetVersion} refinada** (${refinementHint})\n\n${refined}` };
  }

  // Detectar si es opción A o B
  const isOptionA = lower === 'a' || lower.startsWith('a)') || lower.startsWith('a ') || lower === 'solo análisis' || lower === 'solo analisis';
  const isOptionB = lower.startsWith('b') || lower.includes(','); // "B tema, objetivo, plataforma" o "tema, objetivo, plataforma"

  let replicaTopic = '';
  let replicaObjective = '';
  let replicaPlatform = '';
  let replicaAngle = '';
  let useAlexVoice = false;

  if (isOptionB) {
    // Parse: "B coaching financiero, leads, Instagram, contrarian, alex"
    const cleanResponse = response.replace(/^[bB]\)?[\s]*/,'').trim();
    const parts = cleanResponse.split(',').map(p => p.trim());
    replicaTopic = parts[0] || '';
    replicaObjective = parts[1] || 'alcance';
    replicaPlatform = parts[2] || session.content.platform;
    replicaAngle = parts[3] || '';
    useAlexVoice = /^(alex|ac|alexander)$/i.test(parts[4] || '');
  }

  try {
    // ══════════════════════════════════════════════════════════════
    // Gemini analiza el video/imagen
    // ══════════════════════════════════════════════════════════════
    let geminiAnalysis = '';

    if (session.isVideo && session.localFilePath) {
      if (onProgress) await onProgress('🔬 Enviando video a Gemini para análisis visual profundo...').catch(() => {});
      try {
        const videoAnalysis = await analyzeVideo(
          session.localFilePath,
          session.mimeType,
          session.content.caption,
          onProgress
        );
        geminiAnalysis = videoAnalysis.fullAnalysis;
      } catch (e: any) {
        log.error({ error: e.message }, 'Gemini video analysis failed');
        // Dejar vacío para que el UI del reporte muestre el fallback "no disponible" limpio
        geminiAnalysis = '';
        if (onProgress) await onProgress('⚠️ Análisis visual falló, continuando con texto...').catch(() => {});
      }
    } else if (session.localFilePath) {
      if (onProgress) await onProgress('🔬 Gemini analizando imagen...').catch(() => {});
      try {
        geminiAnalysis = await analyzeImage(
          session.localFilePath,
          session.mimeType,
          session.content.caption,
          onProgress
        );
      } catch (e: any) {
        log.error({ error: e.message }, 'Gemini image analysis failed');
        // Dejar vacío para que el UI del reporte muestre el fallback "no disponible" limpio
        geminiAnalysis = '';
      }
    }

    // ══════════════════════════════════════════════════════════════
    // Claude: Análisis estratégico 12 dimensiones
    // ══════════════════════════════════════════════════════════════
    if (onProgress) await onProgress('🧠 Analizando estrategia (12 dimensiones)...').catch(() => {});

    const strategicAnalysis = await generateStrategicAnalysis(
      session.content, geminiAnalysis, session.driveLink
    );

    if (onProgress) await onProgress('✅ Análisis estratégico completo').catch(() => {});

    // ══════════════════════════════════════════════════════════════
    // Si es opción B: Claude genera réplica (hasta 5 versiones)
    // ══════════════════════════════════════════════════════════════
    let replicaText = '';
    if (isOptionB && replicaTopic) {
      const versions = useAlexVoice ? '5 versiones (incluye V5 Alexander)' : '4 versiones (V1-V4)';
      if (onProgress) await onProgress(`🔄 Generando ${versions} para: ${replicaTopic}${replicaAngle ? ` (${replicaAngle})` : ''}...`).catch(() => {});

      replicaText = await generateReplica(
        strategicAnalysis, geminiAnalysis, replicaTopic, replicaObjective, replicaPlatform, replicaAngle, useAlexVoice
      );

      // Guardar en sesión para feedback loop
      session.lastReplica = {
        strategicAnalysis,
        geminiAnalysis,
        topic: replicaTopic,
        objective: replicaObjective,
        platform: replicaPlatform,
        angle: replicaAngle,
        useAlexVoice,
      };

      if (onProgress) await onProgress('✅ Réplicas generadas').catch(() => {});
    }

    // ══════════════════════════════════════════════════════════════
    // Publicar reporte en la web app
    // ══════════════════════════════════════════════════════════════
    if (onProgress) await onProgress('🌐 Generando reporte web...').catch(() => {});

    let reportUrl = '';
    try {
      const apiUrl = process.env.REPORT_API_URL || 'https://kreoon-reports-v2.vercel.app/api/reports';
      const secret = process.env.JARVIS_INTERNAL_SECRET || '';

      const reportPayload = {
        platform: session.content.platform,
        content_type: session.content.type,
        original_url: session.url,
        creator_username: session.content.creator?.username || 'unknown',
        creator_followers: session.content.creator?.followers || null,
        duration_seconds: session.content.duration ? Math.round(session.content.duration) : null,
        caption: session.content.caption || '',
        hashtags: session.content.hashtags || [],
        metrics: {
          views: session.content.views || null,
          likes: session.content.likes || null,
          comments: session.content.comments || null,
          shares: session.content.shares || null,
        },
        // Creator extended
        creator_verified: session.content.creator?.verified || false,
        creator_bio: session.content.creator?.bio || null,
        creator_profile_url: session.url ? `https://www.instagram.com/${session.content.creator?.username || ''}` : null,

        // Engagement
        top_comments: session.content.topComments || [],
        engagement_rate: calculateER(session.content),

        // Content original
        title: session.content.title || null,
        description: session.content.description || null,
        mentions: session.content.mentions || [],

        // Media metadata
        sound_used: session.content.soundUsed || null,
        thumbnail_url: session.content.thumbnailUrl || null,
        published_at: session.content.publishedAt || null,
        aspect_ratio: '9:16',
        video_quality: session.isVideo ? 'HD' : null,

        // Gemini desglosado
        gemini_transcription: geminiAnalysis || null,
        gemini_hook_analysis: extractSection(geminiAnalysis, 'HOOK', 'FORMATO') || null,
        gemini_emotions: extractEmotions(geminiAnalysis) || null,
        gemini_production_specs: extractProductionSpecs(geminiAnalysis) || null,

        // Tracking
        analyzed_by: 'jarvis-v2',
        analysis_duration_ms: Date.now() - session.createdAt,

        // Benchmark
        niche: detectNiche(session.content),
        niche_benchmark: null,
        performance_vs_niche: null,

        // Classification
        content_tags: extractContentTags(session.content, strategicAnalysis),
        language: 'es',
        sentiment: detectSentiment(geminiAnalysis),

        drive_video_url: session.driveLink,
        drive_media_id: session.driveLink?.match(/\/d\/([^/]+)/)?.[1] || null,
        gemini_analysis: { full_analysis: geminiAnalysis, scenes: [], production: {}, emotional_timeline: [], transcription: geminiAnalysis },
        strategic_analysis: { raw_text: strategicAnalysis, structure: {}, copy: {}, strategy: {} },
        verdict: { works: [], improve: [], opportunity: { title: '', description: '' } },
        scores: { hook: 0, copy: 0, strategy: 0, production: 0, virality: 0, total: 0, replication_difficulty: 0 },
        wizard_config: isOptionB ? { topic: replicaTopic, objective: replicaObjective, platform: replicaPlatform } : null,
        replicas: isOptionB ? { faithful: { hook: '', script: [], caption: replicaText, hashtags: '', production_notes: '' }, improved: { hook: '', script: [], caption: '', hashtags: '', production_notes: '', improvements: [], triggers_added: [], neurocopy_changes: [] }, kreoon: { hook: '', script: [], caption: '', hashtags: '', production_notes: '', storybrand: { hero: '', guide: '', plan: '', cta: '', success: '', failure: '' }, creator_brief: {} } } : null,
        production_guide: { checklist: [], script_timeline: [], setup: {}, music: {} },
        publish_strategy: { best_day: '', best_time: '', timezone: 'America/Bogota', reason: '', post_actions: [], caption_final: '', hashtags_final: [], repurposing: [], week_plan: [] },
        success_metrics: { kpis: [], benchmarks: { er_average: 0, good_post: 0, viral_threshold: 0, platform: session.content.platform }, evaluation_timeline: [], plan_b: [] },
        teleprompter_script: replicaText || null,
        branding: { show_kreoon: true, primary_color: '#FF6B00' },
      };

      const { data } = await axios.post(apiUrl, reportPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Jarvis-Secret': secret,
        },
        timeout: 15000,
      });

      reportUrl = data.url;
      if (onProgress) await onProgress('✅ Reporte web generado').catch(() => {});
    } catch (e: any) {
      const respData = e.response?.data;
      log.error({ error: e.message, status: e.response?.status, responseBody: respData }, 'Report web creation failed');
      reportUrl = '(Error creando reporte web)';
    }

    // NO borrar sesión aún — mantener para feedback loop (mejora V2, otra V3, etc.)
    // El archivo local se borra después de Gemini upload (ya no se necesita)
    await deleteLocalFile(session.localFilePath).catch(() => {});

    // ══════════════════════════════════════════════════════════════
    // Respuesta final — si reporte web funcionó manda link, si no
    // entrega el análisis COMPLETO por WhatsApp (partido en chunks si largo)
    // ══════════════════════════════════════════════════════════════
    const reportOk = reportUrl && !reportUrl.startsWith('(') && reportUrl.startsWith('http');
    const driveOk = session.driveLink && !session.driveLink.startsWith('(') && session.driveLink.startsWith('http');

    if (reportOk) {
      const cleanReportUrl = reportUrl.replace(/\s+/g, '').trim();
      return {
        text: `✅ *Análisis listo*

📊 ${cleanReportUrl}

Ahí ves el video + las 12 dimensiones. Desde la página puedes generar las réplicas con el wizard (tema, objetivo, plataforma, ángulo, voz).

Envía otro link para analizar más contenido.`,
      };
    }

    // Fallback: reporte web falló → mandar análisis directamente por WhatsApp
    const header = `✅ *Análisis completo* (reporte web no disponible)\n━━━━━━━━━━━━━━━━━\n`;
    const sections: string[] = [header + strategicAnalysis];

    if (isOptionB && replicaText) {
      sections.push(`\n━━━ 🔄 RÉPLICAS para *${replicaTopic}* ━━━\n\n${replicaText}`);
    }

    sections.push(`\n━━━━━━━━━━━━━━━━━\nEnvía otro link para analizar más.`);

    return { text: sections.join('') };

  } catch (error: any) {
    log.error({ error: error.message, stack: error.stack }, 'Analyst analysis failed');
    pendingSessions.delete(phone);
    return { text: `❌ Error en el análisis: ${error.message}\nIntenta de nuevo.` };
  }
}

// ─── Análisis estratégico con Claude ────────────────────────────────────────

async function generateStrategicAnalysis(
  content: any,
  geminiAnalysis: string,
  driveLink: string
): Promise<string> {
  const prompt = buildAnalysisPrompt(content, geminiAnalysis, driveLink);

  const response = await callLLM([
    { role: 'system', content: STRATEGIC_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ], {
    maxTokens: 6000,
    temperature: 0.4,
  });

  return response.text;
}

// ─── Generación de réplica ──────────────────────────────────────────────────

async function generateReplica(
  strategicAnalysis: string,
  geminiAnalysis: string,
  topic: string,
  objective: string,
  platform: string,
  angle: string = '',
  useAlexVoice: boolean = false
): Promise<string> {
  const systemPrompt = buildReplicaSystemPrompt(useAlexVoice);

  const angleLine = angle ? `- Ángulo solicitado: ${angle}` : '- Ángulo: libre (V4 siempre será opuesto al original)';
  const voiceLine = useAlexVoice ? '- Voz V5: Alexander Cast (usar perfil completo del system)' : '- Voz V5: OMITIR (no la generes)';

  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `## ANÁLISIS ESTRATÉGICO DEL ORIGINAL:
${strategicAnalysis}

## DESGLOSE VISUAL (GEMINI):
${geminiAnalysis || '(No disponible)'}

## DATOS DE RÉPLICA:
- Tema/Marca: ${topic}
- Objetivo: ${objective}
- Plataforma destino: ${platform}
${angleLine}
${voiceLine}

Genera ${useAlexVoice ? 'las 5 versiones' : 'las 4 versiones (V1-V4, omite V5)'} de réplica.` },
  ], {
    maxTokens: useAlexVoice ? 8000 : 6500,
    temperature: 0.6,
  });

  return response.text;
}

async function refineReplica(
  lastReplica: NonNullable<AnalystSession['lastReplica']>,
  targetVersion: string,
  refinementHint: string
): Promise<string> {
  const systemPrompt = buildReplicaSystemPrompt(lastReplica.useAlexVoice);
  const response = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Ya generaste 4-5 versiones de réplica. El usuario pide refinar SOLO ${targetVersion}.

Instrucción del usuario: "${refinementHint}"

## ANÁLISIS ESTRATÉGICO ORIGINAL:
${lastReplica.strategicAnalysis}

## DESGLOSE VISUAL (GEMINI):
${lastReplica.geminiAnalysis || '(No disponible)'}

## DATOS DE RÉPLICA:
- Tema/Marca: ${lastReplica.topic}
- Objetivo: ${lastReplica.objective}
- Plataforma destino: ${lastReplica.platform}
- Ángulo: ${lastReplica.angle || 'libre'}
- Voz Alexander: ${lastReplica.useAlexVoice ? 'SÍ' : 'NO'}

Genera SOLO ${targetVersion} mejorada siguiendo la instrucción. Usa el mismo formato (hook, caption, hashtags, notas, brief UGC).` },
  ], {
    maxTokens: 3500,
    temperature: 0.7,
  });

  return response.text;
}

// ─── System prompts ─────────────────────────────────────────────────────────

const STRATEGIC_SYSTEM_PROMPT = `Eres un analista de contenido de nivel mundial para Kreoon, agencia UGC en Colombia.

Recibes DOS fuentes:
1. ANÁLISIS VISUAL DE GEMINI: Desglose del video/imagen (escenas, cámaras, emociones, texto, transiciones, música)
2. METADATA: Caption, hashtags, métricas, perfil del creador

Genera un análisis de 12 DIMENSIONES. Formato:

🔍 ANÁLISIS: [título corto]
📱 [plataforma] | 📊 [formato] | ⏱️ [duración] | 👤 @[creator]

━━━ ESTRUCTURA ━━━
🎣 Hook (0-3s): [qué pasa visual y auditivamente] — [técnica] — Score: X/10
📖 Desarrollo: [estructura narrativa + retención + ritmo]
🎯 CTA: [tipo + efectividad + micro-sí previos]
📐 Formato: [tipo + óptimo sí/no + repurposing]

━━━ PRODUCCIÓN ━━━
🎬 Cámaras/Planos: [planos y ángulos]
✂️ Edición: [ritmo, transiciones, efectos]
🎵 Audio: [música, voz, sincronización]
📝 Texto en pantalla: [textos y función]

━━━ COPY ━━━
📝 Fórmula: [AIDA/PAS/BAB/4U/ACCA/StoryBrand/Pixar]
💪 Palabras de poder: [lista]
🧠 Gatillos mentales:
  ✅ Usados: [lista]
  ❌ Faltantes: [oportunidades]
🗣️ Tono: [descripción] | Cerebro triuno: [cuál domina] | DISC: [perfil]

━━━ ESTRATEGIA ━━━
📍 Embudo: [TOFU/MOFU/BOFU] | Schwartz: [nivel]
🏛️ Pilar: [Educar/Entretener/Inspirar/Vender — %]
🎯 Ángulo: [pain + deseo + transformación] | Maslow: [nivel]
🔥 Viralidad: X/10 | Emoción: [cuál] | Shareability: [nivel] | Patrón: [cuál]

━━━ VEREDICTO ━━━
✅ Funciona: [top 3]
❌ Mejorar: [top 3]
💡 Oportunidad oculta: [lo que no aprovechó]
📊 Producción para replicar: X/10

REGLAS:
- Brutalmente honesto. Cuantifica todo.
- USA el análisis visual de Gemini para fundamentar cada punto
- Si Gemini detectó escenas, emociones, técnicas → referencialas
- Español colombiano, directo, sin rodeos`;

function buildReplicaSystemPrompt(useAlexVoice: boolean): string {
  const base = `Eres un estratega de contenido de Kreoon (agencia UGC Colombia).

Genera versiones de réplica adaptada:

V1 FIEL: Misma estructura exacta, cambia solo el tema. Respeta formato, duración, ritmo, hook, CTA.

V2 MEJORADA: Optimiza gatillos faltantes, mejora hook si <7, refuerza CTA, mejor fórmula copy, neurocopy. Aplica: Cialdini, cerebro triuno, Zeigarnik.

V3 KREOON UGC: Auténtico, cámara frontal, lenguaje natural. StoryBrand (cliente=héroe). Vulnerabilidad + autoridad.

V4 ÁNGULO OPUESTO: Mismo tema, ángulo contrarian/disruptivo. Rompe la expectativa del formato original.
  - Si el original es motivacional → V4 es escéptico/realista
  - Si el original es educativo → V4 es provocador
  - Si el original es aspiracional → V4 es crudo/honesto
  Hook debe generar tensión desde el segundo 0.

V5 ALEXANDER CAST: Solo genera si useAlexVoice=true. Usa el PERFIL DE VOZ de abajo.

Si el usuario pidió un ÁNGULO específico (contrarian, educativo, emocional, storytelling, mainstream), aplícalo a V1-V3. V4 siempre es opuesto al original (independiente del ángulo pedido).

Cada versión incluye:
- Hook escrito (texto y/o guión con tiempos)
- Caption completo con formato
- Hashtags (15-20, mix 30% grandes / 40% medianos / 30% nicho)
- Notas de producción (ángulos, cortes, ritmo, duración por sección)
- Brief para creator UGC

Español colombiano natural, directo, accionable.`;

  return useAlexVoice ? `${base}\n\n${ALEXANDER_VOICE_PROFILE}` : base;
}

// ─── Build prompt ───────────────────────────────────────────────────────────

function buildAnalysisPrompt(content: any, geminiAnalysis: string, driveLink: string): string {
  const parts: string[] = [];

  parts.push('## ANÁLISIS VISUAL DE GEMINI:');
  parts.push(geminiAnalysis || '(No disponible)');
  parts.push('');

  parts.push('## METADATA:');
  parts.push(`- URL: ${content.url}`);
  parts.push(`- Plataforma: ${content.platform}`);
  parts.push(`- Tipo: ${content.type}`);
  parts.push(`- Duración: ${content.duration ? content.duration + 's' : 'N/A'}`);
  parts.push(`- Creator: @${content.creator?.username || 'desconocido'}`);
  if (content.creator?.followers) parts.push(`- Seguidores: ${content.creator.followers}`);
  if (content.views) parts.push(`- Views: ${content.views}`);
  if (content.likes) parts.push(`- Likes: ${content.likes}`);
  if (content.comments) parts.push(`- Comments: ${content.comments}`);
  if (content.shares) parts.push(`- Shares: ${content.shares}`);
  if (content.publishedAt) parts.push(`- Publicado: ${content.publishedAt}`);
  parts.push('');

  parts.push('## CAPTION:');
  parts.push(content.caption || '(Sin caption)');
  parts.push('');

  if (content.hashtags?.length) {
    parts.push('## HASHTAGS: ' + content.hashtags.join(' '));
  }
  if (content.soundUsed) {
    parts.push('## SONIDO: ' + content.soundUsed);
  }

  return parts.join('\n');
}
