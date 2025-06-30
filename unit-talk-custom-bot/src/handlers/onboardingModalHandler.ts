import { ModalSubmitInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { logger } from '../utils/logger';

/**
 * Onboarding Modal Handler
 * Handles modal submissions from onboarding flows
 */
export class OnboardingModalHandler {
  
  /**
   * Handle onboarding modal submissions
   */
  async handleOnboardingModal(interaction: ModalSubmitInteraction): Promise<void> {
    const { customId, user } = interaction;
    
    try {
      logger.info(`Onboarding modal submitted: ${customId} by ${user.tag}`);
      
      switch (customId) {
        case 'capper_onboarding_modal':
          await this.handleCapperOnboardingModal(interaction);
          break;
          
        default:
          await this.handleUnknownModal(interaction);
      }
      
    } catch (error) {
      logger.error(`Error handling onboarding modal ${customId}:`, error);
      await this.handleModalError(interaction, error);
    }
  }
  
  /**
   * Handle capper onboarding modal submission
   */
  private async handleCapperOnboardingModal(interaction: ModalSubmitInteraction): Promise<void> {
    // Extract form data
    const capperName = interaction.fields.getTextInputValue('capper_name');
    const experience = interaction.fields.getTextInputValue('capper_experience');
    const sports = interaction.fields.getTextInputValue('capper_sports');
    const bio = interaction.fields.getTextInputValue('capper_bio') || 'No bio provided';
    
    // Validate experience level
    const validExperience = ['beginner', 'intermediate', 'expert'];
    const normalizedExperience = experience.toLowerCase();
    
    if (!validExperience.includes(normalizedExperience)) {
      await interaction.reply({
        content: '❌ Experience level must be: Beginner, Intermediate, or Expert',
        ephemeral: true
      });
      return;
    }
    
    // Create confirmation embed
    const embed = new EmbedBuilder()
      .setTitle('🎯 Capper Application Submitted!')
      .setDescription('Thank you for completing your capper onboarding! Your application is now under review.')
      .setColor(0x00FF00)
      .addFields(
        {
          name: '👤 Capper Name',
          value: capperName,
          inline: true
        },
        {
          name: '📊 Experience Level',
          value: experience,
          inline: true
        },
        {
          name: '🏈 Sports Specialization',
          value: sports,
          inline: false
        },
        {
          name: '📝 Bio',
          value: bio.length > 100 ? bio.substring(0, 100) + '...' : bio,
          inline: false
        },
        {
          name: '⏳ What\'s Next?',
          value: '• Admin team will review your application\n• You\'ll be notified within 24-48 hours\n• Once approved, you can start submitting picks\n• Your performance will be tracked automatically',
          inline: false
        },
        {
          name: '🚀 Get Started',
          value: 'While you wait, check out the capper guide and familiarize yourself with our pick submission process!',
          inline: false
        }
      )
      .setFooter({ text: 'Welcome to the Unit Talk capper community! 🎉' })
      .setTimestamp();
    
    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('capper_guide')
          .setLabel('View Capper Guide')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📖'),
        new ButtonBuilder()
          .setCustomId('view_leaderboard')
          .setLabel('View Leaderboard')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏆'),
        new ButtonBuilder()
          .setCustomId('capper_support')
          .setLabel('Contact Support')
          .setStyle(ButtonStyle.Success)
          .setEmoji('💬')
      );
    
    await interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true
    });
    
    // Log the application for admin review
    logger.info('Capper application submitted', {
      userId: interaction.user.id,
      username: interaction.user.tag,
      capperName,
      experience: normalizedExperience,
      sports,
      bio: bio.substring(0, 200), // Truncate for logging
      timestamp: new Date().toISOString()
    });
    
    // TODO: Store in database and notify admins
    // This would typically:
    // 1. Save application to database
    // 2. Send notification to admin channel
    // 3. Create pending approval record
    // 4. Set up follow-up reminders
    
    await this.notifyAdminsOfNewApplication(interaction, {
      capperName,
      experience: normalizedExperience,
      sports,
      bio,
      user: interaction.user
    });
  }
  
  /**
   * Notify admins of new capper application
   */
  private async notifyAdminsOfNewApplication(
    interaction: ModalSubmitInteraction, 
    applicationData: {
      capperName: string;
      experience: string;
      sports: string;
      bio: string;
      user: User;
    }
  ): Promise<void> {
    try {
      // Find admin channel (you'll need to configure this)
      const adminChannelId = '1234567890123456789'; // Replace with actual admin channel ID
      const adminChannel = interaction.guild?.channels.cache.get(adminChannelId);
      
      if (!adminChannel || !adminChannel.isTextBased()) {
        logger.warn('Admin channel not found or not text-based');
        return;
      }
      
      const adminEmbed = new EmbedBuilder()
        .setTitle('🎯 New Capper Application')
        .setDescription(`${applicationData.user.tag} has submitted a capper application`)
        .setColor(0xFFA500)
        .addFields(
          {
            name: '👤 User',
            value: `<@${applicationData.user.id}> (${applicationData.user.tag})`,
            inline: true
          },
          {
            name: '🎯 Capper Name',
            value: applicationData.capperName,
            inline: true
          },
          {
            name: '📊 Experience',
            value: applicationData.experience,
            inline: true
          },
          {
            name: '🏈 Sports',
            value: applicationData.sports,
            inline: false
          },
          {
            name: '📝 Bio',
            value: applicationData.bio || 'No bio provided',
            inline: false
          }
        )
        .setThumbnail(applicationData.user.displayAvatarURL())
        .setFooter({ text: 'Capper Application Review Required' })
        .setTimestamp();
      
      const adminActionRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`approve_capper_${applicationData.user.id}`)
            .setLabel('Approve')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setCustomId(`reject_capper_${applicationData.user.id}`)
            .setLabel('Reject')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌'),
          new ButtonBuilder()
            .setCustomId(`review_capper_${applicationData.user.id}`)
            .setLabel('Request More Info')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
        );
      
      await adminChannel.send({
        embeds: [adminEmbed],
        components: [adminActionRow]
      });
      
      logger.info('Admin notification sent for capper application', {
        userId: applicationData.user.id,
        capperName: applicationData.capperName
      });
      
    } catch (error) {
      logger.error('Failed to notify admins of capper application:', error);
    }
  }
  
  /**
   * ERROR HANDLERS
   */
  
  private async handleUnknownModal(interaction: ModalSubmitInteraction): Promise<void> {
    logger.warn(`Unknown onboarding modal: ${interaction.customId}`);
    
    await interaction.reply({
      content: '❓ This form is not yet implemented. Please contact support if you need assistance.',
      ephemeral: true
    });
  }
  
  private async handleModalError(interaction: ModalSubmitInteraction, error: any): Promise<void> {
    logger.error('Modal interaction error:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ An error occurred while processing your form. Please try again or contact support.',
        ephemeral: true
      }).catch(() => {
        // Ignore reply errors
      });
    }
  }
  
  /**
   * Check if a modal ID is an onboarding modal
   */
  static isOnboardingModal(customId: string): boolean {
    const onboardingModals = [
      'capper_onboarding_modal'
      // Add other onboarding modals here as they're created
    ];
    
    return onboardingModals.includes(customId);
  }
}