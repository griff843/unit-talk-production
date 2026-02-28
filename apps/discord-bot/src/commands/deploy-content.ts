import {
  CommandInteraction,
  ButtonInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';

import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('deploy-content')
  .setDescription('Deploy professional content embeds to designated channels')
  .addStringOption(option =>
    option
      .setName('section')
      .setDescription('Which content section to deploy')
      .setRequired(true)
      .addChoices(
        { name: 'Welcome & Quick Start Guide', value: 'welcome_guide' },
        { name: 'Onboarding Checklist', value: 'onboarding_checklist' },
        { name: 'Capper Corner Guide', value: 'capper_guide' },
        { name: 'Server Map', value: 'server_map' },
        { name: 'Analytics Preview', value: 'analytics_preview' },
        { name: 'VIP Perks & Rewards', value: 'vip_perks' },
        { name: 'Deploy All Sections', value: 'all' }
      )
  )
  .addChannelOption(option =>
    option
      .setName('target_channel')
      .setDescription('Override default channel (optional)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const section = interaction.options.getString('section', true);
  const targetChannel = interaction.options.getChannel('target_channel') as TextChannel | null;

  await interaction.deferReply({ ephemeral: true });

  try {
    if (section === 'all') {
      await deployAllSections(interaction);
    } else {
      await deploySingleSection(interaction, section, targetChannel);
    }

    await interaction.editReply({
      content: `✅ Successfully deployed ${section === 'all' ? 'all content sections' : 'content section'} with professional Fortune 100-level presentation!`,
    });
  } catch (error) {
    logger.error('Error deploying content:', error);
    await interaction.editReply({
      content: '❌ Failed to deploy content. Please check the logs for details.',
    });
  }
}

async function deployAllSections(interaction: ChatInputCommandInteraction) {
  const sections = [
    'welcome_guide',
    'onboarding_checklist',
    'capper_guide',
    'server_map',
    'analytics_preview',
    'vip_perks',
  ];

  for (const section of sections) {
    await deploySingleSection(interaction, section, null);
    // Brief delay between deployments
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function deploySingleSection(
  interaction: ChatInputCommandInteraction,
  section: string,
  targetChannel: TextChannel | null
) {
  const guild = interaction.guild;
  if (!guild) return;

  let channelId: string;
  let embed: EmbedBuilder;
  let buttons: ActionRowBuilder<ButtonBuilder> | null = null;

  switch (section) {
    case 'welcome_guide':
      channelId = '1387143551992987879'; // Your specified thread ID
      ({ embed, buttons } = createWelcomeGuideEmbed(guild));
      break;

    case 'onboarding_checklist':
      channelId = '1387144072032157736'; // Your specified thread ID
      ({ embed, buttons } = createOnboardingChecklistEmbed(guild));
      break;

    case 'capper_guide':
      channelId = '1387152040328953926'; // Your specified thread ID
      ({ embed, buttons } = createCapperGuideEmbed(guild));
      break;

    case 'server_map':
      channelId = '1387158075814838495'; // Your specified thread ID
      ({ embed, buttons } = createServerMapEmbed(guild));
      break;

    case 'analytics_preview':
      channelId = '1387158575515697232'; // Your specified thread ID
      ({ embed, buttons } = createAnalyticsPreviewEmbed(guild));
      break;

    case 'vip_perks':
      channelId = '1387184046680834140'; // Your specified thread ID
      ({ embed, buttons } = createVIPPerksEmbed(guild));
      break;

    default:
      throw new Error(`Unknown section: ${section}`);
  }

  // Use target channel if provided, otherwise fetch the thread/channel by ID
  let channel: TextChannel;
  if (targetChannel) {
    channel = targetChannel;
  } else {
    try {
      // Fetch the channel/thread directly using the client
      const fetchedChannel = await interaction.client.channels.fetch(channelId);
      if (!fetchedChannel || !fetchedChannel.isTextBased()) {
        throw new Error(`Channel ${channelId} is not a text-based channel`);
      }
      channel = fetchedChannel as TextChannel;
    } catch (error) {
      throw new Error(`Channel not found: ${channelId}`);
    }
  }

  // Send the professional embed with buttons
  const messageOptions: any = { embeds: [embed] };
  if (buttons) {
    messageOptions.components = [buttons];
  }

  await channel.send(messageOptions);
}

function createWelcomeGuideEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('🚀 Welcome to Unit Talk – The Next Evolution in Sports Intelligence')
    .setDescription(
      `**You've joined an elite community where expert picks, advanced analytics, and actionable education come together.**\n\n` +
        `**Here's how to get started fast:**\n\n` +
        `**1️⃣ Say Hello**\n` +
        `Introduce yourself in <#1288606775121285273> and meet the team and fellow sharp bettors.\n\n` +
        `**2️⃣ Claim Your Free Picks**\n` +
        `Head to <#1288596680563753000> for today's selections—available to all members.\n\n` +
        `**3️⃣ Explore the Knowledge Hub**\n` +
        `Browse <#1387198398087561236> for guides, FAQs, and strategy deep-dives.\n\n` +
        `**4️⃣ Review Your Member Perks**\n` +
        `Want to know what you unlock at each level? Visit <#1387184046680834140> anytime.\n\n` +
        `**5️⃣ Take the Onboarding Checklist**\n` +
        `Get set up in minutes with our <#1387144072032157736>.\n\n` +
        `**💡 Pro Tip:**\n` +
        `Maximize your experience by setting up notifications for channels you care about—never miss a pick or update.\n\n` +
        `**You're now part of the winning edge. Have a question? Ask in General Chat or tag our team. Welcome aboard!**`
    )
    .setColor(Colors.Blue)
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk - The Next Evolution in Sports Intelligence',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('quick_start_general')
      .setLabel('💬 General Chat')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('quick_start_picks')
      .setLabel('🎯 Free Picks')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('quick_start_knowledge')
      .setLabel('📚 Knowledge Hub')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('quick_start_checklist')
      .setLabel('✅ Onboarding Checklist')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, buttons };
}

function createOnboardingChecklistEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('✅ Unit Talk Onboarding Checklist – Set Up for Success')
    .setDescription(
      `**Welcome! Complete these steps to unlock the full power of your membership:**\n\n` +
        `☐ **Introduce yourself** in <#1288606775121285273>\n` +
        `☐ **Subscribe to channels** for free picks, VIP picks, and capper threads\n` +
        `☐ **Review VIP Perks & Rewards** to understand all benefits\n` +
        `☐ **Set up notifications** for picks, recaps, and live alerts\n` +
        `☐ **Explore Analytics Preview** to see performance tracking in action\n` +
        `☐ **Visit Capper Corner Guide** and start tracking your favorites\n` +
        `☐ **Access Server Map** for a full navigation guide\n` +
        `☐ **Dive into the Knowledge Hub** for strategies and education\n` +
        `☐ **Ask a question** or get help in General Chat or Support\n\n` +
        `**💡 Pro Tip:** Bookmark this checklist for quick reference and track your progress!`
    )
    .setColor(Colors.Green)
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk - Your Success Checklist',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('checklist_general')
      .setLabel('💬 General Chat')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('checklist_analytics')
      .setLabel('📊 Analytics Preview')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('checklist_capper')
      .setLabel('🎯 Capper Corner')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('checklist_support')
      .setLabel('🆘 Support')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, buttons };
}

function createCapperGuideEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('🎯 Capper Corner – How to Follow, Track, and Engage with Top Experts')
    .setDescription(
      `**Unit Talk's Capper Corner is your home for curated, expert-driven betting opportunities.**\n\n` +
        `**🔧 How it Works:**\n` +
        `Each capper has their own set of threads:\n` +
        `• **Picks Only** – Official, timestamped plays (no noise)\n` +
        `• **Q&A & Discussion** – Ask questions, break down strategies, discuss results\n\n` +
        `**📱 To follow a capper:**\n` +
        `• Subscribe to their threads to get is_instant alerts\n` +
        `• Use Discord's thread "Follow" feature for push notifications\n` +
        `• Track performance with <#1387158575515697232>\n\n` +
        `**⭐ Why Capper Corner?**\n` +
        `• Clean separation of signals vs. discussion\n` +
        `• Direct engagement—no spam, just substance\n` +
        `• Instant access to results, recaps, and in-depth analysis\n\n` +
        `**🚀 Want to become a featured capper?**\n` +
        `Contact our team for Capper Program details and requirements.`
    )
    .setColor('#FF6B35')
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk - Expert Capper Network',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('capper_corner_browse')
      .setLabel('🎯 Browse Capper Corner')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('capper_analytics')
      .setLabel('📊 Analytics Preview')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('capper_program')
      .setLabel('🌟 Capper Program Info')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, buttons };
}

function createServerMapEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('🗺️ Unit Talk Server Map – Navigate Like a Pro')
    .setDescription(
      `**Find what you need, when you need it. Here's your at-a-glance guide to every area:**\n\n` +
        `**🏠 COMMUNITY AREAS**\n` +
        `<#1288606775121285273> - Meet members, ask questions, daily banter\n` +
        `<#1390413374260514977> - Direct help from our team\n\n` +
        `**🎯 PICKS & ANALYSIS**\n` +
        `<#1288596680563753000> - Open plays for all members\n` +
        `<#1288596108876054559> - Threads for each capper—picks and Q&A\n` +
        `<#1288611956575703120> - Real-time market data and analytics\n\n` +
        `**📚 EDUCATION & RESOURCES**\n` +
        `<#1387198398087561236> - Education, guides, advanced strategy\n` +
        `<#1387158575515697232> - Performance tracking and analytics\n\n` +
        `**👑 VIP EXCLUSIVE**\n` +
        `<#1288606775121285273> - Network, get live help, share your journey\n` +
        `<#1288604565423390782> - Member wins and success stories\n` +
        `<#1387184046680834140> - All VIP benefits and upgrade options\n\n` +
        `**💡 Tip:** Use the "Follow" button or star your most-used channels for easy access.`
    )
    .setColor('#9932CC')
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk - Server Navigation Guide',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('map_general')
      .setLabel('💬 General Chat')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('map_picks')
      .setLabel('🎯 Free Picks')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('map_knowledge')
      .setLabel('📚 Knowledge Hub')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('map_support')
      .setLabel('🆘 Support')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, buttons };
}

function createAnalyticsPreviewEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('📊 Analytics Preview – Track Your Edge, Level Up Your Results')
    .setDescription(
      `**See your progress at a glance.**\n` +
        `Our Analytics Suite delivers the same metrics trusted by professional bettors:\n\n` +
        `**📈 Performance Dashboards:**\n` +
        `Visualize win rate, ROI, and streaks by capper, sport, or system\n\n` +
        `**⚡ Edge Tracking:**\n` +
        `Follow your personal stats and optimize for profit\n\n` +
        `**🏆 Capper Leaderboards:**\n` +
        `Discover who's hot, who's rising, and find new experts to follow\n\n` +
        `**🔥 Streak Analysis:**\n` +
        `Identify hot hands and emerging trends\n\n` +
        `**💰 Unit Management:**\n` +
        `Track bankroll growth and risk exposure in real time\n\n` +
        `**This preview updates live—upgrade to VIP for advanced filters, long-term trends, and deeper analytics.**`
    )
    .setColor('#00D4AA')
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk - Advanced Analytics Suite',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('analytics_dashboard')
      .setLabel('📊 View Dashboard')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('analytics_leaderboard')
      .setLabel('🏆 Capper Leaderboard')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('analytics_upgrade')
      .setLabel('⭐ Upgrade to VIP')
      .setStyle(ButtonStyle.Success)
  );

  return { embed, buttons };
}

function createVIPPerksEmbed(guild: any) {
  const embed = new EmbedBuilder()
    .setTitle('💎 VIP & VIP+ Perks and Rewards – Experience the Next Level')
    .setDescription(
      `**Unit Talk VIP is the ultimate upgrade for serious bettors, data-driven investors, and sports analytics enthusiasts.**\n` +
        `*Built by pros, trusted by sharp bettors, and driven by real results—not hype.*\n\n` +
        `**🚀 Unmatched Edge & Real-Time Alerts**\n` +
        `• Elite-level custom alert system with fastest notifications\n` +
        `• Live in-game analysis and interactive Game Threads\n` +
        `• Extensive custom slash commands for stats and market scans\n\n` +
        `**📊 Advanced Data, Transparent Results**\n` +
        `• Proprietary grading and edge scoring algorithms\n` +
        `• Advanced analytics suite with ROI and trend visualization\n` +
        `• Transparent results with live records and leaderboards\n\n` +
        `**🔍 Next-Gen Market Intelligence**\n` +
        `• Up-to-the-minute odds and prop feeds\n` +
        `• Custom-built bots and enterprise-level data pipelines\n` +
        `• Live trend detection and sharp movement tracking\n\n` +
        `**🤝 Premium Community & Direct Access**\n` +
        `• Private capper threads with "Picks Only" and "Discussion" separation\n` +
        `• VIP Lounge & exclusive channels for elite networking\n` +
        `• Real member wins and testimonials in <#1288604565423390782>`
    )
    .setColor('#FFD700')
    .setThumbnail(guild.iconURL())
    .setTimestamp()
    .setFooter({
      text: 'Unit Talk VIP - Where Next-Level Bettors Get Next-Level Results',
      iconURL: guild.iconURL() || undefined,
    });

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('vip_upgrade')
      .setLabel('⭐ Upgrade to VIP')
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId('vip_plus_elite')
      .setLabel('💎 VIP+ Elite Info')
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId('vip_testimonials')
      .setLabel('🏆 View Testimonials')
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId('vip_trial')
      .setLabel('🎯 Request Trial')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embed, buttons };
}
