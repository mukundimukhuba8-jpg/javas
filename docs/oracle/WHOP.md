# Whop payment verification (Oracle)

Checkout plan: [`plan_HXXGXZqh48JQs`](https://whop.com/checkout/plan_HXXGXZqh48JQs)

## What works today (no API key)

1. Client opens hosted checkout with email prefilled.
2. Soft return URL: `?paid=1&email=…&status=success&source=whop` unlocks Activate and writes a **verified** subscription (`verifiedVia: whop_return`).
3. There is **no** “I've paid” button. Forged query params stay on Payment.

GitHub Pages can only do this soft path (static hosting cannot hold secrets).

## Hard verify (needs secrets on Vercel)

| Secret | Where | Purpose |
|--------|--------|---------|
| `WHOP_API_KEY` | Vercel env | Bearer token — list members/memberships (`member:basic:read`, `member:email:read`) |
| `WHOP_COMPANY_ID` (`biz_…`) | Vercel env | Company / account id (alias: `WHOP_ACCOUNT_ID`) |
| `WHOP_PLAN_ID` | Vercel env | Default `plan_HXXGXZqh48JQs` |
| `WHOP_WEBHOOK_SECRET` (`ws_…`) | Vercel env | Verify `payment.succeeded` / `membership.activated` |

Endpoints (this repo → Vercel):

- `GET /api/whop/verify?email=` — poll Whop; used on Sign in Continue, return, and **Check payment status**
- `POST /api/whop/webhook` — Whop dashboard webhook URL; unlocks catalog with `verifiedVia: webhook`

When `WHOP_API_KEY` is set, soft return alone is **not** enough — the API must confirm payment.

### GitHub Pages + Vercel API

Set in the Expo web export:

```bash
EXPO_PUBLIC_WHOP_VERIFY_URL=https://YOUR_VERCEL_APP.vercel.app/api/whop/verify
```

### Whop dashboard setup

1. Developer → API keys → create account key → paste as `WHOP_API_KEY`
2. Copy company id `biz_…` → `WHOP_COMPANY_ID`
3. Developer → Webhooks → Create → URL `https://YOUR_VERCEL_APP.vercel.app/api/whop/webhook`  
   Events: `payment.succeeded`, `membership.activated`  
   Copy signing secret → `WHOP_WEBHOOK_SECRET`
4. On the plan/checkout, set redirect / return to the Oracle app URL with success params (or rely on API poll after Pay with Whop)

## Auto-open Activate

After verified payment (API, webhook, or soft return when API unset), `AccessStore` sets the session and App routes to **Activate robot**. Portal Subscription shows Paid · awaiting for `verifiedVia` rows.
