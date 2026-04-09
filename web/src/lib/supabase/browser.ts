"use client";

import { createClient } from "@supabase/supabase-js";

// Fallback to placeholders during build; real values injected at runtime via Next.js env embedding.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Singleton para uso en cliente — solo anon key, solo para Realtime subscriptions
export const supabaseBrowser = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
