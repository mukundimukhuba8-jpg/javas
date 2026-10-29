/**
 * GET /api/whop/verify?email=
 * Polls Whop for an active membership on plan_HXXGXZqh48JQs.
 * Requires server env: WHOP_API_KEY + WHOP_COMPANY_ID (biz_…).
 */
import {
  cors,
  json,
  verifyMembershipByEmail,
  whopConfigured,
  WHOP_PLAN_ID,
} from './_lib.mjs';

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, reason: 'method_not_allowed' });
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();

  if (!whopConfigured()) {
    return json(res, 200, {
      ok: true,
      configured: false,
      paid: false,
      planId: WHOP_PLAN_ID,
      reason: 'Set WHOP_API_KEY and WHOP_COMPANY_ID on Vercel to enable live verify.',
    });
  }

  try {
    const result = await verifyMembershipByEmail(email);
    return json(res, 200, {
      ok: true,
      planId: WHOP_PLAN_ID,
      ...result,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      configured: true,
      paid: false,
      reason: e instanceof Error ? e.message : 'verify_failed',
    });
  }
}
