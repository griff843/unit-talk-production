import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getUserTier, getTierDisplayName } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const enhancedHelp = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help and information about Unit Talk commands')
    .addStringOption(option =>
      option
        .setName('command')
        .setDescription('Get help for a specific command')
        .setRequired(false)
        .addChoices(
          { name: 'Pick Commands', value: 'picks' },
          { name: 'VIP Commands', value: 'vip' },
          { name: 'AI Commands', value: 'ai' },
          { name: 'Analytics Commands', value: 'analytics' },
          { name: 'Admin Commands', value: 'admin' },
          { name: 'Utility Commands', value: 'utility' }
        )
    ),

  async execute(interaction: any) {
    try {
      const command = interaction.options.getString('command');
      const userTier = getUserTier(interaction.member);

      logger.info(
        `Help request: ${command || 'general'} for user ${interaction.user.tag} (tier: ${userTier})`
      );

      if (command) {
        await this.showCommandHelp(interaction, command, userTier);
      } else {
        await this.showGeneralHelp(interaction, userTier);
      }
    } catch (error) {
      logger.error('Error in enhanced help:', error);
      await interaction.reply({
        content: '❌ An error occurred while loading help. Please try again.',
        ephemeral: true,
      });
    }
  },

  async showGeneralHelp(interaction: any, userTier: string) {
    const embed = new EmbedBuilder()
      .setTitle('🎯 Unit Talk Help Center')
      .setDescription(
        `Welcome to Unit Talk! Here's how to get the most out of your **${getTierDisplayName(userTier)}** experience.`
      )
      .addFields(
        {
          name: '🚀 Getting Started',
          value: 'Use `/tutorial` for interactive tutorials',
          inline: true,
        },
        { name: '📚 Documentation', value: 'Check our comprehensive guides', inline: true },
        { name: '🆘 Support', value: 'Use `/support` for assistance', inline: true }
      )
      .setColor('#00D4AA')
      .setFooter({
        text: `Your tier: ${getTierDisplayName(userTier)} • Use /help <category> for specific help`,
      });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('help_picks')
        .setLabel('🎯 Pick Commands')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_vip')
        .setLabel('🏆 VIP Commands')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_ai')
        .setLabel('🤖 AI Commands')
        .setStyle(ButtonStyle.Secondary)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('help_analytics')
        .setLabel('📊 Analytics')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_utility')
        .setLabel('🔧 Utility')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_tutorial')
        .setLabel('🎓 Tutorial')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row, row2],
      ephemeral: true,
    });
  },

  async showCommandHelp(interaction: any, command: string, userTier: string) {
    const helpData = {
      picks: {
        title: '🎯 Pick Commands',
        description: 'Commands for submitting and managing sports picks',
        color: '#FF6B35',
        commands: [
          {
            name: '/pick',
            description: 'Submit a basic sports pick',
            usage: '/pick sport:NFL selection:Chiefs -3.5 odds:-110 units:2 confidence:7',
            tier: 'all',
          },
          {
            name: '/enhanced-pick',
            description: 'Submit a pick with detailed analysis (VIP+)',
            usage:
              '/enhanced-pick sport:NBA selection:Lakers +5.5 odds:+105 units:1 confidence:8 analysis:Strong defensive matchup',
            tier: 'vip_plus',
          },
          {
            name: '/edit-pick',
            description: 'Edit a previously submitted pick',
            usage: '/edit-pick pick_id:123 odds:-120',
            tier: 'all',
          },
          {
            name: '/delete-pick',
            description: 'Delete a submitted pick',
            usage: '/delete-pick pick_id:123',
            tier: 'all',
          },
        ],
      },
      vip: {
        title: '🏆 VIP Commands',
        description: 'Premium features for VIP members',
        color: '#FFD700',
        commands: [
          {
            name: '/vip-info',
            description: 'View VIP benefits and upgrade options',
            usage: '/vip-info',
            tier: 'all',
          },
          {
            name: '/trial-status',
            description: 'Check your trial status and remaining time',
            usage: '/trial-status',
            tier: 'all',
          },
          {
            name: '/upgrade',
            description: 'Quick access to upgrade options',
            usage: '/upgrade',
            tier: 'all',
          },
          {
            name: '/top-plays',
            description: 'View top performing picks from community',
            usage: '/top-plays NFL week',
            tier: 'vip',
          },
          {
            name: '/recap',
            description: 'Get daily/weekly performance recap',
            usage: '/recap week',
            tier: 'vip',
          },
        ],
      },
      ai: {
        title: '🤖 AI Commands',
        description: 'AI-powered analysis and coaching features',
        color: '#9B59B6',
        commands: [
          {
            name: '/ask-ai',
            description: 'Get AI-powered betting analysis and coaching',
            usage: '/ask-ai question:Should I bet the over on LeBron James 25.5 points tonight?',
            tier: 'vip_plus',
          },
          {
            name: '/heat-signal',
            description: 'Access live market alerts and signals',
            usage: '/heat-signal',
            tier: 'vip_plus',
          },
          {
            name: '/edge-tracker',
            description: 'Track betting edges and value opportunities',
            usage: '/edge-tracker NBA line_movement',
            tier: 'vip_plus',
          },
        ],
      },
      analytics: {
        title: '📊 Analytics Commands',
        description: 'Performance tracking and analytics features',
        color: '#3498DB',
        commands: [
          {
            name: '/stats',
            description: 'View your personal statistics',
            usage: '/stats',
            tier: 'all',
          },
          {
            name: '/analytics',
            description: 'View detailed analytics and performance data',
            usage: '/analytics performance week',
            tier: 'vip',
          },
          {
            name: '/black-label dashboard',
            description: 'Access comprehensive analytics dashboard (Black Label)',
            usage: '/black-label dashboard',
            tier: 'black_label',
          },
          {
            name: '/black-label portfolio',
            description: 'View comprehensive portfolio performance (Black Label)',
            usage: '/black-label portfolio',
            tier: 'black_label',
          },
        ],
      },
      admin: {
        title: '🛠️ Admin Commands',
        description: 'Administrative and moderation features',
        color: '#E74C3C',
        commands: [
          {
            name: '/admin',
            description: 'Access administrative controls',
            usage: '/admin user_manage list',
            tier: 'admin',
          },
          {
            name: '/roles',
            description: 'Manage user roles and permissions',
            usage: '/roles assign @user vip',
            tier: 'staff',
          },
        ],
      },
      utility: {
        title: '🔧 Utility Commands',
        description: 'General utility and support commands',
        color: '#95A5A6',
        commands: [
          {
            name: '/help',
            description: 'Get help and information about commands',
            usage: '/help [command]',
            tier: 'all',
          },
          {
            name: '/ping',
            description: 'Check if the bot is responsive',
            usage: '/ping',
            tier: 'all',
          },
          {
            name: '/faq',
            description: 'Access frequently asked questions',
            usage: '/faq [topic]',
            tier: 'all',
          },
          {
            name: '/support',
            description: 'Get help and support',
            usage: '/support [issue]',
            tier: 'all',
          },
          {
            name: '/tutorial',
            description: 'Start an interactive tutorial',
            usage: '/tutorial [type]',
            tier: 'all',
          },
        ],
      },
    };

    const data = helpData[command as keyof typeof helpData];
    if (!data) {
      await interaction.reply({
        content: '❌ Unknown command category. Use `/help` to see available categories.',
        ephemeral: true,
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(data.title)
      .setDescription(data.description)
      .setColor(data.color as any)
      .setFooter({ text: `Your tier: ${getTierDisplayName(userTier)}` });

    // Filter commands based on user tier
    const availableCommands = data.commands.filter(cmd => {
      if (cmd.tier === 'all') return true;
      if (
        cmd.tier === 'vip' &&
        ['vip', 'vip_plus', 'black_label', 'capper', 'staff', 'admin'].includes(userTier)
      )
        return true;
      if (
        cmd.tier === 'vip_plus' &&
        ['vip_plus', 'black_label', 'capper', 'staff', 'admin'].includes(userTier)
      )
        return true;
      if (cmd.tier === 'black_label' && ['black_label', 'staff', 'admin'].includes(userTier))
        return true;
      if (cmd.tier === 'staff' && ['staff', 'admin'].includes(userTier)) return true;
      if (cmd.tier === 'admin' && userTier === 'admin') return true;
      return false;
    });

    // Add command fields
    availableCommands.forEach(cmd => {
      embed.addFields({
        name: `${cmd.name}`,
        value: `${cmd.description}\n**Usage:** \`${cmd.usage}\``,
        inline: false,
      });
    });

    // Add upgrade prompt if user can't access some commands
    const unavailableCommands = data.commands.filter(cmd => !availableCommands.includes(cmd));
    if (unavailableCommands.length > 0) {
      embed.addFields({
        name: '🔒 Upgrade to Access More',
        value: `${unavailableCommands.length} command(s) available with tier upgrade. Use \`/vip-info\` to learn more.`,
        inline: false,
      });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('help_back')
        .setLabel('← Back to Help')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('help_tutorial')
        .setLabel('🎓 Start Tutorial')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('help_vip_info')
        .setLabel('🏆 VIP Info')
        .setStyle(ButtonStyle.Success)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
};

// Export button handler for help interactions
export async function handleHelpButton(interaction: any) {
  const customId = interaction.customId;

  try {
    switch (customId) {
      case 'help_picks':
        await enhancedHelp.showCommandHelp(interaction, 'picks', getUserTier(interaction.member));
        break;
      case 'help_vip':
        await enhancedHelp.showCommandHelp(interaction, 'vip', getUserTier(interaction.member));
        break;
      case 'help_ai':
        await enhancedHelp.showCommandHelp(interaction, 'ai', getUserTier(interaction.member));
        break;
      case 'help_analytics':
        await enhancedHelp.showCommandHelp(
          interaction,
          'analytics',
          getUserTier(interaction.member)
        );
        break;
      case 'help_utility':
        await enhancedHelp.showCommandHelp(interaction, 'utility', getUserTier(interaction.member));
        break;
      case 'help_tutorial':
        await interaction.reply({
          content: 'Try typing `/tutorial` to start an interactive tutorial!',
          ephemeral: true,
        });
        break;
      case 'help_vip_info':
        await interaction.reply({
          content: 'Try typing `/vip-info` to learn about VIP benefits!',
          ephemeral: true,
        });
        break;
      case 'help_back':
        await enhancedHelp.showGeneralHelp(interaction, getUserTier(interaction.member));
        break;
      default:
        await interaction.reply({
          content: 'Unknown help action. Use `/help` to start over.',
          ephemeral: true,
        });
    }
  } catch (error) {
    logger.error('Error handling help button:', error);
    await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
  }
}
