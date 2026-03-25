import axios from 'axios';
import { agentLogger } from '../../shared/logger.js';
import { config } from '../../shared/config.js';
import { sendText } from '../../connectors/whatsapp.js';
import { getGoogleAccessToken } from '../../shared/google-api.js';
import { enrichBrand } from './brand-enricher.js';
import { scrapeProfilePosts } from './profile-scraper.js';
import { generateDiagnosis } from './diagnosis-generator.js';
import { initCalendarWatcher, setNewMeetingHandler, markMeetingProcessed } from './calendar-watcher.js';
import type { CalendarEvent, CalendarAttendee, BrandResearchResult, AnalyzedPost, SocialProfile } from './types.js';

const log = agentLogger('brand-researcher');

const REPORTS_API = process.env.KREOON_REPORTS_URL || 'https://jarvis-reports.vercel.app';
const JARVIS_SECRET = process.env.JARVIS_INTERNAL_SECRET || '';
const OWNER_PHONE = config.dailyEngine.ownerPhone;

// ─── Email notification ──────────────────────────────────────────────────────

async function sendDiagnosisEmail(
  attendeeEmail: string,
  attendeeName: string,
  brandName: string,
  reportUrl: string,
  meetingDate: string,
): Promise<void> {
  try {
    const accessToken = await getGoogleAccessToken('founder');

    const subject = `Tu diagnóstico de marca está listo — Kreoon`;
    const body = [
      `Hola ${attendeeName},`,
      '',
      `¡Gracias por agendar tu consultoría con Kreoon!`,
      '',
      `Hemos preparado un diagnóstico personalizado de ${brandName} para nuestra reunión del ${new Date(meetingDate).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}.`,
      '',
      `👉 Ver tu diagnóstico: ${reportUrl}`,
      '',
      `Este reporte incluye:`,
      `• Análisis de tu presencia en redes sociales`,
      `• Evaluación de tu estrategia de contenido`,
      `• Oportunidades de mejora identificadas`,
      `• Propuesta de servicios personalizada`,
      '',
      `Nos vemos en la reunión para revisarlo juntos.`,
      '',
      `— Alexander Cast`,
      `Kreoon | Contenido que convierte`,
    ].join('\n');

    // Build RFC 2822 email
    const email = [
      `To: ${attendeeEmail}`,
      `From: Alexander Cast <founder@kreoon.com>`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      body,
    ].join('\r\n');

    const encodedEmail = Buffer.from(email)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await axios.post(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      { raw: encodedEmail },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
    );

    log.info({ to: attendeeEmail }, 'Diagnosis email sent');
  } catch (error: any) {
    log.error({ error: error.message, to: attendeeEmail }, 'Failed to send diagnosis email');
  }
}

// ─── Post report to kreoon-reports ───────────────────────────────────────────

async function postReport(data: BrandResearchResult): Promise<{ id: string; url: string } | null> {
  try {
    const payload = {
      report_type: 'brand-diagnosis',
      // Map to kreoon-reports expected fields
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
      verdict: {
        works: [],
        improve: [],
        opportunity: { title: '', description: '' },
      },
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
      branding: {
        show_kreoon: true,
        primary_color: '#7c3aed',
      },
      // Brand diagnosis specific data
      brand_diagnosis: data,
    };

    const response = await axios.post(
      `${REPORTS_API}/api/reports`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'x-jarvis-secret': JARVIS_SECRET,
        },
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

// ─── Main pipeline ───────────────────────────────────────────────────────────

async function runResearchPipeline(
  event: CalendarEvent,
  attendee: CalendarAttendee,
): Promise<void> {
  const startTime = Date.now();
  const attendeeName = attendee.displayName || attendee.email.split('@')[0];

  log.info(
    { eventId: event.id, attendee: attendee.email, meeting: event.summary },
    'Starting brand research pipeline',
  );

  try {
    // Check if meeting is in <30 min → quick mode
    const meetingStart = new Date(event.start);
    const minutesUntil = (meetingStart.getTime() - Date.now()) / (1000 * 60);
    const quickMode = minutesUntil < 30;

    if (quickMode) {
      log.info({ minutesUntil: Math.round(minutesUntil) }, 'Quick mode: meeting soon');
    }

    // Step 1: Enrich brand via Perplexity
    const enrichment = await enrichBrand(attendee);

    // Step 2: Scrape social profiles (skip in quick mode if many profiles)
    let allPosts: AnalyzedPost[] = [];

    if (enrichment.social_profiles.length > 0) {
      const profilesToScrape = quickMode
        ? enrichment.social_profiles.slice(0, 1)
        : enrichment.social_profiles.slice(0, 3);

      for (const profile of profilesToScrape) {
        try {
          const { posts, profileMeta } = await scrapeProfilePosts(profile, !quickMode);
          allPosts.push(...posts);

          // Merge scraped metadata back into profile
          if (profileMeta.engagement_rate) profile.engagement_rate = profileMeta.engagement_rate;
          if (profileMeta.posts_per_week) profile.posts_per_week = profileMeta.posts_per_week;
        } catch (error: any) {
          log.warn({ error: error.message, profile: profile.username }, 'Profile scraping failed, continuing');
        }
      }
    }

    // Step 3: Generate diagnosis with Claude
    const diagnosis = await generateDiagnosis(
      enrichment.brand_name,
      enrichment.brand_description,
      enrichment.brand_industry,
      enrichment.brand_website,
      enrichment.social_profiles,
      allPosts,
    );

    // Step 4: Assemble complete result
    const result: BrandResearchResult = {
      attendee_email: attendee.email,
      attendee_name: attendeeName,
      meeting_date: event.start,
      meeting_title: event.summary,
      calendar_event_id: event.id,
      brand_name: enrichment.brand_name,
      brand_website: enrichment.brand_website,
      brand_industry: enrichment.brand_industry,
      brand_description: enrichment.brand_description,
      social_profiles: enrichment.social_profiles,
      posts_analyzed: allPosts,
      ...diagnosis,
    };

    // Step 5: Post to kreoon-reports
    const report = await postReport(result);

    if (report) {
      // Step 6: Mark as completed
      await markMeetingProcessed(event.id, attendee.email, 'completed', report.url);

      // Step 7: Send email to attendee
      await sendDiagnosisEmail(
        attendee.email,
        attendeeName,
        enrichment.brand_name,
        report.url,
        event.start,
      );

      // Step 8: Notify Alexander via WhatsApp
      const duration = Math.round((Date.now() - startTime) / 1000);
      await sendText(
        OWNER_PHONE,
        `🔬 *Diagnóstico listo*\n\n` +
        `Marca: *${enrichment.brand_name}*\n` +
        `Industria: ${enrichment.brand_industry}\n` +
        `Score: ${diagnosis.overall_score}/100\n` +
        `Reunión: ${event.summary}\n` +
        `Fecha: ${new Date(event.start).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}\n\n` +
        `📊 Ver diagnóstico: ${report.url}\n\n` +
        `⏱️ Generado en ${duration}s | ${allPosts.length} posts analizados`,
      );

      log.info(
        { eventId: event.id, reportUrl: report.url, duration: `${duration}s` },
        'Research pipeline completed successfully',
      );
    } else {
      await markMeetingProcessed(event.id, attendee.email, 'failed', undefined, 'Report creation failed');

      await sendText(
        OWNER_PHONE,
        `⚠️ *Error en diagnóstico*\n\nNo se pudo crear el reporte para ${enrichment.brand_name} (${attendee.email}).\nRevisa logs.`,
      );
    }
  } catch (error: any) {
    log.error({ error: error.message, eventId: event.id }, 'Research pipeline failed');
    await markMeetingProcessed(event.id, attendee.email, 'failed', undefined, error.message);

    await sendText(
      OWNER_PHONE,
      `❌ *Pipeline falló*\n\n${attendeeName} (${attendee.email})\nError: ${error.message.slice(0, 200)}`,
    ).catch(() => {});
  }
}

// ─── Manual trigger (via WhatsApp command) ───────────────────────────────────

export async function researchByEmail(email: string): Promise<string> {
  const fakeEvent: CalendarEvent = {
    id: `manual-${Date.now()}`,
    summary: 'Investigación manual',
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    status: 'confirmed',
    attendees: [],
  };

  const fakeAttendee: CalendarAttendee = {
    email,
    displayName: email.split('@')[0].replace(/[._]/g, ' '),
  };

  // Run pipeline in background
  runResearchPipeline(fakeEvent, fakeAttendee).catch(err => {
    log.error({ err }, 'Manual research failed');
  });

  return `🔍 Investigando marca para ${email}... Te notifico cuando esté listo.`;
}

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initBrandResearcher(): void {
  setNewMeetingHandler(runResearchPipeline);
  initCalendarWatcher();
  log.info('Brand researcher initialized');
}
