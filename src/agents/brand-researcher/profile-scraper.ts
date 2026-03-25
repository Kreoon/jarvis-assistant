import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { agentLogger } from '../../shared/logger.js';
import { searchWeb } from '../../shared/perplexity.js';
import type { SocialProfile, AnalyzedPost } from './types.js';

const log = agentLogger('profile-scraper');
const execFileAsync = promisify(execFile);

const TMP_DIR = '/app/data/tmp';
const COOKIES_PATH = process.env.COOKIES_FILE || '/app/data/cookies.txt';
const MAX_POSTS_PER_PROFILE = 6;
const MAX_VISUAL_ANALYSIS = 3;

// ─── List profile posts via yt-dlp ──────────────────────────────────────────

function buildProfileUrl(profile: SocialProfile): string {
  switch (profile.platform) {
    case 'instagram':
      return `https://www.instagram.com/${profile.username}/reels/`;
    case 'tiktok':
      return `https://www.tiktok.com/@${profile.username}`;
    case 'youtube':
      return profile.url.includes('/channel/')
        ? `${profile.url}/shorts`
        : `https://www.youtube.com/@${profile.username}/shorts`;
    default:
      return profile.url;
  }
}

async function listProfilePosts(profile: SocialProfile): Promise<string[]> {
  const profileUrl = buildProfileUrl(profile);
  log.info({ platform: profile.platform, username: profile.username, url: profileUrl }, 'Listing posts');

  const args = [
    '--flat-playlist',
    '--print', 'url',
    '--playlist-end', String(MAX_POSTS_PER_PROFILE),
    '--no-warnings',
  ];

  // Add cookies if available
  try {
    await fs.access(COOKIES_PATH);
    args.push('--cookies', COOKIES_PATH);
  } catch {
    // No cookies
  }

  args.push(profileUrl);

  try {
    const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 60000 });
    const urls = stdout.trim().split('\n').filter(u => u.startsWith('http'));
    log.info({ platform: profile.platform, count: urls.length }, 'Posts listed');
    return urls.slice(0, MAX_POSTS_PER_PROFILE);
  } catch (error: any) {
    log.warn({ error: error.message, platform: profile.platform }, 'yt-dlp listing failed');
    return [];
  }
}

// ─── Extract metadata for a single post ─────────────────────────────────────

async function extractPostMetadata(url: string): Promise<AnalyzedPost | null> {
  const idFile = path.join(TMP_DIR, '_brand_id.txt');
  await fs.unlink(idFile).catch(() => {});

  const args = [
    '--skip-download',
    '--write-info-json',
    '-o', path.join(TMP_DIR, '%(id)s.%(ext)s'),
    '--no-warnings',
    '--print-to-file', 'id', idFile,
  ];

  try {
    await fs.access(COOKIES_PATH);
    args.push('--cookies', COOKIES_PATH);
  } catch {
    // No cookies
  }

  args.push(url);

  try {
    await execFileAsync('yt-dlp', args, { timeout: 60000 });

    const raw = (await fs.readFile(idFile, 'utf-8')).trim();
    const videoId = raw.split('\n')[0]?.trim();
    await fs.unlink(idFile).catch(() => {});

    if (!videoId) return null;

    const infoPath = path.join(TMP_DIR, `${videoId}.info.json`);
    const infoRaw = await fs.readFile(infoPath, 'utf-8');
    const info = JSON.parse(infoRaw);

    // Clean up info.json to save space
    await fs.unlink(infoPath).catch(() => {});

    const platform = url.includes('instagram') ? 'instagram'
      : url.includes('tiktok') ? 'tiktok'
      : url.includes('youtube') || url.includes('youtu.be') ? 'youtube'
      : 'unknown';

    return {
      url,
      platform,
      caption: info.description || info.title || '',
      likes: info.like_count ?? undefined,
      views: info.view_count ?? info.play_count ?? undefined,
      comments: info.comment_count ?? undefined,
      thumbnail_url: info.thumbnail ?? undefined,
      published_at: formatDate(info.upload_date),
      content_type: info.duration && info.duration < 90 ? 'reel' : 'video',
    };
  } catch (error: any) {
    log.warn({ error: error.message, url }, 'Post metadata extraction failed');
    return null;
  }
}

function formatDate(uploadDate?: string): string | undefined {
  if (!uploadDate || uploadDate.length !== 8) return undefined;
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
}

// ─── Engagement scoring ─────────────────────────────────────────────────────

function engagementScore(post: AnalyzedPost): number {
  const likes = post.likes || 0;
  const comments = post.comments || 0;
  const views = post.views || 1;
  return ((likes + comments * 2) / views) * 100;
}

// ─── Fallback: Perplexity profile research ──────────────────────────────────

async function perplexityProfileFallback(profile: SocialProfile): Promise<AnalyzedPost[]> {
  log.info({ platform: profile.platform, username: profile.username }, 'Using Perplexity fallback');

  try {
    const query = `Describe los últimos 5-6 posts/reels publicados por @${profile.username} en ${profile.platform}. Para cada uno incluye: tema/caption, likes aproximados, views, tipo de contenido. Si no encuentras datos exactos, describe su estilo general de contenido.`;
    const { result } = await searchWeb(query);

    // Create a single post entry summarizing the research
    return [{
      url: profile.url,
      platform: profile.platform,
      caption: result.slice(0, 500),
      analysis: result,
      content_type: 'research-summary',
    }];
  } catch {
    return [];
  }
}

// ─── Main scraper ───────────────────────────────────────────────────────────

export async function scrapeProfilePosts(
  profile: SocialProfile,
  useVisualAnalysis: boolean = true,
): Promise<{ posts: AnalyzedPost[]; profileMeta: Partial<SocialProfile> }> {
  // Ensure tmp dir exists
  await fs.mkdir(TMP_DIR, { recursive: true }).catch(() => {});

  // Step 1: List posts from profile
  let postUrls = await listProfilePosts(profile);

  // Fallback if yt-dlp can't list posts
  if (postUrls.length === 0) {
    const fallbackPosts = await perplexityProfileFallback(profile);
    return { posts: fallbackPosts, profileMeta: {} };
  }

  // Step 2: Extract metadata for each post
  const metadataPromises = postUrls.map(url => extractPostMetadata(url));
  const metadataResults = await Promise.allSettled(metadataPromises);

  const posts: AnalyzedPost[] = metadataResults
    .filter((r): r is PromiseFulfilledResult<AnalyzedPost | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((p): p is AnalyzedPost => p !== null);

  // Step 3: Sort by engagement, pick top 3 for visual analysis
  posts.sort((a, b) => engagementScore(b) - engagementScore(a));

  // Step 4: Visual analysis for top posts (delegated to diagnosis-generator)
  // We mark which ones should get visual analysis
  const topPosts = posts.slice(0, MAX_VISUAL_ANALYSIS);
  for (const post of topPosts) {
    post.score = Math.round(engagementScore(post) * 10); // Normalize to 0-100ish
  }

  // Step 5: Estimate profile metrics from posts
  const profileMeta: Partial<SocialProfile> = {};
  if (posts.length >= 2) {
    const dates = posts
      .map(p => p.published_at)
      .filter((d): d is string => !!d)
      .map(d => new Date(d).getTime())
      .sort();

    if (dates.length >= 2) {
      const daySpan = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
      if (daySpan > 0) {
        profileMeta.posts_per_week = Math.round((posts.length / daySpan) * 7 * 10) / 10;
      }
    }

    const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
    if (totalViews > 0) {
      profileMeta.engagement_rate = Math.round((totalLikes / totalViews) * 100 * 100) / 100;
    }
  }

  log.info(
    { platform: profile.platform, username: profile.username, postsFound: posts.length },
    'Profile scraping complete',
  );

  return { posts, profileMeta };
}
