/** Slim license record — never embed base64 images. */
export type LicenseKey = {
  id: string;
  /** Canonical XXX-XXX-XXX-XXX */
  key: string;
  /** Linked EA id from Create keys */
  eaId: string;
  eaName: string;
  /** Always null in persisted catalog; Home resolves image from EA store */
  eaImageUri: null;
  /** Display alias — same as eaName */
  ea: string;
  user: string;
  plan: string;
  status: 'Active' | 'Expired';
  createdAt: string;
  boundEmail: string | null;
};

export type KeyActivation = {
  email: string;
  key: string;
  activatedAt: string;
  eaId: string;
  eaName: string;
  /** Snapshot optional; prefer live EA image on Home */
  eaImageUri: string | null;
};

export type UnlockedRobot = {
  id: string;
  name: string;
  imageUri: string | null;
  key: string;
};

/** Normalize user-entered keys: trim, uppercase, ignore dashes/spaces/punctuation. */
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

export function generateLicenseKeyCode(): string {
  return `${chunk3()}-${chunk3()}-${chunk3()}-${chunk3()}`;
}

/** Strip images for safe persistence. */
export function toSlimKey(k: LicenseKey): LicenseKey {
  return {
    id: k.id,
    key: normalizeLicenseKey(k.key),
    eaId: k.eaId || '',
    eaName: k.eaName || k.ea || '',
    eaImageUri: null,
    ea: k.eaName || k.ea || '',
    user: k.user || '',
    plan: k.plan || '',
    status: k.status === 'Expired' ? 'Expired' : 'Active',
    createdAt: k.createdAt || new Date().toISOString(),
    boundEmail: k.boundEmail ?? null,
  };
}
