import { ButtonInteraction } from 'discord.js';
import { SupabaseService } from '../services/supabase';
import { logger } from '../utils/logger';
import { getUserTier } from '../utils/roleUtils';
import { toGuildMember } from '../utils/discordUtils';

export class ButtonHandler {
  private supabaseService: SupabaseService;

  constructor(supabaseService: SupabaseService) {
    this.supabaseService = supabaseService;
  }

  public async handleButton(interaction: ButtonInteraction) {
    const { customId } = interaction;
    logger.info(`Button clicked: ${customId}`, {
      userId: interaction.user.id,
      username: interaction.user.username,
    });

    try {
      // Get user's tier for permission checks
      const userTier = getUserTier(await toGuildMember(interaction.member, interaction.guild));

      // Handle different button types
      if (customId.startsWith('tutorial_')) {
        await this.handleTutorialButton(interaction, userTier);
      } else if (customId.startsWith('analytics_')) {
        await this.handleAnalyticsButton(interaction, userTier);
      } else if (customId.startsWith('alert_')) {
        await this.handleAlertButton(interaction, userTier);
      } else if (customId.startsWith('edge_tracker_')) {
        await this.handleEdgeTrackerButton(interaction, userTier);
      } else if (customId.startsWith('pick_')) {
        await this.handlePickButton(interaction, userTier);
      } else {
        await interaction.reply({
          content: '❌ This button functionality is not yet implemented.',
          ephemeral: true,
        });
      }
    } catch (error) {
      logger.error('Error handling button interaction:', error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true,
        });
      }
    }
  }

  private async handleTutorialButton(interaction: ButtonInteraction, userTier: string) {
    const tutorialSteps = {
      tutorial_start: {
        content: "Welcome to Unit Talk! Let's get you started with the basics.",
        nextStep: 'tutorial_commands',
      },
      tutorial_commands: {
        content: 'Here are the essential commands you can use:',
        nextStep: 'tutorial_picks',
      },
      tutorial_picks: {
        content: 'Learn how to submit and track your picks:',
        nextStep: 'tutorial_alerts',
      },
      tutorial_alerts: {
        content: 'Set up your alert preferences:',
        nextStep: 'tutorial_complete',
      },
      tutorial_complete: {
        content: "Congratulations! You've completed the tutorial.",
        nextStep: null,
      },
    };

    const step = tutorialSteps[interaction.customId as keyof typeof tutorialSteps];
    if (!step) {
      await interaction.reply({
        content: '❌ Invalid tutorial step.',
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({
      content: step.content,
      ephemeral: true,
    });
  }

  private async handleAnalyticsButton(interaction: ButtonInteraction, userTier: string) {
    if (!['vip', 'vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Analytics features require VIP access or higher.',
        ephemeral: true,
      });
      return;
    }

    // Handle different analytics buttons
    const analyticsType = interaction.customId.replace('analytics_', '');

    try {
      const data = await this.supabaseService.getAnalyticsData(analyticsType);
      await interaction.reply({
        content: `📊 Here are your ${analyticsType} analytics:`,
        embeds: [data],
        ephemeral: true,
      });
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      await interaction.reply({
        content: '❌ Failed to fetch analytics data.',
        ephemeral: true,
      });
    }
  }

  private async handleAlertButton(interaction: ButtonInteraction, userTier: string) {
    if (!['vip', 'vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Alert configuration requires VIP access or higher.',
        ephemeral: true,
      });
      return;
    }

    const alertAction = interaction.customId.replace('alert_', '');

    try {
      switch (alertAction) {
        case 'save':
          await this.supabaseService.saveAlertPreferences(interaction.user.id, {});
          await interaction.reply({
            content: '✅ Alert preferences saved successfully!',
            ephemeral: true,
          });
          break;

        case 'reset':
          await this.supabaseService.resetAlertPreferences(interaction.user.id);
          await interaction.reply({
            content: '✅ Alert preferences reset to default.',
            ephemeral: true,
          });
          break;

        default:
          await interaction.reply({
            content: '❌ Invalid alert action.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error handling alert action:', error);
      await interaction.reply({
        content: '❌ Failed to process alert action.',
        ephemeral: true,
      });
    }
  }

  private async handleEdgeTrackerButton(interaction: ButtonInteraction, userTier: string) {
    if (!['vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Edge Tracker features require VIP+ access or higher.',
        ephemeral: true,
      });
      return;
    }

    const trackerAction = interaction.customId.replace('edge_tracker_', '');

    try {
      switch (trackerAction) {
        case 'update_goals':
          // Handle updating goals
          await interaction.reply({
            content: '✅ Goals updated successfully!',
            ephemeral: true,
          });
          break;

        case 'view_trends':
          // Handle viewing trends
          const trends = await this.supabaseService.getEdgeTrackerTrends(interaction.user.id);
          await interaction.reply({
            content: '📈 Here are your betting trends:',
            embeds: [trends],
            ephemeral: true,
          });
          break;

        default:
          await interaction.reply({
            content: '❌ Invalid Edge Tracker action.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error handling Edge Tracker action:', error);
      await interaction.reply({
        content: '❌ Failed to process Edge Tracker action.',
        ephemeral: true,
      });
    }
  }

  private async handlePickButton(interaction: ButtonInteraction, userTier: string) {
    if (!['vip_plus', 'black_label', 'admin', 'owner'].includes(userTier)) {
      await interaction.reply({
        content: '❌ Enhanced pick features require VIP+ access or higher.',
        ephemeral: true,
      });
      return;
    }

    const pickAction = interaction.customId.replace('pick_', '');

    try {
      switch (pickAction) {
        case 'submit':
          // Handle pick submission
          await interaction.reply({
            content: '✅ Pick submitted successfully!',
            ephemeral: true,
          });
          break;

        case 'history':
          // Handle viewing pick history
          const history = await this.supabaseService.getPickHistory(interaction.user.id);
          await interaction.reply({
            content: "📊 Here's your pick history:",
            embeds: [history],
            ephemeral: true,
          });
          break;

        default:
          await interaction.reply({
            content: '❌ Invalid pick action.',
            ephemeral: true,
          });
      }
    } catch (error) {
      logger.error('Error handling pick action:', error);
      await interaction.reply({
        content: '❌ Failed to process pick action.',
        ephemeral: true,
      });
    }
  }
}
