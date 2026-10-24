export type ExpertAdvisor = {
  id: string;
  name: string;
  /** data: URL or remote URI; null = use built-in Oracle hero */
  imageUri: string | null;
  type: 'Standard' | 'Self-host';
  createdAt: string;
  isDefault?: boolean;
};

export const DEFAULT_ORACLE_ID = 'default-the-oracle';

export function createDefaultOracle(): ExpertAdvisor {
  return {
    id: DEFAULT_ORACLE_ID,
    name: 'THE ORACLE',
    imageUri: null,
    type: 'Standard',
    createdAt: new Date(0).toISOString(),
    isDefault: true,
  };
}
