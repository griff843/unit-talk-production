import { CommandInteraction, ButtonInteraction } from 'discord.js';
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { getUserTier, hasMinimumTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('alerts-setup')
  .setDescription('Setup pick alerts and notifications (VIP+ required)')
  .addSubcommand(subcommand =>
    subcommand.setName('configure').setDescription('Configure your alert preferences')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('status').setDescription('View your current alert settings')
  )
  .addSubcommand(subcommand =>
    subcommand.setName('test').setDescription('Send a test alert to verify settings')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const member = interaction.member;
    if (!member) {
      await interaction.editReply('❌ Unable to determine your membership status.');
      return;
    }

    const userTier = getUserTier(member as any);

    // Check if user has VIP+ access
    if (!hasMinimumTier(member as any, 'vip_plus')) {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP+ Feature Required')
        .setDescription('Advanced alert setup is available to VIP+ members and above.')
        .setColor(0xff4500)
        .addFields(
          {
            name: '🔔 VIP+ Alert Features',
            value:
              '• Custom alert preferences\n• Capper-specific notifications\n• Sport filtering\n• Confidence level alerts\n• Real-time push notifications\n• SMS alerts (premium)',
            inline: false,
          },
          {
            name: '⭐ Basic VIP Alerts',
            value:
              'VIP members receive basic pick notifications. Upgrade to VIP+ for advanced customization!',
            inline: false,
          }
        );

      const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('upgrade_to_vip_plus')
          .setLabel('Upgrade to VIP+')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💎'),
        new ButtonBuilder()
          .setCustomId('basic_alerts')
          .setLabel('Basic Alerts')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔔')
      );

      await interaction.editReply({
        embeds: [embed],
        components: [actionRow],
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'configure':
        await handleConfigure(interaction, userTier);
        break;
      case 'status':
        await handleStatus(interaction, userTier);
        break;
      case 'test':
        await handleTest(interaction, userTier);
        break;
      default:
        await interaction.editReply('❌ Invalid subcommand.');
    }
  } catch (error) {
    logger.error('Error in alerts-setup command:', error);
    await interaction.editReply('❌ An error occurred while setting up alerts.');
  }
}

async function handleConfigure(interaction: ChatInputCommandInteraction, userTier: string) {
  const embed = new EmbedBuilder()
    .setTitle('🔔 Configure Alert Preferences')
    .setDescription('Customize your pick alert settings below:')
    .setColor(0x00ff00)
    .addFields(
      {
        name: '📱 Alert Types',
        value:
          '• Discord DM\n• Discord Channel Mention\n• Email (coming soon)\n• SMS (Black Label only)',
        inline: true,
      },
      {
        name: '🎯 Filter Options',
        value:
          '• Specific cappers\n• Sports preferences\n• Confidence levels\n• Unit size minimums',
        inline: true,
      },
      {
        name: '⏰ Timing',
        value: '• Instant notifications\n• Daily digest\n• Pre-game reminders\n• Result updates',
        inline: true,
      }
    );

  const sportSelect = new StringSelectMenuBuilder()
    .setCustomId('alert_sports')
    .setPlaceholder('Select sports for alerts')
    .setMinValues(1)
    .setMaxValues(5)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('NBA Basketball').setValue('nba').setEmoji('🏀'),
      new StringSelectMenuOptionBuilder().setLabel('NFL Football').setValue('nfl').setEmoji('🏈'),
      new StringSelectMenuOptionBuilder().setLabel('MLB Baseball').setValue('mlb').setEmoji('⚾'),
      new StringSelectMenuOptionBuilder().setLabel('NHL Hockey').setValue('nhl').setEmoji('🏒'),
      new StringSelectMenuOptionBuilder().setLabel('All Sports').setValue('all').setEmoji('🏆')
    );

  const confidenceSelect = new StringSelectMenuBuilder()
    .setCustomId('alert_confidence')
    .setPlaceholder('Select minimum confidence level')
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('All Picks').setValue('all').setEmoji('📊'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Medium+ Confidence')
        .setValue('medium')
        .setEmoji('⭐'),
      new StringSelectMenuOptionBuilder()
        .setLabel('High Confidence Only')
        .setValue('high')
        .setEmoji('🔥')
    );

  const actionRow1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sportSelect);

  const actionRow2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    confidenceSelect
  );

  const actionRow3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('save_alert_settings')
      .setLabel('Save Settings')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💾'),
    new ButtonBuilder()
      .setCustomId('reset_alerts')
      .setLabel('Reset to Default')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow1, actionRow2, actionRow3],
  });
}

async function handleStatus(interaction: ChatInputCommandInteraction, userTier: string) {
  // Mock user alert settings (this would normally come from database)
  const alertSettings = {
    enabled: true,
    sports: ['nba', 'nfl'],
    confidence: 'medium',
    cappers: ['ProCapper1', 'EliteAnalyst'],
    alertTypes: ['discord_dm', 'discord_mention'],
    lastUpdated: '2024-01-15',
  };

  const embed = new EmbedBuilder()
    .setTitle('🔔 Your Alert Settings')
    .setDescription('Current notification preferences:')
    .setColor(alertSettings.enabled ? 0x00ff00 : 0xff0000)
    .addFields(
      {
        name: '📊 Status',
        value: alertSettings.enabled ? '✅ Alerts Enabled' : '❌ Alerts Disabled',
        inline: true,
      },
      {
        name: '🏆 Sports',
        value: alertSettings.sports.map(sport => sport.toUpperCase()).join(', ') || 'All Sports',
        inline: true,
      },
      {
        name: '⭐ Confidence Level',
        value:
          alertSettings.confidence === 'all'
            ? 'All Picks'
            : alertSettings.confidence === 'medium'
              ? 'Medium+'
              : 'High Only',
        inline: true,
      },
      {
        name: '👥 Favorite Cappers',
        value: alertSettings.cappers.join(', ') || 'All Cappers',
        inline: false,
      },
      {
        name: '📱 Alert Methods',
        value: alertSettings.alertTypes
          .map(type =>
            type === 'discord_dm'
              ? 'Discord DM'
              : type === 'discord_mention'
                ? 'Channel Mentions'
                : type === 'email'
                  ? 'Email'
                  : 'SMS'
          )
          .join(', '),
        inline: false,
      }
    )
    .setFooter({ text: `Last updated: ${alertSettings.lastUpdated}` });

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('modify_alerts')
      .setLabel('Modify Settings')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('⚙️'),
    new ButtonBuilder()
      .setCustomId(alertSettings.enabled ? 'disable_alerts' : 'enable_alerts')
      .setLabel(alertSettings.enabled ? 'Disable Alerts' : 'Enable Alerts')
      .setStyle(alertSettings.enabled ? ButtonStyle.Danger : ButtonStyle.Success)
      .setEmoji(alertSettings.enabled ? '🔕' : '🔔')
  );

  await interaction.editReply({
    embeds: [embed],
    components: [actionRow],
  });
}

async function handleTest(interaction: ChatInputCommandInteraction, userTier: string) {
  const embed = new EmbedBuilder()
    .setTitle('🧪 Test Alert')
    .setDescription('Sending test notification...')
    .setColor(0xffa500);

  await interaction.editReply({ embeds: [embed] });

  // Simulate sending test alert
  setTimeout(async () => {
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Test Alert Sent!')
      .setDescription('Check your DMs for the test notification.')
      .setColor(0x00ff00)
      .addFields({
        name: '📱 Test Alert Content',
        value:
          '🔥 **Test Pick Alert**\n**Game:** Lakers vs Warriors\n**Pick:** Lakers +3.5\n**Confidence:** High\n**Capper:** ProCapper1',
        inline: false,
      });

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('send_another_test')
        .setLabel('Send Another Test')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('configure_alerts')
        .setLabel('Configure Alerts')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚙️')
    );

    await interaction.editReply({
      embeds: [successEmbed],
      components: [actionRow],
    });

    // Try to send actual DM
    try {
      const testDM = new EmbedBuilder()
        .setTitle('🧪 Unit Talk Test Alert')
        .setDescription('This is a test notification from Unit Talk!')
        .setColor(0x7289da)
        .addFields({
          name: '🔥 Sample Pick',
          value:
            '**Game:** Lakers vs Warriors\n**Pick:** Lakers +3.5\n**Confidence:** High\n**Capper:** ProCapper1',
          inline: false,
        })
        .setFooter({ text: 'This is a test alert. Configure your preferences with /alerts-setup' });

      await interaction.user.send({ embeds: [testDM] });
    } catch (dmError) {
      logger.warn(`Failed to send test DM to ${interaction.user.tag}:`, dmError);
    }
  }, 2000);

  logger.info(`Test alert sent by ${interaction.user.tag} (${userTier})`);
}
