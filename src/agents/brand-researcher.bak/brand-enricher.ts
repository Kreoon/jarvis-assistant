import { searchWeb } from '../../shared/perplexity.js';
import { agentLogger } from '../../shared/logger.js';
import type { CalendarAttendee, SocialProfile } from './types.js';

const log = agentLogger('brand-enricher');

interface EnrichmentResult {
  brand_name: string;
  brand_website: string | null;
  brand_industry: string;
  brand_description: string;
  social_profiles: SocialProfile[];
}

// Generic email domains — use name-based search instead
const GENERIC_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'live.com',
  'icloud.com', 'aol.com', 'protonmail.com', 'mail.com', 'zoho.com',
  'googlemail.com', 'ymail.com', 'msn.com', 'me.com',
]);

function extractDomain(email: string): string | null {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain || GENERIC_DOMAINS.has(domain)) return null;
  return domain;
}

function buildSearchQuery(attendee: CalendarAttendee): string {
  const domain = extractDomain(attendee.email);

  if (domain) {
    return `¿Qué empresa o marca es "${domain}"? Describe qué hacen, su industria, website oficial, y enlaces a sus perfiles de Instagram, TikTok, YouTube, LinkedIn, Twitter y Facebook si los tienen.`;
  }

  // Fallback: use display name or email prefix
  const name = attendee.displayName || attendee.email.split('@')[0].replace(/[._]/g, ' ');
  return `¿Quién es "${name}"? Busca su empresa, marca personal o negocio. Describe qué hacen, su industria, website, y enlaces a perfiles de Instagram, TikTok, YouTube, LinkedIn, Twitter y Facebook.`;
}

// Parse social URLs from Perplexity response text
function parseSocialProfiles(text: string): SocialProfile[] {
  const profiles: SocialProfile[] = [];
  const seen = new Set<string>();

  const patterns: { platform: SocialProfile['platform']; regex: RegExp }[] = [
    { platform: 'instagram', regex: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?/gi },
    { platform: 'tiktok', regex: /https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9_.]+)\/?/gi },
    { platform: 'youtube', regex: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)([A-Za-z0-9_.-]+)\/?/gi },
    { platform: 'linkedin', regex: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/([A-Za-z0-9_.-]+)\/?/gi },
    { platform: 'twitter', regex: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]+)\/?/gi },
    { platform: 'facebook', regex: /https?:\/\/(?:www\.)?facebook\.com\/([A-Za-z0-9_.]+)\/?/gi },
  ];

  for (const { platform, regex } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const username = match[1];
      const key = `${platform}:${username.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      profiles.push({
        platform,
        username,
        url: match[0].replace(/\/$/, ''),
      });
    }
  }

  return profiles;
}

function parseWebsite(text: string, domain: string | null): string | null {
  // Try to find the brand website from the text
  if (domain) return `https://${domain}`;

  const urlMatch = text.match(/(?:website|sitio|web|página)[:\s]*(?:es\s+)?(?:https?:\/\/)?([a-z0-9][a-z0-9.-]+\.[a-z]{2,})/i);
  if (urlMatch) return `https://${urlMatch[1]}`;

  return null;
}

function parseBrandName(text: string, attendeeName: string): string {
  // Try extracting from first sentence or heading
  const firstLine = text.split('\n')[0] || '';
  const nameMatch = firstLine.match(/(?:^|\*\*)([^*\n]{2,50})(?:\*\*|es una|is a|se dedica)/i);
  if (nameMatch) return nameMatch[1].trim();
  return attendeeName;
}

function parseIndustry(text: string): string {
  const industryPatterns = [
    /industria[:\s]+([^\n.]{3,60})/i,
    /sector[:\s]+([^\n.]{3,60})/i,
    /se dedica[n]?\s+a\s+([^\n.]{3,80})/i,
    /(?:industry|sector)[:\s]+([^\n.]{3,60})/i,
  ];

  for (const pattern of industryPatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return 'No identificada';
}

export async function enrichBrand(attendee: CalendarAttendee): Promise<EnrichmentResult> {
  const query = buildSearchQuery(attendee);
  log.info({ email: attendee.email, query: query.slice(0, 80) }, 'Searching brand info via Perplexity');

  try {
    const { result, citations } = await searchWeb(query);

    const domain = extractDomain(attendee.email);
    const attendeeName = attendee.displayName || attendee.email.split('@')[0].replace(/[._]/g, ' ');

    const socialProfiles = parseSocialProfiles(result + '\n' + citations.join('\n'));
    const website = parseWebsite(result, domain);
    const brandName = parseBrandName(result, attendeeName);
    const industry = parseIndustry(result);

    // Truncate description to first ~500 chars
    const description = result.length > 500 ? result.slice(0, 500) + '...' : result;

    log.info(
      { brand: brandName, profiles: socialProfiles.length, website },
      'Brand enrichment complete',
    );

    return {
      brand_name: brandName,
      brand_website: website,
      brand_industry: industry,
      brand_description: description,
      social_profiles: socialProfiles,
    };
  } catch (error: any) {
    log.error({ error: error.message, email: attendee.email }, 'Brand enrichment failed');

    const name = attendee.displayName || attendee.email.split('@')[0].replace(/[._]/g, ' ');
    return {
      brand_name: name,
      brand_website: null,
      brand_industry: 'No identificada',
      brand_description: 'No se pudo obtener información de la marca.',
      social_profiles: [],
    };
  }
}
