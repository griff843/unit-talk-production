import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  PermissionFlagsBits,
  EmbedBuilder 
} from 'discord.js';
import { FAQService, FAQItem } from '../services/faqService';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('faq-add')
  .setDescription('Add a new FAQ to the forum')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option.setName('title')
      .setDescription('The FAQ title')
      .setRequired(true)
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option.setName('icon')
      .setDescription('The emoji or icon for the FAQ')
      .setRequired(true)
      .setMaxLength(10)
  )
  .addStringOption(option =>
    option.setName('description')
      .setDescription('The FAQ description/answer')
      .setRequired(true)
      .setMaxLength(4000)
  )
  .addStringOption(option =>
    option.setName('button_label')
      .setDescription('Optional button label')
      .setRequired(false)
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option.setName('button_url')
      .setDescription('Optional button URL (required if button_label is provided)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has permission (additional check beyond default permissions)
    const member = interaction.member;
    if (!member || !interaction.guild) {
      await interaction.reply({ 
        content: '❌ This command can only be used in a server.', 
        ephemeral: true 
      });
      return;
    }

    // Defer reply as this might take a moment
    await interaction.deferReply({ ephemeral: true });

    // Get command options
    const title = interaction.options.getString('title', true);
    const icon = interaction.options.getString('icon', true);
    const description = interaction.options.getString('description', true);
    const buttonLabel = interaction.options.getString('button_label');
    const buttonUrl = interaction.options.getString('button_url');

    // Validate button parameters
    if (buttonLabel && !buttonUrl) {
      await interaction.editReply({
        content: '❌ Button URL is required when button label is provided.'
      });
      return;
    }

    if (buttonUrl && !buttonLabel) {
      await interaction.editReply({
        content: '❌ Button label is required when button URL is provided.'
      });
      return;
    }

    // Validate URL format if provided
    if (buttonUrl) {
      try {
        new URL(buttonUrl);
      } catch {
        await interaction.editReply({
          content: '❌ Invalid URL format for button URL.'
        });
        return;
      }
    }

    // Create FAQ item
    const faqItem: FAQItem = {
      title,
      icon,
      description,
      button_label: buttonLabel,
      button_url: buttonUrl
    };

    // Initialize FAQ service and create thread
    const faqService = new FAQService(interaction.client);
    const thread = await faqService.createOrUpdateFAQThread(faqItem);

    if (thread) {
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ FAQ Added Successfully')
        .setDescription(`FAQ "${title}" has been added to the forum.`)
        .addFields(
          { name: 'Thread', value: `<#${thread.id}>`, inline: true },
          { name: 'Icon', value: icon, inline: true },
          { name: 'Has Button', value: buttonLabel ? 'Yes' : 'No', inline: true }
        )
        .setColor('#1EF763')
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
      
      logger.info(`FAQ added by ${interaction.user.tag}: ${title}`);
    } else {
      await interaction.editReply({
        content: '❌ Failed to create FAQ thread. Please check the logs and try again.'
      });
    }

  } catch (error) {
    logger.error('Error in faq-add command:', error);
    
    const errorMessage = '❌ An error occurred while adding the FAQ. Please try again.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}