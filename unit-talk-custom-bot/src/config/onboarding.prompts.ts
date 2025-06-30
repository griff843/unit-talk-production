/**
 * Onboarding Prompts Configuration
 * Contains all the prompts and messages used in the onboarding process
 */

export const ONBOARDING_PROMPTS = {
  // Welcome messages for different user tiers
  WELCOME_MESSAGES: {
    VIP: {
      title: "🎉 Welcome to Unit Talk VIP!",
      description: "You now have access to premium picks, exclusive channels, and priority support. Let's get you started!",
      color: 0xFFD700, // Gold
      fields: [
        {
          name: "🏆 VIP Benefits",
          value: "• Access to all capper picks\n• Exclusive VIP channels\n• Priority customer support\n• Advanced analytics\n• Early access to new features",
          inline: false
        },
        {
          name: "📍 Next Steps",
          value: "1. Check out <#capper-corner> for daily picks\n2. Enable notifications for your favorite cappers\n3. Join the VIP discussion in <#vip-lounge>",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "view_vip_guide",
          label: "VIP Guide",
          style: 1, // Primary
          emoji: "📖"
        },
        {
          customId: "setup_notifications",
          label: "Setup Notifications",
          style: 2, // Secondary
          emoji: "🔔"
        }
      ]
    },
    PREMIUM: {
      title: "✨ Welcome to Unit Talk Premium!",
      description: "You have access to premium features and select capper picks. Welcome to the community!",
      color: 0x9932CC, // Purple
      fields: [
        {
          name: "💎 Premium Benefits",
          value: "• Access to premium capper picks\n• Premium channels access\n• Enhanced support\n• Weekly analytics reports",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "view_premium_guide",
          label: "Premium Guide",
          style: 1,
          emoji: "💎"
        }
      ]
    },
    TRIAL: {
      title: "🚀 Welcome to Unit Talk!",
      description: "Welcome to the Unit Talk community! Start your journey with our expert picks and analysis.",
      color: 0xFFA500, // Orange
      fields: [
        {
          name: "🎯 Getting Started",
          value: "• Check out our FAQ section\n• Browse daily picks in Capper Corner\n• Join community discussions\n• Consider upgrading to VIP for full access",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "view_trial_features",
          label: "Getting Started Guide",
          style: 1,
          emoji: "🎯"
        },
        {
          customId: "upgrade_to_vip",
          label: "Upgrade to VIP",
          style: 3, // Success
          emoji: "⭐"
        }
      ]
    },
    BASIC: {
      title: "👋 Welcome to Unit Talk!",
      description: "Welcome to the Unit Talk community! We're excited to have you here.",
      color: 0x7289DA, // Discord Blue
      fields: [
        {
          name: "🚀 Get Started",
          value: "• Check out our FAQ section\n• Browse community discussions\n• See what VIP members are saying\n• Start your VIP trial for full access to picks!",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "view_faq",
          label: "View FAQ",
          style: 2, // Secondary
          emoji: "❓"
        },
        {
          customId: "start_vip_trial",
          label: "Start VIP Trial",
          style: 3, // Success
          emoji: "🚀"
        }
      ]
    },
    CAPPER: {
      title: "🎯 Welcome UT Capper!",
      description: "You've been granted capper privileges! Time to start submitting picks and building your reputation.",
      color: 0xE67E22, // Orange
      fields: [
        {
          name: "🚀 Getting Started",
          value: "Complete your capper onboarding and start submitting picks to the community!",
          inline: false
        },
        {
          name: "📊 Track Your Performance",
          value: "All your picks are automatically tracked for wins, losses, ROI, and leaderboard rankings.",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "capper_onboard_start",
          label: "Complete Onboarding",
          style: 3, // Success
          emoji: "🎯"
        },
        {
          customId: "capper_guide",
          label: "Capper Guide",
          style: 1, // Primary
          emoji: "📖"
        }
      ]
    },
    STAFF: {
      title: "👮 Welcome Staff Member!",
      description: "You have staff privileges. Welcome to the Unit Talk team!",
      color: 0x00FF00, // Green
      fields: [
        {
          name: "🛡️ Staff Responsibilities",
          value: "• Help moderate the community\n• Assist members with questions\n• Maintain a positive environment\n• Report issues to admins",
          inline: false
        }
      ],
      buttons: [
        {
          customId: "staff_guide",
          label: "Staff Guide",
          style: 1,
          emoji: "📋"
        }
      ]
    }
  }
};

// Updated role names to match actual Discord roles
export const ROLE_NAMES = {
  VIP: "💎 VIP Member",
  VIP_PLUS: "🔱 VIP+ Member", 
  PREMIUM: "Premium",
  BASIC: "🪄 Member",
  TRIAL: "Trial", // This role doesn't exist yet, but keeping for future
  CAPPER: "🎯 UT Capper",
  ADMIN: "🎖️Admin",
  STAFF: "👮 Staff",
  OWNER: "👑 Owner",
  MODERATOR: "🛡️ Moderator"
};

// Onboarding flow configuration
export const ONBOARDING_CONFIG = {
  COOLDOWN_DURATION: 60000, // 1 minute
  MAX_RETRIES: 3,
  TIMEOUT_DURATION: 300000, // 5 minutes
  AUTO_ROLE_ASSIGNMENT: true,
  SEND_WELCOME_DM: true,
  LOG_ONBOARDING_EVENTS: true
};