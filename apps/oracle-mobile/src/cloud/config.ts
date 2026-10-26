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
  'https://crudcrud.com/api/ea3befcf49d04445886354714c072753/oracle/6adf32e3db422303e8fa6a85';

/** Same-origin / raw snapshots — last-resort reads only. */
export const CLOUD_FALLBACK_URLS: string[] = [
  'cloud-store.json',
  '/javas/oracle/cloud-store.json',
  'https://raw.githubusercontent.com/mukundimukhuba8-jpg/javas/main/docs/oracle/cloud-store.json',
];

/** Max data-URL length kept in the shared EA catalog (bytes of string). */
export const MAX_EA_IMAGE_CHARS = 120_000;
