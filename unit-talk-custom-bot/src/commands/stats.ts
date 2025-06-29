import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { supabaseService } from '../services/supabase';
import { createUserStatsEmbed } from '../utils/embeds';
import { permissionsService } from '../services/permissions';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your personal statistics')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('User to view stats for (admin only)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const targetUser = interaction.options.getUser('user');
    const member = interaction.member;
    
    if (!member || typeof member === 'string') {
      await interaction.reply({ 
        content: 'Unable to determine your permissions.', 
        ephemeral: true 
      });
      return;
    }

    // Check if user is trying to view someone else's stats
    if (targetUser && targetUser.id !== interaction.user.id) {
      const permissions = await permissionsService.getUserPermissions(member as any);
      if (!permissions.isAdmin) {
        await interaction.reply({ 
          content: 'You can only view your own statistics.', 
          ephemeral: true 
        });
        return;
      }
    }

    const userToCheck = targetUser || interaction.user;
    
    // Get user profile
    const userProfile = await supabaseService.getUserProfile(userToCheck.id);
    if (!userProfile) {
      await interaction.reply({ 
        content: 'No statistics found for this user.', 
        ephemeral: true 
      });
      return;
    }

    // Create stats embed
    const statsEmbed = createUserStatsEmbed(userProfile, userToCheck);
    
    await interaction.reply({ 
      embeds: [statsEmbed], 
      ephemeral: true 
    });

    logger.info(`Stats viewed for user ${userToCheck.username}`, {
      viewedBy: interaction.user.username,
      isAdmin: targetUser ? true : false
    });

  } catch (error) {
    logger.error('Error in stats command:', error);
    await interaction.reply({ 
      content: 'An error occurred while fetching statistics.', 
      ephemeral: true 
    });
  }
}