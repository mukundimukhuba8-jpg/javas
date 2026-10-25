export type ExpertAdvisor = {
  id: string;
  name: string;
  /** data: URL or remote URI; null = no custom image yet */
  imageUri: string | null;
  type: 'Standard' | 'Self-host';
  createdAt: string;
};
