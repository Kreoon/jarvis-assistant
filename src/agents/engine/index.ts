import { callLLM } from '../../core/llm.js';
import { searchEmails, readEmailFull, listAccounts } from '../../shared/google-api.js';
import { searchWeb } from '../../shared/perplexity.js';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { loadSkillContent } from '../../core/skill-loader.js';
import { generateSpeech } from '../../connectors/tts.js';
import { sendMedia, sendText } from '../../connectors/whatsapp.js';
import type { DailyReport, ContentIdea, VideoScript } from '../../shared/types.js';

type ProgressFn = (msg: string) => void;

const OWNER_PHONE = config.dailyEngine.ownerPhone;

// ─── Main Pipeline ───────────────────────────────────────────────────────────

export async function runDailyContentEngine(
  onProgress?: ProgressFn,
  requestPhone?: string,
): Promise<DailyReport> {
  const date = new Date().toISOString().split('T')[0];
  const phone = requestPhone || OWNER_PHONE;
  const log = (msg: string) => {
    logger.info({ engine: true }, msg);
    onProgress?.(msg);
  };

  log('Leyendo los emails de hoy...');
  const { emailSummary, accountsScanned } = await scanAllEmails();

  log('Buscando qué está pasando en el mundo...');
  const webTrends = await searchTrends();

  // ─── Voice Update: Audio summary of what's new ──────────────────────────
  log('Preparando el update de voz...');
  await sendVoiceUpdate(emailSummary, webTrends, date, phone);

  log('Eligiendo los mejores temas...');
  const ideas = await selectTopIdeas(emailSummary, webTrends);

  log('Escribiendo los guiones...');
  const fullIdeas = await generateVideoScripts(ideas);

  log('Armando el reporte...');
  const report: DailyReport = {
    date,
    emailSummary,
    webTrends,
    ideas: fullIdeas,
    generatedAt: new Date().toISOString(),
    accountsScanned,
  };

  log(`Listo, ${fullIdeas.length} guiones listos para grabar`);

  return report;
}

// ─── Voice Update via ElevenLabs ────────────────────────────────────────────

async function sendVoiceUpdate(
  emailSummary: string,
  webTrends: string,
  date: string,
  phone: string,
): Promise<void> {
  try {
    // Generate a conversational summary for TTS
    const voiceResponse = await callLLM(
      [
        {
          role: 'system',
          content: `Eres Jarvis, el asistente de Alexander Cast. Vas a grabar un audio de WhatsApp de máximo 45 segundos.

Estilo: Como un parcero que te cuenta las noticias del día tomando café. Natural, directo, con energía pero sin gritar. Colombiano.

Estructura:
1. Saludo rápido (3s): "Quiubo Alex, te cuento lo de hoy..."
2. Top 3-4 nuggets más importantes (30s): Los datos más impactantes de emails y tendencias
3. Cierre (5s): "Ya te tengo los guiones listos, revísalos"

REGLAS:
- NO uses formato markdown, bullets, ni asteriscos — esto se va a LEER EN VOZ ALTA
- Usa lenguaje hablado natural, con conectores ("mira que...", "otra cosa...", "y lo más loco es que...")
- Menciona datos específicos (números, nombres, herramientas)
- Máximo 400 caracteres para que quede en ~45 segundos`,
        },
        {
          role: 'user',
          content: `Fecha: ${date}\n\nNUGGETS DE EMAILS:\n${emailSummary.slice(0, 1500)}\n\nTENDENCIAS WEB:\n${webTrends.slice(0, 1500)}\n\nGenera el texto para el audio. Solo el texto, nada más.`,
        },
      ],
      { provider: 'gemini', maxTokens: 500 },
    );

    const voiceText = voiceResponse.text?.trim();
    if (!voiceText) return;

    // Generate audio with ElevenLabs
    const audio = await generateSpeech(voiceText, `jarvis-briefing-${date}.mp3`);

    if (audio?.url) {
      // Send audio message via WhatsApp
      await sendMedia(phone, {
        type: 'audio',
        url: audio.url,
        mimeType: 'audio/mpeg',
      });
      logger.info({ phone }, 'Voice briefing sent via WhatsApp');
    } else {
      // Fallback: send as text if TTS fails
      await sendText(phone, voiceText);
      logger.warn('TTS failed, sent voice update as text');
    }
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Voice update failed, continuing with scripts');
  }
}

// ─── Step 1: Scan ALL email accounts ────────────────────────────────────────

async function scanAllEmails(): Promise<{ emailSummary: string; accountsScanned: string[] }> {
  const topics = config.dailyEngine.topics;
  const query = topics.map(t => `"${t}"`).join(' OR ') + ' newer_than:1d';

  try {
    const accounts = listAccounts();
    const accountKeys = Object.keys(accounts);

    if (accountKeys.length === 0) {
      return { emailSummary: 'No hay cuentas Google conectadas.', accountsScanned: [] };
    }

    const scanResults = await Promise.allSettled(
      accountKeys.map(key => searchEmails(query, 10, key).then(emails => ({ key, emails }))),
    );

    const allEmails: { id: string; from: string; subject: string; snippet: string; account: string }[] = [];
    const scannedAccounts: string[] = [];

    for (const result of scanResults) {
      if (result.status === 'fulfilled') {
        scannedAccounts.push(result.value.key);
        for (const email of result.value.emails) {
          allEmails.push({ ...email, account: result.value.key });
        }
      }
    }

    if (allEmails.length === 0) {
      return { emailSummary: 'Sin newsletters relevantes hoy.', accountsScanned: scannedAccounts };
    }

    const topEmails = allEmails.slice(0, 10);
    const fullContents = await Promise.allSettled(
      topEmails.map(e => readEmailFull(e.id, e.account)),
    );

    const emailData = fullContents
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof readEmailFull>>>).value)
      .map(e => `From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body.slice(0, 800)}`)
      .join('\n---\n');

    const filterResponse = await callLLM(
      [
        {
          role: 'system',
          content: `Eres un curador de información para Alexander Cast, experto en Estrategia Digital, IA y Contenido.

Extrae los NUGGETS más valiosos — datos específicos, estadísticas, noticias de impacto, herramientas nuevas, predicciones.

FILTRA SOLO lo útil para crear contenido viral sobre: IA, tecnología, negocios, emprendimiento, automatización, estrategia digital, motivación.

IGNORA: promociones, spam, transaccionales.

Formato: 5-10 nuggets con el DATO CONCRETO y relevancia. Español.`,
        },
        { role: 'user', content: emailData },
      ],
      { provider: 'gemini', maxTokens: 2000 },
    );

    return {
      emailSummary: filterResponse.text || 'Sin nuggets relevantes hoy.',
      accountsScanned: scannedAccounts,
    };
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Email scan failed');
    return { emailSummary: `Error escaneando emails: ${error.message}`, accountsScanned: [] };
  }
}

// ─── Step 2: Search Web Trends ──────────────────────────────────────────────

async function searchTrends(): Promise<string> {
  const queries = [
    'AI artificial intelligence news today breakthroughs tools',
    'tendencias tecnología emprendimiento negocios hoy',
    'automatización negocios herramientas IA nuevas 2026',
    'viral content trends social media creators this week',
    'motivación emprendedores startups latinoamérica',
  ];

  try {
    const results = await Promise.allSettled(queries.map(q => searchWeb(q)));
    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ result: string; citations: string[] }>).value);

    if (successful.length === 0) return 'No se pudieron obtener tendencias web.';

    const combined = successful.map(r => r.result).join('\n\n---\n\n');

    const consolidation = await callLLM(
      [
        {
          role: 'system',
          content: `Eres el radar de tendencias de Alexander Cast (Estrategia Digital, IA, Contenido).

Extrae los 5-8 insights MÁS POTENTES para contenido viral:
- Noticias de IA impactantes
- Herramientas que cambian el juego
- Datos/estadísticas impactantes
- Tendencias de negocio emergentes

Para cada uno: DATO CONCRETO + por qué importa a emprendedores/marketers/creadores. Español, bullets.`,
        },
        { role: 'user', content: combined.slice(0, 8000) },
      ],
      { provider: 'gemini', maxTokens: 2000 },
    );

    return consolidation.text || 'Tendencias procesadas sin resumen.';
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Web trends search failed');
    return `Error buscando tendencias: ${error.message}`;
  }
}

// ─── Step 3: Select Top 3 Ideas ─────────────────────────────────────────────

async function selectTopIdeas(emailSummary: string, webTrends: string): Promise<ContentIdea[]> {
  const maxIdeas = config.dailyEngine.maxIdeas;

  const response = await callLLM(
    [
      {
        role: 'system',
        content: `Eres el estratega de Alexander Cast — experto en Estrategia Digital, IA y Contenido.

Selecciona los ${maxIdeas} MEJORES temas para videos virales HOY.

Criterios:
1. VIRALIDAD: ¿Genera curiosidad, debate, o "wow"?
2. RELEVANCIA: ¿Conecta con emprendedores, marketers, creadores?
3. ÁNGULO ÚNICO: ¿Alexander puede dar perspectiva experta?
4. URGENCIA: ¿Mejor hoy que mañana?

JSON array:
[{
  "title": "Título clickeable (máx 10 palabras)",
  "angle": "Perspectiva experta de Alexander",
  "whyToday": "Por qué es relevante HOY",
  "platform": "instagram|tiktok|youtube|linkedin",
  "viralScore": 8
}]`,
      },
      {
        role: 'user',
        content: `📧 NEWSLETTERS:\n${emailSummary}\n\n🌐 TENDENCIAS:\n${webTrends}\n\nSelecciona ${maxIdeas} temas. Solo JSON array.`,
      },
    ],
    { provider: 'gemini', maxTokens: 2000, temperature: 0.8 },
  );

  try {
    let jsonStr = response.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) jsonStr = arrayMatch[0];
    return (JSON.parse(jsonStr) as ContentIdea[]).slice(0, maxIdeas);
  } catch {
    return [{
      title: 'Lo que está pasando hoy con la IA',
      angle: 'Resumen de las noticias más importantes',
      whyToday: 'Tendencias web del día',
      platform: 'instagram',
      viralScore: 6,
    }];
  }
}

// ─── Step 4: Generate Video Scripts (3 dimensions) ──────────────────────────

async function generateVideoScripts(
  ideas: ContentIdea[],
): Promise<(ContentIdea & { videoScript: VideoScript })[]> {
  const skillContent = loadSkillsForEngine([
    'skill_copywriting_avanzado',
    'skill_storytelling_avanzado',
    'skill_humanizer',
    'skill_viralidad_redes',
    'skill_neuroventas',
    'skill_creacion_contenido',
  ]);

  return Promise.all(
    ideas.map(async (idea) => {
      try {
        const videoScript = await generateSingleScript(idea, skillContent);
        return { ...idea, videoScript };
      } catch (error: any) {
        logger.error({ idea: idea.title, error: error.message }, 'Script generation failed');
        return { ...idea, videoScript: getEmptyScript() };
      }
    }),
  );
}

async function generateSingleScript(idea: ContentIdea, skillContent: string): Promise<VideoScript> {
  const response = await callLLM(
    [
      {
        role: 'system',
        content: `Eres el equipo creativo de Alexander Cast para videos virales DOPAMÍNICOS.

ALEXANDER CAST: Experto en Estrategia Digital, IA y Contenido. Colombiano, directo, datos duros + opinión fuerte. Su audiencia: emprendedores, marketers, creadores.

Genera un guión con 3 DIMENSIONES separadas:

1. **GUIÓN DE VOZ** (voiceScript): Lo que Alexander DICE palabra por palabra.
   - Hook de 3 segundos IRRESISTIBLE
   - Estructura: Hook → Contexto rápido → Dato 1 → Dato 2 → Opinión personal → CTA
   - Con marcadores de tiempo [0:00], [0:05], etc.
   - Tono: como contarle algo increíble a un amigo
   - Pausas estratégicas marcadas con (...)
   - Cambios de energía: [ENERGÍA ALTA], [TONO SERIO], [SUSURRO]

2. **GUIÓN VISUAL** (visualScript): Lo que SE VE en pantalla.
   - Cada escena con tiempo exacto
   - Encuadres: POV, close-up cara, plano medio, pantalla compartida, B-roll
   - Movimientos de cámara: zoom in rápido, paneo, estático
   - Props, fondos, elementos visuales
   - Expresiones faciales y lenguaje corporal
   - Máximo dinamismo: cambio de plano cada 2-3 segundos

3. **GUIÓN DE EDICIÓN** (editingScript): Instrucciones para el editor.
   - Cortes y transiciones (jump cuts, zoom cuts, whip pan)
   - Text overlays: texto exacto + timing + posición + animación
   - Efectos de sonido: woosh, pop, ding, bass drop
   - Música de fondo: estilo, BPM, momentos clave
   - Efectos visuales: shake, flash, slow-mo, speed ramp
   - Subtítulos animados: estilo (Alex Hormozi, Mr Beast)
   - Formato: 9:16, 1080x1920

OBJETIVO: Que cada segundo genere DOPAMINA. Retención del 90%+.

${skillContent}

RESPONDE SOLO en JSON:
{
  "hook": "Texto exacto del hook (primeros 3s). IRRESISTIBLE.",
  "duration": "30s|60s|90s",
  "voiceScript": "Guión completo de VOZ con marcadores de tiempo y energía",
  "visualScript": "Guión completo VISUAL escena por escena con encuadres y movimientos",
  "editingScript": "Instrucciones de EDICIÓN: cortes, overlays, SFX, música, subtítulos",
  "caption": "Caption completo para la plataforma con hook, cuerpo y CTA",
  "hashtags": "20 hashtags: 30% grandes, 40% medianos, 30% nicho",
  "cta": "CTA del video + CTA del caption"
}`,
      },
      {
        role: 'user',
        content: `TEMA: ${idea.title}\nÁNGULO: ${idea.angle}\nPOR QUÉ HOY: ${idea.whyToday}\nPLATAFORMA: ${idea.platform}\nVIRAL SCORE: ${idea.viralScore}/10\n\nEscribe el guión completo con las 3 dimensiones. Solo JSON.`,
      },
    ],
    { provider: 'gemini', maxTokens: 6000, temperature: 0.7 },
  );

  try {
    let jsonStr = response.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) jsonStr = objMatch[0];
    return JSON.parse(jsonStr) as VideoScript;
  } catch {
    return {
      hook: idea.title,
      duration: '60s',
      voiceScript: response.text.slice(0, 3000),
      visualScript: 'Ver guión de voz para referencia',
      editingScript: 'Jump cuts cada 2-3s, subtítulos estilo Hormozi, SFX en datos clave',
      caption: idea.angle,
      hashtags: '#IA #EstrategiaDigital #Emprendimiento #AlexanderCast',
      cta: 'Sígueme para más contenido como este',
    };
  }
}

function getEmptyScript(): VideoScript {
  return {
    hook: 'Error generando guión',
    duration: '60s',
    voiceScript: '-',
    visualScript: '-',
    editingScript: '-',
    caption: '-',
    hashtags: '-',
    cta: '-',
  };
}

// ─── Skill Loader Helper ────────────────────────────────────────────────────

function loadSkillsForEngine(skillNames: string[]): string {
  const contents: string[] = [];
  for (const name of skillNames) {
    const content = loadSkillContent(name);
    if (content) {
      contents.push(`## Skill: ${name}\n${content.slice(0, 2000)}`);
    }
  }
  return contents.join('\n\n');
}
