/**
 * POST /api/whop/webhook
 * Whop → payment.succeeded / membership.activated → unlock Oracle subscription.
 * Requires WHOP_WEBHOOK_SECRET (ws_…) + Supabase sync env for catalog write.
 */
import {
  cors,
  json,
  verifyWhopSignature,
  extractEmailFromWhopEvent,
  unlockOraclePaid,
  WHOP_PLAN_ID,
} from './_lib.mjs';

async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, reason: 'method_not_allowed' });
  }

  if (!process.env.WHOP_WEBHOOK_SECRET) {
    return json(res, 503, {
      ok: false,
      reason: 'WHOP_WEBHOOK_SECRET not configured',
    });
  }

  try {
    const raw = await readRawBody(req);
    const verified = await verifyWhopSignature(raw, req.headers || {});
    if (!verified.ok) {
      return json(res, 401, { ok: false, reason: verified.reason });
    }

    const event = JSON.parse(raw);
    const type = String(event?.type || '');
    const interesting =
      type === 'payment.succeeded' ||
      type === 'membership.activated' ||
      type === 'membership.updated';

    if (!interesting) {
      return json(res, 200, { ok: true, ignored: type || 'unknown' });
    }

    const email = extractEmailFromWhopEvent(event);
    if (!email) {
      return json(res, 200, {
        ok: true,
        unlocked: false,
        reason: 'no_email_in_event',
        type,
        hint: 'Ensure checkout prefills email; or set metadata.email',
      });
    }

    // Optional plan filter when payload includes plan id
    const plan =
      event?.data?.plan?.id ||
      event?.data?.plan_id ||
      event?.data?.membership?.plan?.id ||
      '';
    if (plan && plan !== WHOP_PLAN_ID) {
      return json(res, 200, { ok: true, unlocked: false, reason: 'other_plan', plan });
    }

    const paymentId =
      event?.data?.id || event?.data?.membership?.id || event?.id || null;
    const unlock = await unlockOraclePaid(email, {
      paymentId,
      verifiedVia: 'webhook',
    });

    return json(res, 200, {
      ok: true,
      type,
      email,
      unlocked: unlock.ok,
      ...unlock,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      reason: e instanceof Error ? e.message : 'webhook_error',
    });
  }
}
