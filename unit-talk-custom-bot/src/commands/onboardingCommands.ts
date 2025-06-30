import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { DiscordOnboardingAgent } from '../agents/discordOnboardingAgent';
import { logger } from '../utils/logger';

export const onboardingCommands = [
  // Onboarding Status Command
  {
    data: new SlashCommandBuilder()
      .setName('onboarding-status')
      .setDescription('Get onboarding system status and metrics')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction: ChatInputCommandInteraction, services: any) {
      try {
        await interaction.deferReply({ ephemeral: true });

        const agent: DiscordOnboardingAgent = services.discordOnboardingAgent;
        if (!agent) {
          await interaction.editReply('❌ Discord Onboarding Agent not available');
          return;
        }

        const report = await agent.generateReport();
        await interaction.editReply({ embeds: [report] });

      } catch (error) {
        logger.error('Error in onboarding-status command:', error);
        await interaction.editReply('❌ Failed to get onboarding status');
      }
    }
  },

  // Onboarding Issues Command
  {
    data: new SlashCommandBuilder()
      .setName('onboarding-issues')
      .setDescription('List unresolved onboarding issues')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction: ChatInputCommandInteraction, services: any) {
      try {
        await interaction.deferReply({ ephemeral: true });

        const agent: DiscordOnboardingAgent = services.discordOnboardingAgent;
        if (!agent) {
          await interaction.editReply('❌ Discord Onboarding Agent not available');
          return;
        }

        const issues = agent.getUnresolvedIssues();
        
        if (issues.length === 0) {
          await interaction.editReply('✅ No unresolved onboarding issues');
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('⚠️ Unresolved Onboarding Issues')
          .setColor(0xFF6B6B)
          .setTimestamp();

        const issueList = issues.slice(0, 10).map((issue: any, index: number) =>
          `${index + 1}. **${issue.username}** (${issue.tier})\n   ${issue.issue}\n   <t:${Math.floor(issue.timestamp.getTime() / 1000)}:R>`
        ).join('\n\n');

        embed.setDescription(issueList);

        if (issues.length > 10) {
          embed.setFooter({ text: `Showing 10 of ${issues.length} issues` });
        }

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        logger.error('Error in onboarding-issues command:', error);
        await interaction.editReply('❌ Failed to get onboarding issues');
      }
    }
  },

  // Retry Onboarding Command
  {
    data: new SlashCommandBuilder()
      .setName('retry-onboarding')
      .setDescription('Manually retry onboarding for a user')
      .addUserOption(option =>
        option.setName('user')
          .setDescription('The user to retry onboarding for')
          .setRequired(true)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction: ChatInputCommandInteraction, services: any) {
      try {
        await interaction.deferReply({ ephemeral: true });

        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild?.members.fetch(user.id);

        if (!member) {
          await interaction.editReply('❌ User not found in this server');
          return;
        }

        const agent: DiscordOnboardingAgent = services.discordOnboardingAgent;
        if (!agent) {
          await interaction.editReply('❌ Discord Onboarding Agent not available');
          return;
        }

        const success = await agent.triggerManualOnboarding(member, interaction.user.tag);

        if (success) {
          await interaction.editReply(`✅ Successfully triggered onboarding for ${user.tag}`);
        } else {
          await interaction.editReply(`❌ Failed to trigger onboarding for ${user.tag}`);
        }

      } catch (error) {
        logger.error('Error in retry-onboarding command:', error);
        await interaction.editReply('❌ Failed to retry onboarding');
      }
    }
  },

  // Onboarding Health Command
  {
    data: new SlashCommandBuilder()
      .setName('onboarding-health')
      .setDescription('Check onboarding system health')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    
    async execute(interaction: ChatInputCommandInteraction, services: any) {
      try {
        await interaction.deferReply({ ephemeral: true });

        const agent: DiscordOnboardingAgent = services.discordOnboardingAgent;
        if (!agent) {
          await interaction.editReply('❌ Discord Onboarding Agent not available');
          return;
        }

        const metrics = agent.getMetrics();
        const issues = agent.getUnresolvedIssues();
        
        const successRate = metrics.totalOnboardings > 0 
          ? (metrics.successfulOnboardings / metrics.totalOnboardings * 100).toFixed(1)
          : '0';

        let healthStatus = '🟢 Healthy';
        let healthColor = 0x00FF00;

        if (issues.length > 5) {
          healthStatus = '🔴 Critical';
          healthColor = 0xFF0000;
        } else if (issues.length > 2 || parseFloat(successRate) < 90) {
          healthStatus = '🟡 Warning';
          healthColor = 0xFFFF00;
        }

        const embed = new EmbedBuilder()
          .setTitle('🏥 Onboarding System Health')
          .setColor(healthColor)
          .setTimestamp()
          .addFields(
            {
              name: '📊 Status',
              value: healthStatus,
              inline: true
            },
            {
              name: '📈 Success Rate',
              value: `${successRate}%`,
              inline: true
            },
            {
              name: '⚠️ Issues',
              value: `${issues.length} unresolved`,
              inline: true
            },
            {
              name: '⚡ Avg Response Time',
              value: `${metrics.averageResponseTime.toFixed(0)}ms`,
              inline: true
            },
            {
              name: '📅 Last Onboarding',
              value: metrics.lastOnboardingTime 
                ? `<t:${Math.floor(metrics.lastOnboardingTime.getTime() / 1000)}:R>`
                : 'Never',
              inline: true
            },
            {
              name: '🔢 Total Processed',
              value: `${metrics.totalOnboardings}`,
              inline: true
            }
          );

        await interaction.editReply({ embeds: [embed] });

      } catch (error) {
        logger.error('Error in onboarding-health command:', error);
        await interaction.editReply('❌ Failed to check onboarding health');
      }
    }
  }
];