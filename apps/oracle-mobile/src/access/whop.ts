/**
 * Whop hosted checkout for Oracle client payments.
 *
 * Checkout: https://whop.com/checkout/plan_HXXGXZqh48JQs
 * Prefill: ?email=…&email.disabled=1 (Whop branding docs)
 *
 * Return (best-effort — no webhook secret provided):
 *   {appBase}?paid=1&email={email}&status=success
 * Also accepts Whop-style ?status=succeeded|success with email.
 *
 * Hard verification needs a Whop webhook + API secret in a server/Edge Function.
 */

export const WHOP_CHECKOUT_PLAN_URL = 'https://whop.com/checkout/plan_HXXGXZqh48JQs';

export const WHOP_PLAN_LABEL = 'Whop · plan_HXXGXZqh48JQs';

function appOriginAndBase(): { origin: string; basePath: string } {
  if (typeof window === 'undefined') {
    return { origin: 'https://mukundimukhuba8-jpg.github.io', basePath: '/javas/oracle' };
  }
  const origin = window.location.origin;
  // Expo web may be at / or /javas/oracle/
  const path = window.location.pathname || '/';
  if (path.startsWith('/javas/oracle')) {
    return { origin, basePath: '/javas/oracle' };
  }
  return { origin, basePath: '' };
}

/** Public app URL used as Whop return / deep link target. */
export function buildAppReturnUrl(email: string): string {
  const { origin, basePath } = appOriginAndBase();
  const u = new URL(`${origin}${basePath || '/'}`);
  // Keep path trailing slash friendly for Pages
  if (basePath && !u.pathname.endsWith('/')) {
    u.pathname = `${u.pathname}/`;
  }
  u.searchParams.set('paid', '1');
  u.searchParams.set('email', email.trim().toLowerCase());
  u.searchParams.set('status', 'success');
  u.searchParams.set('source', 'whop');
  return u.toString();
}

/** Hosted checkout with email prefilled + locked. */
export function buildWhopCheckoutUrl(email: string): string {
  const u = new URL(WHOP_CHECKOUT_PLAN_URL);
  const n = email.trim().toLowerCase();
  if (n) {
    u.searchParams.set('email', n);
    u.searchParams.set('email.disabled', '1');
  }
  // Some Whop setups honor redirect; harmless if ignored
  u.searchParams.set('redirect', buildAppReturnUrl(n));
  return u.toString();
}

export type WhopReturnParams = {
  paid: boolean;
  email: string | null;
  status: string | null;
  paymentId: string | null;
};

/** Parse current location (or given search) for Whop / mock paid return. */
export function parseWhopReturn(search?: string): WhopReturnParams {
  const raw =
    search ??
    (typeof window !== 'undefined' ? window.location.search : '') ??
    '';
  const q = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
  const emailRaw = q.get('email') || q.get('buyer_email');
  const email = emailRaw ? emailRaw.trim().toLowerCase() : null;
  const status = (q.get('status') || '').toLowerCase() || null;
  const paidFlag = q.get('paid') === '1' || q.get('paid') === 'true';
  const statusOk =
    status === 'success' ||
    status === 'succeeded' ||
    status === 'ok' ||
    status === 'complete';
  const paymentId = q.get('payment') || q.get('payment_id') || null;
  return {
    paid: paidFlag || statusOk,
    email,
    status,
    paymentId,
  };
}

/** Strip paid/Whop query params from the address bar after handling. */
export function clearWhopReturnFromUrl(): void {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const u = new URL(window.location.href);
    ['paid', 'email', 'status', 'source', 'payment', 'payment_id', 'buyer_email'].forEach((k) =>
      u.searchParams.delete(k),
    );
    const next = `${u.pathname}${u.searchParams.toString() ? `?${u.searchParams}` : ''}${u.hash}`;
    window.history.replaceState({}, '', next);
  } catch {
    /* ignore */
  }
}

const PENDING_KEY = 'oracle.whop.pendingEmail.v1';

export function stashPendingCheckoutEmail(email: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export function takePendingCheckoutEmail(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(PENDING_KEY);
    localStorage.removeItem(PENDING_KEY);
    return v ? v.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
