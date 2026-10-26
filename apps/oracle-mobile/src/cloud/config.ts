/**
 * Shared worldwide store for license keys, reactivated emails, and EA metadata.
 * Backed by a free crudcrud.com REST document (CORS *, no paid secrets).
 *
 * Free buckets last ~24h — regenerate via POST https://crudcrud.com/api and
 * update CLOUD_DOC_URL below (or set window.__ORACLE_CLOUD_URL).
 *
 * Optional permanent upgrade: claim the Cloudflare Worker in services/oracle-store
 * and point CLOUD_DOC_URL at that Worker’s /store endpoint (GET/PUT JSON body).
 */
export const CLOUD_DOC_URL =
  'https://crudcrud.com/api/dde5b2dde26142da88c9dd91ade17da8/oracle/6aded048ab732003e81022e3';

/** Max data-URL length kept in the shared EA catalog (bytes of string). */
export const MAX_EA_IMAGE_CHARS = 120_000;
