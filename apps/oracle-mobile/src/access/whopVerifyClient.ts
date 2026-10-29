/**
 * Client → optional Vercel `/api/whop/verify` (needs WHOP_API_KEY on server).
 * When not configured, returns configured:false and caller keeps soft-return rules.
 */

export type WhopVerifyResult = {
  ok: boolean;
  configured: boolean;
  paid: boolean;
  reason?: string;
  membershipId?: string | null;
  paymentId?: string | null;
  planId?: string;
};

function verifyEndpoint(): string | null {
  const fromEnv =
    (typeof process !== 'undefined' &&
      (process.env.EXPO_PUBLIC_WHOP_VERIFY_URL || process.env.EXPO_PUBLIC_WHOP_API_BASE)) ||
    '';
  if (fromEnv.trim()) {
    const base = fromEnv.trim().replace(/\/$/, '');
    return base.includes('/verify') ? base : `${base}/api/whop/verify`;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    // Same-origin on Vercel; GitHub Pages has no /api — will 404 → treat as not configured
    const host = window.location.hostname || '';
    if (host.includes('github.io')) {
      // Pages cannot host secrets; point at Vercel if public URL set later
      return null;
    }
    return `${window.location.origin}/api/whop/verify`;
  }
  return null;
}

export function whopApiVerifyAvailable(): boolean {
  return !!verifyEndpoint();
}

export async function verifyWhopPaidOnServer(
  email: string,
  timeoutMs = 10_000,
): Promise<WhopVerifyResult> {
  const n = email.trim().toLowerCase();
  const endpoint = verifyEndpoint();
  if (!endpoint || !n.includes('@')) {
    return { ok: true, configured: false, paid: false, reason: 'no_verify_endpoint' };
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    const url = `${endpoint}?email=${encodeURIComponent(n)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: ctrl?.signal,
    });
    const text = await res.text();
    let data: Partial<WhopVerifyResult> = {};
    try {
      data = text ? (JSON.parse(text) as Partial<WhopVerifyResult>) : {};
    } catch {
      // SPA / Pages often return HTML for missing /api — treat as not configured
      return {
        ok: true,
        configured: false,
        paid: false,
        reason: 'verify_endpoint_not_json',
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        configured: data.configured === true,
        paid: false,
        reason: data.reason || `http_${res.status}`,
      };
    }
    // Only trust "configured" when the API explicitly says so
    const configured = data.configured === true;
    return {
      ok: true,
      configured,
      paid: configured && !!data.paid,
      reason: data.reason,
      membershipId: data.membershipId ?? null,
      paymentId: data.paymentId ?? null,
      planId: data.planId,
    };
  } catch (e) {
    return {
      ok: false,
      configured: false,
      paid: false,
      reason: e instanceof Error ? e.message : 'verify_fetch_failed',
    };
  } finally {
    clearTimeout(t);
  }
}
