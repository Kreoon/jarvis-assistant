import { callLLM } from '../../core/llm.js';
import { agentLogger } from '../../shared/logger.js';
import type {
  BrandResearchResult,
  SocialProfile,
  AnalyzedPost,
  FunnelCoverage,
  PillarDistribution,
  BrandScores,
  Opportunity,
  ServiceProposal,
} from './types.js';

const log = agentLogger('diagnosis-generator');

const DIAGNOSIS_SYSTEM_PROMPT = `Eres un consultor senior de marketing digital y contenido en Kreoon, una agencia de UGC y estrategia de contenido en Colombia.

Tu tarea es generar un DIAGNÓSTICO ESTRATÉGICO COMPLETO de una marca basándote en:
1. Research de la marca (industria, descripción, website)
2. Análisis de su presencia en redes sociales
3. Análisis de sus publicaciones recientes

Debes responder EXCLUSIVAMENTE en formato JSON válido (sin markdown, sin backticks) con esta estructura exacta:

{
  "overall_score": <number 0-100>,
  "scores": {
    "content_quality": <number 0-100>,
    "strategy": <number 0-100>,
    "consistency": <number 0-100>,
    "engagement": <number 0-100>,
    "branding": <number 0-100>
  },
  "funnel_coverage": {
    "tofu": <number 0-100>,
    "mofu": <number 0-100>,
    "bofu": <number 0-100>
  },
  "pillar_distribution": {
    "educar": <number porcentaje>,
    "entretener": <number porcentaje>,
    "inspirar": <number porcentaje>,
    "vender": <number porcentaje>
  },
  "hook_patterns": ["<patrón 1>", "<patrón 2>", ...],
  "opportunities": [
    {
      "title": "<título>",
      "description": "<descripción detallada>",
      "impact": "high|medium|low",
      "priority": <number 1-5>
    }
  ],
  "service_proposal": {
    "packages": [
      {
        "name": "<nombre>",
        "description": "<descripción>",
        "includes": ["<item 1>", "<item 2>"],
        "price_range": "<rango USD>",
        "ideal_for": "<para quién>"
      }
    ],
    "recommended": "<nombre del paquete recomendado>",
    "pricing_note": "<nota sobre pricing>"
  }
}

CRITERIOS DE EVALUACIÓN:

**Content Quality (0-100):**
- Producción visual (iluminación, encuadre, edición)
- Copy y captions (hooks, storytelling, CTAs)
- Variedad de formatos
- Calidad del audio y música

**Strategy (0-100):**
- Cobertura del embudo (TOFU/MOFU/BOFU)
- Distribución de pilares (Educar/Entretener/Inspirar/Vender)
- Coherencia con objetivos de negocio
- Uso de tendencias vs contenido evergreen

**Consistency (0-100):**
- Frecuencia de publicación
- Coherencia visual/tonal
- Regularidad del calendario
- Presencia multiplataforma

**Engagement (0-100):**
- Tasa de engagement vs benchmarks del nicho
- Calidad de comentarios
- Patrones de respuesta
- Community building

**Branding (0-100):**
- Identidad visual consistente
- Tono de voz definido
- Diferenciación vs competidores
- Propuesta de valor clara

PAQUETES DE SERVICIO KREOON:
1. "Auditoría Express" — Diagnóstico + plan de acción 30 días ($300-500 USD)
2. "Content Strategy" — Estrategia completa + calendario 3 meses + guiones ($800-1,500 USD)
3. "Full Content" — Estrategia + producción UGC mensual + gestión ($2,000-4,000 USD/mes)
4. "Agency Partner" — Full Content + paid media + community management ($4,000-8,000 USD/mes)

Recomienda el paquete que mejor se ajuste a la situación actual de la marca.
Genera exactamente 5 oportunidades, ordenadas por prioridad.
Sé específico y accionable en cada recomendación.`;

export async function generateDiagnosis(
  brandName: string,
  brandDescription: string,
  brandIndustry: string,
  brandWebsite: string | null,
  socialProfiles: SocialProfile[],
  posts: AnalyzedPost[],
): Promise<{
  overall_score: number;
  scores: BrandScores;
  funnel_coverage: FunnelCoverage;
  pillar_distribution: PillarDistribution;
  hook_patterns: string[];
  opportunities: Opportunity[];
  service_proposal: ServiceProposal;
}> {
  // Build the analysis context
  const profilesSummary = socialProfiles.map(p => {
    const parts = [`${p.platform}: @${p.username}`];
    if (p.followers) parts.push(`${p.followers.toLocaleString()} seguidores`);
    if (p.engagement_rate) parts.push(`ER: ${p.engagement_rate}%`);
    if (p.posts_per_week) parts.push(`${p.posts_per_week} posts/semana`);
    return parts.join(' | ');
  }).join('\n');

  const postsSummary = posts.map((p, i) => {
    const parts = [`Post ${i + 1} (${p.platform})`];
    if (p.caption) parts.push(`Caption: "${p.caption.slice(0, 150)}"`);
    if (p.views) parts.push(`Views: ${p.views.toLocaleString()}`);
    if (p.likes) parts.push(`Likes: ${p.likes.toLocaleString()}`);
    if (p.comments) parts.push(`Comments: ${p.comments}`);
    if (p.content_type) parts.push(`Tipo: ${p.content_type}`);
    if (p.published_at) parts.push(`Fecha: ${p.published_at}`);
    if (p.analysis) parts.push(`Análisis visual: ${p.analysis.slice(0, 300)}`);
    return parts.join('\n  ');
  }).join('\n\n');

  const userMessage = `MARCA A DIAGNOSTICAR:
- Nombre: ${brandName}
- Industria: ${brandIndustry}
- Website: ${brandWebsite || 'No disponible'}
- Descripción: ${brandDescription}

PRESENCIA EN REDES SOCIALES:
${profilesSummary || 'No se encontraron perfiles'}

POSTS ANALIZADOS (${posts.length}):
${postsSummary || 'No se pudieron analizar posts'}

Genera el diagnóstico estratégico completo en JSON.`;

  log.info({ brandName, profiles: socialProfiles.length, posts: posts.length }, 'Generating diagnosis');

  const response = await callLLM(
    [
      { role: 'system', content: DIAGNOSIS_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    {
      provider: 'claude',
      maxTokens: 4096,
      temperature: 0.4,
    },
  );

  try {
    // Strip any markdown fencing if present
    let jsonText = response.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const result = JSON.parse(jsonText);
    log.info({ brandName, score: result.overall_score }, 'Diagnosis generated successfully');
    return result;
  } catch (parseError: any) {
    log.error({ error: parseError.message, rawLength: response.text.length }, 'Failed to parse diagnosis JSON');

    // Return safe defaults
    return {
      overall_score: 50,
      scores: { content_quality: 50, strategy: 50, consistency: 50, engagement: 50, branding: 50 },
      funnel_coverage: { tofu: 60, mofu: 30, bofu: 10 },
      pillar_distribution: { educar: 30, entretener: 30, inspirar: 20, vender: 20 },
      hook_patterns: ['No se pudieron identificar patrones'],
      opportunities: [{
        title: 'Diagnóstico incompleto',
        description: 'No se pudo generar el diagnóstico automático. Se recomienda revisión manual durante la consultoría.',
        impact: 'high' as const,
        priority: 1,
      }],
      service_proposal: {
        packages: [{
          name: 'Auditoría Express',
          description: 'Diagnóstico presencial + plan de acción 30 días',
          includes: ['Auditoría de redes', 'Plan de contenido', 'Guía de marca'],
          price_range: '$300-500 USD',
          ideal_for: 'Marcas que quieren entender su situación actual',
        }],
        recommended: 'Auditoría Express',
        pricing_note: 'Precio a confirmar durante la consultoría',
      },
    };
  }
}
