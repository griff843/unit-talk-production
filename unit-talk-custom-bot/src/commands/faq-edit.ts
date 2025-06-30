import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ComponentType,
  EmbedBuilder
} from 'discord.js';
import { FAQService, FAQItem } from '../services/faqService';
import { logger } from '../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('faq-edit')
  .setDescription('Edit an existing FAQ in the forum')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
  .addStringOption(option =>
    option.setName('title')
      .setDescription('The current FAQ title to edit')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option.setName('new_title')
      .setDescription('New FAQ title (leave empty to keep current)')
      .setRequired(false)
      .setMaxLength(100)
  )
  .addStringOption(option =>
    option.setName('new_icon')
      .setDescription('New emoji or icon (leave empty to keep current)')
      .setRequired(false)
      .setMaxLength(10)
  )
  .addStringOption(option =>
    option.setName('new_description')
      .setDescription('New FAQ description/answer (leave empty to keep current)')
      .setRequired(false)
      .setMaxLength(4000)
  )
  .addStringOption(option =>
    option.setName('new_button_label')
      .setDescription('New button label (use "REMOVE" to remove button)')
      .setRequired(false)
      .setMaxLength(80)
  )
  .addStringOption(option =>
    option.setName('new_button_url')
      .setDescription('New button URL (required if new_button_label is provided)')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    // Check if user has permission
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

    const currentTitle = interaction.options.getString('title', true);
    const newTitle = interaction.options.getString('new_title');
    const newIcon = interaction.options.getString('new_icon');
    const newDescription = interaction.options.getString('new_description');
    const newButtonLabel = interaction.options.getString('new_button_label');
    const newButtonUrl = interaction.options.getString('new_button_url');

    // Initialize FAQ service
    const faqService = new FAQService(interaction.client);

    // Find the existing thread
    const threads = await faqService.getAllFAQThreads();
    const existingThread = threads.find(thread => thread.name === currentTitle);

    if (!existingThread) {
      await interaction.editReply({
        content: `❌ FAQ with title "${currentTitle}" not found.`
      });
      return;
    }

    // Get current FAQ data from the thread's first message
    const messages = await existingThread.messages.fetch({ limit: 1 });
    const starterMessage = messages.first();
    
    if (!starterMessage || !starterMessage.embeds[0]) {
      await interaction.editReply({
        content: '❌ Could not retrieve current FAQ data.'
      });
      return;
    }

    const currentEmbed = starterMessage.embeds[0];
    const currentEmbedTitle = currentEmbed.title || '';
    const currentIcon = currentEmbedTitle.split(' ')[0] || '❓';
    const currentTitleText = currentEmbedTitle.replace(currentIcon, '').trim();
    const currentDescription = currentEmbed.description || '';
    
    // Get current button info
    const actionRow = starterMessage.components[0];
    const currentButton = actionRow && 'components' in actionRow ? actionRow.components[0] : null;
    const currentButtonLabel = currentButton && 'label' in currentButton ? currentButton.label : null;
    const currentButtonUrl = currentButton && 'url' in currentButton ? currentButton.url : null;

    // Validate new button parameters
    if (newButtonLabel && newButtonLabel !== 'REMOVE' && !newButtonUrl) {
      await interaction.editReply({
        content: '❌ Button URL is required when button label is provided.'
      });
      return;
    }

    if (newButtonUrl && (!newButtonLabel || newButtonLabel === 'REMOVE')) {
      await interaction.editReply({
        content: '❌ Button label is required when button URL is provided.'
      });
      return;
    }

    // Validate URL format if provided
    if (newButtonUrl) {
      try {
        new URL(newButtonUrl);
      } catch {
        await interaction.editReply({
          content: '❌ Invalid URL format for button URL.'
        });
        return;
      }
    }

    // Create updated FAQ item
    const updatedFAQ: FAQItem = {
      title: newTitle || currentTitleText,
      icon: newIcon || currentIcon,
      description: newDescription || currentDescription,
      button_label: newButtonLabel === 'REMOVE' ? null : (newButtonLabel || currentButtonLabel),
      button_url: newButtonLabel === 'REMOVE' ? null : (newButtonUrl || currentButtonUrl)
    };

    // Update the FAQ
    const updatedThread = await faqService.createOrUpdateFAQThread(updatedFAQ);

    if (updatedThread) {
      const successEmbed = new EmbedBuilder()
        .setTitle('✅ FAQ Updated Successfully')
        .setDescription(`FAQ has been updated successfully.`)
        .addFields(
          { name: 'Thread', value: `<#${updatedThread.id}>`, inline: true },
          { name: 'Title', value: `${currentTitleText} → ${updatedFAQ.title}`, inline: false },
          { name: 'Icon', value: `${currentIcon} → ${updatedFAQ.icon}`, inline: true },
          { name: 'Has Button', value: updatedFAQ.button_label ? 'Yes' : 'No', inline: true }
        )
        .setColor('#1EF763')
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });
      
      logger.info(`FAQ updated by ${interaction.user.tag}: ${currentTitle} → ${updatedFAQ.title}`);
    } else {
      await interaction.editReply({
        content: '❌ Failed to update FAQ thread. Please check the logs and try again.'
      });
    }

  } catch (error) {
    logger.error('Error in faq-edit command:', error);
    
    const errorMessage = '❌ An error occurred while editing the FAQ. Please try again.';
    
    if (interaction.deferred) {
      await interaction.editReply({ content: errorMessage });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
}

// Autocomplete handler for FAQ titles
export async function autocomplete(interaction: any) {
  try {
    const focusedValue = interaction.options.getFocused();
    const faqService = new FAQService(interaction.client);
    const threads = await faqService.getAllFAQThreads();
    
    const choices = threads
      .map(thread => ({ name: thread.name, value: thread.name }))
      .filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25); // Discord limit

    await interaction.respond(choices);
  } catch (error) {
    logger.error('Error in faq-edit autocomplete:', error);
    await interaction.respond([]);
  }
}