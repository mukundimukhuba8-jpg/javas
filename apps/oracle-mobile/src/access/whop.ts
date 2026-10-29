/**
 * Whop hosted checkout for Oracle client payments.
 *
 * Checkout: https://whop.com/checkout/plan_HXXGXZqh48JQs
 * Prefill: ?email=…&email.disabled=1
 *
 * Soft-verified return (no webhook secret yet):
 *   {appBase}?paid=1&email={email}&status=success&source=whop
 *
 * Unlock requires ALL of: paid=1, success status, source=whop.
 * Client-only “I've paid” claims are never honored.
 * Hard verification needs a Whop webhook + API secret (server/Edge).
 */

export const WHOP_CHECKOUT_PLAN_URL = 'https://whop.com/checkout/plan_HXXGXZqh48JQs';

export const WHOP_PLAN_LABEL = 'Whop · plan_HXXGXZqh48JQs';

function appOriginAndBase(): { origin: string; basePath: string } {
  if (typeof window === 'undefined') {
    return { origin: 'https://mukundimukhuba8-jpg.github.io', basePath: '/javas/oracle' };
  }
  const origin = window.location.origin;
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
  u.searchParams.set('redirect', buildAppReturnUrl(n));
  return u.toString();
}

export type WhopReturnParams = {
  /** True only when return URL satisfies soft verify rules. */
  paid: boolean;
  email: string | null;
  status: string | null;
  source: string | null;
  paymentId: string | null;
  /** Query looked like a payment return but failed verification. */
  forgedOrIncomplete: boolean;
};

function readSearchParams(search?: string): URLSearchParams {
  const raw =
    search ?? (typeof window !== 'undefined' ? window.location.search : '') ?? '';
  return new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw);
}

/** True if the URL has any Whop/payment-related query keys. */
export function isWhopReturnAttempt(search?: string): boolean {
  const q = readSearchParams(search);
  return (
    q.has('paid') ||
    q.has('status') ||
    q.has('payment') ||
    q.has('payment_id') ||
    (q.get('source') || '').toLowerCase() === 'whop'
  );
}

/**
 * Parse current location (or given search) for Whop return.
 * Requires paid=1 + success|succeeded|ok|complete + source=whop.
 */
export function parseWhopReturn(search?: string): WhopReturnParams {
  const q = readSearchParams(search);
  const emailRaw = q.get('email') || q.get('buyer_email');
  const email = emailRaw ? emailRaw.trim().toLowerCase() : null;
  const status = (q.get('status') || '').toLowerCase() || null;
  const source = (q.get('source') || '').toLowerCase() || null;
  const paidFlag = q.get('paid') === '1' || q.get('paid') === 'true';
  const statusOk =
    status === 'success' ||
    status === 'succeeded' ||
    status === 'ok' ||
    status === 'complete';
  const sourceOk = source === 'whop';
  const paymentId = q.get('payment') || q.get('payment_id') || null;
  const attempt = isWhopReturnAttempt(search);
  const paid = paidFlag && statusOk && sourceOk;
  return {
    paid,
    email,
    status,
    source,
    paymentId,
    forgedOrIncomplete: attempt && !paid,
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

export function peekPendingCheckoutEmail(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const v = localStorage.getItem(PENDING_KEY);
    return v ? v.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
