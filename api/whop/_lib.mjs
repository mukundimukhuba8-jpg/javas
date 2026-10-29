/**
 * Shared Whop + Oracle helpers for Vercel serverless routes.
 * Secrets stay server-side — never expose WHOP_API_KEY / WHOP_WEBHOOK_SECRET to the client.
 */

export const WHOP_PLAN_ID = process.env.WHOP_PLAN_ID || 'plan_HXXGXZqh48JQs';
export const WHOP_API_BASE = process.env.WHOP_API_BASE || 'https://api.whop.com/api/v1';

export function cors(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, webhook-id, webhook-timestamp, webhook-signature');
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function whopConfigured() {
  return !!(
    process.env.WHOP_API_KEY &&
    (process.env.WHOP_COMPANY_ID || process.env.WHOP_ACCOUNT_ID)
  );
}

export function companyId() {
  return process.env.WHOP_COMPANY_ID || process.env.WHOP_ACCOUNT_ID || '';
}

export async function whopFetch(path, { method = 'GET', body } = {}) {
  const key = process.env.WHOP_API_KEY;
  if (!key) throw new Error('WHOP_API_KEY missing');
  const res = await fetch(`${WHOP_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data };
}

/**
 * Look up whether email has an active/valid membership for WHOP_PLAN_ID.
 * Uses GET /members?query=email&plan_ids=…&account_id=…
 */
export async function verifyMembershipByEmail(email) {
  const n = String(email || '')
    .trim()
    .toLowerCase();
  if (!n.includes('@')) {
    return { paid: false, reason: 'invalid_email' };
  }
  if (!whopConfigured()) {
    return { paid: false, configured: false, reason: 'whop_api_not_configured' };
  }

  const params = new URLSearchParams();
  params.set('query', n);
  params.set('account_id', companyId());
  params.append('plan_ids[]', WHOP_PLAN_ID);
  // Also try comma form some SDKs use
  params.set('plan_ids', WHOP_PLAN_ID);

  const { ok, status, data } = await whopFetch(`/members?${params.toString()}`);
  if (!ok) {
    return {
      paid: false,
      configured: true,
      reason: 'whop_api_error',
      status,
      detail: typeof data?.error?.message === 'string' ? data.error.message : undefined,
    };
  }

  const rows = Array.isArray(data?.data) ? data.data : [];
  const match = rows.find((m) => {
    const e = (m?.user?.email || m?.email || '').trim().toLowerCase();
    if (e !== n) return false;
    const access = (m?.access_level || m?.status || '').toLowerCase();
    // Whop members: access_level often "customer" when paid; status on nested membership
    const memStatus = (m?.membership?.status || m?.most_recent_action || '').toLowerCase();
    if (access === 'no_access') return false;
    if (memStatus.includes('cancel') || memStatus.includes('expired')) return false;
    return true;
  });

  if (!match) {
    // Fallback: list memberships for plan and filter email client-side
    const mparams = new URLSearchParams();
    mparams.set('company_id', companyId());
    mparams.append('plan_ids[]', WHOP_PLAN_ID);
    mparams.set('plan_ids', WHOP_PLAN_ID);
    mparams.set('first', '50');
    const mem = await whopFetch(`/memberships?${mparams.toString()}`);
    if (mem.ok) {
      const list = Array.isArray(mem.data?.data) ? mem.data.data : [];
      const hit = list.find((row) => {
        const e = (row?.user?.email || row?.email || '').trim().toLowerCase();
        const st = (row?.status || '').toLowerCase();
        return e === n && (st === 'active' || st === 'completed' || st === 'trialing' || !st);
      });
      if (hit) {
        return {
          paid: true,
          configured: true,
          membershipId: hit.id || null,
          paymentId: hit.purchase_id || hit.id || null,
          via: 'memberships',
        };
      }
    }
    return { paid: false, configured: true, reason: 'no_membership' };
  }

  return {
    paid: true,
    configured: true,
    membershipId: match.id || match.membership?.id || null,
    paymentId: match.membership?.id || match.id || null,
    via: 'members',
  };
}

/** Standard Webhooks HMAC verify (Whop ws_… secret). */
export async function verifyWhopSignature(rawBody, headers) {
  const secret = process.env.WHOP_WEBHOOK_SECRET || '';
  if (!secret) return { ok: false, reason: 'WHOP_WEBHOOK_SECRET missing' };
  const id = headers['webhook-id'] || headers['Webhook-Id'] || '';
  const ts = headers['webhook-timestamp'] || headers['Webhook-Timestamp'] || '';
  const sig = headers['webhook-signature'] || headers['Webhook-Signature'] || '';
  if (!id || !ts || !sig) return { ok: false, reason: 'missing_signature_headers' };

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(Number(ts)) || age > 300) {
    return { ok: false, reason: 'timestamp_skew' };
  }

  const crypto = await import('node:crypto');
  const key = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice('whsec_'.length), 'base64')
    : Buffer.from(secret, 'utf8');
  const signed = `${id}.${ts}.${rawBody}`;
  const digest = crypto.createHmac('sha256', key).update(signed, 'utf8').digest('base64');
  const expected = `v1,${digest}`;
  const candidates = String(sig)
    .split(' ')
    .map((s) => s.trim())
    .filter(Boolean);
  const match = candidates.some((c) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(c), Buffer.from(expected));
    } catch {
      return c === expected;
    }
  });
  return match ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

function normalizeEmail(e) {
  return String(e || '')
    .trim()
    .toLowerCase();
}

/** Write verified paid subscription into Oracle Supabase sync catalog. */
export async function unlockOraclePaid(email, { paymentId, verifiedVia = 'webhook' } = {}) {
  const n = normalizeEmail(email);
  if (!n.includes('@')) return { ok: false, reason: 'invalid_email' };

  const URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const PUB =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const SYNC_EMAIL = process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL;
  const SYNC_PASS =
    process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD;
  if (!URL || !PUB || !SYNC_EMAIL || !SYNC_PASS) {
    return { ok: false, reason: 'supabase_sync_env_missing' };
  }

  const login = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: PUB,
      Authorization: `Bearer ${PUB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: SYNC_EMAIL, password: SYNC_PASS }),
  });
  const loginJson = await login.json().catch(() => ({}));
  if (!login.ok || !loginJson.access_token) {
    return { ok: false, reason: `supabase_login_${login.status}` };
  }
  const token = loginJson.access_token;

  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: PUB, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const userJson = await userRes.json().catch(() => ({}));
  const store = userJson?.user_metadata?.oracle_store || {
    keys: [],
    reactivated: [],
    eas: [],
    activations: [],
    mentors: [],
    subscriptions: [],
    updatedAt: new Date(0).toISOString(),
  };

  const paidAt = new Date().toISOString();
  const existing = (store.subscriptions || []).find(
    (s) =>
      normalizeEmail(s.email) === n &&
      (s.verifiedVia === 'webhook' || s.verifiedVia === 'api' || s.verifiedVia === 'whop_return') &&
      (s.status === 'awaiting' || s.status === 'approved'),
  );
  const sub = {
    id: existing?.id || `whop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    email: n,
    status: existing?.status === 'approved' ? 'approved' : 'awaiting',
    paidAt: existing?.paidAt || paidAt,
    plan: existing?.plan || `Whop · ${WHOP_PLAN_ID}`,
    source: 'whop',
    verifiedVia,
    paymentId: paymentId || existing?.paymentId || undefined,
  };
  const others = (store.subscriptions || []).filter((s) => normalizeEmail(s.email) !== n);
  const next = {
    ...store,
    subscriptions: [sub, ...others],
    updatedAt: paidAt,
  };

  const write = await fetch(`${URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      apikey: PUB,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data: { oracle_store: next } }),
  });
  if (!write.ok) {
    const t = await write.text();
    return { ok: false, reason: `supabase_write_${write.status}`, detail: t.slice(0, 120) };
  }
  return { ok: true, email: n, subscriptionId: sub.id };
}

export function extractEmailFromWhopEvent(event) {
  const d = event?.data || {};
  const candidates = [
    d.user?.email,
    d.email,
    d.member?.user?.email,
    d.membership?.user?.email,
    d.buyer?.email,
    d.customer?.email,
    d.buyer_email,
    d.user_email,
    d.metadata?.email,
    d.metadata?.customer_email,
    d.metadata?.customer_id, // sometimes the checkout email is stuffed here
    d.checkout_configuration?.metadata?.email,
  ];
  for (const c of candidates) {
    const n = normalizeEmail(c);
    if (n.includes('@')) return n;
  }
  return null;
}

/** Booleans only — never returns secret values. */
export function whopServerStatus() {
  return {
    webhookSecret: !!process.env.WHOP_WEBHOOK_SECRET,
    apiKey: !!process.env.WHOP_API_KEY,
    companyId: !!(process.env.WHOP_COMPANY_ID || process.env.WHOP_ACCOUNT_ID),
    planId: WHOP_PLAN_ID,
    supabaseUrl: !!(process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL),
    supabasePublishable: !!(
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ),
    syncAccount: !!(
      (process.env.ORACLE_SYNC_EMAIL || process.env.EXPO_PUBLIC_ORACLE_SYNC_EMAIL) &&
      (process.env.ORACLE_SYNC_PASSWORD || process.env.EXPO_PUBLIC_ORACLE_SYNC_PASSWORD)
    ),
  };
}
