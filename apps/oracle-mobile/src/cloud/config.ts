/**
 * Shared worldwide store for license keys, reactivated emails, and EA metadata.
 *
 * Write/read primary: free crudcrud.com REST document (CORS *).
 * Read fallbacks (same-origin + GitHub raw) so Activate still works if crudcrud
 * rate-limits — seeded on each Pages deploy with the current catalog.
 *
 * Override at runtime: window.__ORACLE_CLOUD_URL
 */
export const CLOUD_DOC_URL =
  'https://crudcrud.com/api/dde5b2dde26142da88c9dd91ade17da8/oracle/6aded048ab732003e81022e3';

/** Same-origin snapshot shipped with GitHub Pages (no CORS issues). */
export const CLOUD_FALLBACK_URLS: string[] = [
  // Relative to /javas/oracle/
  'cloud-store.json',
  '/javas/oracle/cloud-store.json',
  'https://raw.githubusercontent.com/mukundimukhuba8-jpg/javas/main/docs/oracle/cloud-store.json',
];

/** Max data-URL length kept in the shared EA catalog (bytes of string). */
export const MAX_EA_IMAGE_CHARS = 120_000;
