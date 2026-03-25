import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const BUCKET = 'post-thumbnails';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.KREOON_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function ensureBucket(supabase: any) {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: true });
    console.log(`[thumbnail-persist] Created bucket "${BUCKET}"`);
  }
}

async function uploadImage(supabase: any, igUrl: string, username: string, index: number): Promise<string | null> {
  try {
    const res = await axios.get(igUrl, { responseType: 'arraybuffer', timeout: 15_000 });
    const buffer = Buffer.from(res.data);
    const ext = res.headers['content-type']?.includes('png') ? 'png' : 'jpg';
    const path = `${username}/${Date.now()}-${index}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: res.headers['content-type'] || 'image/jpeg',
      upsert: true,
    });

    if (error) {
      console.log(`[thumbnail-persist] Upload error for ${path}: ${error.message}`);
      return null;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    console.log(`[thumbnail-persist] Uploaded ${path}`);
    return urlData.publicUrl;
  } catch (err: any) {
    console.log(`[thumbnail-persist] Failed to download ${igUrl.substring(0, 60)}...: ${err.message}`);
    return null;
  }
}

export async function persistThumbnails(
  posts: { thumbnail_url?: string }[],
  username: string,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    console.log('[thumbnail-persist] Supabase not configured, skipping');
    return;
  }

  await ensureBucket(supabase);

  const tasks = posts.map(async (post, i) => {
    if (!post.thumbnail_url) return;
    // Skip if already a Supabase URL
    if (post.thumbnail_url.includes('supabase.co/storage')) return;

    const permanentUrl = await uploadImage(supabase, post.thumbnail_url, username, i);
    if (permanentUrl) {
      post.thumbnail_url = permanentUrl;
    }
  });

  await Promise.allSettled(tasks);
  console.log(`[thumbnail-persist] Processed ${posts.length} thumbnails for @${username}`);
}
