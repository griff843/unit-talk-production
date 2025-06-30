import { Client, TextChannel, EmbedBuilder } from 'discord.js';
import { capperService } from './capperService';
import { logger } from '../shared/logger';
import { getTierColor } from '../utils/roleUtils';

interface Leg {
  game: string;
  bet_type: string;
  selection: string;
  odds: number;
}

interface Pick {
  id: string;
  capper_discord_id: string;
  capper_id: string;
  tier?: string;
  legs: Leg[];
  total_units: number;
  analysis?: string;
  // Add other properties as needed
}

export class DailyPickPublisher {
  private client: Client;
  private channelId: string;
  private isRunning: boolean = false;

  constructor(client: Client, channelId: string) {
    this.client = client;
    this.channelId = channelId;
  }

  async publishDailyPicks(): Promise<void> {
    if (this.isRunning) {
      logger.info('Daily pick publishing already in progress');
      return;
    }

    this.isRunning = true;
    logger.info('Starting daily pick publishing');

    try {
      const today = new Date().toISOString().split('T')[0]!;
      const picks = await capperService.getCapperPicks('', today, 'pending');

      if (picks.length === 0) {
        logger.info('No pending picks found for today');
        return;
      }

      const channel = this.client.channels.cache.get(this.channelId) as TextChannel;
      if (!channel) {
        logger.error('Publishing channel not found', { channelId: this.channelId });
        return;
      }

      // Group picks by capper
      const picksByCapper = new Map();
      for (const pick of picks) {
        if (!picksByCapper.has(pick.capper_id)) {
          picksByCapper.set(pick.capper_id, []);
        }
        picksByCapper.get(pick.capper_id).push(pick);
      }

      // Publish picks for each capper
      for (const [capperId, capperPicks] of Array.from(picksByCapper)) {
        // Use capperId to prevent unused warning
        logger.info(`Processing picks for capper: ${capperId}`);

        await this.publishCapperPicks(channel, capperPicks);

        // Mark picks as published
        const pickIds = capperPicks.map((p: { id: string }) => p.id);
        await capperService.finalizePicks(pickIds);
      }

      logger.info('Daily pick publishing completed', { 
        totalPicks: picks.length,
        cappers: picksByCapper.size 
      });

    } catch (error) {
      logger.error('Error during daily pick publishing', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    } finally {
      this.isRunning = false;
    }
  }

  private async publishCapperPicks(channel: TextChannel, picks: Pick[]): Promise<void> {
    try {
      const firstPick = picks[0];
      if (!firstPick) {
        logger.error('No picks provided to publish');
        return;
      }

      // TypeScript assertion since we've already checked for null
      const capperProfile = await capperService.getCapperById(firstPick.capper_id);

      if (!capperProfile) {
        logger.error('Capper profile not found', {
          capperId: firstPick.capper_id
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎯 ${capperProfile.display_name || capperProfile.username}'s Picks`)
        .setColor(getTierColor(capperProfile.tier || 'rookie'))
        .addFields({ name: 'Tier', value: (capperProfile.tier || 'rookie').toUpperCase(), inline: true })
        .setTimestamp();

      // Add each pick
      picks.forEach((pick, index) => {
        // Handle picks with legs (parlay) or single picks
        if (pick.legs && pick.legs.length > 0) {
          pick.legs.forEach((leg, legIndex) => {
            const pickText = `**${leg.game}**\n${leg.bet_type}: ${leg.selection}\nOdds: ${leg.odds > 0 ? '+' : ''}${leg.odds}`;

            embed.addFields({
              name: `Pick ${index + 1}.${legIndex + 1} - ${leg.bet_type.toUpperCase()} (${pick.total_units} units)`,
              value: pickText,
              inline: false
            });
          });
        }
      });

      await channel.send({ embeds: [embed] });

      // Log analytics
      await capperService.logAnalyticsEvent({
        event_type: 'picks_published',
        capper_id: firstPick!.capper_id,
        event_data: {
          pick_count: picks.length,
          total_units: picks.reduce((sum: number, p: Pick) => sum + p.total_units, 0)
        },
        metadata: null
      });

    } catch (error) {
      logger.error('Error publishing capper picks', { 
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

export const dailyPickPublisher = (client: Client, channelId: string) => 
  new DailyPickPublisher(client, channelId);