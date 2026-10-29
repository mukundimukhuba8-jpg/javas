/**
 * GET /api/whop/status — booleans only (no secrets).
 * Use after setting Vercel env to confirm webhook/API wiring.
 */
import { cors, json, whopServerStatus, WHOP_PLAN_ID } from './_lib.mjs';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, reason: 'method_not_allowed' });
  }
  const s = whopServerStatus();
  return json(res, 200, {
    ok: true,
    planId: WHOP_PLAN_ID,
    webhookReady: s.webhookSecret && s.syncAccount && s.supabaseUrl && s.supabasePublishable,
    pollVerifyReady: s.apiKey && s.companyId,
    ...s,
    webhookPath: '/api/whop/webhook',
    verifyPath: '/api/whop/verify',
  });
}
