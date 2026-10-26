import { normalizeEmail } from './types';

/** Demo-only client-side portal credentials — never shown in UI copy. */
const ADMIN_EMAIL = 'eatrade@gmail.com';
const ADMIN_PASSWORD = 'Sfiso';

export function verifyAdminCredentials(email: string, password: string): boolean {
  return normalizeEmail(email) === ADMIN_EMAIL && password === ADMIN_PASSWORD;
}

export function adminPortalEmail(): string {
  return ADMIN_EMAIL;
}
