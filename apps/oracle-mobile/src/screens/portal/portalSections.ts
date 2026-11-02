export type PortalSectionId =
  | 'dashboard'
  | 'create-keys'
  | 'manage-keys'
  | 'expert-adviser'
  | 'profile'
  | 'commission'
  | 'reactivate-email'
  | 'affiliate-program'
  | 'manage-users'
  | 'affiliates'
  | 'subscription'
  | 'reactivate-license'
  | 'keys-analytics';

export type PortalMenuItem = {
  id: PortalSectionId;
  title: string;
  subtitle: string;
  icon:
    | 'grid-outline'
    | 'key-outline'
    | 'hardware-chip-outline'
    | 'mail-outline'
    | 'git-network-outline'
    | 'people-outline'
    | 'briefcase-outline'
    | 'card-outline'
    | 'refresh-outline'
    | 'stats-chart-outline'
    | 'person-outline'
    | 'cash-outline'
    | 'list-outline';
  /** Mentor menu: show as disabled stub */
  comingSoon?: boolean;
};

/** Mentor portal — only these six items. */
export const MENTOR_PORTAL_MENU: PortalMenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Your key stats',
    icon: 'grid-outline',
  },
  {
    id: 'expert-adviser',
    title: 'Create EA',
    subtitle: 'Expert advisors',
    icon: 'hardware-chip-outline',
  },
  {
    id: 'manage-keys',
    title: 'Manage license keys',
    subtitle: 'Search, copy, delete',
    icon: 'list-outline',
  },
  {
    id: 'create-keys',
    title: 'Generate license keys',
    subtitle: 'Issue new keys',
    icon: 'key-outline',
  },
  {
    id: 'profile',
    title: 'Profile',
    subtitle: 'Your mentor account',
    icon: 'person-outline',
  },
  {
    id: 'commission',
    title: 'Commission',
    subtitle: '(coming soon)',
    icon: 'cash-outline',
    comingSoon: true,
  },
];

/** Superadmin keeps the full portal. */
export const SUPERADMIN_PORTAL_MENU: PortalMenuItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Overview & health',
    icon: 'grid-outline',
  },
  {
    id: 'create-keys',
    title: 'Create keys',
    subtitle: 'Issue license keys',
    icon: 'key-outline',
  },
  {
    id: 'manage-keys',
    title: 'Manage license keys',
    subtitle: 'Search, copy, delete',
    icon: 'list-outline',
  },
  {
    id: 'expert-adviser',
    title: 'EXPERT ADVISER',
    subtitle: 'EA builds & deploy',
    icon: 'hardware-chip-outline',
  },
  {
    id: 'reactivate-email',
    title: 'Reactivate email',
    subtitle: 'Resend activation',
    icon: 'mail-outline',
  },
  {
    id: 'affiliate-program',
    title: 'Affiliate program',
    subtitle: 'Commissions & links',
    icon: 'git-network-outline',
  },
  {
    id: 'manage-users',
    title: 'Manage mentors',
    subtitle: 'Approve & key quotas',
    icon: 'people-outline',
  },
  {
    id: 'affiliates',
    title: 'Affiliates',
    subtitle: 'Partner roster',
    icon: 'briefcase-outline',
  },
  {
    id: 'subscription',
    title: 'Subscription',
    subtitle: 'Paid · awaiting approval',
    icon: 'card-outline',
  },
  {
    id: 'reactivate-license',
    title: 'Reactivate license key',
    subtitle: 'Unlock expired keys',
    icon: 'refresh-outline',
  },
  {
    id: 'keys-analytics',
    title: 'Keys analytics',
    subtitle: 'Usage & conversion',
    icon: 'stats-chart-outline',
  },
];

/** @deprecated use MENTOR_PORTAL_MENU / SUPERADMIN_PORTAL_MENU */
export const PORTAL_MENU = SUPERADMIN_PORTAL_MENU;
