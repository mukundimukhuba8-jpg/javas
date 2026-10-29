# Oracle ↔ Supabase

Worldwide catalog (license keys, EAs, mentors, subscriptions, reactivated emails) syncs through Supabase.

## Mentor isolation

Catalog rows (`keys`, `eas`) carry `mentorId`. Portal sessions:

- **Superadmin** (`eatrade@gmail.com`) — sees all catalogs; Manage mentors / Subscription.
- **Approved mentor** — sees/edits only rows stamped with their `mentorId`.
- **Clients** activate any valid key; Home shows that key’s EA only (not other mentors’ catalogs).

## Client env (publishable only)

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
EXPO_PUBLIC_ORACLE_SYNC_EMAIL=...
EXPO_PUBLIC_ORACLE_SYNC_PASSWORD=...
```

The **project secret key must never** appear in the Expo web bundle, commits, or screenshots.

## Backend preference

1. **`public.oracle_catalog`** (JSONB document) when the migration is applied — publishable key + permissive RLS.
2. **Auth `user_metadata.oracle_store`** via the dedicated sync account — same private-app tradeoff as open RLS (static Pages has no Edge Function).
3. **Storage** `oracle/catalog.json` public read + local `cloud-store.json` fallbacks.

## Apply SQL

```bash
# Option A — database password
SUPABASE_DB_PASSWORD=... node scripts/apply-supabase-schema.mjs

# Option B — Management PAT (sbp_...)
SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-supabase-schema.mjs

# Option C — paste supabase/migrations/*.sql into the Dashboard SQL editor
```

Normalized tables (`license_keys`, `eas`, `mentors`, `subscriptions`, `reactivated_emails`, `key_activations`) are created by the same migration for optional querying; the app reads/writes the JSON catalog document.

## Security note

If a project secret was pasted into chat, rotate it in the Supabase dashboard (API Keys) after wiring.

## Whop client payments

Checkout: `https://whop.com/checkout/plan_HXXGXZqh48JQs`

Flow: email → Whop (email prefilled) → return `?paid=1&email=…&status=success` → subscription **awaiting** + access unlock → Activate key.

Hard verification needs a Whop webhook secret / Edge Function (not shipped; browser return is best-effort).
