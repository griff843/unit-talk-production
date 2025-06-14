// src/agents/FeedAgent.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { fetchSGOEvents, flattenSGOEvents } from '../logic/providers/sgoFetcher';

export class FeedAgent {
  private supabase: SupabaseClient;
  private apiKey: string;
  private leagueID: string;

  constructor(supabase: SupabaseClient, apiKey: string, leagueID = 'MLB') {
    this.supabase = supabase;
    this.apiKey = apiKey;
    this.leagueID = leagueID;
  }

  // Utility to batch an array into chunks of N
  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  public async fetchAndStoreProps() {
    try {
      // 1. Fetch events via SGO and flatten to props
      const events = await fetchSGOEvents({
        apiKey: this.apiKey,
        leagueID: this.leagueID,
        startsAfter: new Date().toISOString(),
        startsBefore: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        includeAltLine: true,
        oddsAvailable: true,
        limit: 100,
      });
      const props = flattenSGOEvents(events);

      if (!props.length) {
        console.warn('[FeedAgent] No props fetched');
        return;
      }

      // 2. Deduplicate: check for external_id or marketKey in raw_props in BATCHES
      const externalIds = props.map(p => p.marketKey);
      const BATCH_SIZE = 100;
      let existing: { external_id: string }[] = [];

      for (const chunk of this.chunkArray(externalIds, BATCH_SIZE)) {
        const { data, error } = await this.supabase
          .from('raw_props')
          .select('external_id')
          .in('external_id', chunk);

        if (error) {
          console.error('[FeedAgent] Error fetching existing IDs in batch:', error.message);
          continue;
        }
        if (data) existing = existing.concat(data);
      }

      const existingSet = new Set(existing.map(e => e.external_id));
      const newProps = props.filter(p => !existingSet.has(p.marketKey));
      let inserted = 0, failed = 0;

      // 3. Insert new (non-duplicate) props (can also batch insert if >500)
      for (const prop of newProps) {
        // Build insert object using only valid columns
        const insertObj = {
          event_id: prop.eventID,
          external_id: prop.marketKey,
          provider: 'SGO',
          league: prop.leagueID,
          sport: prop.sportID,
          game_time: prop.startsAtUTC,
          team: prop.homeTeam, // Use as main team
          opponent: prop.awayTeam, // Use as opponent
          player_id: null, // Fix: always null for now
          player_slug: prop.playerId || null, // Save SGO/Outlier string
          player_name: prop.playerName || null,
          stat_type: prop.statType || null,
          line: prop.line !== undefined ? Number(prop.line) : null,
          direction: prop.direction || null,
          odds: prop.odds !== undefined ? Number(prop.odds) : null,
          matchup: `${prop.homeTeam} vs ${prop.awayTeam}`,
          external_game_id: prop.eventID,
          scraped_at: new Date().toISOString(),
          is_valid: true,
        };

        const { error } = await this.supabase.from('raw_props').insert(insertObj);

        if (error) {
          failed++;
          console.error('[FeedAgent] Failed to insert prop', prop.marketKey, error.message);
        } else {
          inserted++;
        }
      }

      // 4. Log result
      console.log(`[FeedAgent] SGO ingest: ${props.length} fetched, ${newProps.length} new, ${inserted} inserted, ${failed} failed`);
    } catch (err) {
      console.error('[FeedAgent] Error:', err);
    }
  }
}
