import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';

import { toGuildMember } from '../utils/discordUtils';
import { logger } from '../utils/logger';
import { getUserTier, getTierDisplayName } from '../utils/roleUtils';

export const interactiveTutorial = {
  data: new SlashCommandBuilder()
    .setName('tutorial')
    .setDescription('Start an interactive tutorial to learn about Unit Talk features')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type of tutorial to start')
        .setRequired(false)
        .addChoices(
          { name: 'Getting Started', value: 'getting_started' },
          { name: 'Pick Submission', value: 'pick_submission' },
          { name: 'VIP Features', value: 'vip_features' },
          { name: 'AI Coaching', value: 'ai_coaching' },
          { name: 'Analytics', value: 'analytics' },
          { name: 'Complete Tour', value: 'complete_tour' }
        )
    ),

  async execute(interaction: any) {
    try {
      const tutorialType = interaction.options.getString('type') || 'getting_started';
      const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

      logger.info(
        `Starting tutorial: ${tutorialType} for user ${interaction.user.tag} (tier: ${userTier})`
      );

      await this.startTutorial(interaction, tutorialType, userTier);
    } catch (error) {
      logger.error('Error in interactive tutorial:', error);
      await interaction.reply({
        content: '❌ An error occurred while starting the tutorial. Please try again.',
        ephemeral: true,
      });
    }
  },

  async startTutorial(interaction: any, tutorialType: string, userTier: string) {
    const tutorials = {
      getting_started: this.getGettingStartedTutorial,
      pick_submission: this.getPickSubmissionTutorial,
      vip_features: this.getVIPFeaturesTutorial,
      ai_coaching: this.getAICoachingTutorial,
      analytics: this.getAnalyticsTutorial,
      complete_tour: this.getCompleteTourTutorial,
    };

    const tutorial = tutorials[tutorialType as keyof typeof tutorials];
    if (tutorial) {
      await tutorial.call(this, interaction, userTier);
    } else {
      await this.showTutorialMenu(interaction, userTier);
    }
  },

  async showTutorialMenu(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🎓 Unit Talk Interactive Tutorials')
      .setDescription('Choose a tutorial to learn about Unit Talk features:')
      .addFields(
        { name: '🚀 Getting Started', value: 'Learn the basics of Unit Talk', inline: true },
        { name: '🎯 Pick Submission', value: 'How to submit and manage picks', inline: true },
        { name: '🏆 VIP Features', value: 'Explore VIP and premium features', inline: true },
        { name: '🤖 AI Coaching', value: 'Learn about AI-powered analysis', inline: true },
        { name: '📊 Analytics', value: 'Understanding your performance data', inline: true },
        { name: '🌟 Complete Tour', value: 'Full feature overview', inline: true }
      )
      .setColor('#00D4AA')
      .setFooter({ text: `Your current tier: ${getTierDisplayName(userTier)}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_getting_started')
        .setLabel('🚀 Getting Started')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_pick_submission')
        .setLabel('🎯 Pick Submission')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_vip_features')
        .setLabel('🏆 VIP Features')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_ai_coaching')
        .setLabel('🤖 AI Coaching')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tutorial_analytics')
        .setLabel('📊 Analytics')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tutorial_complete_tour')
        .setLabel('🌟 Complete Tour')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row, row2],
      ephemeral: true,
    });
  },

  async getGettingStartedTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🚀 Getting Started with Unit Talk')
      .setDescription("Welcome to Unit Talk! Let's get you started with the basics.")
      .addFields(
        {
          name: 'Step 1: Your First Command',
          value: 'Try `/help` to see all available commands',
          inline: false,
        },
        {
          name: 'Step 2: Check Your Stats',
          value: 'Use `/stats` to view your performance',
          inline: false,
        },
        {
          name: 'Step 3: Submit a Pick',
          value: 'Try `/pick` to submit your first sports pick',
          inline: false,
        },
        {
          name: 'Step 4: Explore Features',
          value: 'Use `/vip-info` to learn about premium features',
          inline: false,
        }
      )
      .setColor('#00D4AA')
      .setFooter({ text: 'Click the buttons below to continue or try commands' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_try_help')
        .setLabel('Try /help')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_try_stats')
        .setLabel('Try /stats')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_next_pick_submission')
        .setLabel('Next: Pick Submission')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  async getPickSubmissionTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Pick Submission Tutorial')
      .setDescription('Learn how to submit and manage your sports picks.')
      .addFields(
        {
          name: 'Basic Pick Submission',
          value: '`/pick sport:NFL selection:Chiefs -3.5 odds:-110 units:2 confidence:7`',
          inline: false,
        },
        {
          name: 'Enhanced Pick (VIP+)',
          value:
            '`/enhanced-pick sport:NBA selection:Lakers +5.5 odds:+105 units:1 confidence:8 analysis:Strong defensive matchup`',
          inline: false,
        },
        {
          name: 'Managing Picks',
          value: 'Use `/edit-pick` and `/delete-pick` to manage your submissions',
          inline: false,
        },
        {
          name: 'Pick Tracking',
          value: 'All picks are automatically tracked and graded',
          inline: false,
        }
      )
      .setColor('#FF6B35')
      .setFooter({ text: 'Your picks help build your track record' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_try_pick')
        .setLabel('Try /pick')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_try_enhanced_pick')
        .setLabel('Try /enhanced-pick')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tutorial_next_vip_features')
        .setLabel('Next: VIP Features')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  async getVIPFeaturesTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🏆 VIP Features Tutorial')
      .setDescription('Discover the premium features available to VIP members.')
      .addFields(
        {
          name: 'VIP Tier Benefits',
          value: 'Enhanced analytics, community features, premium content',
          inline: false,
        },
        {
          name: 'VIP+ Features',
          value: 'AI coaching, heat signals, advanced analytics',
          inline: false,
        },
        {
          name: 'Black Label',
          value: 'Professional portfolio management and market intelligence',
          inline: false,
        },
        {
          name: 'Current Tier',
          value: `You are currently: **${getTierDisplayName(userTier)}**`,
          inline: false,
        }
      )
      .setColor('#FFD700')
      .setFooter({ text: 'Upgrade to unlock more features' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_vip_info')
        .setLabel('VIP Info')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_upgrade')
        .setLabel('Upgrade')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('tutorial_next_ai_coaching')
        .setLabel('Next: AI Coaching')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  async getAICoachingTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🤖 AI Coaching Tutorial')
      .setDescription('Learn how to use AI-powered betting analysis and coaching.')
      .addFields(
        {
          name: 'AI Analysis',
          value: '`/ask-ai question:Should I bet the over on LeBron James 25.5 points tonight?`',
          inline: false,
        },
        {
          name: 'Personalized Advice',
          value: 'Get analysis based on your betting history and preferences',
          inline: false,
        },
        {
          name: 'Risk Assessment',
          value: 'AI evaluates risk levels and provides recommendations',
          inline: false,
        },
        {
          name: 'Strategy Coaching',
          value: 'Learn betting strategies and bankroll management',
          inline: false,
        }
      )
      .setColor('#9B59B6')
      .setFooter({ text: 'VIP+ and above feature' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_try_ask_ai')
        .setLabel('Try /ask-ai')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_ai_examples')
        .setLabel('AI Examples')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tutorial_next_analytics')
        .setLabel('Next: Analytics')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  async getAnalyticsTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('📊 Analytics Tutorial')
      .setDescription('Learn how to track and analyze your betting performance.')
      .addFields(
        {
          name: 'Personal Stats',
          value: '`/stats` - View your win/loss record and performance',
          inline: false,
        },
        {
          name: 'Performance Analytics',
          value: 'Track ROI, streaks, and sport-specific performance',
          inline: false,
        },
        {
          name: 'Community Analytics',
          value: '`/top-plays` - See top performing picks from community',
          inline: false,
        },
        {
          name: 'Advanced Analytics',
          value: 'VIP+ users get detailed trend analysis and predictions',
          inline: false,
        }
      )
      .setColor('#3498DB')
      .setFooter({ text: 'Data-driven decisions lead to better results' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_try_stats')
        .setLabel('Try /stats')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_try_top_plays')
        .setLabel('Try /top-plays')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('tutorial_complete')
        .setLabel('Complete Tutorial')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  async getCompleteTourTutorial(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🌟 Complete Unit Talk Tour')
      .setDescription('A comprehensive overview of all Unit Talk features.')
      .addFields(
        { name: '🎯 Core Features', value: 'Pick submission, tracking, and grading', inline: true },
        { name: '🏆 Premium Features', value: 'VIP tiers, AI coaching, analytics', inline: true },
        { name: '🤖 AI Integration', value: 'Personalized analysis and coaching', inline: true },
        { name: '📊 Analytics', value: 'Performance tracking and insights', inline: true },
        { name: '🖤 Black Label', value: 'Professional portfolio management', inline: true },
        { name: '🎯 Capper Program', value: 'Share picks and earn revenue', inline: true }
      )
      .setColor('#E74C3C')
      .setFooter({ text: 'Ready to start your Unit Talk journey?' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('tutorial_start_journey')
        .setLabel('Start My Journey')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('tutorial_help')
        .setLabel('Get Help')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('tutorial_vip_info')
        .setLabel('VIP Info')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};

// Export button handler for tutorial interactions
export async function handleTutorialButton(interaction: ButtonInteraction) {
  const customId = interaction.customId;

  try {
    switch (customId) {
      case 'tutorial_getting_started':
        await interactiveTutorial.getGettingStartedTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_pick_submission':
        await interactiveTutorial.getPickSubmissionTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_vip_features':
        await interactiveTutorial.getVIPFeaturesTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_ai_coaching':
        await interactiveTutorial.getAICoachingTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_analytics':
        await interactiveTutorial.getAnalyticsTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_complete_tour':
        await interactiveTutorial.getCompleteTourTutorial(
          interaction,
          getUserTier(await toGuildMember(interaction.member, interaction.guild))
        );
        break;
      case 'tutorial_try_help':
        await interaction.reply({
          content: 'Try typing `/help` to see all available commands!',
          ephemeral: true,
        });
        break;
      case 'tutorial_try_stats':
        await interaction.reply({
          content: 'Try typing `/stats` to view your performance!',
          ephemeral: true,
        });
        break;
      case 'tutorial_try_pick':
        await interaction.reply({
          content:
            'Try typing `/pick sport:NFL selection:Chiefs -3.5 odds:-110 units:2 confidence:7`',
          ephemeral: true,
        });
        break;
      case 'tutorial_vip_info':
        await interaction.reply({
          content: 'Try typing `/vip-info` to learn about VIP benefits!',
          ephemeral: true,
        });
        break;
      case 'tutorial_upgrade':
        await interaction.reply({
          content: 'Try typing `/upgrade` to upgrade your tier!',
          ephemeral: true,
        });
        break;
      case 'tutorial_try_ask_ai':
        await interaction.reply({
          content: "Try typing `/ask-ai question:What's the best strategy for NFL Sunday?`",
          ephemeral: true,
        });
        break;
      case 'tutorial_try_top_plays':
        await interaction.reply({
          content: 'Try typing `/top-plays NFL week` to see top picks!',
          ephemeral: true,
        });
        break;
      case 'tutorial_complete':
        await interaction.update({
          content:
            "🎉 **Tutorial Complete!** You're now ready to use Unit Talk effectively. Use `/help` anytime for assistance!",
          embeds: [],
          components: [],
        });
        break;
      default:
        await interaction.reply({
          content: 'Unknown tutorial action. Use `/tutorial` to start over.',
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error('Error handling tutorial button:', error);
    await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
  }
}
