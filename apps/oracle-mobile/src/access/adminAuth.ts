import { normalizeEmail } from './types';
import {
  fetchCloudPrimary,
  type Mentor,
} from '../cloud/oracleCloud';
import {
  SUPERADMIN_EMAIL,
  SUPERADMIN_MENTOR_ID,
  type PortalSession,
} from './portalSession';

/** Demo-only client-side portal credentials — never shown in UI copy. */
const SUPERADMIN_PASSWORD = 'Sfiso';

export { SUPERADMIN_EMAIL };

export function adminPortalEmail(): string {
  return SUPERADMIN_EMAIL;
}

/** SHA-256 hex; falls back to a deterministic non-crypto marker if SubtleCrypto missing. */
export async function hashPortalPassword(password: string): Promise<string> {
  const payload = `oracle-portal:v1:${password}`;
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const data = new TextEncoder().encode(payload);
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    /* fall through */
  }
  // Weak fallback for non-web test envs — still not plaintext
  let h = 0;
  for (let i = 0; i < payload.length; i += 1) h = (h * 31 + payload.charCodeAt(i)) >>> 0;
  return `fallback_${h.toString(16)}`;
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  return normalizeEmail(email) === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD;
}

export type PortalAuthResult =
  | { ok: true; session: PortalSession }
  | { ok: false; reason: string };

/**
 * Superadmin (hardcoded) or approved mentor with matching password hash.
 */
export async function authenticatePortal(
  email: string,
  password: string,
): Promise<PortalAuthResult> {
  const n = normalizeEmail(email);
  if (!n || !password) {
    return { ok: false, reason: 'Enter email and password.' };
  }

  if (verifyAdminCredentials(n, password)) {
    return {
      ok: true,
      session: {
        email: SUPERADMIN_EMAIL,
        role: 'superadmin',
        mentorId: SUPERADMIN_MENTOR_ID,
        name: 'EA Trade Admin',
      },
    };
  }

  let mentors: Mentor[] = [];
  try {
    const store = await fetchCloudPrimary();
    mentors = store.mentors || [];
  } catch (e) {
    return {
      ok: false,
      reason: e instanceof Error ? e.message : 'Could not reach mentor directory.',
    };
  }

  const mentor = mentors.find((m) => normalizeEmail(m.email || '') === n);
  if (!mentor) {
    return { ok: false, reason: 'Wrong email or password.' };
  }
  if (mentor.status !== 'approved') {
    return {
      ok: false,
      reason:
        mentor.status === 'waiting'
          ? 'Your mentor account is waiting for admin approval.'
          : 'Wrong email or password.',
    };
  }
  if (!mentor.passwordHash) {
    return {
      ok: false,
      reason: 'This mentor has no password on file. Register again or contact admin.',
    };
  }

  const hash = await hashPortalPassword(password);
  if (hash !== mentor.passwordHash) {
    return { ok: false, reason: 'Wrong email or password.' };
  }

  return {
    ok: true,
    session: {
      email: n,
      role: 'mentor',
      mentorId: mentor.id,
      name: mentor.mentorName || mentor.name || n,
    },
  };
}
