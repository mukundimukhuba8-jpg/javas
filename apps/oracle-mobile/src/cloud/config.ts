/**
 * Shared worldwide store for license keys, reactivated emails, mentors, and EA metadata.
 *
 * Primary R/W: Supabase (publishable key only — never the project secret).
 *   - Prefers public.oracle_catalog when present
 *   - Falls back to Auth user_metadata via sync account (private-app tradeoff)
 * Read fallbacks: Storage public catalog.json, then local/Pages snapshots.
 *
 * Embed at build time (direct process.env.EXPO_PUBLIC_* so Metro inlines them):
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *   EXPO_PUBLIC_ORACLE_SYNC_EMAIL
 *   EXPO_PUBLIC_ORACLE_SYNC_PASSWORD
 *
 * Override write target at runtime: window.__ORACLE_CLOUD_URL (legacy URL only)
 */

function trim(v: string | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

// IMPORTANT: keep these as direct process.env.EXPO_PUBLIC_* member expressions
// so Expo/Metro can inline them at export time.
export const SUPABASE_URL =
  trim(process.env.EXPO_PUBLIC_SUPABASE_URL) || 'https://wugjvgasptydqnmirlzx.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY =
  trim(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ||
  trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

/** Dedicated sync user for Auth-metadata catalog R/W when tables/RLS are not ready. */
export const ORACLE_SYNC_EMAIL = trim(process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL) || '';
export const ORACLE_SYNC_PASSWORD = trim(process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD) || '';

export const STORAGE_CATALOG_URL = `${SUPABASE_URL}/storage/v1/object/public/oracle/catalog.json`;

/**
 * Legacy document URL override (crudcrud / raw JSON). Prefer Supabase when configured.
 * Kept so window.__ORACLE_CLOUD_URL and disaster-recovery URLs still work.
 */
export const CLOUD_DOC_URL = STORAGE_CATALOG_URL;

/** Same-origin / raw snapshots — last-resort reads only. */
export const CLOUD_FALLBACK_URLS: string[] = [
  STORAGE_CATALOG_URL,
  'cloud-store.json',
  '/cloud-store.json',
  '/javas/oracle/cloud-store.json',
  'https://raw.githubusercontent.com/mukundimukhuba8-jpg/javas/main/docs/oracle/cloud-store.json',
];

/**
 * Max data-URL length kept inline on the EA record (~280KB binary ≈ 380k chars).
 * Larger uploads are compressed and/or hosted; https:// URLs are uncapped.
 */
export const MAX_EA_IMAGE_CHARS = 380_000;

/** Prefer hosting once a data URL exceeds this (keeps the cloud doc lean). */
export const PREFER_HOST_CHARS = 100_000;
