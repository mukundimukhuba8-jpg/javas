/** Design tokens sampled from the Oracle home reference screenshot. */
export const colors = {
  background: '#000000',
  cardFill: '#05070F',
  actionRow: '#080B1A',
  addRobotFill: '#0E1B3D',
  navFill: '#0E101F',
  homeActiveBg: '#272938',
  neon: '#6AA0F8',
  neonBright: '#6AA0F8',
  neonMuted: '#3D5F99',
  textPrimary: '#FFFFFF',
  textMuted: '#8A93A8',
  textSub: '#7B8BA8',
  divider: '#4A7AD4',
  redDot: '#FF4D4D',
  iconFrame: '#121526',
  plusCircle: '#1A4FBF',
} as const;

export const radii = {
  card: 28,
  pill: 999,
  iconFrame: 12,
  homeActive: 14,
} as const;

export const spacing = {
  screenH: 20,
  screenTop: 12,
  gapCardToAdd: 18,
  gapAddToNav: 18,
  navBottom: 12,
} as const;
