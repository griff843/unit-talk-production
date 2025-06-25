export interface OnboardingConfig {
  flows: {
    member: OnboardingFlowConfig;
    vip: OnboardingFlowConfig;
    vipPlus: OnboardingFlowConfig;
  };
  messages: {
    welcome: OnboardingMessageTemplate;
    preferences: OnboardingMessageTemplate;
    roleAssignment: OnboardingMessageTemplate;
    completion: OnboardingMessageTemplate;
    error: OnboardingMessageTemplate;
  };
  settings: {
    dmRetryAttempts: number;
    dmRetryDelayMinutes: number;
    onboardingTimeoutHours: number;
    adminNotificationChannel: string;
    welcomeChannelFallback: string;
    enableAnalytics: boolean;
    enablePreferenceCollection: boolean;
  };
  preferences: {
    sports: string[];
    notificationLevels: string[];
    experienceLevels: string[];
    bettingStyles: string[];
  };
}

export interface OnboardingFlowConfig {
  id: string;
  name: string;
  description: string;
  targetRole: string;
  isActive: boolean;
  steps: OnboardingStepConfig[];
  triggers: {
    autoStart: boolean;
    requiredRole?: string;
    excludedRoles?: string[];
  };
}

export interface OnboardingStepConfig {
  id: string;
  name: string;
  description: string;
  type: 'message' | 'preference' | 'role' | 'confirmation';
  required: boolean;
  order: number;
  template: string;
  buttons?: OnboardingButtonConfig[];
  validation?: {
    required: boolean;
    minSelections?: number;
    maxSelections?: number;
  };
}

export interface OnboardingButtonConfig {
  id: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
  emoji?: string;
  action: string;
  value?: string;
}

export interface OnboardingMessageTemplate {
  title: string;
  description: string;
  color: number;
  fields?: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  footer?: string;
  thumbnail?: string;
  image?: string;
}

// Default onboarding configuration
export const defaultOnboardingConfig: OnboardingConfig = {
  flows: {
    member: {
      id: 'member_onboarding',
      name: 'Member Onboarding',
      description: 'Standard onboarding flow for new members',
      targetRole: process.env.MEMBER_ROLE_ID || '',
      isActive: true,
      triggers: {
        autoStart: true
      },
      steps: [
        {
          id: 'welcome',
          name: 'Welcome',
          description: 'Welcome new member and explain the process',
          type: 'message',
          required: true,
          order: 1,
          template: `# 🎉 Welcome to Unit Talk!

We're thrilled to have you join our community of successful sports bettors!

## What makes Unit Talk special?
• **Expert Analysis**: Our team provides in-depth analysis for every pick
• **Proven Track Record**: Consistent profits with transparent results  
• **Community Support**: Learn from experienced bettors
• **Real-time Updates**: Get picks and updates as they happen

## Quick Setup (2-3 minutes)
We'll help you personalize your experience to get the most value from our community.

Ready to get started?`,
          buttons: [
            {
              id: 'start',
              label: '🚀 Let\'s Go!',
              style: 'primary',
              action: 'continue'
            },
            {
              id: 'skip',
              label: '⏭️ Skip Setup',
              style: 'secondary',
              action: 'skip'
            }
          ]
        },
        {
          id: 'preferences',
          name: 'Preferences',
          description: 'Collect user preferences for personalization',
          type: 'preference',
          required: false,
          order: 2,
          template: `# 📊 Let's Personalize Your Experience

Help us tailor Unit Talk to your betting style and interests.

## Your Preferences Matter
The more we know about your preferences, the better we can serve you with:
• Relevant picks and analysis
• Customized notifications
• Targeted content and tips

Don't worry - you can always change these later in your profile!`,
          buttons: [
            {
              id: 'sports',
              label: '🏈 Sports',
              style: 'secondary',
              action: 'select_sports',
              emoji: '🏈'
            },
            {
              id: 'notifications',
              label: '🔔 Notifications',
              style: 'secondary',
              action: 'select_notifications',
              emoji: '🔔'
            },
            {
              id: 'experience',
              label: '📈 Experience',
              style: 'secondary',
              action: 'select_experience',
              emoji: '📈'
            },
            {
              id: 'complete',
              label: '✅ All Set',
              style: 'primary',
              action: 'continue'
            }
          ]
        },
        {
          id: 'role_assignment',
          name: 'Role Assignment',
          description: 'Assign member role and explain access',
          type: 'role',
          required: true,
          order: 3,
          template: `# 🎯 You're Almost Ready!

## Member Access Includes:
• **Free Picks Channel**: Daily free picks with analysis
• **General Discussion**: Chat with the community
• **Educational Content**: Learn from our guides and tips
• **Live Updates**: Real-time game updates and results

## Want More?
Consider upgrading to **VIP** or **VIP+** for:
• Premium picks with higher win rates
• Exclusive analysis and insights
• Priority support
• Advanced betting strategies

We'll assign you the **Member** role now so you can start exploring!`,
          buttons: [
            {
              id: 'assign_member',
              label: '👤 Assign Member Role',
              style: 'primary',
              action: 'assign_role',
              value: 'member'
            },
            {
              id: 'learn_vip',
              label: '⭐ Learn About VIP',
              style: 'secondary',
              action: 'show_vip_info'
            }
          ]
        }
      ]
    },
    vip: {
      id: 'vip_onboarding',
      name: 'VIP Onboarding',
      description: 'Enhanced onboarding flow for VIP members',
      targetRole: process.env.VIP_ROLE_ID || '',
      isActive: true,
      triggers: {
        autoStart: true,
        requiredRole: process.env.VIP_ROLE_ID
      },
      steps: [
        {
          id: 'vip_welcome',
          name: 'VIP Welcome',
          description: 'Welcome VIP member with exclusive benefits',
          type: 'message',
          required: true,
          order: 1,
          template: `# 🌟 Welcome to VIP, Champion!

Thank you for upgrading to **VIP** - you've made an excellent investment in your betting success!

## Your VIP Benefits:
• **Premium Picks**: Higher value picks with detailed analysis
• **VIP-Only Channels**: Exclusive discussions and insights  
• **Priority Support**: Direct access to our expert team
• **Advanced Strategies**: Learn professional betting techniques
• **Early Access**: Get picks before general members
• **Monthly Reports**: Detailed performance analytics

## VIP Channels You Now Have Access To:
• 🔥 **#vip-picks** - Premium daily picks
• 💬 **#vip-general** - VIP member discussions
• 📊 **#vip-analysis** - In-depth game breakdowns
• 🎯 **#vip-strategies** - Advanced betting methods

Let's get you set up for maximum success!`,
          buttons: [
            {
              id: 'explore_vip',
              label: '🚀 Explore VIP Features',
              style: 'primary',
              action: 'continue'
            }
          ]
        },
        {
          id: 'vip_preferences',
          name: 'VIP Preferences',
          description: 'Enhanced preference collection for VIP members',
          type: 'preference',
          required: false,
          order: 2,
          template: `# 🎯 VIP Personalization

As a VIP member, we want to ensure you get maximum value from every feature.

## Enhanced Customization:
• **Bankroll Management**: Set your betting unit size
• **Risk Tolerance**: Configure your preferred bet types
• **Notification Timing**: When do you want to receive picks?
• **Analysis Depth**: How detailed should our breakdowns be?

Your preferences help us deliver exactly what you need, when you need it.`,
          buttons: [
            {
              id: 'bankroll',
              label: '💰 Bankroll',
              style: 'secondary',
              action: 'set_bankroll'
            },
            {
              id: 'risk',
              label: '⚖️ Risk Level',
              style: 'secondary',
              action: 'set_risk'
            },
            {
              id: 'timing',
              label: '⏰ Timing',
              style: 'secondary',
              action: 'set_timing'
            },
            {
              id: 'vip_complete',
              label: '✅ Ready to Win',
              style: 'primary',
              action: 'continue'
            }
          ]
        }
      ]
    },
    vipPlus: {
      id: 'vip_plus_onboarding',
      name: 'VIP+ Onboarding',
      description: 'Premium onboarding flow for VIP+ members',
      targetRole: process.env.VIP_PLUS_ROLE_ID || '',
      isActive: true,
      triggers: {
        autoStart: true,
        requiredRole: process.env.VIP_PLUS_ROLE_ID
      },
      steps: [
        {
          id: 'vip_plus_welcome',
          name: 'VIP+ Welcome',
          description: 'Welcome VIP+ member with premium benefits',
          type: 'message',
          required: true,
          order: 1,
          template: `# 💎 Welcome to VIP+ Elite!

You've joined the **highest tier** of Unit Talk - welcome to the elite circle of professional bettors!

## Your VIP+ Elite Benefits:
• **Exclusive Picks**: Our highest confidence plays
• **Personal Consultation**: One-on-one strategy sessions
• **Custom Analysis**: Personalized pick explanations
• **Live Chat Access**: Direct line to our experts during games
• **Advanced Tools**: Bankroll calculators and tracking
• **Monthly Strategy Calls**: Group calls with our head analyst
• **First Access**: Get everything before anyone else

## VIP+ Exclusive Channels:
• 💎 **#vip-plus-picks** - Our absolute best plays
• 🏆 **#vip-plus-elite** - Elite member discussions
• 📞 **#vip-plus-support** - Direct expert access
• 🎯 **#vip-plus-strategies** - Professional techniques
• 📊 **#vip-plus-analytics** - Advanced data insights

You're now part of an exclusive group of serious bettors. Let's maximize your edge!`,
          buttons: [
            {
              id: 'elite_setup',
              label: '💎 Elite Setup',
              style: 'primary',
              action: 'continue'
            },
            {
              id: 'schedule_consultation',
              label: '📞 Schedule Consultation',
              style: 'secondary',
              action: 'schedule_call'
            }
          ]
        }
      ]
    }
  },
  messages: {
    welcome: {
      title: '🎉 Welcome to Unit Talk!',
      description: 'We\'re excited to have you join our community of successful bettors.',
      color: 0x00AE86,
      fields: [
        {
          name: '🎯 Our Mission',
          value: 'Help you make profitable betting decisions with expert analysis and proven strategies.',
          inline: false
        }
      ],
      footer: 'Unit Talk - Your Betting Edge'
    },
    preferences: {
      title: '📊 Personalize Your Experience',
      description: 'Help us tailor Unit Talk to your betting style and preferences.',
      color: 0x3498DB,
      footer: 'Your preferences can be changed anytime'
    },
    roleAssignment: {
      title: '🎯 Role Assignment',
      description: 'We\'ll assign you the appropriate role based on your membership level.',
      color: 0x9B59B6,
      footer: 'Roles determine your channel access'
    },
    completion: {
      title: '🎉 Welcome to the Team!',
      description: 'Your onboarding is complete. You\'re ready to start winning!',
      color: 0x27AE60,
      fields: [
        {
          name: '🚀 What\'s Next?',
          value: 'Explore your channels, check out today\'s picks, and join the conversation!',
          inline: false
        }
      ],
      footer: 'Happy betting!'
    },
    error: {
      title: '⚠️ Onboarding Issue',
      description: 'We encountered an issue during your setup process.',
      color: 0xE74C3C,
      fields: [
        {
          name: '🔧 What can you do?',
          value: '• Try again in a few minutes\n• Contact an administrator\n• Use the `/help` command',
          inline: false
        }
      ],
      footer: 'We apologize for the inconvenience'
    }
  },
  settings: {
    dmRetryAttempts: 3,
    dmRetryDelayMinutes: 5,
    onboardingTimeoutHours: 24,
    adminNotificationChannel: process.env.ADMIN_CHANNEL_ID || '',
    welcomeChannelFallback: process.env.WELCOME_CHANNEL_ID || '',
    enableAnalytics: true,
    enablePreferenceCollection: true
  },
  preferences: {
    sports: [
      'NFL', 'NBA', 'MLB', 'NHL', 'NCAA Football', 'NCAA Basketball',
      'Soccer', 'Tennis', 'Golf', 'UFC/MMA', 'Boxing', 'Formula 1'
    ],
    notificationLevels: [
      'All Picks', 'High Confidence Only', 'VIP+ Only', 'Minimal'
    ],
    experienceLevels: [
      'Beginner', 'Intermediate', 'Advanced', 'Professional'
    ],
    bettingStyles: [
      'Conservative', 'Moderate', 'Aggressive', 'High Volume', 'Selective'
    ]
  }
};

export default defaultOnboardingConfig;