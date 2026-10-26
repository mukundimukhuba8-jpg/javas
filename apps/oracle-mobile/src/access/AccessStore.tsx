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
import { fetchCloudStore, pushReactivatedToCloud } from '../cloud/oracleCloud';
import { normalizeEmail, type ReactivatedEmail } from './types';

const LIST_KEY = 'oracle.access.reactivated.v1';
const SESSION_KEY = 'oracle.access.sessionEmail.v1';

type AccessContextValue = {
  reactivated: ReactivatedEmail[];
  sessionEmail: string | null;
  isAllowed: boolean;
  reactivate: (email: string, paid: boolean) => Promise<ReactivatedEmail>;
  removeReactivated: (email: string) => void;
  tryEnter: (email: string) => Promise<{ ok: boolean; reason?: string }>;
  signOut: () => void;
  isEmailActive: (email: string) => boolean;
  refreshCloudAccess: () => Promise<void>;
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

export function AccessProvider({ children }: { children: ReactNode }) {
  const [reactivated, setReactivated] = useState<ReactivatedEmail[]>(() => loadList());
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => {
    const email = loadSession();
    if (!email) return null;
    const list = loadList();
    return list.some((e) => e.email === email && e.status === 'active') ? email : null;
  });

  useEffect(() => {
    persistList(reactivated);
  }, [reactivated]);

  useEffect(() => {
    persistSession(sessionEmail);
  }, [sessionEmail]);

  useEffect(() => {
    if (!sessionEmail) return;
    const still = reactivated.some((e) => e.email === sessionEmail && e.status === 'active');
    if (!still) setSessionEmail(null);
  }, [reactivated, sessionEmail]);

  const refreshCloudAccess = useCallback(async () => {
    try {
      const store = await fetchCloudStore();
      setReactivated((prev) => {
        const next = mergeReactivated(store.reactivated, prev);
        persistList(next);
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
    }, 20000);
    return () => clearInterval(id);
  }, [refreshCloudAccess]);

  const isEmailActive = useCallback(
    (email: string) => {
      const n = normalizeEmail(email);
      return reactivated.some((e) => e.email === n && e.status === 'active');
    },
    [reactivated],
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

  const tryEnter = useCallback(
    async (email: string) => {
      const n = normalizeEmail(email);
      if (!n || !n.includes('@')) {
        return { ok: false, reason: 'Enter a valid email address.' };
      }
      // Refresh worldwide list before gate check
      try {
        const store = await fetchCloudStore();
        const next = mergeReactivated(store.reactivated, reactivated);
        setReactivated(next);
        persistList(next);
        const active = next.some((e) => e.email === n && e.status === 'active');
        if (!active) {
          return {
            ok: false,
            reason: 'Access isn’t active for this email. Contact your admin to reactivate.',
          };
        }
      } catch {
        if (!isEmailActive(n)) {
          return {
            ok: false,
            reason: 'Access isn’t active for this email. Contact your admin to reactivate.',
          };
        }
      }
      setSessionEmail(n);
      return { ok: true };
    },
    [isEmailActive, reactivated],
  );

  const signOut = useCallback(() => {
    setSessionEmail(null);
  }, []);

  const isAllowed = !!sessionEmail && isEmailActive(sessionEmail);

  const value = useMemo(
    () => ({
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      signOut,
      isEmailActive,
      refreshCloudAccess,
    }),
    [
      reactivated,
      sessionEmail,
      isAllowed,
      reactivate,
      removeReactivated,
      tryEnter,
      signOut,
      isEmailActive,
      refreshCloudAccess,
    ],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess(): AccessContextValue {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within AccessProvider');
  return ctx;
}
