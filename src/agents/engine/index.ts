import { callLLM } from '../../core/llm.js';
import { searchEmails, readEmailFull } from '../../shared/google-api.js';
import { searchWeb } from '../../shared/perplexity.js';
import { config } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { loadSkillContent } from '../../core/skill-loader.js';
import type { DailyReport, ContentIdea, ReelStructure } from '../../shared/types.js';

type ProgressFn = (msg: string) => void;

// ─── Main Pipeline ───────────────────────────────────────────────────────────

export async function runDailyContentEngine(
  onProgress?: ProgressFn,
): Promise<DailyReport> {
  const date = new Date().toISOString().split('T')[0];
  const log = (msg: string) => {
    logger.info({ engine: true }, msg);
    onProgress?.(msg);
  };

  log('📧 Paso 1/5: Escaneando emails relevantes...');
  const emailSummary = await scanEmails();

  log('🌐 Paso 2/5: Buscando tendencias web...');
  const webTrends = await searchTrends();

  log('💡 Paso 3/5: Generando ideas de contenido...');
  const ideas = await generateIdeas(emailSummary, webTrends);

  log('🎬 Paso 4/5: Generando estructura completa por idea...');
  const fullIdeas = await generateStructures(ideas);

  log('📊 Paso 5/5: Compilando reporte...');
  const report: DailyReport = {
    date,
    emailSummary,
    webTrends,
    ideas: fullIdeas,
    generatedAt: new Date().toISOString(),
  };

  log(`✅ Reporte completo: ${fullIdeas.length} ideas con estructura de 5 perspectivas`);

  return report;
}

// ─── Step 1: Scan Emails ─────────────────────────────────────────────────────

async function scanEmails(): Promise<string> {
  const brands = config.dailyEngine.brands;
  const query = brands.map(b => `"${b}"`).join(' OR ') + ' newer_than:1d';

  try {
    // Scan both accounts in parallel
    const [founderEmails, opsEmails] = await Promise.allSettled([
      searchEmails(query, 15, 'founder'),
      searchEmails(query, 15, 'ops'),
    ]);

    const allEmails = [
      ...(founderEmails.status === 'fulfilled' ? founderEmails.value : []),
      ...(opsEmails.status === 'fulfilled' ? opsEmails.value : []),
    ];

    if (allEmails.length === 0) {
      return 'Sin emails relevantes en las últimas 24 horas.';
    }

    // Read full content of top 5 most relevant
    const topEmails = allEmails.slice(0, 5);
    const fullContents = await Promise.allSettled(
      topEmails.map(e => readEmailFull(e.id, 'founder').catch(() => readEmailFull(e.id, 'ops'))),
    );

    const emailData = fullContents
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof readEmailFull>>>).value)
      .map(e => `From: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nBody: ${e.body.slice(0, 500)}`)
      .join('\n---\n');

    // Use Gemini Flash (cheap) to filter and summarize
    const filterResponse = await callLLM(
      [
        {
          role: 'system',
          content: 'Eres un asistente que filtra emails relevantes para una agencia de contenido UGC en Colombia. Responde en español.',
        },
        {
          role: 'user',
          content: `Estos son emails recientes. Filtra cuáles son relevantes para generar ideas de contenido (noticias de la industria, oportunidades de negocio, tendencias, comunicaciones de clientes). Resume cada uno en 1-2 líneas.\n\n${emailData}`,
        },
      ],
      { provider: 'gemini', maxTokens: 1500 },
    );

    return filterResponse.text || 'Sin emails relevantes procesados.';
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Email scan failed');
    return `Error escaneando emails: ${error.message}`;
  }
}

// ─── Step 2: Search Web Trends ───────────────────────────────────────────────

async function searchTrends(): Promise<string> {
  const queries = [
    'tendencias contenido digital Colombia hoy',
    'viral reels trends Instagram TikTok this week',
    'UGC marketing news Latin America',
    'novedades marketing digital creadores',
  ];

  try {
    const results = await Promise.allSettled(
      queries.map(q => searchWeb(q)),
    );

    const successful = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ result: string; citations: string[] }>).value);

    if (successful.length === 0) {
      return 'No se pudieron obtener tendencias web.';
    }

    const combined = successful.map(r => r.result).join('\n\n---\n\n');

    // Consolidate and deduplicate with Gemini Flash
    const consolidation = await callLLM(
      [
        {
          role: 'system',
          content: 'Consolida y deduplica estas búsquedas de tendencias web. Extrae los 5-8 insights más relevantes para una agencia UGC/contenido digital en LATAM. Responde en español, formato bullet points.',
        },
        {
          role: 'user',
          content: combined.slice(0, 8000),
        },
      ],
      { provider: 'gemini', maxTokens: 1500 },
    );

    return consolidation.text || 'Tendencias procesadas sin resumen.';
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Web trends search failed');
    return `Error buscando tendencias: ${error.message}`;
  }
}

// ─── Step 3: Generate Ideas ──────────────────────────────────────────────────

async function generateIdeas(
  emailSummary: string,
  webTrends: string,
): Promise<ContentIdea[]> {
  const maxIdeas = config.dailyEngine.maxIdeas;

  // Load relevant skills
  const skillContent = loadSkillsForEngine([
    'skill_viralidad_redes',
    'skill_estrategia_contenido',
    'skill_neuroventas',
  ]);

  const response = await callLLM(
    [
      {
        role: 'system',
        content: `Eres un estratega de contenido digital para Kreoon, agencia UGC en Colombia.
Genera exactamente ${maxIdeas} ideas de contenido basadas en los datos proporcionados.

${skillContent}

RESPONDE EXCLUSIVAMENTE en formato JSON array. Cada idea debe tener:
{
  "title": "Título corto y punchy",
  "angle": "Ángulo específico para este contenido",
  "relevance": "Por qué es relevante HOY (referencia a email/tendencia)",
  "platform": "instagram|tiktok|youtube|linkedin",
  "funnelPosition": "TOFU|MOFU|BOFU",
  "contentPillar": "educativo|entretenimiento|venta|behind-the-scenes|autoridad"
}`,
      },
      {
        role: 'user',
        content: `📧 EMAILS RELEVANTES:\n${emailSummary}\n\n🌐 TENDENCIAS WEB:\n${webTrends}\n\nGenera ${maxIdeas} ideas de contenido. Solo JSON array, nada más.`,
      },
    ],
    { provider: 'gemini', maxTokens: 2000, temperature: 0.8 },
  );

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Also try to extract array directly
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const ideas: ContentIdea[] = JSON.parse(jsonStr);
    return ideas.slice(0, maxIdeas);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to parse ideas JSON');
    // Fallback: return a single generic idea
    return [{
      title: 'Tendencia del día en contenido UGC',
      angle: 'Resumen de lo más relevante en el mundo UGC hoy',
      relevance: 'Basado en las tendencias web del día',
      platform: 'instagram',
      funnelPosition: 'TOFU',
      contentPillar: 'educativo',
    }];
  }
}

// ─── Step 4: Generate Structures ─────────────────────────────────────────────

async function generateStructures(
  ideas: ContentIdea[],
): Promise<(ContentIdea & { structure: ReelStructure })[]> {
  // Load all relevant skills for structure generation
  const skillContent = loadSkillsForEngine([
    'skill_copywriting_avanzado',
    'skill_storytelling_avanzado',
    'skill_humanizer',
    'skill_creacion_contenido',
    'skill_viralidad_redes',
  ]);

  const results = await Promise.all(
    ideas.map(async (idea) => {
      try {
        const structure = await generateSingleStructure(idea, skillContent);
        return { ...idea, structure };
      } catch (error: any) {
        logger.error({ idea: idea.title, error: error.message }, 'Failed to generate structure');
        return { ...idea, structure: getEmptyStructure() };
      }
    }),
  );

  return results;
}

async function generateSingleStructure(
  idea: ContentIdea,
  skillContent: string,
): Promise<ReelStructure> {
  const response = await callLLM(
    [
      {
        role: 'system',
        content: `Eres un equipo completo de producción de contenido UGC para Kreoon (agencia en Colombia).
Para la idea dada, genera la estructura completa desde 5 perspectivas profesionales.

${skillContent}

RESPONDE EXCLUSIVAMENTE en formato JSON con esta estructura exacta:
{
  "creator": {
    "script": "Script completo: hook (3s), desarrollo, CTA. Con marcadores de tiempo.",
    "timing": "Desglose de tiempo por sección",
    "deliveryNotes": "Energía, tono, contacto visual, gestos"
  },
  "producer": {
    "shotList": "Lista de planos escena por escena",
    "transitions": "Transiciones entre escenas",
    "textOverlays": "Texto exacto + posición + timing de cada overlay",
    "music": "Género, BPM, trending sounds sugeridos",
    "specs": "Formato, aspecto, resolución"
  },
  "strategist": {
    "funnelPosition": "Posición en funnel y justificación",
    "pillar": "Pilar de contenido",
    "objective": "Objetivo principal y métricas",
    "kpis": "KPIs específicos a trackear",
    "schedule": "Mejor día/hora de publicación",
    "repurposing": "Plan de repurposing a otras plataformas"
  },
  "trafficker": {
    "adScore": 7,
    "targeting": "Audiencia ideal para paid",
    "budget": "Rango de presupuesto sugerido",
    "paidCTA": "CTA optimizado para versión pagada"
  },
  "communityManager": {
    "caption": "Caption completo con hook/body/CTA",
    "hashtags": "30 hashtags IG + 5 TikTok",
    "engagement": "Prompts de engagement para comentarios",
    "replyTemplates": "Templates de respuesta a comentarios",
    "crossPosting": "Plan de cross-posting"
  }
}`,
      },
      {
        role: 'user',
        content: `IDEA: ${idea.title}
ÁNGULO: ${idea.angle}
PLATAFORMA: ${idea.platform}
FUNNEL: ${idea.funnelPosition}
PILAR: ${idea.contentPillar}

Genera la estructura completa. Solo JSON, nada más.`,
      },
    ],
    {
      provider: 'claude',
      maxTokens: 6000,
      temperature: 0.7,
    },
  );

  try {
    let jsonStr = response.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }

    return JSON.parse(jsonStr) as ReelStructure;
  } catch {
    logger.warn({ idea: idea.title }, 'Failed to parse structure JSON, using raw text');
    // Fallback: wrap raw text
    return {
      creator: { script: response.text.slice(0, 2000), timing: 'Ver script', deliveryNotes: 'Ver script' },
      producer: { shotList: 'Ver script', transitions: 'Cortes directos', textOverlays: 'Ver script', music: 'Trending audio', specs: '9:16, 1080x1920' },
      strategist: { funnelPosition: idea.funnelPosition, pillar: idea.contentPillar, objective: 'Engagement', kpis: 'Views, saves, shares', schedule: 'L-V 7-9AM / 6-8PM', repurposing: 'Stories, carousel' },
      trafficker: { adScore: 5, targeting: 'Emprendedores 25-40 Colombia', budget: '$5-15 USD/día', paidCTA: 'Descubre más' },
      communityManager: { caption: 'Ver script', hashtags: '#UGC #ContentCreator #Colombia', engagement: '¿Qué opinan?', replyTemplates: 'Gracias por tu comentario!', crossPosting: 'IG → TikTok → LinkedIn' },
    };
  }
}

function getEmptyStructure(): ReelStructure {
  return {
    creator: { script: 'Error generando estructura', timing: '-', deliveryNotes: '-' },
    producer: { shotList: '-', transitions: '-', textOverlays: '-', music: '-', specs: '9:16' },
    strategist: { funnelPosition: '-', pillar: '-', objective: '-', kpis: '-', schedule: '-', repurposing: '-' },
    trafficker: { adScore: 0, targeting: '-', budget: '-', paidCTA: '-' },
    communityManager: { caption: '-', hashtags: '-', engagement: '-', replyTemplates: '-', crossPosting: '-' },
  };
}

// ─── Skill Loader Helper ─────────────────────────────────────────────────────

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
