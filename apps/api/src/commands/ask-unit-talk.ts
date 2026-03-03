import { ChatInputCommandInteraction } from 'discord.js';

import { BaseAgentDependencies } from '../agents/BaseAgent/types';

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
        content: 'This command is only available to VIP members due to rate limiting.',
        ephemeral: true,
      });
      return;
    }

    // Get question from command
    const question = interaction.options.getString('question');
    if (!question || question.length < 10) {
      await interaction.reply({
        content: 'Your question must be at least 10 characters long.',
        ephemeral: true,
      });
      return;
    }

    // Defer reply while processing
    await interaction.deferReply();

    // Get AI analysis
    const aiService = (deps as any).aiService;
    if (!aiService) {
      await interaction.editReply('AI service is not available.');
      return;
    }

    // Generate analysis
    const analysis = await aiService.generateAnalysis({
      question,
      userContext: {
        tier: 'vip',
      },
    });

    // Format response
    const response =
      `**Analysis:** ${analysis.analysis}\n\n` +
      `**Confidence:** ${analysis.confidence}%\n\n` +
      `**Risk Assessment:** ${analysis.riskAssessment.level} (${analysis.riskAssessment.score}/10)\n\n` +
      `**Key Insights:**\n${analysis.keyInsights.map((i: string) => `• ${i}`).join('\n')}\n\n` +
      `**Recommendations:**\n${analysis.recommendations.map((r: string) => `• ${r}`).join('\n')}`;

    // Send response
    await interaction.editReply(response);

    // Log success
    deps.logger.info('AI analysis generated successfully', {
      userId: interaction.user.id,
      question,
    });
  } catch (error) {
    // Log error
    deps.logger.error('Failed to generate AI analysis', {
      error,
      userId: interaction.user.id,
    });

    // Send error message
    await interaction.editReply(
      'Sorry, I encountered an error while analyzing your question. Please try again later.'
    );
  }
}
