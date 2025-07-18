import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { ButtonInteraction, TextChannel, EmbedBuilder, Colors } from 'discord.js';
import { logger } from '../utils/logger';

export class ContentButtonHandler {
  async handleContentButton(interaction: ButtonInteraction): Promise<void> {
    const customId = interaction.customId;

    try {
      switch (customId) {
        // Welcome Guide Buttons
        case 'quick_start_general':
          await this.redirectToChannel(interaction, '1288606775121285273', '💬 General Chat', 'Introduce yourself and meet the community!');
          break;
        case 'quick_start_picks':
          await this.redirectToChannel(interaction, '1288596680563753000', '🎯 Free Daily Picks', 'Claim your free picks for today!');
          break;
        case 'quick_start_knowledge':
          await this.redirectToChannel(interaction, '1387198398087561236', '📚 Knowledge Hub', 'Explore guides, strategies, and educational content!');
          break;
        case 'quick_start_checklist':
          await this.redirectToChannel(interaction, '1387144072032157736', '✅ Onboarding Checklist', 'Complete your setup for maximum success!');
          break;

        // Onboarding Checklist Buttons
        case 'checklist_general':
          await this.redirectToChannel(interaction, '1288606775121285273', '💬 General Chat', 'Step 1: Introduce yourself to the community!');
          break;
        case 'checklist_analytics':
          await this.redirectToChannel(interaction, '1387158575515697232', '📊 Analytics Preview', 'See performance tracking in action!');
          break;
        case 'checklist_capper':
          await this.redirectToChannel(interaction, '1387152040328953926', '🎯 Capper Corner Guide', 'Learn how to follow and track expert picks!');
          break;
        case 'checklist_support':
          await this.redirectToChannel(interaction, '1390413374260514977', '🆘 Support', 'Get help from our team anytime!');
          break;

        // Capper Guide Buttons
        case 'capper_corner_browse':
          await this.redirectToChannel(interaction, '1288596108876054559', '🎯 Capper Corner', 'Browse expert capper threads and picks!');
          break;
        case 'capper_analytics':
          await this.redirectToChannel(interaction, '1387158575515697232', '📊 Analytics Preview', 'Track capper performance and your results!');
          break;
        case 'capper_program':
          await this.sendCapperProgramInfo(interaction);
          break;

        // Server Map Buttons
        case 'map_general':
          await this.redirectToChannel(interaction, '1288606775121285273', '💬 General Chat', 'Community hub for discussions and questions!');
          break;
        case 'map_picks':
          await this.redirectToChannel(interaction, '1288596680563753000', '🎯 Free Daily Picks', 'Daily picks available to all members!');
          break;
        case 'map_knowledge':
          await this.redirectToChannel(interaction, '1387198398087561236', '📚 Knowledge Hub', 'Educational resources and strategy guides!');
          break;
        case 'map_support':
          await this.redirectToChannel(interaction, '1390413374260514977', '🆘 Support', 'Direct help from the Unit Talk team!');
          break;

        // Analytics Preview Buttons
        case 'analytics_dashboard':
          await this.sendAnalyticsDashboardInfo(interaction);
          break;
        case 'analytics_leaderboard':
          await this.sendLeaderboardInfo(interaction);
          break;
        case 'analytics_upgrade':
          await this.redirectToChannel(interaction, '1387184046680834140', '⭐ VIP Perks & Rewards', 'Upgrade to unlock advanced analytics!');
          break;

        // VIP Perks Buttons
        case 'vip_upgrade':
          await this.sendVIPUpgradeInfo(interaction);
          break;
        case 'vip_plus_elite':
          await this.sendVIPPlusInfo(interaction);
          break;
        case 'vip_testimonials':
          await this.redirectToChannel(interaction, '1288604565423390782', '🏆 VIP Testimonials', 'See real member wins and success stories!');
          break;
        case 'vip_trial':
          await this.sendTrialInfo(interaction);
          break;

        default:
          await interaction.reply({
            content: '❌ Unknown button interaction.',
            ephemeral: true
          });
      }
    } catch (error) {
      logger.error('Error handling content button:', error);
      await interaction.reply({
        content: '❌ An error occurred while processing your request.',
        ephemeral: true
      });
    }
  }

  private async redirectToChannel(interaction: ButtonInteraction, channelId: string, channelName: string, description: string): Promise<void> {
    const channel = interaction.guild?.channels.cache.get(channelId) as TextChannel;
    
    if (!channel) {
      await interaction.reply({
        content: `❌ Channel not found. Please contact support.`,
        ephemeral: true
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🚀 Redirecting to ${channelName}`)
      .setDescription(
        `${description}\n\n` +
        `**Click the link below to visit the channel:**\n` +
        `<#${channelId}>\n\n` +
        `*This message will disappear in 10 seconds.*`
      )
      .setColor(Colors.Blue)
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendCapperProgramInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🌟 Capper Program Information')
      .setDescription(
        `**Interested in becoming a featured capper at Unit Talk?**\n\n` +
        
        `**Program Benefits:**\n` +
        `• Dedicated capper threads (Picks Only + Q&A)\n` +
        `• Performance tracking and transparent results\n` +
        `• Revenue sharing opportunities\n` +
        `• Direct access to our analytics platform\n` +
        `• Marketing support and community promotion\n\n` +
        
        `**Requirements:**\n` +
        `• Proven track record with documented results\n` +
        `• Commitment to transparency and regular posting\n` +
        `• Professional communication and community engagement\n` +
        `• Compliance with our quality and ethical standards\n\n` +
        
        `**Next Steps:**\n` +
        `Contact our team in <#1390413374260514977> or DM a staff member to discuss your application and provide your track record for review.`
      )
      .setColor('#FF6B35')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - Capper Program' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendAnalyticsDashboardInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📊 Analytics Dashboard Preview')
      .setDescription(
        `**Your Personal Performance Command Center**\n\n` +
        
        `**Current Preview Features:**\n` +
        `• Real-time win/loss tracking\n` +
        `• Basic ROI calculations\n` +
        `• Capper performance summaries\n` +
        `• Recent picks and results\n\n` +
        
        `**VIP Analytics Unlock:**\n` +
        `• Advanced filtering by sport, date, capper\n` +
        `• Historical trend analysis and projections\n` +
        `• Bankroll management tools\n` +
        `• Custom alerts and notifications\n` +
        `• Export capabilities for personal tracking\n\n` +
        
        `**Ready to unlock the full analytics suite?**\n` +
        `Visit <#1387184046680834140> to explore VIP upgrade options!`
      )
      .setColor('#00D4AA')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - Analytics Suite' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendLeaderboardInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Capper Leaderboard System')
      .setDescription(
        `**Transparent Performance Tracking**\n\n` +
        
        `**Current Leaderboard Features:**\n` +
        `• Top performing cappers by win rate\n` +
        `• Recent hot streaks and trends\n` +
        `• Monthly and weekly rankings\n` +
        `• Public performance verification\n\n` +
        
        `**VIP Leaderboard Features:**\n` +
        `• Historical performance data\n` +
        `• Advanced filtering and sorting\n` +
        `• Personal performance comparisons\n` +
        `• Detailed pick-by-pick breakdowns\n` +
        `• Custom timeframe analysis\n\n` +
        
        `**All results are transparent and verified.**\n` +
        `No fake records, no cherry-picking—just real performance data you can trust.`
      )
      .setColor('#FFD700')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - Transparent Results' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendVIPUpgradeInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ VIP Upgrade Information')
      .setDescription(
        `**Ready to unlock the full Unit Talk experience?**\n\n` +
        
        `**VIP Membership Includes:**\n` +
        `• Access to all capper threads and exclusive picks\n` +
        `• Advanced analytics suite with full historical data\n` +
        `• Real-time alerts and notifications\n` +
        `• VIP Lounge access for elite community networking\n` +
        `• Priority support and white-glove onboarding\n` +
        `• Monthly contests, giveaways, and exclusive events\n\n` +
        
        `**Pricing & Plans:**\n` +
        `• Monthly VIP: Contact for current pricing\n` +
        `• Annual VIP: Significant savings with yearly commitment\n` +
        `• VIP+ Elite: Premium tier with AI coaching and advanced features\n\n` +
        
        `**Ready to upgrade?**\n` +
        `Contact our team in <#1390413374260514977> or visit <#1387184046680834140> for detailed pricing and feature comparisons.`
      )
      .setColor('#FFD700')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk VIP - Unlock Your Edge' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendVIPPlusInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP+ Elite - The Ultimate Experience')
      .setDescription(
        `**VIP+ Elite delivers institutional-grade tools and support:**\n\n` +
        
        `**Exclusive VIP+ Features:**\n` +
        `• AI-powered advice and strategy coaching\n` +
        `• Personal performance tracking & portfolio management\n` +
        `• Direct access to Unit Talk leadership\n` +
        `• Private masterclasses and research drops\n` +
        `• Priority upgrades and custom reporting\n` +
        `• Hands-on onboarding and personal consultation\n\n` +
        
        `**Advanced Technology Stack:**\n` +
        `• Institutional-grade data pipelines\n` +
        `• Custom AI models for edge detection\n` +
        `• Real-time market intelligence feeds\n` +
        `• Professional-grade risk management tools\n\n` +
        
        `**VIP+ is limited for exclusivity.**\n` +
        `Contact our team in <#1390413374260514977> to request access and discuss your specific needs.`
      )
      .setColor('#9932CC')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk VIP+ Elite - Institutional Grade' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  private async sendTrialInfo(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 VIP Trial Information')
      .setDescription(
        `**Experience VIP risk-free with our trial program!**\n\n` +
        
        `**Trial Includes:**\n` +
        `• 7-day full VIP access\n` +
        `• All capper threads and exclusive picks\n` +
        `• Complete analytics suite access\n` +
        `• VIP Lounge community access\n` +
        `• Priority support during trial period\n\n` +
        
        `**Trial Requirements:**\n` +
        `• Serious interest in upgrading to VIP\n` +
        `• Active participation in community\n` +
        `• Feedback on VIP experience\n\n` +
        
        `**How to Request:**\n` +
        `Contact our team in <#1390413374260514977> and mention your interest in a VIP trial. Include a brief note about your betting experience and goals.\n\n` +
        
        `*Trials are limited and subject to availability.*`
      )
      .setColor('#00D4AA')
      .setTimestamp()
      .setFooter({ text: 'Unit Talk - VIP Trial Program' });

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }
}