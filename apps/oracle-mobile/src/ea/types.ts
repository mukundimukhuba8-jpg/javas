export type ExpertAdvisor = {
  id: string;
  name: string;
  /** data: URL or remote URI; null = no custom image yet */
  imageUri: string | null;
  type: 'Standard' | 'Self-host';
  createdAt: string;
  /** Owning mentor portal id — isolates EA pictures per mentor */
  mentorId: string;
};

/** Portal list filter — superadmin (scope null) sees all. */
export function filterEasForMentor(
  eas: ExpertAdvisor[],
  scopeMentorId: string | null,
): ExpertAdvisor[] {
  if (!scopeMentorId) return eas;
  return eas.filter((e) => (e.mentorId || 'legacy') === scopeMentorId);
}
