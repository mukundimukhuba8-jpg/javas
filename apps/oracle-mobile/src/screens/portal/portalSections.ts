export type PortalSectionId =
  | 'dashboard'
  | 'create-keys'
  | 'expert-adviser'
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
    | 'stats-chart-outline';
};

export const PORTAL_MENU: PortalMenuItem[] = [
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
