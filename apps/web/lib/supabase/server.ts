import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Two server clients, two levels of power:
 *
 * - publicClient: the anon/publishable key. Bound by Row Level Security, so it
 *   can only read what the policies allow. Safe for page rendering.
 * - adminClient: the service-role/secret key. Bypasses RLS. Only route handlers
 *   that have already verified the caller (e.g. the signed GitHub webhook) may
 *   use it. This key must never reach the browser: no NEXT_PUBLIC_ prefix.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Null when Supabase isn't configured yet, so the calendar still renders locally. */
export function publicClient(): SupabaseClient | null {
  return url && anonKey ? createClient(url, anonKey, noSession) : null;
}

export function adminClient(): SupabaseClient {
  if (!url || !serviceKey) throw new Error("Supabase admin client needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, noSession);
}
