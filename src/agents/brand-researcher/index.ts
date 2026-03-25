import axios from 'axios';
import { agentLogger } from '../../shared/logger.js';
import { config } from '../../shared/config.js';
import { sendText } from '../../connectors/whatsapp.js';
import { getGoogleAccessToken } from '../../shared/google-api.js';
import { enrichBrand, enrichBrandByName } from './brand-enricher.js';
import { scrapeProfilePosts } from './profile-scraper.js';
import { scrapeInstagramViaApify, scrapeAdsViaApify } from './apify-scraper.js';
import type { ApifyAd } from './apify-scraper.js';
import { generateDiagnosis } from './diagnosis-generator.js';
import { analyzeCompetitors } from './competitor-analyzer.js';
import { initCalendarWatcher, setNewMeetingHandler, markMeetingProcessed } from './calendar-watcher.js';
import { analyzePostBatch } from './post-analyzer.js';
import type { CalendarEvent, CalendarAttendee, BrandResearchResult, AnalyzedPost, SocialProfile, BookingFormData } from './types.js';

const log = agentLogger('brand-researcher');

const REPORTS_API = process.env.KREOON_REPORTS_URL || 'https://jarvis-reports.vercel.app';
const JARVIS_SECRET = process.env.JARVIS_INTERNAL_SECRET || '';
const OWNER_PHONE = config.dailyEngine.ownerPhone;

// ─── Convert Apify posts to AnalyzedPost[] ───────────────────────────────────

function apifyToAnalyzedPosts(apifyResult: any): AnalyzedPost[] {
  if (!apifyResult || !apifyResult.recent_posts) return [];
  return apifyResult.recent_posts.map((post: any) => ({
    url: post.url || '',
    platform: 'instagram',
    caption: post.caption || '',
    likes: post.likes ?? undefined,
    views: post.views ?? undefined,
    comments: post.comments ?? undefined,
    thumbnail_url: post.thumbnail_url ?? undefined,
    published_at: post.published_at || undefined,
    content_type: post.content_type || 'image',
    video_url: post.video_url ?? undefined,
  }));
}

// ─── Post report to kreoon-reports ───────────────────────────────────────────

async function postReport(data: BrandResearchResult): Promise<{ id: string; url: string } | null> {
  try {
    const payload = {
      report_type: 'brand-diagnosis',
      platform: data.social_profiles[0]?.platform || 'instagram',
      content_type: 'diagnosis',
      original_url: data.brand_website || '',
      creator_username: data.brand_name,
      creator_followers: data.social_profiles[0]?.followers ?? null,
      duration_seconds: null,
      caption: data.brand_description,
      hashtags: [],
      metrics: {
        views: 0,
        likes: 0,
        comments: 0,
        engagement_rate: data.social_profiles[0]?.engagement_rate ?? 0,
      },
      gemini_analysis: {
        transcription: '',
        scenes: [],
        production: { lighting: '', audio: '', quality: 0, editing: '', cuts_per_minute: 0, aspect_ratio: '' },
        emotional_timeline: [],
        full_analysis: '',
      },
      strategic_analysis: {
        structure: {
          hook: { score: 0, description: '' },
          development: { score: 0, description: '' },
          cta: { score: 0, description: '' },
          format: { score: 0, description: '' },
        },
        copy: {
          formula: { score: 0, description: '', detected: '', confidence: 0 },
          power_words: { score: 0, description: '', words: [] },
          mental_triggers: { score: 0, description: '', used: [], missing: [] },
          tone: { score: 0, description: '', brain: { reptilian: 0, limbic: 0, neocortex: 0 }, disc: '' },
        },
        strategy: {
          funnel: { score: 0, description: '', stage: 'TOFU' as const, schwartz: 0 },
          pillar: { score: 0, description: '', breakdown: [] },
          sales_angle: { score: 0, description: '', pain: '', desire: '', transformation: '', maslow: '' },
          virality: { score: 0, description: '', pattern: '', emotion: '', shareability: '' },
        },
        raw_text: '',
      },
      verdict: { works: [], improve: [], opportunity: { title: '', description: '' } },
      scores: {
        hook: 0,
        copy: 0,
        strategy: Math.round(data.scores.strategy / 10),
        production: Math.round(data.scores.content_quality / 10),
        virality: 0,
        total: Math.round(data.overall_score / 10),
        replication_difficulty: 0,
      },
      production_guide: {
        checklist: [],
        script_timeline: [],
        setup: { camera: '', resolution: '', lighting: '', audio: '', background: '', editing: '' },
        music: { type: '', name: null, trending: false, volume_recommendation: '', source: '' },
      },
      publish_strategy: {
        best_day: '',
        best_time: '',
        timezone: 'America/Bogota',
        reason: '',
        post_actions: [],
        caption_final: '',
        hashtags_final: [],
        repurposing: [],
        week_plan: [],
      },
      success_metrics: {
        kpis: [],
        benchmarks: { er_average: 0, good_post: 0, viral_threshold: 0, platform: '' },
        evaluation_timeline: [],
        plan_b: [],
      },
      branding: { show_kreoon: true, primary_color: '#7c3aed' },
      brand_diagnosis: data,
    };

    const response = await axios.post(
      `${REPORTS_API}/api/reports`,
      payload,
      {
        headers: { 'Content-Type': 'application/json', 'x-jarvis-secret': JARVIS_SECRET },
        timeout: 15000,
      },
    );

    log.info({ id: response.data.id, url: response.data.url }, 'Report created in kreoon-reports');
    return { id: response.data.id, url: response.data.url };
  } catch (error: any) {
    log.error({ error: error.message }, 'Failed to post report to kreoon-reports');
    return null;
  }
}

// ─── Main pipeline (calendar-based) ──────────────────────────────────────────

async function runResearchPipeline(event: CalendarEvent, attendee: CalendarAttendee): Promise<void> {
  const startTime = Date.now();
  const attendeeName = attendee.displayName || attendee.email.split('@')[0];

  log.info({ eventId: event.id, attendee: attendee.email }, 'Starting brand research pipeline');

  try {
    const meetingStart = new Date(event.start);
    const minutesUntil = (meetingStart.getTime() - Date.now()) / (1000 * 60);
    const quickMode = minutesUntil < 30;
    if (quickMode) log.info({ minutesUntil: Math.round(minutesUntil) }, 'Quick mode: meeting soon');

    const enrichment = await enrichBrand(attendee);

    let allPosts: AnalyzedPost[] = [];
    if (enrichment.social_profiles.length > 0) {
      const profilesToScrape = quickMode ? enrichment.social_profiles.slice(0, 1) : enrichment.social_profiles.slice(0, 3);
      for (const profile of profilesToScrape) {
        try {
          const { posts, profileMeta } = await scrapeProfilePosts(profile, !quickMode);
          allPosts.push(...posts);
          if (profileMeta.engagement_rate) profile.engagement_rate = profileMeta.engagement_rate;
          if (profileMeta.posts_per_week) profile.posts_per_week = profileMeta.posts_per_week;
        } catch (error: any) {
          log.warn({ error: error.message, profile: profile.username }, 'Profile scraping failed');
        }
      }
    }

    const diagnosis = await generateDiagnosis(
      enrichment.brand_name, enrichment.brand_description, enrichment.brand_industry,
      enrichment.brand_website, enrichment.social_profiles, allPosts,
    );

    const result: BrandResearchResult = {
      attendee_email: attendee.email, attendee_name: attendeeName,
      meeting_date: event.start, meeting_title: event.summary, calendar_event_id: event.id,
      brand_name: enrichment.brand_name, brand_website: enrichment.brand_website,
      brand_industry: enrichment.brand_industry, brand_description: enrichment.brand_description,
      social_profiles: enrichment.social_profiles, posts_analyzed: allPosts, ...diagnosis,
    };

    const report = await postReport(result);

    if (report) {
      await markMeetingProcessed(event.id, attendee.email, 'completed', report.url);
      const duration = Math.round((Date.now() - startTime) / 1000);
      await sendText(OWNER_PHONE,
        `🔬 *Diagnóstico listo*\n\nMarca: *${enrichment.brand_name}*\nScore: ${diagnosis.overall_score}/100\nReunión: ${event.summary}\n\n📊 ${report.url}\n⏱️ ${duration}s | ${allPosts.length} posts`,
      );
      log.info({ eventId: event.id, reportUrl: report.url, duration: `${duration}s` }, 'Research pipeline completed successfully');
    } else {
      await markMeetingProcessed(event.id, attendee.email, 'failed', undefined, 'Report creation failed');
      await sendText(OWNER_PHONE, `⚠️ *Error en diagnóstico*\n\nNo se pudo crear el reporte para ${enrichment.brand_name}.`);
    }
  } catch (error: any) {
    log.error({ error: error.message, eventId: event.id }, 'Research pipeline failed');
    await markMeetingProcessed(event.id, attendee.email, 'failed', undefined, error.message);
    await sendText(OWNER_PHONE, `❌ *Pipeline falló*\n\n${attendeeName}\nError: ${error.message.slice(0, 200)}`).catch(() => {});
  }
}

// ─── Research by booking form data ───────────────────────────────────────────

export async function researchByFormData(data: BookingFormData): Promise<string> {
  (async () => {
    const startTime = Date.now();
    const brandName = data.brandName;
    const handle = data.socialHandle;

    log.info({ brandName, handle }, 'Starting form-based brand research pipeline');

    try {
      // Step 1: Scrape IG + Ads via Apify in PARALLEL
      let allPosts: AnalyzedPost[] = [];
      let apifyBio: string | undefined;
      let apifyFollowers: number | undefined;
      let apifyER: number | undefined;
      let brandAds: ApifyAd[] = [];

      if (handle) {
        log.info({ handle, brandName }, 'Step 1: Apify scraping (IG + Ads in parallel)');

        const [igResult, adsResult] = await Promise.allSettled([
          scrapeInstagramViaApify(handle),
          scrapeAdsViaApify(brandName),
        ]);

        // Process IG result
        if (igResult.status === 'fulfilled' && igResult.value?.recent_posts?.length) {
          const apifyResult = igResult.value;
          allPosts = apifyToAnalyzedPosts(apifyResult);
          apifyBio = apifyResult.bio;
          apifyFollowers = apifyResult.followers;
          apifyER = (apifyResult as any).engagement_rate ?? undefined;
          log.info({ posts: allPosts.length, followers: apifyFollowers, bio: apifyBio?.slice(0, 60) }, 'IG scraping successful');
        } else {
          log.warn({ handle }, 'IG scraping returned no posts');
        }

        // Process Ads result
        if (adsResult.status === 'fulfilled' && adsResult.value?.length) {
          brandAds = adsResult.value;
          log.info({ ads: brandAds.length, active: brandAds.filter(a => a.status === 'active').length }, 'Ad Library scraping successful');
        } else {
          log.info({ brandName }, 'No ads found in Meta Ad Library');

        // Step 1.5: Analyze posts with Gemini Vision
        if (allPosts.length > 0) {
          log.info({ count: Math.min(allPosts.length, 10) }, 'Analyzing posts with Gemini Vision');
          allPosts = await analyzePostBatch(allPosts, brandName, 10);
          log.info({ analyzed: allPosts.filter(p => p.score).length }, 'Post video analysis complete');
        }
        }
      }

      // Step 2: Enrich brand by name + bio from Apify (prevents Perplexity confusion)
      const enrichment = await enrichBrandByName(brandName, handle, apifyBio);

      // Update IG profile with real Apify data
      if (apifyFollowers !== undefined) {
        const igProfile = enrichment.social_profiles.find(p => p.platform === 'instagram');
        if (igProfile) {
          igProfile.followers = apifyFollowers;
          igProfile.bio = apifyBio;
          igProfile.engagement_rate = apifyER;
        }
      }

      // Fallback scraping if Apify failed
      if (allPosts.length === 0 && handle) {
        log.info('No Apify posts, trying profile-scraper fallback');
        for (const profile of enrichment.social_profiles.slice(0, 2)) {
          try {
            const { posts, profileMeta } = await scrapeProfilePosts(profile, true);
            allPosts.push(...posts);
            if (profileMeta.engagement_rate) profile.engagement_rate = profileMeta.engagement_rate;
            if (profileMeta.posts_per_week) profile.posts_per_week = profileMeta.posts_per_week;
          } catch (err: any) {
            log.warn({ error: err.message, profile: profile.username }, 'Fallback also failed');
          }
        }
      }

      // Step 3: Analyze 5 competitors (with bio for context)
      let competitorData = undefined;
      try {
        log.info({ brandName, industry: enrichment.brand_industry }, 'Starting competitor analysis');
        competitorData = await analyzeCompetitors(brandName, enrichment.brand_industry, handle, apifyBio);
        log.info({ competitors: competitorData.competitors.length }, 'Competitor analysis complete');
      } catch (compError: any) {
        log.warn({ error: compError.message }, 'Competitor analysis failed, continuing without');
      }

      // Step 4: Generate diagnosis with competitors + client context
      const extraContext = [
        data.mainChallenge ? `Principal desafío del cliente: ${data.mainChallenge}` : '',
        data.goals ? `Objetivos del cliente: ${data.goals}` : '',
      ].filter(Boolean).join('\n');

      const diagnosis = await generateDiagnosis(
        enrichment.brand_name,
        enrichment.brand_description + (extraContext ? `\n\n--- Contexto del formulario ---\n${extraContext}` : ''),
        enrichment.brand_industry, enrichment.brand_website,
        enrichment.social_profiles, allPosts, competitorData, brandAds,
      );

      // Step 5: Assemble result
      const result: BrandResearchResult = {
        attendee_email: data.contactEmail || 'form-submission',
        attendee_name: data.contactName || brandName,
        meeting_date: data.meetingDate || new Date().toISOString(),
        meeting_title: `Diagnóstico: ${brandName}`,
        calendar_event_id: `form-${Date.now()}`,
        brand_name: enrichment.brand_name, brand_website: enrichment.brand_website,
        brand_industry: enrichment.brand_industry, brand_description: enrichment.brand_description,
        social_profiles: enrichment.social_profiles, posts_analyzed: allPosts, ...diagnosis,
      };

      // Step 6: Post report
      const report = await postReport(result);

      if (report) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        const compMsg = competitorData && competitorData.competitors.length > 0
          ? `\nCompetidores: ${competitorData.competitors.map(c => `@${c.handle}`).join(', ')}\nBenchmark ER: ${competitorData.benchmark_engagement}%`
          : '';
        const adsMsg = brandAds.length > 0
          ? `\nAds: ${brandAds.length} (${brandAds.filter(a => a.status === 'active').length} activos)`
          : '\nAds: No encontrados en Meta Ad Library';

        await sendText(OWNER_PHONE,
          `🔬 *Diagnóstico listo*\n\nMarca: *${enrichment.brand_name}*\nHandle: @${handle || 'N/A'}\nScore: ${diagnosis.overall_score}/100${compMsg}${adsMsg}\n\n📊 ${report.url}\n⏱️ ${duration}s | ${allPosts.length} posts | ${competitorData?.competitors.length ?? 0} competidores`,
        );

        log.info({ brandName, reportUrl: report.url, duration: `${duration}s` }, 'Form-based research pipeline completed successfully');
      } else {
        await sendText(OWNER_PHONE, `⚠️ *Error en diagnóstico*\n\nNo se pudo crear el reporte para ${brandName}.`);
      }
    } catch (error: any) {
      log.error({ error: error.message, brandName }, 'Form-based research pipeline failed');
      await sendText(OWNER_PHONE, `❌ *Pipeline falló*\n\n${brandName} (@${handle || 'N/A'})\nError: ${error.message.slice(0, 200)}`).catch(() => {});
    }
  })();

  return `🔍 Investigando marca ${data.brandName}... Te notifico cuando esté listo.`;
}

// ─── Manual trigger ──────────────────────────────────────────────────────────

export async function researchByEmail(email: string): Promise<string> {
  const fakeEvent: CalendarEvent = {
    id: `manual-${Date.now()}`, summary: 'Investigación manual',
    start: new Date().toISOString(), end: new Date().toISOString(),
    status: 'confirmed', attendees: [],
  };
  const fakeAttendee: CalendarAttendee = { email, displayName: email.split('@')[0].replace(/[._]/g, ' ') };
  runResearchPipeline(fakeEvent, fakeAttendee).catch(err => log.error({ err }, 'Manual research failed'));
  return `🔍 Investigando marca para ${email}... Te notifico cuando esté listo.`;
}


export async function researchByHandle(handle: string): Promise<string> {
  const cleanHandle = handle.replace(/^@/, '');
  const brandName = cleanHandle.replace(/[._]/g, ' ');
  log.info({ handle: cleanHandle, brandName }, 'Starting handle-based brand research');
  researchByFormData({
    brandName,
    socialHandle: cleanHandle,
    contactEmail: `${cleanHandle}@whatsapp-request.kreoon.com`,
    contactName: brandName,
    meetingDate: new Date().toISOString(),
  }).catch(err => log.error({ err: err.message }, 'Handle-based research failed'));
  return `🔬 Iniciando diagnóstico de marca para @${cleanHandle}... Esto toma ~2 minutos. Te envío el reporte cuando esté listo.`;
}

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initBrandResearcher(): void {
  setNewMeetingHandler(runResearchPipeline);
  initCalendarWatcher();
  log.info('Brand researcher initialized');
}
