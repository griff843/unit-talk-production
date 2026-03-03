import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

import { BaseAgentDependencies } from '../agents/BaseAgent/types';

const VALID_SPORTS = ['nba', 'nfl', 'mlb', 'nhl'];

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: BaseAgentDependencies,
  config: any
): Promise<void> {
  try {
    // Check if user has VIP role
    const member = interaction.member;
    if (
      !member?.roles ||
      (typeof member.roles === 'object' &&
        'cache' in member.roles &&
        !member.roles.cache.has(config.roles.vip)) ||
      (Array.isArray(member.roles) && !member.roles.includes(config.roles.vip))
    ) {
      await interaction.reply({
        content: 'This command is only available to VIP members.',
        ephemeral: true,
      });
      return;
    }

    // Get parameters from command
    const sport = interaction.options.getString('sport')?.toLowerCase();
    const minConfidence = interaction.options.getNumber('min_confidence') || 0.7;

    // Validate sport
    if (!sport || !VALID_SPORTS.includes(sport)) {
      await interaction.reply({
        content: `Please specify a valid sport: ${VALID_SPORTS.join(', ')}`,
        ephemeral: true,
      });
      return;
    }

    // Defer reply while processing
    await interaction.deferReply();

    // Get trend analysis
    const trendService = (deps as any).trendService;
    if (!trendService) {
      await interaction.editReply('Trend service is not available.');
      return;
    }

    const analysis = await trendService.analyzeTrends();

    // Filter trends by confidence
    const significantTrends = analysis.trendBreaks.filter(
      (trend: any) => trend.confidence >= minConfidence
    );

    if (significantTrends.length === 0) {
      await interaction.editReply('No significant trend breaks found at this time.');
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('Trend Break Analysis')
      .setDescription(`Found ${significantTrends.length} significant trend breaks`)
      .setColor('#0099ff')
      .setTimestamp();

    // Add trends to embed
    significantTrends.forEach((trend: any, index: number) => {
      embed.addFields({
        name: `Trend ${index + 1}: ${trend.player}`,
        value:
          `${trend.stat} (${trend.line})\n` +
          `Confidence: ${(trend.confidence * 100).toFixed(1)}%\n` +
          `Historical: ${trend.historicalData.hitRate * 100}% over ${trend.historicalData.totalGames} games`,
      });
    });

    // Send response
    await interaction.editReply({ embeds: [embed] });

    // Log success
    deps.logger.info('Trend analysis generated successfully', {
      userId: interaction.user.id,
      sport,
      totalTrends: significantTrends.length,
    });
  } catch (error) {
    // Log error
    deps.logger.error('Failed to generate trend analysis', {
      error,
      userId: interaction.user.id,
    });

    // Send error message
    await interaction.editReply(
      'Sorry, I encountered an error while analyzing trends. Please try again later.'
    );
  }
}
