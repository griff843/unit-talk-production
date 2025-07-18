import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { ButtonInteraction, EmbedBuilder, Colors } from 'discord.js';
import { WelcomeService } from '../services/welcomeService';
import { logger } from '../utils/logger';

export class WelcomeButtonHandler {
  private welcomeService: WelcomeService;

  constructor() {
    this.welcomeService = new WelcomeService();
    logger.info('WelcomeButtonHandler initialized');
  }

  /**
   * Handle welcome button interactions
   */
  async handleWelcomeButton(interaction: ButtonInteraction): Promise<void> {
    try {
      const customId = interaction.customId;
      
      // Acknowledge the interaction first
      await interaction.deferReply({ ephemeral: true });

      switch (customId) {
        // Free tier buttons
        case 'welcome_free_picks':
          await this.handleFreePicksButton(interaction);
          break;
        case 'welcome_knowledge_hub':
          await this.handleKnowledgeHubButton(interaction);
          break;
        case 'welcome_general_chat':
          await this.handleGeneralChatButton(interaction);
          break;
        case 'welcome_free_resources':
          await this.handleFreeResourcesButton(interaction);
          break;
        case 'welcome_vip_perks':
          await this.handleVIPPerksButton(interaction);
          break;
        case 'welcome_faq':
          await this.handleFAQButton(interaction);
          break;

        // VIP tier buttons
        case 'vip_capper_corner':
          await this.handleVIPCapperCornerButton(interaction);
          break;
        case 'vip_insights':
          await this.handleVIPInsightsButton(interaction);
          break;
        case 'vip_lounge':
          await this.handleVIPLoungeButton(interaction);
          break;
        case 'vip_resources':
          await this.handleVIPResourcesButton(interaction);
          break;
        case 'vip_support':
          await this.handleVIPSupportButton(interaction);
          break;
        case 'vip_testimonials':
          await this.handleVIPTestimonialsButton(interaction);
          break;
        case 'vip_perks_upgrade':
          await this.handleVIPPerksUpgradeButton(interaction);
          break;

        // VIP+ tier buttons
        case 'vip_plus_alerts':
          await this.handleVIPPlusAlertsButton(interaction);
          break;
        case 'vip_plus_ai_coach':
          await this.handleVIPPlusAICoachButton(interaction);
          break;
        case 'vip_plus_lounge':
          await this.handleVIPPlusLoungeButton(interaction);
          break;
        case 'vip_plus_perks':
          await this.handleVIPPlusPerksButton(interaction);
          break;

        default:
          await interaction.editReply({
            content: '❌ Unknown button action. Please try again or contact support.',
          });
      }

    } catch (error) {
      logger.error('Error handling welcome button:', error);
      
      try {
        await interaction.editReply({
          content: '❌ Something went wrong. Please try again or contact support.',
        });
      } catch (replyError) {
        logger.error('Error sending error reply:', replyError);
      }
    }
  }

  // FREE TIER BUTTON HANDLERS

  private async handleFreePicksButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Free Picks - Daily Expert Selections')
      .setDescription(
        `Head over to <#1288596680563753000> for today's free picks!\n\n` +
        `**What you'll find:**\n` +
        `• Daily expert picks across major sports\n` +
        `• Analysis and reasoning behind each pick\n` +
        `• Track record and performance stats\n` +
        `• Community discussion and insights\n\n` +
        `**Pro Tip:** Check back daily for fresh picks and don't miss out on the weekend action!`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleKnowledgeHubButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📚 Knowledge Hub - Learn & Grow')
      .setDescription(
        `Visit <#1387198398087561236> to level up your betting game!\n\n` +
        `**Available Resources:**\n` +
        `• Betting fundamentals and strategy guides\n` +
        `• Bankroll management tutorials\n` +
        `• Market analysis techniques\n` +
        `• Video walkthroughs and tips\n` +
        `• Q&A with experienced bettors\n\n` +
        `**Start Here:** Check the pinned messages for beginner-friendly content!`
      )
      .setColor(Colors.Blue)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleGeneralChatButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💬 General Chat - Join the Community')
      .setDescription(
        `Jump into <#1288606775121285273> and connect with fellow bettors!\n\n` +
        `**Great for:**\n` +
        `• Asking questions and getting help\n` +
        `• Sharing your thoughts on games\n` +
        `• Discussing strategies with the community\n` +
        `• Getting to know other members\n` +
        `• Real-time game discussions\n\n` +
        `**Community Guidelines:** Keep it respectful, helpful, and fun! 🎉`
      )
      .setColor(Colors.Orange)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleFreeResourcesButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🆓 Free Resources - Everything Available to You')
      .setDescription(
        `Explore <#1288596680563753000> for all your free content!\n\n` +
        `**What's Included:**\n` +
        `• Daily free picks and analysis\n` +
        `• Educational content and guides\n` +
        `• Community discussions\n` +
        `• Beginner-friendly resources\n` +
        `• Access to general chat and support\n\n` +
        `**Make the Most of It:** Engage with the community and don't hesitate to ask questions!`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPPerksButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ VIP Perks & Upgrade Information')
      .setDescription(
        `Ready to unlock the full Unit Talk experience? Check out <#1387184046680834140>!\n\n` +
        `**VIP Benefits Include:**\n` +
        `• Exclusive capper picks and analysis\n` +
        `• Real-time market insights and alerts\n` +
        `• Private VIP community access\n` +
        `• Advanced educational content\n` +
        `• Priority support from our team\n` +
        `• Success stories and testimonials\n\n` +
        `**Ready to upgrade?** All the details and pricing are in the channel above!`
      )
      .setColor(Colors.Gold)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleFAQButton(interaction: ButtonInteraction): Promise<void> {
    const faqEmbed = this.welcomeService.createFAQEmbed();
    await interaction.editReply({ embeds: [faqEmbed] });
  }

  // VIP TIER BUTTON HANDLERS

  private async handleVIPCapperCornerButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Capper Corner - Expert Picks & Analysis')
      .setDescription(
        `Welcome to your VIP picks headquarters! Head to <#1288596108876054559>\n\n` +
        `**What You'll Find:**\n` +
        `• Dedicated threads for each vetted capper\n` +
        `• High-conviction VIP picks with detailed analysis\n` +
        `• Real-time strategy discussions and Q&A\n` +
        `• Performance tracking and results\n` +
        `• Direct interaction with expert cappers\n\n` +
        `**Pro Tip:** Subscribe to your favorite cappers' threads to never miss a play!`
      )
      .setColor(Colors.Gold)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPInsightsButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📊 VIP Insights - Market Intelligence')
      .setDescription(
        `Access exclusive market data in <#1288611956575703120>!\n\n` +
        `**Exclusive VIP Content:**\n` +
        `• Advanced market analysis and trends\n` +
        `• Line movement alerts and opportunities\n` +
        `• Data-driven insights and statistics\n` +
        `• Real-time market intelligence\n` +
        `• Professional-grade analytics\n\n` +
        `**Stay Sharp:** Check daily for the latest market edges and opportunities!`
      )
      .setColor(Colors.Purple)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPLoungeButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('👑 VIP Lounge - Elite Community')
      .setDescription(
        `Connect with fellow VIP members in <#1288606775121285273>!\n\n` +
        `**VIP Community Features:**\n` +
        `• Network with other elite members\n` +
        `• Share strategies and insights\n` +
        `• Collaborate on analysis\n` +
        `• Direct access to our expert team\n` +
        `• Private discussions and tips\n\n` +
        `**Get Involved:** Introduce yourself and start building valuable connections!`
      )
      .setColor(Colors.Gold)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPResourcesButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('📚 VIP Resource Area - Advanced Education')
      .setDescription(
        `Unlock advanced content in <#1387198398087561236>!\n\n` +
        `**VIP-Exclusive Resources:**\n` +
        `• Advanced strategy guides and systems\n` +
        `• Detailed market analysis tutorials\n` +
        `• Professional betting methodologies\n` +
        `• Exclusive video content and walkthroughs\n` +
        `• Growth tools and calculators\n\n` +
        `**Level Up:** Use these resources to develop your edge and maximize profits!`
      )
      .setColor(Colors.Blue)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPSupportButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🛟 VIP Support - Expert Help Available')
      .setDescription(
        `Get priority support in <#1390413374260514977>!\n\n` +
        `**VIP Support Benefits:**\n` +
        `• 24/7 expert assistance\n` +
        `• Priority response times\n` +
        `• Personalized help and guidance\n` +
        `• Technical support and troubleshooting\n` +
        `• Strategy consultation\n\n` +
        `**Need Help?** Our team is standing by to assist with any questions or issues!`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPTestimonialsButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🏆 Share Your Wins - VIP Testimonials')
      .setDescription(
        `Celebrate your success in <#1288604565423390782>!\n\n` +
        `**Share Your:**\n` +
        `• Big wins and successful picks\n` +
        `• Profit screenshots and results\n` +
        `• Success stories and testimonials\n` +
        `• Strategies that worked for you\n` +
        `• Inspiration for other members\n\n` +
        `**Inspire Others:** Your wins motivate the entire community and show what's possible!`
      )
      .setColor(Colors.Green)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPPerksUpgradeButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ VIP Perks & Elite Upgrades')
      .setDescription(
        `Explore all your VIP benefits and upgrade options in <#1387184046680834140>!\n\n` +
        `**Current VIP Benefits:**\n` +
        `• Exclusive capper access and picks\n` +
        `• Real-time market insights\n` +
        `• Private community and networking\n` +
        `• Advanced educational resources\n` +
        `• Priority support and assistance\n\n` +
        `**Want Even More?** Check out VIP+ Elite upgrades for the ultimate experience!\n\n` +
        `*Review all your VIP features or explore Elite upgrades anytime.*`
      )
      .setColor(Colors.Gold)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  // VIP+ TIER BUTTON HANDLERS

  private async handleVIPPlusAlertsButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🚨 Configure Elite Alerts - Never Miss a Play')
      .setDescription(
        `Set up your personalized alert system!\n\n` +
        `**Elite Alert Features:**\n` +
        `• Custom notification preferences\n` +
        `• Real-time pick alerts from top cappers\n` +
        `• Market movement notifications\n` +
        `• Personalized strategy alerts\n` +
        `• Priority access to breaking opportunities\n\n` +
        `**Coming Soon:** Advanced alert configuration will be available in your dedicated VIP+ area.\n\n` +
        `**For Now:** Contact VIP+ support in <#1390413374260514977> to customize your alerts!`
      )
      .setColor(Colors.Red)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPPlusAICoachButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('🤖 Meet Your AI Coach - Personalized Strategy')
      .setDescription(
        `Your personal AI betting coach is ready to help!\n\n` +
        `**AI Coach Capabilities:**\n` +
        `• Personalized strategy recommendations\n` +
        `• Real-time analysis and insights\n` +
        `• Performance tracking and optimization\n` +
        `• Custom betting system development\n` +
        `• 24/7 intelligent assistance\n\n` +
        `**Access Your Coach:** Use the \`/ai-coach\` command or visit your VIP+ dashboard.\n\n` +
        `**Pro Tip:** The more you interact, the better your AI coach becomes at helping you win!`
      )
      .setColor(Colors.Purple)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPPlusLoungeButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('💎 VIP+ Lounge - Elite Inner Circle')
      .setDescription(
        `Welcome to the most exclusive community in sports betting!\n\n` +
        `**VIP+ Lounge Features:**\n` +
        `• Direct access to Unit Talk leadership\n` +
        `• Elite member networking and collaboration\n` +
        `• Exclusive events and masterclasses\n` +
        `• Advanced strategy discussions\n` +
        `• White-glove support and consultation\n\n` +
        `**Access:** Your VIP+ Lounge channel will be available shortly. Check <#1387184046680834140> for updates!\n\n` +
        `**For Now:** Connect with other elite members in the main VIP areas.`
      )
      .setColor('#9932CC')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }

  private async handleVIPPlusPerksButton(interaction: ButtonInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle('⭐ All Elite Perks & Features - VIP+ Complete Guide')
      .setDescription(
        `Explore your complete VIP+ Elite experience in <#1387184046680834140>!\n\n` +
        `**Your VIP+ Elite Benefits:**\n` +
        `• AI-powered personal betting coach\n` +
        `• Custom elite alerts and notifications\n` +
        `• Institutional-grade analytics and data\n` +
        `• Direct access to professional systems\n` +
        `• White-glove support and consultation\n` +
        `• Exclusive events and masterclasses\n` +
        `• Advanced technical architecture access\n\n` +
        `**Technical Deep Dive:** All system details, feature walkthroughs, and data pipelines are documented in your perks area.\n\n` +
        `**Questions?** Your dedicated VIP+ support team is available 24/7!`
      )
      .setColor('#9932CC')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
}