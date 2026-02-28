import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import { OnboardingService } from '../services/onboardingService';
import { UserTier } from '../types';
import { getTierColor, getTierEmoji as getTierEmojiFromUtils } from '../utils/roleUtils';

// Define the command with EXACT tier mappings from .env and OnboardingService
export const data = new SlashCommandBuilder()
  .setName('test-onboarding')
  .setDescription('Test onboarding sequences - preview EXACT journey for each tier/user type')
  .addStringOption(option =>
    option
      .setName('journey')
      .setDescription('Which EXACT journey to preview (matches determineUserType logic)')
      .setRequired(false)
      .addChoices(
        // EXACT User Types from OnboardingService.determineUserType()
        { name: '🎩 Trial Member (WHY Discovery)', value: 'trial' },
        { name: '🏆 Capper/Expert Professional', value: 'capper' },
        { name: '🛡️ Admin/Staff/Moderator', value: 'admin' },
        { name: '👑 VIP Member', value: 'vip' },
        { name: '💎 VIP+ Elite Member', value: 'vip_plus' },
        { name: '🎉 Free/Default Member', value: 'free' },
        // WHY Motivations (personalized trial journeys)
        { name: '💸 WHY: Stop Losing Money', value: 'why_losing_money' },
        { name: '🧠 WHY: Need Better Analysis', value: 'why_need_analysis' },
        { name: '📚 WHY: Learn Strategy', value: 'why_learn_strategy' },
        { name: '🤝 WHY: Find Community', value: 'why_community' },
        { name: '💰 WHY: Profit System', value: 'why_profit_system' },
        { name: '⭐ WHY: Expert Picks', value: 'why_expert_picks' }
      )
  )
  .addBooleanOption(option =>
    option
      .setName('send_dm')
      .setDescription('Send as actual DM to mimic EXACT user experience')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('test_mode')
      .setDescription('Use test mode for immediate delivery (matches real onboarding)')
      .setRequired(false)
  );

/**
 * Test onboarding sequences for different journeys including WHY motivations
 */
export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Initialize services (same pattern as start-trial-onboarding)
    const { DMService } = await import('../services/dmService');
    const dmService = new DMService(interaction.client, null as any);
    const onboardingService = new OnboardingService(interaction.client, dmService);
    const journey = interaction.options.getString('journey') || 'trial';
    const sendDM = interaction.options.getBoolean('send_dm') || false;
    const testMode = interaction.options.getBoolean('test_mode') || true; // Default to test mode for previews

    console.log(
      `[TEST-ONBOARDING] Testing journey: ${journey}, sendDM: ${sendDM}, testMode: ${testMode}`
    );

    // Handle WHY motivation journeys (these are personalized trial experiences)
    if (journey.startsWith('why_')) {
      await previewWhyJourney(interaction, journey, sendDM, testMode, onboardingService);
      return;
    }

    // EXACT tier mapping - using same values that determineUserType() returns
    // 'trial', 'capper', 'admin', 'vip', 'vip_plus', 'free'
    const tier = journey;

    if (!sendDM) {
      // Show preview in channel with EXACT journey details
      await showJourneyPreview(interaction, tier, onboardingService);
    } else {
      // MIMIC EXACT USER EXPERIENCE - send actual onboarding via DM
      console.log(`[TEST-ONBOARDING] Mimicking EXACT ${tier} user journey`);
      await onboardingService.handleUserOnboarding(interaction.user, tier, testMode);

      await interaction.editReply({
        content:
          `✅ **${getTierDisplay(tier)} onboarding started!**\n\n` +
          `🎯 **This is the EXACT same journey a real ${tier} user receives.**\n` +
          `Check your DMs for the authentic ${tier} experience.\n\n` +
          `Test mode: ${testMode ? 'ON (immediate delivery)' : 'OFF (normal delays with real timing)'}`,
      });
    }
  } catch (error) {
    console.error('Error in test-onboarding command:', error);
    await interaction.editReply({
      content:
        '❌ An error occurred while testing the onboarding sequence. Check logs for details.',
    });
  }
}

/**
 * Preview a WHY motivation journey
 */
async function previewWhyJourney(
  interaction: ChatInputCommandInteraction,
  journey: string,
  sendDM: boolean,
  testMode: boolean,
  onboardingService: any
): Promise<void> {
  const motivation = journey.replace('why_', '');

  const motivationInfo = {
    losing_money: {
      theme: '💸 Stop Losing, Start Winning',
      color: '#DC143C',
      day1: 'profit protection and edge systems',
      day2: 'bankroll management and smart betting',
      day5: 'consistent profits and loss prevention',
      testimonial: 'I was losing $500/month. Now up $2,100 in 3 months.',
      firstAction: 'Ask "What\'s the biggest mistake losing bettors make?"',
      lose: 'Back to losing money with random betting',
      keep: 'Permanent edge protection and profit strategies',
    },
    need_analysis: {
      theme: '🧠 Institutional-Grade Intelligence',
      color: '#4169E1',
      day1: 'advanced analytics and data insights',
      day2: 'analysis frameworks and tools',
      day5: 'sophisticated betting intelligence',
      testimonial: 'The analysis here is next level.',
      firstAction: 'Ask "How does your edge scoring system work?"',
      lose: 'Back to betting blind without insights',
      keep: 'Unlimited algorithm analysis and intelligence',
    },
    learn_strategy: {
      theme: '📚 Betting Education Mastery',
      color: '#228B22',
      day1: 'learning paths and expert guidance',
      day2: 'strategy development and skill building',
      day5: 'advanced betting strategies',
      testimonial: 'Went from beginner to confident in 2 months.',
      firstAction: 'Ask "What\'s the first strategy every bettor learns?"',
      lose: 'Back to guessing without strategies',
      keep: 'Complete strategy education and mentoring',
    },
    community: {
      theme: '🤝 Elite Betting Community',
      color: '#FF8C00',
      day1: 'community connections and discussions',
      day2: 'member interactions and networking',
      day5: 'exclusive community benefits',
      testimonial: 'Found my betting family here.',
      firstAction: 'Introduce yourself in VIP chat',
      lose: 'Back to betting alone without support',
      keep: 'Lifetime elite community membership',
    },
    profit_system: {
      theme: '💰 Consistent Profit Engine',
      color: '#32CD32',
      day1: 'systematic profit generation',
      day2: 'profit optimization and scaling',
      day5: 'long-term wealth building',
      testimonial: '8 profitable months in a row following the system.',
      firstAction: 'Ask "How do I build a systematic approach?"',
      lose: 'Back to inconsistent results',
      keep: 'Full systematic profit framework',
    },
    expert_picks: {
      theme: '⭐ Expert Capper Network',
      color: '#8A2BE2',
      day1: 'expert picks and capper insights',
      day2: 'capper analysis and reasoning',
      day5: 'premium expert intelligence',
      testimonial: '73% win rate following expert picks.',
      firstAction: 'Use /capper-stats to see top performers',
      lose: 'Back to amateur picks',
      keep: 'Unlimited expert capper access',
    },
  };

  const info = motivationInfo[motivation] || motivationInfo['losing_money'];

  if (sendDM) {
    // Actually send the personalized journey
    await onboardingService.createMotivationDrivenSequence(interaction.user, motivation);

    await interaction.editReply({
      content:
        `✅ **${info.theme} Journey Started!**\n\n` +
        `Check your DMs for your personalized 7-day experience.\n` +
        `This is the exact journey users get when they select "${info.theme}".\n\n` +
        `Test mode: ${testMode ? 'ON (immediate delivery)' : 'OFF (normal delays)'}`,
    });
  } else {
    // Show preview
    const embed = new EmbedBuilder()
      .setColor(info.color)
      .setTitle(`🎩 Preview: ${info.theme}`)
      .setDescription(
        `**This is what users who select this WHY receive:**\n\n` +
          `Their entire 7-day experience focuses on: **${motivation.replace(/_/g, ' ')}**`
      )
      .addFields(
        {
          name: '📅 Day 1 - Personalized Welcome',
          value:
            `• Theme: "${info.theme}"\n` +
            `• Focus: ${info.day1}\n` +
            `• First Action: ${info.firstAction}\n` +
            `• Color: ${info.color}`,
          inline: false,
        },
        {
          name: '📅 Day 2 - Deep Dive',
          value:
            `• Focus: ${info.day2}\n` +
            `• Testimonial: "${info.testimonial}"\n` +
            `• Personalized next steps for their goal`,
          inline: false,
        },
        {
          name: '📅 Day 5 - Conversion',
          value:
            `• Focus: ${info.day5}\n` +
            `• What they lose: ${info.lose}\n` +
            `• What they keep: ${info.keep}\n` +
            `• Special 25% off for 3 months`,
          inline: false,
        }
      )
      .setFooter({ text: `Unit Talk Concierge • ${info.theme}` })
      .setTimestamp();

    await interaction.editReply({
      content: `**Preview Mode** - Use \`send_dm:true\` to actually receive this journey`,
      embeds: [embed],
    });
  }
}

/**
 * Show journey preview for regular user types - EXACT mapping to OnboardingService sequences
 */
async function showJourneyPreview(
  interaction: ChatInputCommandInteraction,
  tier: string,
  onboardingService: any
): Promise<void> {
  // EXACT tier info matching OnboardingService.determineUserType() and sequence creation
  const tierInfo = {
    trial: {
      title: '🎩 Trial Member - WHY Discovery',
      description: 'EXACT journey: Personal WHY discovery → Personalized 7-day experience',
      content:
        '• WHY discovery screen with 6 motivation buttons\n• Each button creates unique personalized journey\n• 7-day progressive engagement sequence\n• Unit Talk Concierge branding\n• Motivation-driven content (losing money, analysis, strategy, etc.)',
      flow: 'createPersonalizedTrialDiscovery() → WHY selection → motivation-driven sequence',
    },
    capper: {
      title: '🏆 Capper/Expert Professional',
      description: 'EXACT journey: Professional onboarding for verified cappers/experts',
      content:
        '• Welcome to capper network\n• Dashboard access and training\n• Performance tracking setup\n• Commission structure overview\n• Professional tools and resources',
      flow: 'createCapperSequence() → professional welcome → tools setup',
    },
    admin: {
      title: '🛡️ Admin/Staff/Moderator',
      description: 'EXACT journey: Administrative access and system overview',
      content:
        '• Administrative welcome\n• System controls overview\n• User management tools\n• Moderation capabilities\n• Staff resources and guidelines',
      flow: 'createAdminSequence() → admin tools → management overview',
    },
    vip: {
      title: '👑 VIP Member',
      description: 'EXACT journey: VIP tier features and premium benefits',
      content:
        '• VIP welcome experience\n• Premium channel access\n• Enhanced features overview\n• Priority support setup\n• VIP community introduction',
      flow: 'createVIPSequence() → premium features → community access',
    },
    vip_plus: {
      title: '💎 VIP+ Elite Member',
      description: 'EXACT journey: Ultimate tier with all premium features',
      content:
        '• VIP+ elite welcome\n• Algorithm picks access\n• Whale tracking features\n• Personal coaching setup\n• Exclusive intelligence access',
      flow: 'createVIPPlusSequence() → elite features → personal services',
    },
    free: {
      title: '🎉 Free/Default Member',
      description: 'EXACT journey: Community welcome and upgrade introduction',
      content:
        '• Community welcome\n• Server navigation guide\n• Free picks access\n• Feature overview\n• Upgrade path presentation',
      flow: 'createFreeSequence() → community intro → upgrade options',
    },
  };

  const info = tierInfo[tier] || tierInfo['free'];

  const embed = new EmbedBuilder()
    .setColor(getTierColor(tier as UserTier))
    .setTitle(`EXACT Preview: ${info.title}`)
    .setDescription(info.description)
    .addFields(
      {
        name: '🎯 Exact Journey Content',
        value: info.content,
        inline: false,
      },
      {
        name: '⚙️ OnboardingService Flow',
        value: `\`${info.flow}\``,
        inline: false,
      },
      {
        name: '🔍 How to Test EXACT Experience',
        value: 'Use `send_dm:true` to receive the identical DM sequence that real users get',
        inline: false,
      }
    )
    .setFooter({
      text: `Unit Talk ${tier.toUpperCase()} Onboarding Preview | Matches Production Logic`,
    })
    .setTimestamp();

  await interaction.editReply({
    content:
      `**🎯 EXACT PREVIEW MODE** - This shows what ${tier} users actually receive\n` +
      `Use \`send_dm:true\` to get the authentic experience in your DMs`,
    embeds: [embed],
  });
}

function getTierDisplay(tier: string): string {
  // EXACT display names matching OnboardingService.determineUserType() return values
  const displays = {
    trial: '🎩 Trial Member',
    capper: '🏆 Capper/Expert Professional',
    admin: '🛡️ Admin/Staff/Moderator',
    vip: '👑 VIP Member',
    vip_plus: '💎 VIP+ Elite Member',
    free: '🎉 Free/Default Member',
  };
  return displays[tier] || `${tier} Member`;
}
