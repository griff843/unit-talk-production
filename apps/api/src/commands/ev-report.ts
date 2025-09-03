import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

import { BaseAgentDependencies } from '../agents/BaseAgent/types';

export async function execute(
  interaction: ChatInputCommandInteraction,
  deps: BaseAgentDependencies,
  config: any
): Promise<void> {
  try {
    // Check if user has VIP role
    const member = interaction.member;
    if (!member?.roles || (typeof member.roles === 'object' && 'cache' in member.roles && !member.roles.cache.has(config.roles.vip)) || (Array.isArray(member.roles) && !member.roles.includes(config.roles.vip))) {
      await interaction.reply({
        content: 'This command is only available to VIP members.',
        ephemeral: true
      });
      return;
    }

    // Get report type from command
    const reportType = interaction.options.getString('type') || 'daily';
    const limit = interaction.options.getNumber('limit') || 5;

    // Defer reply while processing
    await interaction.deferReply();

    // Get EV report
    const evService = (deps as any).evService;
    if (!evService) {
      await interaction.editReply('EV service is not available.');
      return;
    }

    const report = await evService.calculateDailyEV();

    if (report.picks.length === 0) {
      await interaction.editReply('No picks available for EV analysis at this time.');
      return;
    }

    // Create embed
    const embed = new EmbedBuilder()
      .setTitle('Daily EV Report')
      .setDescription(`Total Expected Value: ${report.totalEV.toFixed(2)}`)
      .setColor('#00ff00')
      .setTimestamp();

    // Add picks to embed
    report.picks.slice(0, limit).forEach((pick: any, index: number) => {
      embed.addFields({
        name: `Pick ${index + 1}`,
        value: `${pick.details}\nEV: ${pick.ev.toFixed(2)}\nConfidence: ${(pick.confidence * 100).toFixed(1)}%`
      });
    });

    // Send response
    await interaction.editReply({ embeds: [embed] });

    // Log success
    deps.logger.info('EV report generated successfully', {
      userId: interaction.user.id,
      reportType,
      totalPicks: report.picks.length
    });
  } catch (error) {
    // Log error
    deps.logger.error('Failed to generate EV report', {
      error,
      userId: interaction.user.id
    });

    // Send error message
    await interaction.editReply('Sorry, I encountered an error while generating the EV report. Please try again later.');
  }
} 