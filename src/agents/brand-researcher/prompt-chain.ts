import { callLLM } from '../../core/llm.js';
import { agentLogger } from '../../shared/logger.js';
import type { SocialProfile, AnalyzedPost } from './types.js';
import type { CompetitorAnalysis } from './competitor-analyzer.js';
import type { ApifyAd } from './apify-scraper.js';

const log = agentLogger('prompt-chain');

// ─── Helper: call LLM and parse JSON safely ─────────────────────────────────

async function callAndParse(systemPrompt: string, userMessage: string, label: string): Promise<any> {
  const start = Date.now();
  log.info({ step: label }, `Chain step starting: ${label}`);

  const response = await callLLM(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { maxTokens: 3000, temperature: 0.4 },
  );

  let jsonText = response.text.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonText);
    const duration = Math.round((Date.now() - start) / 1000);
    log.info({ step: label, duration: `${duration}s` }, `Chain step complete: ${label}`);
    return parsed;
  } catch (err: any) {
    log.warn({ step: label, error: err.message, rawLength: jsonText.length }, `Failed to parse JSON for ${label}`);
    return {};
  }
}

// ─── PROMPT 1: Market Researcher ─────────────────────────────────────────────

const P1_SYSTEM = `Eres un investigador de mercado senior especializado en marcas digitales en LATAM.

Tu tarea: Analizar la marca y construir el AVATAR IDEAL del cliente + posicionamiento de mercado.

Responde SOLO en JSON valido (sin markdown, sin backticks):
{
  "avatar_ideal": {
    "demographics": "<edad, genero, ubicacion, nivel socioeconomico>",
    "pain_points": ["<dolor 1>", "<dolor 2>", "<dolor 3>"],
    "desires": ["<deseo 1>", "<deseo 2>", "<deseo 3>"],
    "objections": ["<objecion 1>", "<objecion 2>"],
    "platforms": ["<donde esta: IG, TikTok, YouTube, etc>"],
    "buying_triggers": ["<que lo hace comprar>"]
  },
  "buyer_persona": {
    "name": "<nombre ficticio>",
    "age": <number>,
    "occupation": "<ocupacion>",
    "daily_routine": "<como es su dia tipico en 2 lineas>",
    "how_discovers_brands": "<como descubre marcas nuevas>",
    "decision_factors": ["<factor 1>", "<factor 2>"]
  },
  "market_position": {
    "current_position": "<donde esta la marca hoy>",
    "ideal_position": "<donde deberia estar>",
    "market_trends": ["<tendencia 1>", "<tendencia 2>"],
    "niche_size": "<estimacion del tamano del nicho>"
  },
  "brand_identity": {
    "current_tone": "<tono de voz actual detectado>",
    "recommended_tone": "<tono recomendado>",
    "archetype": "<arquetipo de marca recomendado>",
    "differentiator": "<que los hace unicos>"
  }
}`;

// ─── PROMPT 2: Competitor Analyst ────────────────────────────────────────────

const P2_SYSTEM = `Eres un analista competitivo especializado en redes sociales para marcas en LATAM.

Analiza los competidores con datos REALES y compara con la marca auditada.

Responde SOLO en JSON valido:
{
  "competitor_deep_analysis": [
    {
      "name": "<nombre>",
      "handle": "<@handle>",
      "followers": <number>,
      "engagement_rate": <number>,
      "strengths": ["<fortaleza 1>", "<fortaleza 2>"],
      "weaknesses": ["<debilidad 1>"],
      "dominant_formats": ["<reels, carruseles, etc>"],
      "posting_frequency": "<posts por semana>"
    }
  ],
  "benchmark": {
    "avg_followers": <number>,
    "avg_engagement": <number>,
    "avg_posts_per_week": <number>
  },
  "market_gaps": ["<oportunidad que nadie aprovecha 1>", "<oportunidad 2>", "<oportunidad 3>"],
  "biggest_threat": {
    "competitor": "<nombre>",
    "reason": "<por que es la mayor amenaza>"
  },
  "steal_worthy_ideas": ["<idea concreta para copiar 1>", "<idea 2>", "<idea 3>"]
}`;

// ─── PROMPT 3: Content Auditor ───────────────────────────────────────────────

const P3_SYSTEM = `Eres un auditor de contenido digital senior. Analizas cada post con ojo critico.

IMPORTANTE: Incluye las URLs reales de Instagram de cada post para que el frontend las embeba.

Responde SOLO en JSON valido:
{
  "content_scores": {
    "content_quality": { "score": <0-100>, "justification": "<por que este score>" },
    "strategy": { "score": <0-100>, "justification": "<justificacion>" },
    "consistency": { "score": <0-100>, "justification": "<justificacion>" },
    "engagement": { "score": <0-100>, "justification": "<justificacion>" },
    "branding": { "score": <0-100>, "justification": "<justificacion>" }
  },
  "featured_posts": [
    {
      "url": "<URL real del post de Instagram>",
      "thumbnail_url": "<URL de thumbnail si existe>",
      "caption_preview": "<primeros 80 chars del caption>",
      "likes": <number>,
      "comments": <number>,
      "audit_note": "<observacion especifica: buen hook, falta CTA, etc>"
    }
  ],
  "whats_working": [
    { "insight": "<que funciona>", "evidence": "<evidencia del post>" }
  ],
  "whats_failing": [
    { "insight": "<que falla>", "evidence": "<evidencia>" }
  ],
  "ad_analysis": {
    "has_ads": <boolean>,
    "summary": "<resumen de estrategia publicitaria>",
    "recommendation": "<recomendacion de paid media>"
  }
}`;

// ─── PROMPT 4: Content Strategist ────────────────────────────────────────────

const P4_SYSTEM = `Eres un estratega de contenido senior para marcas en Instagram/TikTok en LATAM.

Basandote en el avatar, competidores y auditoria, crea una ESTRATEGIA DE CONTENIDO completa.

Responde SOLO en JSON valido:
{
  "content_pillars": [
    {
      "name": "<nombre del pilar>",
      "percentage": <number 0-100>,
      "description": "<que tipo de contenido va aqui>",
      "example_posts": ["<idea post 1>", "<idea post 2>"]
    }
  ],
  "funnel_strategy": {
    "tofu": { "percentage": <number>, "formats": ["<formato>"], "goal": "<objetivo>" },
    "mofu": { "percentage": <number>, "formats": ["<formato>"], "goal": "<objetivo>" },
    "bofu": { "percentage": <number>, "formats": ["<formato>"], "goal": "<objetivo>" }
  },
  "format_mix": {
    "reels": { "percentage": <number>, "why": "<razon>" },
    "carousels": { "percentage": <number>, "why": "<razon>" },
    "stories": { "percentage": <number>, "why": "<razon>" },
    "static": { "percentage": <number>, "why": "<razon>" }
  },
  "hook_formulas": [
    "<formula de hook personalizada 1>",
    "<formula 2>",
    "<formula 3>",
    "<formula 4>",
    "<formula 5>"
  ],
  "calendar_30d": [
    { "day": 1, "pillar": "<pilar>", "format": "<formato>", "idea": "<idea del post>" },
    { "day": 2, "pillar": "<pilar>", "format": "<formato>", "idea": "<idea>" }
  ],
  "best_times": {
    "days": ["<mejores dias>"],
    "hours": ["<mejores horas>"],
    "reason": "<por que estos horarios>"
  }
}

IMPORTANTE: El calendar_30d debe tener exactamente 20 entradas (5 posts/semana x 4 semanas).`;

// ─── PROMPT 5: Proposal Builder ──────────────────────────────────────────────

const P5_SYSTEM = `Eres un consultor senior de Kreoon, una agencia de UGC y estrategia de contenido en Colombia.

Genera la propuesta comercial final basada en todo el analisis previo.

PAQUETES KREOON:
1. "Auditoria Express" — Diagnostico + plan de accion 30 dias ($300-500 USD)
2. "Content Strategy" — Estrategia completa + calendario 3 meses + guiones ($800-1,500 USD)
3. "Full Content" — Estrategia + produccion UGC mensual + gestion ($2,000-4,000 USD/mes)
4. "Agency Partner" — Full Content + paid media + community management ($4,000-8,000 USD/mes)

Responde SOLO en JSON valido:
{
  "overall_score": <0-100>,
  "executive_summary": "<resumen ejecutivo en 3 parrafos que el cliente entienda>",
  "quick_wins": [
    { "action": "<accion inmediata gratuita>", "expected_impact": "<impacto esperado>" }
  ],
  "service_proposal": {
    "packages": [
      {
        "name": "<nombre>",
        "description": "<descripcion>",
        "includes": ["<item 1>", "<item 2>"],
        "price_range": "<rango USD>",
        "ideal_for": "<para quien>"
      }
    ],
    "recommended": "<nombre del paquete recomendado>",
    "pricing_note": "<nota sobre pricing>",
    "estimated_roi": "<ROI estimado en 3 meses>"
  },
  "next_steps": ["<paso 1>", "<paso 2>", "<paso 3>"]
}`;

// ─── Main Chain Orchestrator ─────────────────────────────────────────────────

export interface ChainInput {
  brandName: string;
  brandDescription: string;
  brandIndustry: string;
  brandWebsite: string | null;
  socialProfiles: SocialProfile[];
  posts: AnalyzedPost[];
  competitorData?: CompetitorAnalysis;
  adsData?: ApifyAd[];
  clientChallenge?: string;
  clientGoals?: string;
}

export async function runPromptChain(input: ChainInput): Promise<any> {
  const startTime = Date.now();
  log.info({ brand: input.brandName, posts: input.posts.length }, 'Starting 5-step prompt chain');

  // Build shared context strings
  const brandContext = `Marca: ${input.brandName}
Industria: ${input.brandIndustry}
Website: ${input.brandWebsite || 'No disponible'}
Descripcion: ${input.brandDescription}
Desafio del cliente: ${input.clientChallenge || 'No especificado'}
Objetivos: ${input.clientGoals || 'No especificados'}`;

  const profilesContext = input.socialProfiles.map(p =>
    `${p.platform}: @${p.username} | ${p.followers ?? '?'} seguidores | ER: ${p.engagement_rate ?? '?'}% | Bio: ${p.bio ?? 'N/A'}`
  ).join('\n');

  const postsContext = input.posts.map((p, i) =>
    `Post ${i + 1}: ${p.url} | ${p.content_type} | ${p.likes ?? 0} likes, ${p.comments ?? 0} comments | Caption: ${(p.caption || '').slice(0, 120)}`
  ).join('\n');

  const competitorContext = input.competitorData?.competitors?.map(c =>
    `@${c.handle}: ${c.followers} seguidores, ER ${c.engagement_rate}%, Bio: ${c.bio}`
  ).join('\n') || 'No se encontraron competidores';

  const adsContext = input.adsData?.length
    ? `${input.adsData.length} ads encontrados (${input.adsData.filter(a => a.status === 'active').length} activos):\n` +
      input.adsData.slice(0, 5).map(a => `- [${a.status}] ${a.ad_text.slice(0, 100)}`).join('\n')
    : 'No se encontraron ads en Meta Ad Library';

  // ── STEP 1 + 3 in PARALLEL (P3 doesn't depend on P1) ──

  const videoAnalysisContext = input.posts.filter(p => p.score !== undefined).map(p =>
    `- ${p.url} | Score: ${p.score}/100 | ${p.analysis || "Sin analisis"}`
  ).join("\n") || "No se realizo analisis de video";

  const [p1Result, p3Result] = await Promise.all([
    // P1: Market Researcher
    callAndParse(P1_SYSTEM, `${brandContext}\n\nPRESENCIA DIGITAL:\n${profilesContext}`, 'P1-Market'),

    // P3: Content Auditor (runs in parallel with P1)
    callAndParse(P3_SYSTEM, `${brandContext}\n\nPOSTS ANALIZADOS (${input.posts.length}):\n${postsContext}\n\nANALISIS DE VIDEO (IA visual):\n${videoAnalysisContext}\n\nPUBLICIDAD:\n${adsContext}`, 'P3-Audit'),
  ]);

  // ── STEP 2: Competitor Analyst (needs P1 avatar) ──

  const p2Result = await callAndParse(P2_SYSTEM,
    `${brandContext}\n\nAVATAR IDEAL:\n${JSON.stringify(p1Result.avatar_ideal || {})}\n\nCOMPETIDORES (datos reales Apify):\n${competitorContext}\n\nBenchmark followers: ${input.competitorData?.benchmark_followers ?? 'N/A'}\nBenchmark ER: ${input.competitorData?.benchmark_engagement ?? 'N/A'}%`,
    'P2-Competitors');

  // ── STEP 4: Content Strategist (needs P1 + P2 + P3) ──

  const p4Result = await callAndParse(P4_SYSTEM,
    `${brandContext}\n\nAVATAR IDEAL:\n${JSON.stringify(p1Result.avatar_ideal || {})}\n\nCOMPETIDORES - QUE COPIAR:\n${JSON.stringify(p2Result.steal_worthy_ideas || [])}\nGAPS:\n${JSON.stringify(p2Result.market_gaps || [])}\n\nAUDITORIA - QUE FUNCIONA:\n${JSON.stringify(p3Result.whats_working || [])}\nQUE FALLA:\n${JSON.stringify(p3Result.whats_failing || [])}`,
    'P4-Strategy');

  // ── STEP 5: Proposal Builder (needs all) ──

  const p5Result = await callAndParse(P5_SYSTEM,
    `${brandContext}\n\nSCORES:\n${JSON.stringify(p3Result.content_scores || {})}\n\nAVATAR:\n${JSON.stringify(p1Result.buyer_persona || {})}\n\nESTRATEGIA RECOMENDADA:\nPilares: ${(p4Result.content_pillars || []).map((p: any) => p.name).join(', ')}\nFormatos: Reels ${p4Result.format_mix?.reels?.percentage ?? '?'}%, Carruseles ${p4Result.format_mix?.carousels?.percentage ?? '?'}%\n\nQUICK WINS DISPONIBLES:\n${JSON.stringify(p3Result.whats_working || [])}`,
    'P5-Proposal');

  // ── Merge all outputs ──

  const totalDuration = Math.round((Date.now() - startTime) / 1000);
  log.info({ brand: input.brandName, duration: `${totalDuration}s`, steps: 5 }, 'Prompt chain complete');

  // Extract scores for backward compatibility
  const scores = p3Result.content_scores || {};
  const overall = p5Result.overall_score || Math.round(
    ((scores.content_quality?.score || 50) +
     (scores.strategy?.score || 50) +
     (scores.consistency?.score || 50) +
     (scores.engagement?.score || 50) +
     (scores.branding?.score || 50)) / 5
  );

  return {
    // Backward compatible fields
    overall_score: overall,
    scores: {
      content_quality: scores.content_quality?.score || 50,
      strategy: scores.strategy?.score || 50,
      consistency: scores.consistency?.score || 50,
      engagement: scores.engagement?.score || 50,
      branding: scores.branding?.score || 50,
    },
    funnel_coverage: {
      tofu: p4Result.funnel_strategy?.tofu?.percentage || 60,
      mofu: p4Result.funnel_strategy?.mofu?.percentage || 30,
      bofu: p4Result.funnel_strategy?.bofu?.percentage || 10,
    },
    pillar_distribution: Object.fromEntries(
      (p4Result.content_pillars || []).map((p: any) => [p.name?.toLowerCase()?.slice(0, 15) || 'pilar', p.percentage || 25])
    ),
    hook_patterns: p4Result.hook_formulas || [],
    opportunities: (p2Result.market_gaps || []).map((gap: string, i: number) => ({
      title: gap,
      description: gap,
      impact: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
      priority: i + 1,
    })),
    service_proposal: p5Result.service_proposal || { packages: [], recommended: '', pricing_note: '' },

    // NEW v7 fields
    avatar_ideal: p1Result.avatar_ideal || {},
    buyer_persona: p1Result.buyer_persona || {},
    market_position: p1Result.market_position || {},
    brand_identity: p1Result.brand_identity || {},
    competitor_deep_analysis: p2Result.competitor_deep_analysis || [],
    benchmark: p2Result.benchmark || {},
    steal_worthy_ideas: p2Result.steal_worthy_ideas || [],
    content_audit: {
      featured_posts: p3Result.featured_posts || [],
      scores_detail: p3Result.content_scores || {},
      whats_working: p3Result.whats_working || [],
      whats_failing: p3Result.whats_failing || [],
      ad_analysis: p3Result.ad_analysis || {},
    },
    content_strategy: {
      pillars: p4Result.content_pillars || [],
      funnel: p4Result.funnel_strategy || {},
      format_mix: p4Result.format_mix || {},
      calendar_30d: p4Result.calendar_30d || [],
      best_times: p4Result.best_times || {},
    },
    executive_summary: p5Result.executive_summary || '',
    quick_wins: p5Result.quick_wins || [],
    next_steps: p5Result.next_steps || [],
  };
}
