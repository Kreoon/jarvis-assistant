import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { agentLogger } from '../shared/logger.js';
import type { ExtractedContent } from './social-extractor.js';

const log = agentLogger('apify-instagram');

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~instagram-scraper';
const TIMEOUT_MS = 180_000; // 3 min — Apify actor cold start puede tardar
const TMP_DIR = '/app/data/tmp';

function toHashtags(caption: string): string[] {
  const matches = caption.match(/#[\w\u00C0-\u024F]+/g) || [];
  return matches.map((h) => h.slice(1));
}

function toMentions(caption: string): string[] {
  const matches = caption.match(/@[\w.]+/g) || [];
  return matches.map((m) => m.slice(1));
}

function detectContentTypeFromUrl(url: string): 'reel' | 'post' | 'story' | 'unknown' {
  if (/\/reel\//i.test(url)) return 'reel';
  if (/\/p\//i.test(url)) return 'post';
  if (/\/stories\//i.test(url)) return 'story';
  return 'unknown';
}

function extractShortcode(url: string): string | null {
  const m = url.match(/\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
  return m?.[2] || null;
}

async function downloadFile(url: string, dest: string): Promise<number> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60_000,
    maxContentLength: 200 * 1024 * 1024, // 200MB
  });
  const buf = Buffer.from(response.data);
  await fs.writeFile(dest, buf);
  return buf.length;
}

/**
 * Scraper de Instagram vía Apify (fallback cuando yt-dlp falla por rate limit/login).
 * Acepta URLs de reel, post o video y devuelve el mismo shape que extractContent().
 */
export async function scrapeInstagramViaApify(url: string): Promise<ExtractedContent | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    log.warn('APIFY_API_TOKEN not set, cannot use Apify fallback');
    return null;
  }

  const shortcode = extractShortcode(url);
  if (!shortcode) {
    log.warn({ url }, 'Could not extract shortcode from Instagram URL');
    return null;
  }

  log.info({ url, shortcode }, 'Calling Apify instagram-scraper');

  try {
    const actorUrl = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items`;
    const response = await axios.post(
      actorUrl,
      {
        directUrls: [url],
        resultsType: 'posts',
        resultsLimit: 1,
        addParentData: false,
        searchLimit: 1,
      },
      {
        params: { token },
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      }
    );

    const items = response.data;
    if (!Array.isArray(items) || items.length === 0) {
      log.warn({ url }, 'Apify returned no items');
      return null;
    }

    const item = items[0];
    const caption: string = item.caption || '';
    const contentType = detectContentTypeFromUrl(url);

    // Debug: loggea qué fields vinieron (ayuda a diagnosticar si videoUrl está presente)
    log.info({
      fields: Object.keys(item).slice(0, 30),
      hasVideoUrl: !!item.videoUrl,
      hasVideoUrlBackup: !!item.videoUrlBackup,
      hasDisplayUrl: !!item.displayUrl,
      type: item.type,
    }, 'Apify item fields');

    const content: ExtractedContent = {
      platform: 'instagram',
      type: contentType === 'unknown' ? 'reel' : contentType,
      url,
      caption,
      hashtags: (Array.isArray(item.hashtags) && item.hashtags.length > 0)
        ? item.hashtags
        : toHashtags(caption),
      mentions: (Array.isArray(item.mentions) && item.mentions.length > 0)
        ? item.mentions
        : toMentions(caption),
      creator: {
        username: item.ownerUsername || item.owner?.username || 'unknown',
        followers: item.ownerFollowersCount,
        verified: item.ownerIsVerified,
      },
      likes: item.likesCount ?? item.likes,
      comments: item.commentsCount ?? item.comments,
      views: item.videoViewCount ?? item.videoPlayCount,
      duration: item.videoDuration,
      publishedAt: item.timestamp || item.takenAtTimestamp,
      title: item.title || undefined,
      description: item.description || undefined,
    };

    // Descargar video si viene URL
    const videoUrl: string | undefined = item.videoUrl || item.videoUrlBackup;
    if (videoUrl) {
      await fs.mkdir(TMP_DIR, { recursive: true });
      const videoPath = path.join(TMP_DIR, `${shortcode}.mp4`);
      try {
        const bytes = await downloadFile(videoUrl, videoPath);
        if (bytes < 10_000) {
          log.warn({ videoPath, bytes }, 'Video file suspiciously small — probably redirect or error page');
        } else {
          content.localFilePath = videoPath;
          log.info({ videoPath, bytes, sizeMB: (bytes / 1024 / 1024).toFixed(2) }, 'Video downloaded via Apify');
        }
      } catch (err: any) {
        log.error({ err: err.message, videoUrl }, 'Failed to download video from Apify URL');
      }
    } else {
      log.warn({ url }, 'Apify item has no videoUrl — solo imagen o post sin video');
    }

    // Descargar thumbnail si viene
    const thumbnailUrl: string | undefined = item.displayUrl || item.thumbnailUrl;
    if (thumbnailUrl) {
      const thumbPath = path.join(TMP_DIR, `${shortcode}.jpg`);
      try {
        await downloadFile(thumbnailUrl, thumbPath);
        content.thumbnailPath = thumbPath;
        content.thumbnailUrl = thumbnailUrl;
      } catch (err: any) {
        log.warn({ err: err.message }, 'Failed to download thumbnail');
      }
    }

    return content;
  } catch (err: any) {
    const status = err.response?.status;
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
    log.error({ status, detail, url }, 'Apify Instagram scrape failed');
    return null;
  }
}
