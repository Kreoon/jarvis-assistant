import axios from 'axios';
import { persistThumbnails } from "./thumbnail-persist";

export interface ApifyPost {
  url: string;
  caption: string;
  likes: number;
  comments: number;
  views?: number;
  published_at: string;
  content_type: 'image' | 'video' | 'reel' | 'carousel';
  thumbnail_url?: string;
  video_url?: string;
}

export interface ApifyInstagramResult {
  username: string;
  followers: number;
  following: number;
  bio: string;
  posts_count: number;
  profile_pic_url?: string;
  is_verified: boolean;
  recent_posts: ApifyPost[];
}

const APIFY_BASE_URL = 'https://api.apify.com/v2';
const ACTOR_ID = 'apify~instagram-profile-scraper';
const TIMEOUT_MS = 120_000;

function resolveContentType(post: any): ApifyPost['content_type'] {
  const type = (post.type || '').toLowerCase();
  if (type === 'Video' || type === 'video') return 'video';
  if (type === 'Reel' || type === 'reel') return 'reel';
  if (type === 'Sidecar' || type === 'sidecar' || type === 'carousel') return 'carousel';
  return 'image';
}

function mapPost(post: any): ApifyPost {
  return {
    url: post.url || post.shortCode ? `https://www.instagram.com/p/${post.shortCode}/` : '',
    caption: post.caption || '',
    likes: post.likesCount ?? post.likes ?? 0,
    comments: post.commentsCount ?? post.comments ?? 0,
    views: post.videoViewCount ?? post.videoPlayCount ?? undefined,
    published_at: post.timestamp || post.takenAt || '',
    content_type: resolveContentType(post),
    thumbnail_url: post.displayUrl || post.thumbnailUrl || undefined,
    video_url: post.videoUrl || post.videoPlayUrl || undefined,
  };
}

export async function scrapeInstagramViaApify(
  username: string
): Promise<ApifyInstagramResult | null> {
  const token = process.env.APIFY_API_TOKEN;

  if (!token) {
    console.log('[apify-scraper] APIFY_API_TOKEN not set');
    return null;
  }

  const cleanUsername = username.replace(/^@/, '').trim();

  if (!cleanUsername) {
    console.log('[apify-scraper] Empty username provided');
    return null;
  }

  try {
    const url = `${APIFY_BASE_URL}/acts/${ACTOR_ID}/run-sync-get-dataset-items`;

    const response = await axios.post(
      url,
      {
        usernames: [cleanUsername],
        resultsLimit: 6,
      },
      {
        params: { token },
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      }
    );

    const items = response.data;

    if (!Array.isArray(items) || items.length === 0) {
      console.log(`[apify-scraper] No data returned for @${cleanUsername}`);
      return null;
    }

    const profile = items[0];

    const recentPosts: ApifyPost[] = (profile.latestPosts || [])
      .slice(0, 6)
      .map(mapPost);

    const totalLikes = recentPosts.reduce((sum, p) => sum + p.likes, 0);
    const totalComments = recentPosts.reduce((sum, p) => sum + p.comments, 0);
    const followers = profile.followersCount ?? 0;
    const engagementRate =
      followers > 0 && recentPosts.length > 0
        ? ((totalLikes + totalComments) / recentPosts.length / followers) * 100
        : 0;

    const result: ApifyInstagramResult & { engagement_rate: number } = {
      username: profile.username || cleanUsername,
      followers,
      following: profile.followsCount ?? 0,
      bio: profile.biography || '',
      posts_count: profile.postsCount ?? 0,
      profile_pic_url: profile.profilePicUrl || undefined,
      is_verified: profile.verified ?? false,
      recent_posts: recentPosts,
      engagement_rate: Math.round(engagementRate * 100) / 100,
    };

    console.log(
      `[apify-scraper] @${cleanUsername}: ${followers} followers, ${recentPosts.length} posts fetched, ${engagementRate.toFixed(2)}% engagement`
    );

    return result;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.log(
        `[apify-scraper] API error for @${cleanUsername}: ${error.response?.status || 'timeout'} - ${error.message}`
      );
    } else {
      console.log(`[apify-scraper] Unexpected error for @${cleanUsername}: ${error.message}`);
    }
    return null;
  }
}


// ─── Facebook/Meta Ad Library Scraper ────────────────────────────────────────

export interface ApifyAd {
  ad_id: string;
  page_name: string;
  ad_text: string;
  ad_url: string;
  media_url?: string;
  media_type: 'image' | 'video' | 'carousel';
  started_running: string;
  status: 'active' | 'inactive';
  platforms: string[];
}

export async function scrapeAdsViaApify(
  brandName: string,
  country: string = 'CO',
): Promise<ApifyAd[]> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    console.log('[apify-scraper] APIFY_API_TOKEN not set, skipping ads');
    return [];
  }

  try {
    const ACTOR_ID_ADS = 'apify~facebook-ads-library';
    const url = `https://api.apify.com/v2/acts/${ACTOR_ID_ADS}/run-sync-get-dataset-items`;

    console.log(`[apify-scraper] Searching Meta Ad Library for "${brandName}" in ${country}`);

    const response = await axios.post(
      url,
      {
        searchTerms: [brandName],
        countryCode: country,
        adType: 'all',
        maxItems: 10,
      },
      {
        params: { token },
        headers: { 'Content-Type': 'application/json' },
        timeout: 90_000,
      },
    );

    const items = response.data || [];
    console.log(`[apify-scraper] Found ${items.length} ads for "${brandName}"`);

    return items.slice(0, 10).map((ad: any) => ({
      ad_id: ad.id || ad.adArchiveID || '',
      page_name: ad.pageName || ad.page_name || brandName,
      ad_text: ad.adCreativeBody || ad.ad_creative_body || ad.bodyText || '',
      ad_url: ad.adCreativeLinkCaption
        ? `https://www.facebook.com/ads/library/?id=${ad.id || ad.adArchiveID}`
        : '',
      media_url: ad.adCreativeImageUrl || ad.snapshot?.images?.[0]?.original_image_url || undefined,
      media_type: ad.adCreativeVideoUrl ? 'video' : ad.snapshot?.cards ? 'carousel' : 'image',
      started_running: ad.startDate || ad.ad_delivery_start_time || '',
      status: ad.isActive ? 'active' : 'inactive',
      platforms: ad.publisherPlatform || ['facebook', 'instagram'],
    }));
  } catch (err: any) {
    console.log(`[apify-scraper] Ad Library scrape failed: ${err.message}`);
    return [];
  }
}
