import { CommandInteraction, CacheType, ButtonInteraction } from '@discordjs/core';
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getUserTier, hasMinimumTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('top-plays')
  .setDescription('Access exclusive Black Label top plays (Black Label only)')
  .addStringOption(option =>
    option.setName('timeframe')
      .setDescription('Timeframe for top plays')
      .setRequired(false)
      .addChoices(
        { name: 'Today', value: 'today' },
        { name: 'This Week', value: 'week' },
        { name: 'Weekend Special', value: 'weekend' }
      )
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

    // Check if user has Black Label access (highest tier)
    // For now, we'll use 'owner' as Black Label equivalent
    if (userTier !== 'owner') {
      const embed = new EmbedBuilder()
        .setTitle('🏆 Black Label Exclusive')
        .setDescription('Top Plays are exclusively available to Black Label members.')
        .setColor(0x000000)
        .addFields(
          {
            name: '🖤 Black Label Benefits',
            value: '• Exclusive top-tier picks\n• Maximum confidence plays only\n• Limited daily selections\n• Highest ROI potential\n• Personal account manager\n• SMS alerts included',
            inline: false
          },
          {
            name: '💎 Your Current Tier',
            value: `You are currently a ${getTierDisplayName(userTier)} member.\nBlack Label is our premium tier with exclusive access to our highest-confidence plays.`,
            inline: false
          },
          {
            name: '📞 Upgrade Information',
            value: 'Black Label membership is by invitation only. Contact our VIP support team for more information.',
            inline: false
          }
        );

      const actionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('contact_vip_support')
            .setLabel('Contact VIP Support')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📞'),
          new ButtonBuilder()
            .setCustomId('black_label_info')
            .setLabel('Learn More')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🖤')
        );

      await interaction.editReply({ 
        embeds: [embed], 
        components: [actionRow]
      });
      return;
    }

    const timeframe = interaction.options.getString('timeframe') || 'today';

    // Mock Black Label top plays data
    const topPlays = {
      today: [
        {
          id: 'BL001',
          sport: '🏀 NBA',
          game: 'Lakers vs Celtics',
          pick: 'Lakers -2.5',
          confidence: 95,
          units: 5,
          analysis: 'Elite matchup advantage with key injury factor. Historical dominance in this scenario.',
          capper: 'Black Label Elite',
          odds: '-110',
          expectedValue: '+18.2%'
        },
        {
          id: 'BL002',
          sport: '🏈 NFL',
          game: 'Chiefs vs Bills',
          pick: 'Under 48.5',
          confidence: 92,
          units: 4,
          analysis: 'Weather conditions and defensive matchups create perfect storm for under.',
          capper: 'Black Label Pro',
          odds: '-105',
          expectedValue: '+15.8%'
        }
      ],
      week: [
        // Additional weekly plays would go here
      ],
      weekend: [
        // Weekend special plays would go here
      ]
    };

    const plays = topPlays[timeframe as keyof typeof topPlays] || topPlays.today;
    const timeframeText = timeframe === 'today' ? 'Today' : timeframe === 'week' ? 'This Week' : 'Weekend Special';

    const embed = new EmbedBuilder()
      .setTitle(`🖤 Black Label Top Plays - ${timeframeText}`)
      .setDescription('**EXCLUSIVE ACCESS** - Highest confidence plays for Black Label members only')
      .setColor(0x000000)
      .setTimestamp();

    if (plays.length === 0) {
      embed.addFields({
        name: '📅 No Plays Available',
        value: `No Black Label plays available for ${timeframeText.toLowerCase()}. Check back later or try a different timeframe.`,
        inline: false
      });
    } else {
      plays.forEach((play, index) => {
        embed.addFields({
          name: `🏆 ${play.sport} - Play #${index + 1}`,
          value: `**${play.game}**\n**Pick:** ${play.pick} (${play.odds})\n**Confidence:** ${play.confidence}% | **Units:** ${play.units}\n**Expected Value:** ${play.expectedValue}\n**Analysis:** ${play.analysis}\n**Capper:** ${play.capper}`,
          inline: false
        });
      });

      embed.addFields({
        name: '⚠️ Black Label Disclaimer',
        value: 'These are maximum confidence plays with higher unit recommendations. Please bet responsibly and within your bankroll limits.',
        inline: false
      });
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('detailed_analysis')
          .setLabel('Detailed Analysis')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('track_plays')
          .setLabel('Track Performance')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📈'),
        new ButtonBuilder()
          .setCustomId('alert_updates')
          .setLabel('Get Updates')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔔')
      );

    // Add refresh button if no plays available
    if (plays.length === 0) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('refresh_top_plays')
          .setLabel('Refresh')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );
    }

    await interaction.editReply({
      embeds: [embed],
      components: [actionRow]
    });

    logger.info(`Black Label top plays accessed by ${interaction.user.tag} (${userTier}) - ${timeframe}`);

  } catch (error) {
    logger.error('Error in top-plays command:', error);
    await interaction.editReply('❌ An error occurred while fetching top plays.');
  }
}

function getTierDisplayName(tier: string): string {
  switch (tier) {
    case 'vip_plus':
      return 'VIP+ Elite';
    case 'vip':
      return 'VIP';
    case 'trial':
      return 'Trial';
    case 'staff':
      return 'Staff';
    case 'admin':
      return 'Admin';
    case 'owner':
      return 'Black Label';
    default:
      return 'Member';
  }
}