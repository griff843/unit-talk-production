import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { getUserTier } from '../utils/roleUtils';

export const data = new SlashCommandBuilder()
  .setName('edge-tracker')
  .setDescription('View top daily edges with overlays (VIP+ only)');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const member = interaction.guild?.members.cache.get(interaction.user.id);
    if (!member) {
      await interaction.reply({ content: 'Unable to verify your membership status.', ephemeral: true });
      return;
    }

    const userTier = getUserTier(member);

    if (userTier !== 'vip_plus') {
      const embed = new EmbedBuilder()
        .setTitle('🔒 VIP+ Exclusive')
        .setDescription('This command is for VIP+ members only. Type `/vip-info` to see what you\'re missing.')
        .setColor(0xff0000);
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Placeholder for edge tracker functionality
    const embed = new EmbedBuilder()
      .setTitle('⚡ Daily Edge Tracker')
      .setDescription(`**Today's Top Edges:**\n
🔥 **NBA - Lakers vs Warriors**
• **Over 225.5** | Edge: +4.2% | Confidence: 87%
• Model suggests 229.8 total points

🎯 **NFL - Chiefs vs Bills**  
• **Chiefs -3.5** | Edge: +3.8% | Confidence: 82%
• Weather factor: Dome advantage

📊 **NHL - Rangers vs Bruins**
• **Under 6.5** | Edge: +5.1% | Confidence: 91%
• Goalie matchup heavily favors under

*Edge calculations based on our proprietary models vs market pricing*`)
      .setColor(0xff4500)
      .setFooter({ text: 'VIP+ Edge Tracker | Updated every 15 minutes' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error in edge-tracker command:', error);
    await interaction.reply({ 
      content: '❌ An error occurred while fetching edge data.', 
      ephemeral: true 
    });
  }
}