import { createClient } from '@supabase/supabase-js';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

const { url, anonKey, serviceRoleKey } = config.supabase;

function warnMissing(key: string): void {
  logger.warn({ key }, 'Supabase config missing — operations using this client will fail');
}

// Cliente admin (service role) — para mutaciones sin RLS
export const supabaseAdmin = (() => {
  if (!url || !serviceRoleKey) {
    warnMissing('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
})();

// Cliente público (anon key) — para lecturas respetando RLS
export const supabasePublic = (() => {
  if (!url || !anonKey) {
    warnMissing('SUPABASE_URL / SUPABASE_ANON_KEY');
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
})();
