export type LicenseKey = {
  id: string;
  /** Canonical XXX-XXX-XXX-XXX */
  key: string;
  /** Linked EA id from Create keys — required for Activate → Home branding */
  eaId: string;
  eaName: string;
  eaImageUri: string | null;
  /** @deprecated display alias — same as eaName */
  ea: string;
  user: string;
  plan: string;
  status: 'Active' | 'Expired';
  createdAt: string;
  /** Email that activated this key, if any */
  boundEmail: string | null;
};

export type KeyActivation = {
  email: string;
  key: string;
  activatedAt: string;
  eaId: string;
  eaName: string;
  eaImageUri: string | null;
};

/** Robot unlocked for Home after Activate. */
export type UnlockedRobot = {
  id: string;
  name: string;
  imageUri: string | null;
  key: string;
};

/** Normalize user-entered keys to uppercase dashed form for comparison. */
export function normalizeLicenseKey(raw: string): string {
  const compact = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (compact.length !== 12) {
    const parts = compact.match(/.{1,3}/g) ?? [];
    return parts.join('-');
  }
  return `${compact.slice(0, 3)}-${compact.slice(3, 6)}-${compact.slice(6, 9)}-${compact.slice(9, 12)}`;
}

const KEY_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function chunk3(): string {
  let out = '';
  for (let i = 0; i < 3; i += 1) {
    out += KEY_CHARS[Math.floor(Math.random() * KEY_CHARS.length)];
  }
  return out;
}

/** Create a new key in XXX-XXX-XXX-XXX format. */
export function generateLicenseKeyCode(): string {
  return `${chunk3()}-${chunk3()}-${chunk3()}-${chunk3()}`;
}
