# Whop payment verification (Oracle)

Checkout plan: [`plan_HXXGXZqh48JQs`](https://whop.com/checkout/plan_HXXGXZqh48JQs)

## What works today

### Soft return (no API key)
1. Client opens hosted checkout with email prefilled.
2. Soft return URL: `?paid=1&email=…&status=success&source=whop` unlocks Activate (`verifiedVia: whop_return`).
3. No “I've paid” button. Forged query params stay on Payment.

GitHub Pages can only do soft return (static hosting cannot hold secrets).

### Webhook unlock (needs `WHOP_WEBHOOK_SECRET` on Vercel)
Whop POSTs to `/api/whop/webhook` → signature verify → write paid subscription (`verifiedVia: webhook`) → client **Check payment status** / Sign in Continue / Payment auto-poll pulls cloud and opens Activate.

### Poll verify (needs API key + company id)
`GET /api/whop/verify?email=` lists Whop members for the plan. Optional once `WHOP_API_KEY` + `WHOP_COMPANY_ID` are set.

## Vercel environment (do not put secrets in Expo / git)

In the Vercel project that deploys this repo (team **sfiso-mkhondo** / project **javas**):

**Settings → Environment Variables → Production** (and Preview if useful):

| Name | Required for | Notes |
|------|----------------|-------|
| `WHOP_WEBHOOK_SECRET` | webhook unlock | `ws_…` from Whop → Developer → Webhooks (already in agent store; paste into Vercel) |
| `WHOP_PLAN_ID` | both | `plan_HXXGXZqh48JQs` |
| `SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_URL` | webhook catalog write | same project as Oracle sync |
| `SUPABASE_PUBLISHABLE_KEY` or `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | webhook | |
| `ORACLE_SYNC_EMAIL` / `ORACLE_SYNC_PASSWORD` (or `EXPO_PUBLIC_*`) | webhook | sync account that owns `oracle_store` |
| `WHOP_API_KEY` | poll verify only | Account API key |
| `WHOP_COMPANY_ID` | poll verify only | `biz_…` |

Redeploy after saving env vars.

### Whop dashboard webhook URL

Point the Whop webhook at your **production** Vercel host:

```text
https://<YOUR-PRODUCTION-HOST>/api/whop/webhook
```

Events: `payment.succeeded`, `membership.activated` (optional: `membership.updated`).

Confirm wiring (booleans only):

```text
https://<YOUR-PRODUCTION-HOST>/api/whop/status
```

Expect `webhookReady: true` once secret + Supabase sync env are set.

> This agent has **no Vercel API token**, so the secret cannot be pushed from here. Paste `WHOP_WEBHOOK_SECRET` in the Vercel UI (or run `vercel env add WHOP_WEBHOOK_SECRET` locally with a token). Never commit it.

### GitHub Pages + poll verify

Only after you know the production host:

```bash
EXPO_PUBLIC_WHOP_VERIFY_URL=https://<YOUR-PRODUCTION-HOST>/api/whop/verify
```

Leave unset until the host is confirmed — Pages soft-return still works without it.

## Auto-open Activate

After webhook/API/soft verify, `AccessStore` sets the session and the app routes to **Activate robot**. Portal Subscription shows Paid · awaiting for verified rows. On Payment, the client polls cloud every ~8s for webhook unlocks.
