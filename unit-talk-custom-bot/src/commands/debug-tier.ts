import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { getUserTier, getTierDisplayName } from '../utils/roleUtils';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('debug-tier')
  .setDescription('Debug: Check your current tier and roles');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.member as GuildMember;
    
    if (!member) {
      await interaction.reply({
        content: '❌ Could not get member information.',
        ephemeral: true
      });
      return;
    }

    // Get user's roles
    const roleNames = member.roles.cache.map(role => role.name).join(', ');
    
    // Get detected tier
    const tier = getUserTier(member);
    const tierDisplay = getTierDisplayName(tier);
    
    // Log for debugging
    logger.info(`Debug tier check for ${member.user.tag}: roles=[${roleNames}], tier=${tier}`);
    
    await interaction.reply({
      content: `🔍 **Debug Information for ${member.user.tag}**\n\n` +
               `**Discord Roles:** ${roleNames || 'None'}\n` +
               `**Detected Tier:** ${tier}\n` +
               `**Tier Display:** ${tierDisplay}`,
      ephemeral: true
    });
    
  } catch (error) {
    logger.error('Error in debug-tier command:', error);
    await interaction.reply({
      content: '❌ An error occurred while checking your tier.',
      ephemeral: true
    });
  }
}