import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import { normalizeEmail } from './types';

/** Hardcoded superadmin portal identity. */
export const SUPERADMIN_EMAIL = 'eatrade@gmail.com';
/** Stable id for the superadmin portal catalog. */
export const SUPERADMIN_MENTOR_ID = 'superadmin';

export type PortalRole = 'superadmin' | 'mentor';

export type PortalSession = {
  email: string;
  role: PortalRole;
  /** Catalog owner id — mentors are scoped to this; superadmin sees all. */
  mentorId: string;
  name?: string;
};

type PortalSessionContextValue = {
  session: PortalSession | null;
  isSuperadmin: boolean;
  scopeMentorId: string | null;
  signInPortal: (session: PortalSession) => void;
  signOutPortal: () => void;
};

const STORAGE_KEY = 'oracle.portal.session.v1';
const PortalSessionContext = createContext<PortalSessionContextValue | null>(null);

function canUseStorage() {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

function loadSession(): PortalSession | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalSession;
    if (!parsed?.email || !parsed?.mentorId || !parsed?.role) return null;
    return {
      email: normalizeEmail(parsed.email),
      role: parsed.role === 'superadmin' ? 'superadmin' : 'mentor',
      mentorId: parsed.mentorId,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
    };
  } catch {
    return null;
  }
}

function persistSession(session: PortalSession | null) {
  if (!canUseStorage()) return;
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function isSuperadminEmail(email: string): boolean {
  return normalizeEmail(email) === SUPERADMIN_EMAIL;
}

export function PortalSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(() => loadSession());

  const signInPortal = useCallback((next: PortalSession) => {
    const normalized: PortalSession = {
      email: normalizeEmail(next.email),
      role: next.role,
      mentorId: next.mentorId,
      name: next.name,
    };
    persistSession(normalized);
    setSession(normalized);
  }, []);

  const signOutPortal = useCallback(() => {
    persistSession(null);
    setSession(null);
  }, []);

  const value = useMemo<PortalSessionContextValue>(() => {
    const isSuperadmin = session?.role === 'superadmin';
    return {
      session,
      isSuperadmin: Boolean(isSuperadmin),
      /** null ⇒ no filter (superadmin). Mentors get their id. */
      scopeMentorId: !session || session.role === 'superadmin' ? null : session.mentorId,
      signInPortal,
      signOutPortal,
    };
  }, [session, signInPortal, signOutPortal]);

  return (
    <PortalSessionContext.Provider value={value}>{children}</PortalSessionContext.Provider>
  );
}

export function usePortalSession(): PortalSessionContextValue {
  const ctx = useContext(PortalSessionContext);
  if (!ctx) throw new Error('usePortalSession must be used within PortalSessionProvider');
  return ctx;
}
