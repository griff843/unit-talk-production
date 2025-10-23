"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = void 0;
exports.execute = execute;
const discord_js_1 = require("discord.js");
const capperService_1 = require("../services/capperService");
const logger_1 = require("../shared/logger");
const roleUtils_1 = require("../utils/roleUtils");
exports.data = new discord_js_1.SlashCommandBuilder()
    .setName('delete-pick')
    .setDescription('Delete one of your pending picks');
async function execute(interaction) {
    try {
        // Check if user has capper role
        const member = interaction.member;
        if (!(0, roleUtils_1.hasRole)(member, 'UT Capper')) {
            await interaction.reply({
                content: '❌ You need the **UT Capper** role to delete picks.',
                ephemeral: true
            });
            return;
        }
        // Check if user has a capper profile
        const capperProfile = await capperService_1.capperService.getCapperByDiscordId(interaction.user.id);
        if (!capperProfile) {
            await interaction.reply({
                content: '❌ You need to complete capper onboarding first. Use `/capper-onboard` to get started.',
                ephemeral: true
            });
            return;
        }
        // Get today's picks
        const today = new Date().toISOString().split('T')[0];
        const picks = await capperService_1.capperService.getCapperPicks(capperProfile.id, today, 'pending');
        if (picks.length === 0) {
            await interaction.reply({
                content: '❌ You have no pending picks to delete for today.',
                ephemeral: true
            });
            return;
        }
        // Show picks list
        const embed = new discord_js_1.EmbedBuilder()
            .setTitle('🗑️ Your Pending Picks')
            .setColor(0xff0000)
            .setDescription('Here are your pending picks for today:');
        picks.forEach((pick, index) => {
            const legs = pick.legs;
            const legText = legs.map(leg => `${leg.selection} (${leg.odds > 0 ? '+' : ''}${leg.odds})`).join('\n');
            embed.addFields({
                name: `Pick ${index + 1} - ${pick.pick_type.toUpperCase()}`,
                value: `${legText}\nUnits: ${pick.total_units}\nID: ${pick.id}`,
                inline: false
            });
        });
        embed.setFooter({ text: 'Contact an admin to delete specific picks using the Pick ID.' });
        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
    catch (error) {
        logger_1.logger.error('Error in delete-pick command', { error });
        await interaction.reply({
            content: '❌ An error occurred while fetching your picks.',
            ephemeral: true
        });
    }
}
