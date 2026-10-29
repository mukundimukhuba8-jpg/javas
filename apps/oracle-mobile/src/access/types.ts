export type ReactivatedEmail = {
  email: string;
  paid: boolean;
  reactivatedAt: string;
  status: 'active';
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
