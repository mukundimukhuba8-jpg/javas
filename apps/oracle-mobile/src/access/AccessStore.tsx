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
  pushReactivatedToCloud,
  upsertSubscriptionPayment,
  type SubscriptionPayment,
} from '../cloud/oracleCloud';
import { normalizeEmail, type ReactivatedEmail } from './types';
import {
  clearWhopReturnFromUrl,
  parseWhopReturn,
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
  /** Record Whop (or mock) payment → subscription awaiting + access unlock */
  recordWhopPaid: (
    email: string,
    opts?: { paymentId?: string | null },
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  hasPaidAccess: (email: string) => boolean;
  signOut: () => void;
  isEmailActive: (email: string) => boolean;
  refreshCloudAccess: () => Promise<void>;
  whopReturnHandled: boolean;
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
      !!s.paidAt,
  );
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [reactivated, setReactivated] = useState<ReactivatedEmail[]>(() => loadList());
  const [paidEmails, setPaidEmails] = useState<Set<string>>(() => loadPaidEmails());
  const [subscriptions, setSubscriptions] = useState<SubscriptionPayment[]>([]);
  const [whopReturnHandled, setWhopReturnHandled] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => {
    const email = loadSession();
    if (!email) return null;
    const list = loadList();
    const paid = loadPaidEmails();
    if (list.some((e) => e.email === email && e.status === 'active') || paid.has(email)) {
      return email;
    }
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
      const store = await fetchCloudStore();
      setReactivated((prev) => {
        const next = mergeReactivated(store.reactivated, prev);
        persistList(next);
        return next;
      });
      setSubscriptions(store.subscriptions || []);
      // Mirror paid subscription emails into local paid set
      setPaidEmails((prev) => {
        const next = new Set(prev);
        for (const s of store.subscriptions || []) {
          if (
            (s.status === 'awaiting' || s.status === 'approved') &&
            s.paidAt &&
            s.email
          ) {
            next.add(normalizeEmail(s.email));
          }
        }
        persistPaidEmails(next);
        return next;
      });
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
      if (paidEmails.has(n)) return true;
      if (isEmailActive(n)) return true;
      return subscriptionGrantsAccess(subscriptions, n);
    },
    [paidEmails, isEmailActive, subscriptions],
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

  const recordWhopPaid = useCallback(
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
      };
      try {
        const store = await upsertSubscriptionPayment(sub);
        setSubscriptions(store.subscriptions || []);
      } catch (e) {
        // Still unlock locally so the client is not stuck if cloud lags
        setSubscriptions((prev) => {
          const others = prev.filter((s) => normalizeEmail(s.email) !== n);
          return [sub, ...others];
        });
        void e;
      }
      await reactivate(n, true);
      setPaidEmails((prev) => {
        const next = new Set(prev);
        next.add(n);
        persistPaidEmails(next);
        return next;
      });
      setSessionEmail(n);
      void opts?.paymentId;
      return { ok: true as const };
    },
    [reactivate],
  );

  // Handle Whop / mock return URL once on mount
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setWhopReturnHandled(true);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const parsed = parseWhopReturn();
      const pending = takePendingCheckoutEmail();
      const email = parsed.email || pending;
      if (parsed.paid && email) {
        await recordWhopPaid(email, { paymentId: parsed.paymentId });
        clearWhopReturnFromUrl();
      }
      if (!cancelled) setWhopReturnHandled(true);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [recordWhopPaid]);

  const tryEnter = useCallback(
    async (email: string): Promise<TryEnterResult> => {
      const n = normalizeEmail(email);
      if (!n || !n.includes('@')) {
        return { ok: false, reason: 'Enter a valid email address.' };
      }
      try {
        const store = await fetchCloudStore();
        const next = mergeReactivated(store.reactivated, reactivated);
        setReactivated(next);
        persistList(next);
        setSubscriptions(store.subscriptions || []);

        const active = next.some((e) => e.email === n && e.status === 'active');
        const paid =
          active ||
          paidEmails.has(n) ||
          subscriptionGrantsAccess(store.subscriptions || [], n);

        if (paid) {
          setPaidEmails((prev) => {
            const s = new Set(prev);
            s.add(n);
            persistPaidEmails(s);
            return s;
          });
          setSessionEmail(n);
          return { ok: true };
        }
        return {
          ok: false,
          needsPayment: true,
          reason: 'Payment required before you can activate a license key.',
        };
      } catch {
        if (hasPaidAccess(n)) {
          setSessionEmail(n);
          return { ok: true };
        }
        return {
          ok: false,
          needsPayment: true,
          reason: 'Payment required before you can activate a license key.',
        };
      }
    },
    [reactivated, paidEmails, hasPaidAccess],
  );

  const signOut = useCallback(() => {
    setSessionEmail(null);
  }, []);

  const isAllowed = !!sessionEmail && hasPaidAccess(sessionEmail);

  const value = useMemo(
    () => ({
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      recordWhopPaid,
      hasPaidAccess,
      signOut,
      isEmailActive,
      refreshCloudAccess,
      whopReturnHandled,
    }),
    [
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      recordWhopPaid,
      hasPaidAccess,
      signOut,
      isEmailActive,
      refreshCloudAccess,
      whopReturnHandled,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
}
