import {
  SlashCommandBuilder,
  CommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  GuildMember
} from 'discord.js';
import { capperService } from '../services/capperService';
import { logger } from '../shared/logger';
import { hasRole } from '../utils/roleUtils';


export const data = new SlashCommandBuilder()
  .setName('capper-onboard')
  .setDescription('Complete your capper onboarding process');

export async function execute(interaction: CommandInteraction) {
  try {
    // Check if user has capper role
    const member = interaction.member as GuildMember;
    if (!hasRole(member, 'UT Capper')) {
      await interaction.reply({
        content: '❌ You need the **UT Capper** role to complete onboarding. Please contact an admin.',
        ephemeral: true
      });
      return;
    }

    // Check if user already has a profile
    const existingProfile = await capperService.getCapperByDiscordId(interaction.user.id);
    if (existingProfile) {
      const embed = new EmbedBuilder()
        .setTitle('✅ Already Onboarded')
        .setColor(0x00ff00)
        .setDescription('You have already completed the capper onboarding process.')
        .addFields(
          { name: 'Display Name', value: existingProfile.display_name || 'Not set', inline: true },
          { name: 'Tier', value: existingProfile.tier || 'Not set', inline: true },
          { name: 'Status', value: existingProfile.status || 'active', inline: true }
        )
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
      return;
    }

    // Show tier selection
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('tier_select')
      .setPlaceholder('Choose your capper tier')
      .addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel('Rookie')
          .setValue('rookie')
          .setDescription('New capper, building track record'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Pro')
          .setValue('pro')
          .setDescription('Experienced capper with proven results'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Elite')
          .setValue('elite')
          .setDescription('Top-tier capper with exceptional performance')
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
      .addComponents(selectMenu);

    await interaction.reply({
      content: '**🎯 Capper Onboarding**\n\nWelcome to UT Cappers! Please select your tier to get started:',
      components: [row],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error in capper-onboard command', { error });
    await interaction.reply({
      content: '❌ An error occurred during onboarding.',
      ephemeral: true
    });
  }
}

export async function handleTierSelect(interaction: StringSelectMenuInteraction) {
  try {
    const tier = interaction.values[0] as 'rookie' | 'pro' | 'elite';

    // Show onboarding form
    const modal = new ModalBuilder()
      .setCustomId(`onboard_modal_${tier}`)
      .setTitle('Complete Capper Profile');

    const displayNameInput = new TextInputBuilder()
      .setCustomId('display_name')
      .setLabel('Display Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('How you want to be known (e.g., "The Analyst")')
      .setRequired(true)
      .setMaxLength(50);

    const bioInput = new TextInputBuilder()
      .setCustomId('bio')
      .setLabel('Bio')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tell us about your betting experience and expertise...')
      .setRequired(false)
      .setMaxLength(500);

    const specialtiesInput = new TextInputBuilder()
      .setCustomId('specialties')
      .setLabel('Specialties')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., NBA, NFL, Soccer (comma separated)')
      .setRequired(false)
      .setMaxLength(200);

    const experienceInput = new TextInputBuilder()
      .setCustomId('experience')
      .setLabel('Years of Experience')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 3')
      .setRequired(false);

    const rows = [
      new ActionRowBuilder<TextInputBuilder>().addComponents(displayNameInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(bioInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(specialtiesInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput)
    ];

    modal.addComponents(...rows);
    await interaction.showModal(modal);

  } catch (error) {
    logger.error('Error handling tier selection', { error });
    await interaction.reply({
      content: '❌ An error occurred while processing your selection.',
      ephemeral: true
    });
  }
}

export async function handleOnboardModal(interaction: ModalSubmitInteraction) {
  try {
    // Extract tier from custom ID
    const tier = interaction.customId.split('_')[2] as 'rookie' | 'pro' | 'elite';

    const displayName = interaction.fields.getTextInputValue('display_name');
    // const bio = interaction.fields.getTextInputValue('bio') || null;
    const specialtiesStr = interaction.fields.getTextInputValue('specialties') || null;
    const experienceStr = interaction.fields.getTextInputValue('experience') || null;

    // Parse specialties
    const specialties = specialtiesStr
      ? specialtiesStr.split(',').map(s => s.trim()).filter(s => s.length > 0)
      : [];

    // Parse experience
    // let experience = null;
    if (experienceStr) {
      const exp = parseInt(experienceStr);
      if (!isNaN(exp) && exp >= 0) {
        // experience = exp;
      }
    }

    // Create the profile
    const profile = await capperService.createCapperProfile({
      discordId: interaction.user.id,
      username: interaction.user.username,
      displayName: displayName,
      tier: tier
    });

    // Success response
    const successEmbed = new EmbedBuilder()
      .setTitle('🎉 Onboarding Complete!')
      .setColor(0x00ff00)
      .setDescription(`Welcome to UT Cappers, **${displayName}**!`)
      .addFields(
        { name: 'Tier', value: tier.toUpperCase(), inline: true },
        { name: 'Profile ID', value: profile.id, inline: true },
        { name: 'Status', value: 'ACTIVE', inline: true }
      )
      .addFields(
        { name: 'Next Steps', value: '• Use `/submit-pick` to submit your first pick\n• Use `/my-picks` to view your picks\n• Use `/my-stats` to track your performance', inline: false }
      )
      .setTimestamp();

    if (specialties.length > 0) {
      successEmbed.addFields({ name: 'Specialties', value: specialties.join(', '), inline: false });
    }

    await interaction.reply({
      embeds: [successEmbed],
      ephemeral: true
    });

  } catch (error) {
    logger.error('Error handling onboard modal', { error });
    await interaction.reply({
      content: '❌ An error occurred while creating your profile. Please try again.',
      ephemeral: true
    });
  }
}