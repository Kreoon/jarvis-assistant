import { agentLogger } from '../../shared/logger.js';
import type {
  SocialProfile,
  AnalyzedPost,
} from './types.js';
import type { CompetitorAnalysis } from './competitor-analyzer.js';
import type { ApifyAd } from './apify-scraper.js';
import { runPromptChain } from './prompt-chain.js';

const log = agentLogger('diagnosis-generator');

export async function generateDiagnosis(
  brandName: string,
  brandDescription: string,
  brandIndustry: string,
  brandWebsite: string | null,
  socialProfiles: SocialProfile[],
  posts: AnalyzedPost[],
  competitorData?: CompetitorAnalysis,
  adsData?: ApifyAd[],
): Promise<any> {
  log.info({
    brandName,
    profiles: socialProfiles.length,
    posts: posts.length,
    ads: adsData?.length ?? 0,
    competitors: competitorData?.competitors.length ?? 0,
  }, 'Generating diagnosis via 5-step prompt chain');

  try {
    const result = await runPromptChain({
      brandName,
      brandDescription,
      brandIndustry,
      brandWebsite,
      socialProfiles,
      posts,
      competitorData,
      adsData,
      clientChallenge: brandDescription.includes('--- Contexto del formulario ---')
        ? brandDescription.split('Principal desaf\u00edo del cliente: ')[1]?.split('\n')[0]
        : undefined,
      clientGoals: brandDescription.includes('Objetivos del cliente:')
        ? brandDescription.split('Objetivos del cliente: ')[1]?.split('\n')[0]
        : undefined,
    });

    log.info({ brandName, score: result.overall_score }, 'Diagnosis generated successfully via prompt chain');
    return result;
  } catch (error: any) {
    log.error({ error: error.message, brandName }, 'Prompt chain failed, using fallback');

    return {
      overall_score: 50,
      scores: { content_quality: 50, strategy: 50, consistency: 50, engagement: 50, branding: 50 },
      funnel_coverage: { tofu: 60, mofu: 30, bofu: 10 },
      pillar_distribution: { educar: 30, entretener: 30, inspirar: 20, vender: 20 },
      hook_patterns: ['No se pudieron identificar patrones'],
      opportunities: [{
        title: 'Diagn\u00f3stico incompleto',
        description: 'Error en prompt chain: ' + error.message.slice(0, 100),
        impact: 'high' as const,
        priority: 1,
      }],
      service_proposal: {
        packages: [{
          name: 'Auditor\u00eda Express',
          description: 'Diagn\u00f3stico presencial + plan de acci\u00f3n 30 d\u00edas',
          includes: ['Auditor\u00eda de redes', 'Plan de contenido', 'Gu\u00eda de marca'],
          price_range: '$300-500 USD',
          ideal_for: 'Marcas que quieren entender su situaci\u00f3n actual',
        }],
        recommended: 'Auditor\u00eda Express',
        pricing_note: 'Precio a confirmar durante la consultor\u00eda',
      },
    };
  }
}
