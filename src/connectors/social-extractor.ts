import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { agentLogger } from '../shared/logger.js';

const log = agentLogger('social-extractor');
const execFileAsync = promisify(execFile);

const TMP_DIR = '/app/data/tmp';

export interface ExtractedContent {
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'linkedin' | 'facebook';
  type: 'reel' | 'post' | 'carousel' | 'story' | 'short' | 'video' | 'thread' | 'unknown';
  url: string;
  localFilePath?: string;
  thumbnailPath?: string;
  thumbnailUrl?: string;
  duration?: number;
  caption: string;
  hashtags: string[];
  mentions: string[];
  title?: string;
  description?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  creator: {
    username: string;
    followers?: number;
    bio?: string;
    verified?: boolean;
  };
  topComments?: { user: string; text: string; likes: number }[];
  publishedAt?: string;
  soundUsed?: string;
}

const PLATFORM_PATTERNS: { pattern: RegExp; platform: string }[] = [
  { pattern: /instagram\.com/i, platform: 'instagram' },
  { pattern: /tiktok\.com/i, platform: 'tiktok' },
  { pattern: /youtube\.com/i, platform: 'youtube' },
  { pattern: /youtu\.be/i, platform: 'youtube' },
  { pattern: /twitter\.com/i, platform: 'twitter' },
  { pattern: /x\.com/i, platform: 'twitter' },
  { pattern: /linkedin\.com/i, platform: 'linkedin' },
  { pattern: /facebook\.com/i, platform: 'facebook' },
  { pattern: /fb\.watch/i, platform: 'facebook' },
];

export function detectPlatform(url: string): string | null {
  for (const { pattern, platform } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) {
      return platform;
    }
  }
  return null;
}

export function detectContentType(url: string, platform: string): string {
  switch (platform) {
    case 'instagram':
      if (/\/reel\//i.test(url)) return 'reel';
      if (/\/p\//i.test(url)) return 'post';
      if (/\/stories\//i.test(url)) return 'story';
      return 'unknown';
    case 'tiktok':
      return 'reel';
    case 'youtube':
      if (/\/shorts\//i.test(url)) return 'short';
      return 'video';
    case 'twitter':
      return 'post';
    case 'linkedin':
      return 'post';
    case 'facebook':
      return 'video';
    default:
      return 'unknown';
  }
}

export function isSocialMediaUrl(url: string): boolean {
  return detectPlatform(url) !== null;
}

async function ensureTmpDir(): Promise<void> {
  try {
    await fs.mkdir(TMP_DIR, { recursive: true });
  } catch (err) {
    log.warn({ err }, 'Failed to create tmp dir');
  }
}

async function findDownloadedFile(id: string): Promise<string | undefined> {
  try {
    const files = await fs.readdir(TMP_DIR);
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const match = files.find((f) =>
      f.startsWith(id + '.') &&
      !f.endsWith('.info.json') &&
      !f.endsWith('.json') &&
      !imageExts.some(ext => f.endsWith(ext))
    );
    if (match) return path.join(TMP_DIR, match);
  } catch {
    // ignore
  }
  return undefined;
}

async function findThumbnailFile(id: string): Promise<string | undefined> {
  try {
    const files = await fs.readdir(TMP_DIR);
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const match = files.find((f) => f.startsWith(id + '.') && extensions.some((ext) => f.endsWith(ext)));
    if (match) return path.join(TMP_DIR, match);
  } catch {
    // ignore
  }
  return undefined;
}

function extractHashtags(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/#[\w\u00C0-\u024F\u1E00-\u1EFF]+/g);
  return matches ? [...new Set(matches)] : [];
}

function extractMentions(text: string): string[] {
  if (!text) return [];
  const matches = text.match(/@[\w.]+/g);
  return matches ? [...new Set(matches)] : [];
}

function formatPublishedAt(uploadDate: string | undefined): string | undefined {
  if (!uploadDate || uploadDate.length !== 8) return uploadDate;
  // yt-dlp returns YYYYMMDD format
  const year = uploadDate.substring(0, 4);
  const month = uploadDate.substring(4, 6);
  const day = uploadDate.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Pick the shorter/cleaner username from the available yt-dlp fields.
 * yt-dlp sometimes puts a display name in `uploader` and the handle in `channel`
 * (or vice-versa). We prefer whichever looks like a handle (shorter, no spaces).
 */
function pickCreatorUsername(info: any): string {
  const candidates: string[] = [
    info.channel,
    info.uploader,
    info.uploader_id,
  ].filter(Boolean);

  if (candidates.length === 0) return 'unknown';

  // Filter out purely numeric IDs (not real usernames)
  const nonNumeric = candidates.filter((c) => !/^\d+$/.test(c));
  const pool = nonNumeric.length > 0 ? nonNumeric : candidates;

  // Prefer the candidate that looks like a handle: no spaces and shortest
  const handles = pool.filter((c) => !c.includes(' '));
  if (handles.length > 0) {
    return handles.sort((a: string, b: string) => a.length - b.length)[0];
  }

  // Fallback: return first candidate
  return pool[0];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapInfoJsonToContent(url: string, platform: string, contentType: string, info: any): ExtractedContent {
  const captionText = info.description || info.title || '';

  // Build hashtags: prefer tags array, but always merge with caption-extracted ones
  const tagsFromField = info.tags
    ? (info.tags as string[]).map((t: string) => (t.startsWith('#') ? t : `#${t}`))
    : [];
  const tagsFromCaption = extractHashtags(captionText);
  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const hashtags: string[] = [];
  for (const tag of [...tagsFromField, ...tagsFromCaption]) {
    const lower = tag.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      hashtags.push(tag);
    }
  }

  const mentions = extractMentions(captionText);

  const topComments: { user: string; text: string; likes: number }[] = [];
  if (Array.isArray(info.comments)) {
    for (const c of info.comments.slice(0, 5)) {
      topComments.push({
        user: c.author || c.author_id || 'unknown',
        text: c.text || '',
        likes: c.like_count || 0,
      });
    }
  }

  // Resolve publishedAt: prefer upload_date, fallback to timestamp
  let publishedAt = formatPublishedAt(info.upload_date);
  if (!publishedAt && info.timestamp) {
    try {
      publishedAt = new Date(info.timestamp * 1000).toISOString().split('T')[0];
    } catch {
      // ignore invalid timestamp
    }
  }

  return {
    platform: platform as ExtractedContent['platform'],
    type: contentType as ExtractedContent['type'],
    url,
    caption: captionText,
    hashtags,
    mentions,
    title: info.title || undefined,
    description: info.description || undefined,
    views: info.view_count ?? info.play_count ?? undefined,
    likes: info.like_count ?? undefined,
    comments: info.comment_count ?? undefined,
    shares: info.repost_count ?? info.share_count ?? undefined,
    duration: info.duration ?? undefined,
    thumbnailUrl: info.thumbnail || undefined,
    creator: {
      username: pickCreatorUsername(info),
      followers: info.channel_follower_count ?? info.uploader_follower_count ?? info.follower_count ?? undefined,
      bio: info.uploader_description || undefined,
      verified: info.channel_is_verified ?? undefined,
    },
    topComments: topComments.length > 0 ? topComments : undefined,
    publishedAt,
    soundUsed: info.track ? `${info.track}${info.artist ? ` - ${info.artist}` : ''}` : (info.artist || undefined),
  };
}

export async function extractContent(url: string): Promise<ExtractedContent> {
  await ensureTmpDir();

  const platform = detectPlatform(url);
  if (!platform) {
    throw new Error(`Unsupported platform for URL: ${url}`);
  }

  const contentType = detectContentType(url, platform);

  log.info({ url, platform, contentType }, 'Starting yt-dlp extraction');

  const outputTemplate = path.join(TMP_DIR, '%(id)s.%(ext)s');

  let infoJsonPath: string | undefined;
  let videoId: string | undefined;

  // Build yt-dlp args with optional cookies
  // Note: --print causes yt-dlp to skip download, so we use --print-to-file instead
  const videoIdFile = path.join(TMP_DIR, '_video_id.txt');
  const ytdlpArgs = [
    '-o', outputTemplate,
    '--write-info-json',
    '--write-thumbnail',
    '--no-playlist',
    '--no-warnings',
    '--print-to-file', 'id', videoIdFile,
  ];

  const cookiesPath = process.env.COOKIES_FILE || '/app/data/cookies.txt';
  try {
    await fs.access(cookiesPath);
    ytdlpArgs.push('--cookies', cookiesPath);
    log.info({ cookiesPath }, 'Using cookies file for yt-dlp');
  } catch {
    // No cookies file, continue without
  }

  // Clean previous video ID file (--print-to-file appends)
  await fs.unlink(videoIdFile).catch(() => {});

  ytdlpArgs.push(url);

  try {
    const { stderr } = await execFileAsync(
      'yt-dlp',
      ytdlpArgs,
      { timeout: 120000 }
    );

    if (stderr) {
      log.warn({ stderr }, 'yt-dlp stderr output');
    }

    // Read video ID from file written by --print-to-file (take first line only)
    try {
      const raw = (await fs.readFile(videoIdFile, 'utf-8')).trim();
      videoId = raw.split('\n')[0]?.trim();
      await fs.unlink(videoIdFile).catch(() => {});
    } catch {
      // Fallback: extract ID from URL
      const urlMatch = url.match(/\/(?:p|reel|reels|shorts|watch)\/([A-Za-z0-9_-]+)/);
      videoId = urlMatch?.[1];
    }
    log.info({ videoId }, 'yt-dlp extracted video id');
  } catch (err) {
    log.error({ err, url }, 'yt-dlp execution failed');
    // Return minimal content with what we know
    return {
      platform: platform as ExtractedContent['platform'],
      type: contentType as ExtractedContent['type'],
      url,
      caption: '',
      hashtags: [],
      mentions: [],
      creator: { username: 'unknown' },
    };
  }

  if (!videoId) {
    log.warn({ url }, 'Could not determine video id from yt-dlp output');
    return {
      platform: platform as ExtractedContent['platform'],
      type: contentType as ExtractedContent['type'],
      url,
      caption: '',
      hashtags: [],
      mentions: [],
      creator: { username: 'unknown' },
    };
  }

  infoJsonPath = path.join(TMP_DIR, `${videoId}.info.json`);

  let info: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(infoJsonPath, 'utf-8');
    info = JSON.parse(raw);
  } catch (err) {
    log.warn({ err, infoJsonPath }, 'Could not read info.json, returning partial content');
  }

  const content = mapInfoJsonToContent(url, platform, contentType, info);

  const localFilePath = await findDownloadedFile(videoId);
  if (localFilePath) content.localFilePath = localFilePath;

  const thumbnailPath = await findThumbnailFile(videoId);
  if (thumbnailPath) content.thumbnailPath = thumbnailPath;

  log.info({ url, platform, localFilePath, thumbnailPath }, 'Extraction complete');

  return content;
}

export async function extractFromUrl(url: string): Promise<ExtractedContent> {
  try {
    return await extractContent(url);
  } catch (err) {
    log.error({ err, url }, 'extractFromUrl failed, returning fallback content');
    const platform = detectPlatform(url) || 'unknown';
    const contentType = platform !== 'unknown' ? detectContentType(url, platform) : 'unknown';
    return {
      platform: platform as ExtractedContent['platform'],
      type: contentType as ExtractedContent['type'],
      url,
      caption: '',
      hashtags: [],
      mentions: [],
      creator: { username: 'unknown' },
    };
  }
}
