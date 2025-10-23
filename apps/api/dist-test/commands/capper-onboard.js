"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
exports.handleTierSelect = handleTierSelect;
exports.handleOnboardModal = handleOnboardModal;
const discord_js_1 = require("discord.js");
const capperService_1 = require("../services/capperService");
const logger_1 = require("../shared/logger");
const roleUtils_1 = require("../utils/roleUtils");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('capper-onboard')
    .setDescription('Complete your capper onboarding process');
async function execute(interaction) {
    try {
        // Check if user has capper role
        const member = interaction.member;
        if (!(0, roleUtils_1.hasRole)(member, 'UT Capper')) {
            await interaction.reply({
                content: '❌ You need the **UT Capper** role to complete onboarding. Please contact an admin.',
                ephemeral: true
            });
            return;
        }
        // Check if user already has a profile
        const existingProfile = await capperService_1.capperService.getCapperByDiscordId(interaction.user.id);
        if (existingProfile) {
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle('✅ Already Onboarded')
                .setColor(0x00ff00)
                .setDescription('You have already completed the capper onboarding process.')
                .addFields({ name: 'Display Name', value: existingProfile.display_name || 'Not set', inline: true }, { name: 'Tier', value: existingProfile.tier || 'Not set', inline: true }, { name: 'Status', value: existingProfile.status || 'active', inline: true })
                .setTimestamp();
            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });
            return;
        }
        // Show tier selection
        const selectMenu = new discord_js_1.StringSelectMenuBuilder()
            .setCustomId('tier_select')
            .setPlaceholder('Choose your capper tier')
            .addOptions([
            new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel('Rookie')
                .setValue('rookie')
                .setDescription('New capper, building track record'),
            new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel('Pro')
                .setValue('pro')
                .setDescription('Experienced capper with proven results'),
            new discord_js_1.StringSelectMenuOptionBuilder()
                .setLabel('Elite')
                .setValue('elite')
                .setDescription('Top-tier capper with exceptional performance')
        ]);
        const row = new discord_js_1.ActionRowBuilder()
            .addComponents(selectMenu);
        await interaction.reply({
            content: '**🎯 Capper Onboarding**\n\nWelcome to UT Cappers! Please select your tier to get started:',
            components: [row],
            ephemeral: true
        });
    }
    catch (error) {
        logger_1.logger.error('Error in capper-onboard command', { error });
        await interaction.reply({
            content: '❌ An error occurred during onboarding.',
            ephemeral: true
        });
    }
}
async function handleTierSelect(interaction) {
    try {
        const tier = interaction.values[0];
        // Show onboarding form
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(`onboard_modal_${tier}`)
            .setTitle('Complete Capper Profile');
        const displayNameInput = new discord_js_1.TextInputBuilder()
            .setCustomId('display_name')
            .setLabel('Display Name')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder('How you want to be known (e.g., The Analyst?: string)')
            .setRequired(true)
            .setMaxLength(50);
        const bioInput = new discord_js_1.TextInputBuilder()
            .setCustomId('bio')
            .setLabel('Bio')
            .setStyle(discord_js_1.TextInputStyle.Paragraph)
            .setPlaceholder('Tell us about your betting experience and expertise...')
            .setRequired(false)
            .setMaxLength(500);
        const specialtiesInput = new discord_js_1.TextInputBuilder()
            .setCustomId('specialties')
            .setLabel('Specialties')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder('e.g., NBA, NFL, Soccer (comma separated)')
            .setRequired(false)
            .setMaxLength(200);
        const experienceInput = new discord_js_1.TextInputBuilder()
            .setCustomId('experience')
            .setLabel('Years of Experience')
            .setStyle(discord_js_1.TextInputStyle.Short)
            .setPlaceholder('e.g., 3')
            .setRequired(false);
        const rows = [
            new discord_js_1.ActionRowBuilder().addComponents(displayNameInput),
            new discord_js_1.ActionRowBuilder().addComponents(bioInput),
            new discord_js_1.ActionRowBuilder().addComponents(specialtiesInput),
            new discord_js_1.ActionRowBuilder().addComponents(experienceInput)
        ];
        modal.addComponents(...rows);
        await interaction.showModal(modal);
    }
    catch (error) {
        logger_1.logger.error('Error handling tier selection', { error });
        await interaction.reply({
            content: '❌ An error occurred while processing your selection.',
            ephemeral: true
        });
    }
}
async function handleOnboardModal(interaction) {
    try {
        // Extract tier from custom ID
        const tier = interaction.customId.split('_')[2];
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
        const profile = await capperService_1.capperService.createCapperProfile({
            discordId: interaction.user.id,
            name: displayName,
            username: interaction.user.username,
            displayName: displayName,
            tier: tier
        });
        // Success response
        const successEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🎉 Onboarding Complete!')
            .setColor(0x00ff00)
            .setDescription(`Welcome to UT Cappers, **${displayName}**!`)
            .addFields({ name: 'Tier', value: tier.toUpperCase(), inline: true }, { name: 'Profile ID', value: profile?.id || 'Unknown', inline: true }, { name: 'Status', value: 'ACTIVE', inline: true })
            .addFields({ name: 'Next Steps', value: '• Use `/submit-pick` to submit your first pick\n• Use `/my-picks` to view your picks\n• Use `/my-stats` to track your performance', inline: false })
            .setTimestamp();
        if (specialties.length > 0) {
            successEmbed.addFields({ name: 'Specialties', value: specialties.join(', '), inline: false });
        }
        await interaction.reply({
            embeds: [successEmbed],
            ephemeral: true
        });
    }
    catch (error) {
        logger_1.logger.error('Error handling onboard modal', { error });
        await interaction.reply({
            content: '❌ An error occurred while creating your profile. Please try again.',
            ephemeral: true
        });
    }
}
