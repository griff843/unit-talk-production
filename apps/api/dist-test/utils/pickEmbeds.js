"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPickEmbed = createPickEmbed;
exports.createPickButtons = createPickButtons;
exports.createDailyPicksSummaryEmbed = createDailyPicksSummaryEmbed;
exports.createPickSelectionEmbed = createPickSelectionEmbed;
exports.createPickSelectionButtons = createPickSelectionButtons;
const discord_js_1 = require("discord.js");
const pickValidation_1 = require("./pickValidation");
const roleUtils_1 = require("./roleUtils");
/**
 * Creates a Discord embed for a single pick or parlay
 */
function createPickEmbed(pick, capper, options = {}) {
    const { showAnalysis = true, isPreview = false, showStats = false } = options;
    const embed = new discord_js_1.EmbedBuilder()
        .setColor((0, roleUtils_1.getTierColor)('ut_capper'))
        .setTimestamp();
    // Title
    const title = isPreview ?
        `🔍 Pick Preview - ${pick.pick_type === 'parlay' ? 'Parlay' : 'Single'}` :
        `🎯 ${pick.capper_username}'s ${pick.pick_type === 'parlay' ? 'Parlay' : 'Pick'}`;
    embed.setTitle(title);
    // Description with basic info
    const description = [
        `📅 **Event Date:** ${new Date(pick.event_date).toLocaleDateString()}`,
        `🎲 **Type:** ${pick.pick_type === 'parlay' ? `${pick.total_legs}-Leg Parlay` : 'Single Pick'}`,
        `💰 **Total Units:** ${pick.total_units}`,
        `📊 **Total Odds:** ${(0, pickValidation_1.formatOdds)(pick.total_odds)}`,
        `💵 **Potential Payout:** ${(0, pickValidation_1.calculatePayout)(pick.total_odds, pick.total_units).toFixed(2)} units`
    ];
    if (pick.status !== 'pending') {
        description.push(`🔄 **Status:** ${pick.status.charAt(0).toUpperCase() + pick.status.slice(1)}`);
    }
    embed.setDescription(description.join('\n'));
    // Add legs as fields
    pick.legs.forEach((leg, index) => {
        const legTitle = pick.pick_type === 'parlay' ?
            `Leg ${index + 1}: ${leg.sport} - ${leg.league}` :
            `${leg.sport} - ${leg.league}`;
        const legValue = [
            `🏟️ **Matchup:** ${leg.team_away} @ ${leg.team_home}`,
            `🎯 **Market:** ${formatMarketType(leg.market_type)}`,
        ];
        if (leg.market_type === 'player_prop' && leg.player_name) {
            legValue.push(`👤 **Player:** ${leg.player_name}`);
            legValue.push(`📈 **Stat:** ${formatStatType(leg.stat_type || '')}`);
        }
        legValue.push(`📋 **Selection:** ${leg.selection}`, `📏 **Line:** ${leg.line}`, `💰 **Odds:** ${(0, pickValidation_1.formatOdds)(leg.odds)}`, `🎲 **Units:** ${leg.units}`);
        if (leg.confidence && leg.confidence > 0) {
            legValue.push(`🔥 **Confidence:** ${leg.confidence}/10`);
        }
        embed.addFields({
            name: legTitle,
            value: legValue.join('\n'),
            inline: pick.pick_type === 'parlay' && pick.total_legs <= 3
        });
    });
    // Add analysis if provided and enabled
    if (showAnalysis && pick.analysis && pick.analysis.trim()) {
        embed.addFields({
            name: '📝 Analysis',
            value: pick.analysis.length > 1000 ?
                pick.analysis.substring(0, 997) + '...' :
                pick.analysis,
            inline: false
        });
    }
    // Add capper stats if provided and enabled
    if (showStats && capper) {
        const stats = capper.stats;
        const statsValue = [
            `📊 **Record:** ${stats.wins || 0}W-${stats.losses || 0}L-${stats.pushes || 0}P`,
            `📈 **Win Rate:** ${(stats.win_rate || 0).toFixed(1)}%`,
            `💰 **ROI:** ${(stats.roi || 0).toFixed(1)}%`,
            `🔥 **Current Streak:** ${stats.current_streak || 0} ${stats.current_streak_type || 'none'}`
        ].join('\n');
        embed.addFields({
            name: '📈 Capper Stats',
            value: statsValue,
            inline: true
        });
    }
    // Footer
    const footerText = isPreview ?
        'Preview - Not yet submitted' :
        `Pick ID: ${pick.id.substring(0, 8)}`;
    embed.setFooter({ text: footerText });
    return embed;
}
/**
 * Creates action row with buttons for pick interactions
 */
function createPickButtons(pickId, isPreview = false) {
    const row = new discord_js_1.ActionRowBuilder();
    if (isPreview) {
        row.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`edit_pick_${pickId}`)
            .setLabel('Edit')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('✏️'), new discord_js_1.ButtonBuilder()
            .setCustomId(`submit_pick_${pickId}`)
            .setLabel('Submit')
            .setStyle(discord_js_1.ButtonStyle.Success)
            .setEmoji('✅'), new discord_js_1.ButtonBuilder()
            .setCustomId(`cancel_pick_${pickId}`)
            .setLabel('Cancel')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('❌'));
    }
    else {
        row.addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(`edit_pick_${pickId}`)
            .setLabel('Edit')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('✏️'), new discord_js_1.ButtonBuilder()
            .setCustomId(`delete_pick_${pickId}`)
            .setLabel('Delete')
            .setStyle(discord_js_1.ButtonStyle.Danger)
            .setEmoji('🗑️'), new discord_js_1.ButtonBuilder()
            .setCustomId(`view_pick_details_${pickId}`)
            .setLabel('Details')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('📊'));
    }
    return row;
}
/**
 * Creates a summary embed for multiple picks (daily publishing)
 */
function createDailyPicksSummaryEmbed(picks, capper, date) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor((0, roleUtils_1.getTierColor)('ut_capper'))
        .setTitle(`🎯 ${capper.display_name || capper.username}'s Picks - ${new Date(date).toLocaleDateString()}`)
        .setTimestamp();
    if (picks.length === 0) {
        embed.setDescription('📭 No picks submitted for today.');
        return embed;
    }
    // Summary stats
    const totalPicks = picks.length;
    const totalUnits = picks.reduce((sum, pick) => sum + pick.total_units, 0);
    const avgOdds = picks.reduce((sum, pick) => sum + pick.total_odds, 0) / picks.length;
    const parlayCount = picks.filter(pick => pick.pick_type === 'parlay').length;
    const summaryDescription = [
        `📊 **Total Picks:** ${totalPicks}`,
        `🎲 **Total Units:** ${totalUnits.toFixed(1)}`,
        `📈 **Average Odds:** ${(0, pickValidation_1.formatOdds)(Math.round(avgOdds))}`,
        `🔗 **Parlays:** ${parlayCount}`,
        `📅 **Published:** ${new Date().toLocaleTimeString()}`
    ].join('\n');
    embed.setDescription(summaryDescription);
    // Add each pick as a field
    picks.forEach((pick, index) => {
        const pickTitle = `${index + 1}. ${pick.pick_type === 'parlay' ? `${pick.total_legs}-Leg Parlay` : 'Single Pick'}`;
        const pickSummary = pick.legs.map((leg) => {
            let legSummary = `${leg.team_away} @ ${leg.team_home}`;
            if (leg.market_type === 'player_prop' && leg.player_name) {
                legSummary += ` - ${leg.player_name} ${formatStatType(leg.stat_type || '')}`;
            }
            legSummary += ` ${leg.selection} ${leg.line} (${(0, pickValidation_1.formatOdds)(leg.odds)})`;
            return legSummary;
        }).join('\n');
        const pickValue = [
            pickSummary,
            `💰 **${pick.total_units} units @ ${(0, pickValidation_1.formatOdds)(pick.total_odds)}**`
        ].join('\n\n');
        embed.addFields({
            name: pickTitle,
            value: pickValue.length > 1000 ? pickValue.substring(0, 997) + '...' : pickValue,
            inline: false
        });
    });
    // Add capper stats
    const stats = capper.stats;
    if (stats) {
        const statsValue = [
            `📊 **Season Record:** ${stats.wins || 0}W-${stats.losses || 0}L-${stats.pushes || 0}P`,
            `📈 **Win Rate:** ${(stats.win_rate || 0).toFixed(1)}%`,
            `💰 **ROI:** ${(stats.roi || 0).toFixed(1)}%`,
            `🔥 **Current Streak:** ${stats.current_streak || 0} ${stats.current_streak_type || 'none'}`
        ].join('\n');
        embed.addFields({
            name: '📈 Season Stats',
            value: statsValue,
            inline: false
        });
    }
    embed.setFooter({
        text: `UT Capper • Total Picks: ${totalPicks} • Total Units: ${totalUnits.toFixed(1)}`
    });
    return embed;
}
/**
 * Creates an embed for pick selection (edit/delete commands)
 */
function createPickSelectionEmbed(picks, action) {
    const embed = new discord_js_1.EmbedBuilder()
        .setColor((0, roleUtils_1.getTierColor)('ut_capper'))
        .setTitle(`${action === 'edit' ? '✏️ Edit Pick' : '🗑️ Delete Pick'}`)
        .setDescription(`Select a pick to ${action}:`);
    if (picks.length === 0) {
        embed.setDescription('📭 No picks found to ' + action + '.');
        return embed;
    }
    picks.forEach((pick, index) => {
        const pickTitle = `${index + 1}. ${pick.pick_type === 'parlay' ? `${pick.total_legs}-Leg Parlay` : 'Single Pick'}`;
        const pickSummary = [
            `📅 **Date:** ${new Date(pick.event_date).toLocaleDateString()}`,
            `💰 **Units:** ${pick.total_units} @ ${(0, pickValidation_1.formatOdds)(pick.total_odds)}`,
            `🔄 **Status:** ${pick.status}`,
            `⏰ **Created:** ${new Date(pick.created_at).toLocaleString()}`
        ].join('\n');
        embed.addFields({
            name: pickTitle,
            value: pickSummary,
            inline: true
        });
    });
    return embed;
}
/**
 * Creates buttons for pick selection
 */
function createPickSelectionButtons(picks, action) {
    const rows = [];
    let currentRow = new discord_js_1.ActionRowBuilder();
    let buttonsInRow = 0;
    picks.forEach((pick, index) => {
        if (buttonsInRow >= 5) {
            rows.push(currentRow);
            currentRow = new discord_js_1.ActionRowBuilder();
            buttonsInRow = 0;
        }
        const button = new discord_js_1.ButtonBuilder()
            .setCustomId(`${action}_pick_select_${pick.id}`)
            .setLabel(`${index + 1}`)
            .setStyle(action === 'delete' ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Primary);
        currentRow.addComponents(button);
        buttonsInRow++;
    });
    if (buttonsInRow > 0) {
        rows.push(currentRow);
    }
    // Add cancel button
    const cancelRow = new discord_js_1.ActionRowBuilder()
        .addComponents(new discord_js_1.ButtonBuilder()
        .setCustomId(`cancel_${action}_pick`)
        .setLabel('Cancel')
        .setStyle(discord_js_1.ButtonStyle.Secondary)
        .setEmoji('❌'));
    rows.push(cancelRow);
    return rows;
}
/**
 * Helper function to format market types for display
 */
function formatMarketType(marketType) {
    switch (marketType) {
        case 'spread':
            return 'Point Spread';
        case 'total':
            return 'Over/Under';
        case 'moneyline':
            return 'Moneyline';
        case 'player_prop':
            return 'Player Prop';
        default:
            return marketType.charAt(0).toUpperCase() + marketType.slice(1);
    }
}
/**
 * Helper function to format stat types for display
 */
function formatStatType(statType) {
    switch (statType.toLowerCase()) {
        case 'points':
            return 'Points';
        case 'rebounds':
            return 'Rebounds';
        case 'assists':
            return 'Assists';
        case 'steals':
            return 'Steals';
        case 'blocks':
            return 'Blocks';
        case 'threes':
        case '3pm':
            return '3-Pointers Made';
        case 'pra':
            return 'Points + Rebounds + Assists';
        case 'pr':
            return 'Points + Rebounds';
        case 'pa':
            return 'Points + Assists';
        case 'ra':
            return 'Rebounds + Assists';
        case 'rushing_yards':
            return 'Rushing Yards';
        case 'receiving_yards':
            return 'Receiving Yards';
        case 'passing_yards':
            return 'Passing Yards';
        case 'touchdowns':
            return 'Touchdowns';
        case 'receptions':
            return 'Receptions';
        default:
            return statType.charAt(0).toUpperCase() + statType.slice(1);
    }
}
