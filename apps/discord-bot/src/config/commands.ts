import { ApplicationCommandPermissionType } from 'discord.js';

export const COMMAND_CONFIG: {
  [key: string]: { enabled: boolean; allowedTiers: string[]; supabaseRequired?: boolean };
} = {
  // Basic Commands
  help: {
    enabled: true,
    allowedTiers: ['all'],
  },
  ping: {
    enabled: true,
    allowedTiers: ['all'],
  },
  stats: {
    enabled: true,
    allowedTiers: ['all'],
    supabaseRequired: true,
  },
  analytics: {
    enabled: true,
    allowedTiers: ['vip', 'vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // Pick Related Commands
  pick: {
    enabled: true,
    allowedTiers: ['all'],
    supabaseRequired: true,
  },
  'enhanced-pick': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  'pick-history': {
    enabled: true,
    allowedTiers: ['all'],
    supabaseRequired: true,
  },
  'pick-coaching': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  portfolio: {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  'pick-result': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  trends: {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // VIP Commands
  'vip-info': {
    enabled: true,
    allowedTiers: ['all'],
  },
  upgrade: {
    enabled: true,
    allowedTiers: ['all'],
  },
  'trial-status': {
    enabled: false, // Disabled as per current setup
    allowedTiers: ['all'],
  },
  'top-plays': {
    enabled: true,
    allowedTiers: ['vip', 'vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // AI and Analysis Commands
  'ask-ai': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
  },
  'heat-signal': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  'edge-tracker': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  'trend-breaker': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },
  'ev-report': {
    enabled: true,
    allowedTiers: ['vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // Alert Commands
  'alerts-setup': {
    enabled: true,
    allowedTiers: ['vip', 'vip_plus', 'black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // Capper Commands
  'capper-onboard': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
    supabaseRequired: true,
  },
  'capper-stats': {
    enabled: true,
    allowedTiers: ['all'],
    supabaseRequired: true,
  },

  // Black Label Commands
  'black-label': {
    enabled: true,
    allowedTiers: ['black_label', 'admin', 'owner'],
    supabaseRequired: true,
  },

  // Admin + Onboarding Commands
  'gen-invite': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
  'setup-onboarding-check': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
  'ops-staff-code': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
    supabaseRequired: true,
  },
  'ops-onboarding-metrics': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
  'test-onboarding': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
  'debug-tier': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
  'start-trial-onboarding': {
    enabled: true,
    allowedTiers: ['admin', 'owner'], // Admin only for testing, can be expanded later
  },
  'simulate-tier': {
    enabled: true,
    allowedTiers: ['admin', 'owner'],
  },
};

export const VIP_PLUS_MARKETING_CONFIG = {
  winRate: '65%', // More realistic win rate
  unitsWeekly: '8-12', // More conservative estimate
  weeklyProfits: '$800-1200', // Based on $100/unit (more realistic)
  price: 'TBD', // VIP+ pricing under development
  features: [
    {
      title: 'Personal AI Coach',
      description: 'Custom strategy optimization powered by advanced analytics',
    },
    {
      title: 'Premium Plays',
      description: 'High-value opportunities vetted by our expert team',
    },
    {
      title: 'Direct Capper Access',
      description: 'Private consultation with professional cappers',
    },
    {
      title: 'Advanced Analytics',
      description: 'Comprehensive market analysis and trend detection',
    },
    {
      title: 'Portfolio Management',
      description: 'Risk-adjusted betting strategies and position sizing',
    },
    {
      title: 'VIP+ Events',
      description: 'Exclusive masterclasses and networking opportunities',
    },
  ],
  memberLimit: 500,
};
