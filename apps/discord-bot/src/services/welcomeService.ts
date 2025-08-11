import {
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
  Colors,
} from 'discord.js';
import { logger } from '../utils/logger';
import { botConfig } from '../config/botConfig';

export class WelcomeService {
  constructor() {
    logger.info('WelcomeService initialized');
  }

  /**
   * Handle new member welcome
   * DISABLED: Now handled by OnboardingService
   */
  public async handleWelcome(member: GuildMember): Promise<void> {
    // Completely disabled - OnboardingService handles all welcome messages
    return;
  }

  /**
   * Determine member tier based on roles
   * This method is kept for reference by other services
   */
  public getMemberTier(member: GuildMember): string {
    try {
      const roles = member.roles.cache;

      // Check roles by name since we don't have role IDs in config
      for (const role of roles.values()) {
        const roleName = role.name.toLowerCase();
        if (roleName.includes('vip+') || roleName.includes('vip plus')) {
          return 'vip_plus';
        }
        if (roleName.includes('vip') && !roleName.includes('vip+')) {
          return 'vip';
        }
      }

      // Default to member if no specific role found
      return 'member';
    } catch (error) {
      logger.error('Error determining member tier:', error);
      return 'member';
    }
  }

  /**
   * Send Free tier welcome message
   */
  public async sendFreeWelcome(member: GuildMember): Promise<void> {
    const embed = this.createFreeWelcomeEmbed(member);
    const buttons = this.createFreeWelcomeButtons();

    await this.sendWelcomeMessage(member, embed, buttons);
  }

  /**
   * Send VIP tier welcome message
   */
  public async sendVIPWelcome(member: GuildMember): Promise<void> {
    const embed = this.createVIPWelcomeEmbed(member);
    const buttons = this.createVIPWelcomeButtons();

    await this.sendWelcomeMessage(member, embed, buttons);
  }

  /**
   * Send VIP+ tier welcome message
   */
  public async sendVIPPlusWelcome(member: GuildMember): Promise<void> {
    const primaryEmbed = this.createVIPPlusWelcomeEmbed(member);
    const secondaryEmbed = this.createVIPPlusTechEmbed(member);
    const buttons = this.createVIPPlusWelcomeButtons();

    // Send primary message first
    await this.sendWelcomeMessage(member, primaryEmbed, buttons);

    // Send secondary tech message after a brief delay
    setTimeout(async () => {
      try {
        await member.send({ embeds: [secondaryEmbed] });
      } catch (error) {
        logger.warn(`Failed to send VIP+ tech message to ${member.user.username}`);
      }
    }, 3000);
  }

  /**
   * Send welcome message
   * DISABLED: Now handled by OnboardingService
   */
  private async sendWelcomeMessage(
    member: GuildMember,
    embed: EmbedBuilder,
    buttons: ActionRowBuilder<ButtonBuilder>
  ): Promise<void> {
    // Completely disabled - OnboardingService handles all welcome messages
    return;
  }

  /**
   * Create Free tier welcome embed
   */
  public createFreeWelcomeEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎉 Welcome to Unit Talk, ${member.user.username}! Your Edge Starts Now`)
      .setDescription(
        `You're now part of a winning community built for smarter sports bettors, aspiring cappers, and fans just like you.\n\n` +
          `**Here's how to get the most out of Unit Talk as a Free Member:**\n\n` +
          `• Claim free daily picks in <#1288596680563753000> (Free Resources)\n` +
          `• Learn smarter strategies in our Knowledge Hub <#1387198398087561236>\n` +
          `• Join the conversation in General Chat <#1288606775121285273>\n` +
          `• Explore all free resources in <#1288596680563753000>\n` +
          `• See all VIP benefits and upgrade options in <#1387184046680834140> inside Exclusive Access <#1288596108876054559>\n\n` +
          `**Next steps:**\n` +
          `• Visit <#1288596680563753000> for today's picks\n` +
          `• Jump into <#1387198398087561236> for tips, guides, and videos\n` +
          `• Say hello or ask a question in <#1288606775121285273>\n` +
          `• Curious about going VIP? All the details, perks, and success stories are in <#1387184046680834140>\n\n` +
          `If you ever need help or want tips on using the server, head to the Info Center or ask in General Chat.\n\n` +
          `**Welcome aboard, ${member.user.username}! Let's build your edge together.**`
      )
      .setColor(Colors.Green)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: 'Unit Talk - Your Edge Starts Now',
        iconURL: member.guild.iconURL() || undefined,
      });
  }

  /**
   * Create VIP tier welcome embed
   */
  public createVIPWelcomeEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🎉 Welcome to VIP, ${member.user.username}! You've Unlocked the Winning Edge`)
      .setDescription(
        `Welcome to the top tier of sports intelligence. As a VIP member, you now have access to the industry's most advanced betting community and resources. Here's how to maximize your membership:\n\n` +
          `• **Unlock Exclusive Capper Streams:**\n` +
          `Access Capper Corner (<#1288596108876054559>) to follow dedicated threads for each of our vetted experts. Each capper maintains two threads—one for high-conviction VIP picks and another for strategy, discussion, and real-time Q&A.\n` +
          `Never miss a winning move: curate your own feed of top-performing cappers, track results, and interact with leaders in the space.\n\n` +
          `• **Real-Time Market Intelligence:**\n` +
          `Dive into VIP Insights (<#1288611956575703120>) for advanced market analysis, line movement alerts, and data-driven trends—exclusively for VIPs.\n\n` +
          `• **Private Networking & Community:**\n` +
          `Connect and collaborate with other elite members and our team in the VIP Lounge (<#1288606775121285273>).\n\n` +
          `• **Guided Growth & Support:**\n` +
          `Explore the Resource Area (<#1387198398087561236>) for exclusive guides, system walkthroughs, and growth tools.\n` +
          `Need help? Our expert support is always live in <#1390413374260514977>.\n\n` +
          `• **Showcase Your Wins:**\n` +
          `Share your big hits and testimonials in <#1288604565423390782>. Celebrate your success and see what's possible as a VIP.\n\n` +
          `**Next steps:**\n` +
          `• Start by subscribing to your favorite cappers in Capper Corner\n` +
          `• Drop an intro in the VIP Lounge and connect with high-level bettors\n` +
          `• Check VIP Insights daily for the sharpest edges\n` +
          `• Post your wins in VIP Testimonials to inspire the community\n\n` +
          `You have the platform, the people, and the edge. **Welcome to the winner's circle, ${member.user.username}.**`
      )
      .setColor(Colors.Gold)
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: 'Unit Talk VIP - The Winning Edge',
        iconURL: member.guild.iconURL() || undefined,
      });
  }

  /**
   * Create VIP+ tier welcome embed
   */
  public createVIPPlusWelcomeEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`💎 Welcome to VIP+ Elite, ${member.user.username} – The Ultimate Edge`)
      .setDescription(
        `You've reached the pinnacle of sports intelligence.\n` +
          `VIP+ gives you direct access to our most advanced picks, real-time AI-powered analysis, and elite support—built for the sharpest minds in betting.\n\n` +
          `**Here's how to unlock your edge:**\n` +
          `• Get high-conviction picks and live strategy in Capper Corner (<#1288596108876054559>)\n` +
          `• Set up custom Elite Alerts and never miss a play\n` +
          `• Explore AI-powered insights and analytics for every pick\n` +
          `• Meet your AI Coach for personalized strategy and growth\n` +
          `• Access VIP+ only events, masterclasses, and white-glove support\n\n` +
          `> *VIP+ is more than access. It's your personal command center for dominating the market.*\n\n` +
          `**Next Steps:**\n` +
          `• **Configure your Elite Alerts** to get notified on every big move\n` +
          `• **Join the VIP+ Lounge** to connect with other elite members and staff\n` +
          `• **Review all VIP+ features and perks** (button below)\n\n` +
          `*You're in the winner's circle. Let's raise your game, ${member.user.username}.*`
      )
      .setColor('#9932CC') // Purple for VIP+
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp()
      .setFooter({
        text: 'Unit Talk VIP+ Elite - The Ultimate Edge',
        iconURL: member.guild.iconURL() || undefined,
      });
  }

  /**
   * Create VIP+ tech/features embed (second message)
   */
  public createVIPPlusTechEmbed(member: GuildMember): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(`🔥 Powering Your VIP+ Edge`)
      .setDescription(
        `Want to see how it all works?\n` +
          `From AI-driven advice to institutional-grade analytics, VIP+ is built with the same systems trusted by professional traders and syndicates.\n\n` +
          `**Curious about the tech, analytics, or security behind your membership?**\n` +
          `• [View Full VIP+ Architecture & Feature Set](<#1387184046680834140>)\n\n` +
          `*All technical details, feature walkthroughs, and data pipelines are available anytime in our [VIP+ Perks & Tech area].*`
      )
      .setColor('#9932CC')
      .setTimestamp()
      .setFooter({
        text: 'Unit Talk VIP+ Elite - Advanced Systems',
        iconURL: member.guild.iconURL() || undefined,
      });
  }

  /**
   * Create Free tier welcome buttons
   */
  public createFreeWelcomeButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('welcome_free_picks')
        .setLabel('🎯 See Free Picks')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('welcome_knowledge_hub')
        .setLabel('📚 Access Knowledge Hub')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('welcome_general_chat')
        .setLabel('💬 Join General Chat')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('welcome_free_resources')
        .setLabel('🆓 Explore Free Resources')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('welcome_vip_perks')
        .setLabel('⭐ View VIP Perks & Upgrade')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Create VIP tier welcome buttons
   */
  public createVIPWelcomeButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('vip_capper_corner')
        .setLabel('🎯 Browse Capper Corner')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('vip_insights')
        .setLabel('📊 VIP Insights Channel')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_lounge')
        .setLabel('👑 VIP Lounge (Community Chat)')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_resources')
        .setLabel('📚 Access Resource Area')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_support')
        .setLabel('🛟 VIP Support')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Create second row of VIP buttons
   */
  private createVIPWelcomeButtonsRow2(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('vip_testimonials')
        .setLabel('🏆 Share Your Wins')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_perks_upgrade')
        .setLabel('⭐ See VIP Perks & Upgrades')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Create VIP+ tier welcome buttons
   */
  public createVIPPlusWelcomeButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('vip_plus_alerts')
        .setLabel('🚨 Configure Elite Alerts')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('vip_plus_ai_coach')
        .setLabel('🤖 Meet Your AI Coach')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_plus_lounge')
        .setLabel('💎 VIP+ Lounge')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('vip_plus_perks')
        .setLabel('⭐ See All Elite Perks & Features')
        .setStyle(ButtonStyle.Success)
    );
  }

  /**
   * Type guard to check if channel is a text channel
   */
  private isTextChannel(channel: any): channel is TextChannel {
    return channel?.type === 0; // TextChannel type is 0
  }

  /**
   * Create FAQ embed for common questions (Free tier)
   */
  public createFAQEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('❓ Frequently Asked Questions')
      .setDescription(
        `**Q: How do I get free picks?**\n` +
          `A: Visit <#1288596680563753000> daily for our expert picks!\n\n` +
          `**Q: What's included in VIP membership?**\n` +
          `A: Check <#1387184046680834140> for all VIP benefits and success stories.\n\n` +
          `**Q: Where can I learn betting strategies?**\n` +
          `A: Our Knowledge Hub <#1387198398087561236> has guides, tips, and educational content.\n\n` +
          `**Q: How do I get help or ask questions?**\n` +
          `A: Jump into General Chat <#1288606775121285273> - our community is here to help!\n\n` +
          `**Q: What makes Unit Talk different?**\n` +
          `A: We focus on building your long-term edge with education, community, and proven strategies.`
      )
      .setColor(Colors.Blue)
      .setTimestamp();
  }

  /**
   * Create VIP FAQ embed
   */
  public createVIPFAQEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('👑 VIP – Quick FAQ')
      .setDescription(
        `**Where do I find VIP picks?**\n` +
          `All picks are in Capper Corner (<#1288596108876054559>). Each expert has threads for official plays and for in-depth discussion/Q&A—just select your favorite and subscribe for is_instant access.\n\n` +
          `**How do I get real-time insights?**\n` +
          `VIP Insights (<#1288611956575703120>) delivers exclusive data, live alerts, and analytics only available to VIP members.\n\n` +
          `**Where can I network and share wins?**\n` +
          `Join the VIP Lounge for live discussion and drop your testimonials in <#1288604565423390782>.\n\n` +
          `**Where's the education?**\n` +
          `All guides, tutorials, and strategy content are organized in the Resource Area (<#1387198398087561236>).\n\n` +
          `**Need support?**\n` +
          `VIP Support (<#1390413374260514977>) is available 24/7.`
      )
      .setColor(Colors.Gold)
      .setTimestamp();
  }
}
