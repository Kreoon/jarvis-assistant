import { agentLogger } from '../../shared/logger.js';
import { searchWeb } from '../../shared/perplexity.js';
import { scrapeInstagramViaApify } from './apify-scraper.js';
import type { SocialProfile } from './types.js';

const log = agentLogger('competitor-analyzer');

export interface CompetitorProfile {
  name: string;
  handle: string;
  followers: number;
  engagement_rate: number;
  bio: string;
  posts_per_week?: number;
  top_content_types: string[];
  strengths: string[];
}

export interface CompetitorAnalysis {
  competitors: CompetitorProfile[];
  benchmark_followers: number;
  benchmark_engagement: number;
  market_gaps: string[];
}

export async function analyzeCompetitors(
  brandName: string,
  brandIndustry: string,
  brandHandle: string,
  brandBio?: string,
): Promise<CompetitorAnalysis> {
  log.info({ brandName, brandIndustry }, 'Starting competitor analysis');

  // Step 1: Find competitors via Perplexity (with bio context to avoid confusion)
  const bioContext = brandBio ? ` Bio de Instagram: "${brandBio.slice(0, 200)}".` : '';
  const query = `La marca "${brandName}" (Instagram: @${brandHandle}) opera en ${brandIndustry}.${bioContext}

Necesito sus 5 COMPETIDORES DIRECTOS en Colombia/LATAM que vendan productos o servicios similares. No confundas con marcas de nombre parecido en otras industrias.

Responde UNICAMENTE con un JSON array valido, sin texto adicional, sin markdown, sin backticks:
[{"name":"Nombre Marca","handle":"usuario_instagram","description":"que hacen"}]`;

  let competitorHandles: { name: string; handle: string; description: string }[] = [];

  try {
    const { result } = await searchWeb(query);

    // Try multiple JSON extraction strategies
    let parsed = false;

    // Strategy 1: Direct JSON array match
    const jsonMatch = result.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      try {
        competitorHandles = JSON.parse(jsonMatch[0]);
        parsed = true;
      } catch { /* try next strategy */ }
    }

    // Strategy 2: Extract individual objects if array parsing fails
    if (!parsed) {
      const objectMatches = [...result.matchAll(/\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"handle"\s*:\s*"@?([^"]+)"\s*,\s*"description"\s*:\s*"([^"]+)"\s*\}/g)];
      if (objectMatches.length > 0) {
        competitorHandles = objectMatches.map(m => ({
          name: m[1],
          handle: m[2].replace(/^@/, ''),
          description: m[3],
        }));
        parsed = true;
      }
    }

    // Strategy 3: Look for @handles in text as last resort
    if (!parsed) {
      const handleMatches = [...result.matchAll(/@([a-zA-Z0-9_.]+)/g)];
      const uniqueHandles = [...new Set(handleMatches.map(m => m[1]))].filter(h => h !== brandHandle.replace(/^@/, ''));
      competitorHandles = uniqueHandles.slice(0, 5).map(h => ({
        name: h,
        handle: h,
        description: 'Competidor identificado por Perplexity',
      }));
    }

    log.info({ parsed, count: competitorHandles.length }, 'Competitor handles extracted');
  } catch (err: any) {
    log.warn({ error: err.message }, 'Failed to find competitors via Perplexity');
  }

  if (competitorHandles.length === 0) {
    log.warn('No competitors found, returning empty analysis');
    return {
      competitors: [],
      benchmark_followers: 0,
      benchmark_engagement: 0,
      market_gaps: [],
    };
  }

  // Limit to 5
  competitorHandles = competitorHandles.slice(0, 5);
  log.info({ count: competitorHandles.length }, 'Found competitors, scraping profiles');

  // Step 2: Scrape each competitor via Apify (in parallel, max 5)
  const scrapePromises = competitorHandles.map(async (comp) => {
    const handle = comp.handle.replace(/^@/, '').trim();
    if (!handle) return null;

    try {
      const apifyResult = await scrapeInstagramViaApify(handle);
      if (!apifyResult) return null;

      const topTypes = new Set<string>();
      for (const post of apifyResult.recent_posts) {
        topTypes.add(post.content_type);
      }

      const profile: CompetitorProfile = {
        name: comp.name,
        handle,
        followers: apifyResult.followers,
        engagement_rate: (apifyResult as any).engagement_rate ?? 0,
        bio: apifyResult.bio,
        top_content_types: [...topTypes],
        strengths: [],
      };

      return profile;
    } catch (err: any) {
      log.warn({ error: err.message, handle }, 'Failed to scrape competitor');
      return null;
    }
  });

  const results = await Promise.allSettled(scrapePromises);
  const competitors: CompetitorProfile[] = results
    .filter((r): r is PromiseFulfilledResult<CompetitorProfile | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((p): p is CompetitorProfile => p !== null);

  // Step 3: Calculate benchmarks
  const totalFollowers = competitors.reduce((s, c) => s + c.followers, 0);
  const totalER = competitors.reduce((s, c) => s + c.engagement_rate, 0);
  const benchmark_followers = competitors.length > 0 ? Math.round(totalFollowers / competitors.length) : 0;
  const benchmark_engagement = competitors.length > 0 ? Math.round((totalER / competitors.length) * 100) / 100 : 0;

  // Step 4: Identify market gaps via Perplexity
  let market_gaps: string[] = [];
  if (competitors.length > 0) {
    try {
      const gapQuery = `Analiza brevemente qué oportunidades de contenido tiene la marca "${brandName}" (@${brandHandle}) frente a estos competidores en Instagram: ${competitors.map(c => `@${c.handle} (${c.followers} seguidores)`).join(', ')}. Dame exactamente 3 oportunidades concretas en formato JSON array de strings: ["oportunidad 1","oportunidad 2","oportunidad 3"]`;
      const { result: gapResult } = await searchWeb(gapQuery);
      const gapMatch = gapResult.match(/\[[\s\S]*?\]/);
      if (gapMatch) {
        market_gaps = JSON.parse(gapMatch[0]);
      }
    } catch {
      market_gaps = [];
    }
  }

  log.info(
    { competitors: competitors.length, benchmark_followers, benchmark_engagement },
    'Competitor analysis complete',
  );

  return { competitors, benchmark_followers, benchmark_engagement, market_gaps };
}
