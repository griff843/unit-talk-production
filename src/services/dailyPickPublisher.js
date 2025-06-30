"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyPickPublisher = exports.DailyPickPublisher = void 0;
const discord_js_1 = require("discord.js");
const capperService_1 = require("./capperService");
const logger_1 = require("../shared/logger");
const roleUtils_1 = require("../utils/roleUtils");
class DailyPickPublisher {
    constructor(client, channelId) {
        this.isRunning = false;
        this.client = client;
        this.channelId = channelId;
    }
    async publishDailyPicks() {
        if (this.isRunning) {
            logger_1.logger.info('Daily pick publishing already in progress');
            return;
        }
        this.isRunning = true;
        logger_1.logger.info('Starting daily pick publishing');
        try {
            const today = new Date().toISOString().split('T')[0];
            const picks = await capperService_1.capperService.getPicksForDate(today, 'pending');
            if (picks.length === 0) {
                logger_1.logger.info('No pending picks found for today');
                return;
            }
            const channel = this.client.channels.cache.get(this.channelId);
            if (!channel) {
                logger_1.logger.error('Publishing channel not found', { channelId: this.channelId });
                return;
            }
            const picksByCapper = new Map();
            for (const pick of picks) {
                if (!picksByCapper.has(pick.capper_id)) {
                    picksByCapper.set(pick.capper_id, []);
                }
                picksByCapper.get(pick.capper_id).push(pick);
            }
            for (const [capperId, capperPicks] of picksByCapper) {
                await this.publishCapperPicks(channel, capperPicks);
                const pickIds = capperPicks.map((p) => p.id);
                await capperService_1.capperService.finalizePicks(pickIds);
            }
            logger_1.logger.info('Daily pick publishing completed', {
                totalPicks: picks.length,
                cappers: picksByCapper.size
            });
        }
        catch (error) {
            logger_1.logger.error('Error during daily pick publishing', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
        finally {
            this.isRunning = false;
        }
    }
    async publishCapperPicks(channel, picks) {
        try {
            const firstPick = picks[0];
            const capperProfile = await capperService_1.capperService.getCapperByDiscordId(firstPick.capper_discord_id);
            if (!capperProfile) {
                logger_1.logger.error('Capper profile not found', {
                    capperId: firstPick.capper_id
                });
                return;
            }
            const embed = new discord_js_1.EmbedBuilder()
                .setTitle(`🎯 ${capperProfile.display_name || capperProfile.username}'s Picks`)
                .setColor((0, roleUtils_1.getTierColor)(capperProfile.tier || 'rookie'))
                .addFields({ name: 'Tier', value: (capperProfile.tier || 'rookie').toUpperCase(), inline: true })
                .setTimestamp();
            picks.forEach((pick, index) => {
                const legs = pick.legs;
                const legText = legs.map(leg => `**${leg.game}**\n${leg.bet_type}: ${leg.selection}\nOdds: ${leg.odds > 0 ? '+' : ''}${leg.odds}`).join('\n\n');
                embed.addFields({
                    name: `Pick ${index + 1} - ${pick.pick_type.toUpperCase()} (${pick.total_units} units)`,
                    value: legText,
                    inline: false
                });
                if (pick.analysis) {
                    embed.addFields({
                        name: 'Analysis',
                        value: pick.analysis,
                        inline: false
                    });
                }
            });
            await channel.send({ embeds: [embed] });
            await capperService_1.capperService.logAnalyticsEvent({
                event_type: 'picks_published',
                capper_id: firstPick.capper_id,
                event_data: {
                    pick_count: picks.length,
                    total_units: picks.reduce((sum, p) => sum + p.total_units, 0)
                },
                metadata: null
            });
        }
        catch (error) {
            logger_1.logger.error('Error publishing capper picks', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
    getStatus() {
        return {
            running: this.isRunning,
            nextRun: 'Manual trigger only'
        };
    }
}
exports.DailyPickPublisher = DailyPickPublisher;
const dailyPickPublisher = (client, channelId) => new DailyPickPublisher(client, channelId);
exports.dailyPickPublisher = dailyPickPublisher;
//# sourceMappingURL=dailyPickPublisher.js.map