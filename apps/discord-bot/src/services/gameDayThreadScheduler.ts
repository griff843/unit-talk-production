import { Client, TextChannel, ThreadChannel } from 'discord.js';
import { SupabaseService } from './supabase';
import { ThreadService } from './threadService';
import { botConfig } from '../config';
import { logger } from '../utils/logger';

export interface PickContextForScheduling {
  id: string; // unified_picks id
  gameId?: string;
  sport?: string;
  teams?: string; // e.g., "Team A vs Team B"
  description?: string;
  confidence?: number;
  odds?: number;
  units?: number;
  tier?: string;
}

/**
 * Schedules opening a game discussion thread 15 minutes before game start.
 * Pick-only policy: we only schedule threads for games that have picks.
 */
export class GameDayThreadScheduler {
  constructor(
    private client: Client,
    private supabase: SupabaseService
  ) {}

  /**
   * Schedule a thread to open 15 minutes before game start (from games.commence_time).
   * If commence time cannot be resolved or is within 15 minutes, create immediately.
   */
  async scheduleForPick(pick: PickContextForScheduling): Promise<void> {
    try {
      const threadsChannelId = botConfig.channels?.threads;
      if (!threadsChannelId) {
        logger.warn('Game Day Live channel (threads) is not configured');
        return;
      }

      // Resolve game commence time and teams
      let commenceISO: string | null = null;
      let teams = pick.teams || '';
      let sport = pick.sport || 'Unknown';

      if (pick.gameId) {
        const { data: game, error } = await this.supabase.client
          .from('games')
          .select('id, sport, home_team, away_team, commence_time')
          .eq('id', pick.gameId)
          .single();

        if (!error && game) {
          commenceISO = game.commence_time || null;
          sport = game.sport || sport;
          if (!teams) {
            const home = game.home_team || 'Home';
            const away = game.away_team || 'Away';
            teams = `${away} vs ${home}`;
          }
        }
      }

      // Compute target time (15 minutes before)
      const now = Date.now();
      let createNow = true;
      let delayMs = 0;
      if (commenceISO) {
        const commenceMs = new Date(commenceISO).getTime();
        const targetMs = commenceMs - 15 * 60 * 1000;
        delayMs = Math.max(targetMs - now, 0);
        createNow = delayMs <= 0;
      }

      const doCreate = async () => {
        try {
          const threadService = new ThreadService(this.client, this.supabase);
          const thread = await threadService.createGameThread({
            gameId: pick.gameId || `ad-hoc-${pick.id}`,
            sport,
            teams: teams || pick.description || 'Game Thread',
            gameTime: commenceISO || new Date().toISOString(),
          });

          if (thread) {
            // Post the pick to the thread for context
            await threadService.postPickToThread({
              id: pick.id,
              gameId: pick.gameId,
              sport,
              teams,
              pick: pick.description,
              units: pick.units,
              odds: pick.odds,
              confidence: pick.confidence,
              tier: pick.tier || 'member',
            });

            // Persist linkage on unified_picks if column exists
            try {
              // Cast to any to avoid type mismatch if local Supabase types are not yet updated
              await this.supabase.client
                .from('unified_picks')
                .update({ discord_thread_id: thread.id } as any)
                .eq('id', pick.id);
            } catch (e) {
              logger.warn('Could not update unified_picks.discord_thread_id; continuing', e);
            }
          }
        } catch (e) {
          logger.error('Failed to create/post game thread for pick', { error: e, pick });
        }
      };

      if (createNow) {
        await doCreate();
      } else {
        setTimeout(doCreate, delayMs);
        logger.info(
          `Scheduled game thread for pick ${pick.id} in ${(delayMs / 60000).toFixed(1)} minutes (15m before game start)`
        );
      }
    } catch (error) {
      logger.error('scheduleForPick failed', { error, pick });
    }
  }
}

