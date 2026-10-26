# Oracle shared license store

The live GitHub Pages app reads/writes keys via a free REST document:

`https://crudcrud.com/api/dde5b2dde26142da88c9dd91ade17da8/oracle/6aded048ab732003e81022e3`

Configured in `apps/oracle-mobile/src/cloud/config.ts`.

## Optional permanent Worker

This folder has a Cloudflare Worker + KV implementation (`wrangler deploy`).
Temporary `workers.dev` URLs are bot-challenged; claim the preview account or
attach a custom route, then set `CLOUD_DOC_URL` / `window.__ORACLE_CLOUD_URL`
to the Worker origin (GET/PUT `/store`).
