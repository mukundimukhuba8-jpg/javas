import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import {
  fetchCloudStore,
  isVerifiedSubscription,
  pushReactivatedToCloud,
  scrubUnverifiedWhopInCloud,
  upsertSubscriptionPayment,
  type SubscriptionPayment,
} from '../cloud/oracleCloud';
import { normalizeEmail, type ReactivatedEmail } from './types';
import {
  clearWhopReturnFromUrl,
  parseWhopReturn,
  peekPendingCheckoutEmail,
  stashPendingCheckoutEmail,
  takePendingCheckoutEmail,
  WHOP_PLAN_LABEL,
} from './whop';

const LIST_KEY = 'oracle.access.reactivated.v1';
const SESSION_KEY = 'oracle.access.sessionEmail.v1';
const PAID_KEY = 'oracle.access.paidEmails.v1';

type TryEnterResult =
  | { ok: true }
  | { ok: false; reason: string; needsPayment?: boolean };

type AccessContextValue = {
  reactivated: ReactivatedEmail[];
  sessionEmail: string | null;
  isAllowed: boolean;
  reactivate: (email: string, paid: boolean) => Promise<ReactivatedEmail>;
  removeReactivated: (email: string) => void;
  tryEnter: (email: string) => Promise<TryEnterResult>;
  hasPaidAccess: (email: string) => boolean;
  signOut: () => void;
  isEmailActive: (email: string) => boolean;
  refreshCloudAccess: () => Promise<void>;
  whopReturnHandled: boolean;
  /** Set when return URL was present but failed soft verify */
  whopReturnError: string | null;
  clearWhopReturnError: () => void;
};

const AccessContext = createContext<AccessContextValue | null>(null);

function canUseStorage() {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

function loadList(): ReactivatedEmail[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReactivatedEmail[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e) => e && typeof e.email === 'string' && e.status === 'active');
  } catch {
    return [];
  }
}

function loadPaidEmails(): Set<string> {
  if (!canUseStorage()) return new Set();
  try {
    const raw = localStorage.getItem(PAID_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.map((e) => normalizeEmail(e)).filter(Boolean));
  } catch {
    return new Set();
  }
}

function persistPaidEmails(set: Set<string>) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(PAID_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

function loadSession(): string | null {
  if (!canUseStorage()) return null;
  try {
    const email = localStorage.getItem(SESSION_KEY);
    return email ? normalizeEmail(email) : null;
  } catch {
    return null;
  }
}

function persistList(list: ReactivatedEmail[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function persistSession(email: string | null) {
  if (!canUseStorage()) return;
  try {
    if (email) localStorage.setItem(SESSION_KEY, email);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function mergeReactivated(a: ReactivatedEmail[], b: ReactivatedEmail[]): ReactivatedEmail[] {
  const map = new Map<string, ReactivatedEmail>();
  for (const e of [...b, ...a]) {
    if (!e?.email) continue;
    const prev = map.get(e.email);
    if (!prev || (e.reactivatedAt || '') >= (prev.reactivatedAt || '')) map.set(e.email, e);
  }
  return Array.from(map.values()).filter((e) => e.status === 'active');
}

function subscriptionGrantsAccess(subs: SubscriptionPayment[], email: string): boolean {
  const n = normalizeEmail(email);
  return subs.some(
    (s) =>
      normalizeEmail(s.email) === n &&
      (s.status === 'awaiting' || s.status === 'approved') &&
      !!s.paidAt &&
      isVerifiedSubscription(s),
  );
}

function rebuildPaidSet(
  list: ReactivatedEmail[],
  subs: SubscriptionPayment[],
): Set<string> {
  const next = new Set<string>();
  for (const e of list) {
    if (e.status === 'active' && e.email) next.add(normalizeEmail(e.email));
  }
  for (const s of subs) {
    if (
      (s.status === 'awaiting' || s.status === 'approved') &&
      s.paidAt &&
      s.email &&
      isVerifiedSubscription(s)
    ) {
      next.add(normalizeEmail(s.email));
    }
  }
  persistPaidEmails(next);
  return next;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [reactivated, setReactivated] = useState<ReactivatedEmail[]>(() => loadList());
  const [paidEmails, setPaidEmails] = useState<Set<string>>(() => loadPaidEmails());
  const [subscriptions, setSubscriptions] = useState<SubscriptionPayment[]>([]);
  const [whopReturnHandled, setWhopReturnHandled] = useState(false);
  const [whopReturnError, setWhopReturnError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => {
    const email = loadSession();
    if (!email) return null;
    const list = loadList();
    // Do not restore session from paidEmails alone — may be a stale fake unlock
    if (list.some((e) => e.email === email && e.status === 'active')) return email;
    return null;
  });

  useEffect(() => {
    persistList(reactivated);
  }, [reactivated]);

  useEffect(() => {
    persistSession(sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    persistPaidEmails(paidEmails);
  }, [paidEmails]);

  useEffect(() => {
    if (!sessionEmail) return;
    const stillActive = reactivated.some((e) => e.email === sessionEmail && e.status === 'active');
    const stillPaid =
      paidEmails.has(sessionEmail) || subscriptionGrantsAccess(subscriptions, sessionEmail);
    if (!stillActive && !stillPaid) setSessionEmail(null);
  }, [reactivated, sessionEmail, paidEmails, subscriptions]);

  const refreshCloudAccess = useCallback(async () => {
    try {
      // Demote fake Whop “I've paid” rows before trusting cloud paid state
      try {
        await scrubUnverifiedWhopInCloud();
      } catch {
        /* continue with fetch */
      }
      const store = await fetchCloudStore();
      const nextList = mergeReactivated(store.reactivated, []);
      setReactivated(nextList);
      persistList(nextList);
      setSubscriptions(store.subscriptions || []);
      setPaidEmails(rebuildPaidSet(nextList, store.subscriptions || []));
    } catch {
      /* keep local */
    }
  }, []);

  useEffect(() => {
    void refreshCloudAccess();
    const id = setInterval(() => {
      void refreshCloudAccess();
    }, 60000);
    return () => clearInterval(id);
  }, [refreshCloudAccess]);

  const isEmailActive = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return reactivated.some((e) => e.email === n && e.status === 'active');
    },
    [reactivated],
  );

  const hasPaidAccess = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      if (!n) return false;
      // Admin/mentor reactivated list (not the fake Whop button)
      if (isEmailActive(n)) return true;
      return subscriptionGrantsAccess(subscriptions, n);
    },
    [isEmailActive, subscriptions],
  );

  const reactivate = useCallback(async (email: string, paid: boolean) => {
    const n = normalizeEmail(email);
    const entry: ReactivatedEmail = {
      email: n,
      paid,
      reactivatedAt: new Date().toISOString(),
      status: 'active',
    };
    setReactivated((prev) => {
      const without = prev.filter((e) => e.email !== n);
      const next = [entry, ...without];
      persistList(next);
      return next;
    });
    if (paid) {
      setPaidEmails((prev) => {
        const next = new Set(prev);
        next.add(n);
        persistPaidEmails(next);
        return next;
      });
    }
    try {
      await pushReactivatedToCloud(entry);
    } catch {
      /* local kept; cloud may lag */
    }
    return entry;
  }, []);

  const removeReactivated = useCallback((email: string) => {
    const n = normalizeEmail(email);
    setReactivated((prev) => {
      const next = prev.filter((e) => e.email !== n);
      persistList(next);
      return next;
    });
  }, []);

  /** Only called from verified Whop return URL handling — never from a client button. */
  const recordVerifiedWhopPaid = useCallback(
    async (email: string, opts?: { paymentId?: string | null }) => {
      const n = normalizeEmail(email);
      if (!n || !n.includes('@')) {
        return { ok: false as const, reason: 'Enter a valid email address.' };
      }
      const paidAt = new Date().toISOString();
      const sub: SubscriptionPayment = {
        id: `whop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        email: n,
        status: 'awaiting',
        paidAt,
        plan: WHOP_PLAN_LABEL,
        source: 'whop',
        verifiedVia: 'whop_return',
        paymentId: opts?.paymentId || undefined,
      };
      try {
        const store = await upsertSubscriptionPayment(sub);
        setSubscriptions(store.subscriptions || []);
        setPaidEmails(rebuildPaidSet(store.reactivated || reactivated, store.subscriptions || []));
      } catch {
        setSubscriptions((prev) => {
          const others = prev.filter((s) => normalizeEmail(s.email) !== n);
          return [sub, ...others];
        });
        setPaidEmails((prev) => {
          const next = new Set(prev);
          next.add(n);
          persistPaidEmails(next);
          return next;
        });
      }
      setSessionEmail(n);
      return { ok: true as const };
    },
    [reactivated],
  );

  // Handle Whop return URL once on mount — never honor client-only claims
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setWhopReturnHandled(true);
      return;
    }
    let cancelled = false;
    const safety = setTimeout(() => {
      if (!cancelled) setWhopReturnHandled(true);
    }, 5_000);
    const run = async () => {
      try {
        const parsed = parseWhopReturn();
        const pending = peekPendingCheckoutEmail();
        const email = parsed.email || pending;
        if (parsed.paid && email) {
          takePendingCheckoutEmail();
          await Promise.race([
            recordVerifiedWhopPaid(email, { paymentId: parsed.paymentId }),
            new Promise((_, rej) =>
              setTimeout(() => rej(new Error('whop return timeout')), 8_000),
            ),
          ]);
          clearWhopReturnFromUrl();
          setWhopReturnError(null);
        } else if (parsed.forgedOrIncomplete) {
          // Keep email for Payment UI; never unlock
          if (email) stashPendingCheckoutEmail(email);
          setWhopReturnError(
            'Payment not verified. Complete checkout on Whop, then return here with a successful payment redirect.',
          );
          clearWhopReturnFromUrl();
        }
      } catch {
        /* still unblock UI */
      } finally {
        if (!cancelled) setWhopReturnHandled(true);
        clearTimeout(safety);
      }
    };
    void run();
    return () => {
      cancelled = true;
      clearTimeout(safety);
    };
  }, [recordVerifiedWhopPaid]);

  const tryEnter = useCallback(
    async (email: string): Promise<TryEnterResult> => {
      const n = normalizeEmail(email);
      if (!n || !n.includes('@')) {
        return { ok: false, reason: 'Enter a valid email address.' };
      }

      const decide = (storeSubs: SubscriptionPayment[], list: ReactivatedEmail[]): TryEnterResult => {
        const active = list.some((e) => e.email === n && e.status === 'active');
        const paid = active || subscriptionGrantsAccess(storeSubs, n);
        if (paid) {
          setPaidEmails(rebuildPaidSet(list, storeSubs));
          setSessionEmail(n);
          return { ok: true };
        }
        return {
          ok: false,
          needsPayment: true,
          reason: 'Payment required before you can activate a license key.',
        };
      };

      try {
        const store = await Promise.race([
          fetchCloudStore(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('Cloud check timed out')), 10_000),
          ),
        ]);
        const next = mergeReactivated(store.reactivated, reactivated);
        setReactivated(next);
        persistList(next);
        setSubscriptions(store.subscriptions || []);
        return decide(store.subscriptions || [], next);
      } catch (e) {
        if (hasPaidAccess(n)) {
          setSessionEmail(n);
          return { ok: true };
        }
        const msg = e instanceof Error ? e.message : 'Cloud unreachable';
        return {
          ok: false,
          needsPayment: true,
          reason: `Could not verify membership (${msg}). Continue to payment to unlock Activate.`,
        };
      }
    },
    [reactivated, hasPaidAccess],
  );

  const signOut = useCallback(() => {
    setSessionEmail(null);
  }, []);

  const clearWhopReturnError = useCallback(() => setWhopReturnError(null), []);

  const isAllowed = !!sessionEmail && hasPaidAccess(sessionEmail);

  const value = useMemo(
    () => ({
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      hasPaidAccess,
      signOut,
      isEmailActive,
      refreshCloudAccess,
      whopReturnHandled,
      whopReturnError,
      clearWhopReturnError,
    }),
    [
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      hasPaidAccess,
      signOut,
      isEmailActive,
      refreshCloudAccess,
      whopReturnHandled,
      whopReturnError,
      clearWhopReturnError,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
}
