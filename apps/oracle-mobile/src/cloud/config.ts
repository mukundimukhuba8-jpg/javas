/**
 * Shared worldwide store for license keys, reactivated emails, and EA metadata.
 *
 * Primary R/W: free crudcrud.com REST document (CORS *).
 * Read fallbacks used ONLY when primary is unreachable (disaster recovery).
 * Create keys / Activate always prefer the primary URL and verify writes.
 *
 * Override at runtime: window.__ORACLE_CLOUD_URL
 */
export const CLOUD_DOC_URL =
  'https://crudcrud.com/api/d0beed68a3bf499a97e4dd1598fc9ff8/oracle/6adf7cf1286ff303e839ba7e';

/** Same-origin / raw snapshots — last-resort reads only. */
export const CLOUD_FALLBACK_URLS: string[] = [
  'cloud-store.json',
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
