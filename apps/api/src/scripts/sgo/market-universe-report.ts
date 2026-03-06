/* eslint-disable no-console */
/**
 * Market Universe Report
 * Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Use canonical types from shared-types
import type { PlayersRow } from '@unit-talk/contracts';

type Player = PlayersRow;

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface SportStats {
  sport: string;
  totalPlayers: number;
  marketUniversePlayers: number;
  marketUniverseLinked: number;
  marketUniverseUnlinked: number;
  linkedPercent: number;
}

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical PlayersRow
// This interface represents participants table records, not players table
interface ParticipantPlayer {
  id: string;
  external_id: string;
  name: string;
  sport: string;
}

const PAGE_SIZE = 1000;

async function fetchAllPlayers(client: SupabaseClient): Promise<ParticipantPlayer[]> {
  const players: ParticipantPlayer[] = [];
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    const { data, error } = await client
      .from('participants')
      .select('id, external_id, name, sport')
      .eq('type', 'player')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching players:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      players.push(...data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }

  return players;
}

async function fetchOfferedPlayerIds(
  client: SupabaseClient,
  since: Date
): Promise<{ ids: Set<string>; lastOfferDates: Map<string, string> }> {
  const ids = new Set<string>();
  const lastOfferDates = new Map<string, string>();

  const { data, error } = await client
    .from('provider_offers')
    .select('participant_id, snapshot_at')
    .not('participant_id', 'is', null)
    .gte('snapshot_at', since.toISOString())
    .order('snapshot_at', { ascending: false });

  if (error) {
    console.error('Error fetching offered players:', error);
    return { ids, lastOfferDates };
  }

  for (const offer of data || []) {
    if (offer.participant_id) {
      ids.add(offer.participant_id);
      if (!lastOfferDates.has(offer.participant_id)) {
        lastOfferDates.set(offer.participant_id, offer.snapshot_at);
      }
    }
  }

  return { ids, lastOfferDates };
}

async function fetchUpcomingEventTeamIds(
  client: SupabaseClient,
  from: Date,
  to: Date
): Promise<{ teamIds: Set<string>; eventCount: number }> {
  const teamIds = new Set<string>();
  const { data: events, error } = await client
    .from('canonical_events')
    .select('home_participant_id, away_participant_id')
    .gte('scheduled_at', from.toISOString())
    .lte('scheduled_at', to.toISOString())
    .eq('status', 'scheduled');

  if (error) {
    console.error('Error fetching upcoming events:', error);
    return { teamIds, eventCount: 0 };
  }

  for (const event of events || []) {
    if (event.home_participant_id) teamIds.add(event.home_participant_id);
    if (event.away_participant_id) teamIds.add(event.away_participant_id);
  }

  return { teamIds, eventCount: events?.length || 0 };
}

async function fetchRosterPlayerIds(
  client: SupabaseClient,
  teamIds: Set<string>
): Promise<Set<string>> {
  const playerIds = new Set<string>();
  if (teamIds.size === 0) return playerIds;

  const { data: memberships, error } = await client
    .from('participant_memberships')
    .select('participant_id')
    .in('team_id', [...teamIds])
    .is('valid_to', null);

  if (error) {
    console.error('Error fetching roster players:', error);
    return playerIds;
  }

  for (const m of memberships || []) {
    if (m.participant_id) playerIds.add(m.participant_id);
  }

  return playerIds;
}

async function fetchUpcomingRosterPlayerIds(
  client: SupabaseClient,
  from: Date,
  to: Date
): Promise<Set<string>> {
  const { teamIds, eventCount } = await fetchUpcomingEventTeamIds(client, from, to);
  console.log(`Upcoming events: ${eventCount}, Teams: ${teamIds.size}`);
  return fetchRosterPlayerIds(client, teamIds);
}

async function fetchLinkedPlayerIds(client: SupabaseClient): Promise<Set<string>> {
  const linkedIds = new Set<string>();
  let hasMore = true;
  let offset = 0;

  while (hasMore) {
    const { data, error } = await client
      .from('participant_memberships')
      .select('participant_id, team_id')
      .is('valid_to', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching memberships:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      for (const m of data) {
        if (m.participant_id && m.team_id) linkedIds.add(m.participant_id);
      }
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    }
  }

  return linkedIds;
}

function computeStatsBySport(
  players: Player[],
  marketUniverseIds: Set<string>,
  linkedPlayerIds: Set<string>
): Map<string, SportStats> {
  const statsBySport = new Map<string, SportStats>();

  for (const player of players) {
    const sport = player.sport || 'UNKNOWN';

    if (!statsBySport.has(sport)) {
      statsBySport.set(sport, {
        sport,
        totalPlayers: 0,
        marketUniversePlayers: 0,
        marketUniverseLinked: 0,
        marketUniverseUnlinked: 0,
        linkedPercent: 0,
      });
    }

    const stats = statsBySport.get(sport)!;
    stats.totalPlayers++;

    if (marketUniverseIds.has(player.id)) {
      stats.marketUniversePlayers++;
      if (linkedPlayerIds.has(player.id)) {
        stats.marketUniverseLinked++;
      } else {
        stats.marketUniverseUnlinked++;
      }
    }
  }

  for (const stats of statsBySport.values()) {
    if (stats.marketUniversePlayers > 0) {
      stats.linkedPercent = (stats.marketUniverseLinked / stats.marketUniversePlayers) * 100;
    }
  }

  return statsBySport;
}

function printReport(statsBySport: Map<string, SportStats>): void {
  console.log('\n============================================================');
  console.log('STATS BY SPORT');
  console.log('============================================================\n');

  console.log('| Sport | Total | MU Players | MU Linked | MU Unlinked | Linked % |');
  console.log('|-------|-------|------------|-----------|-------------|----------|');

  let totalAll = 0,
    totalMU = 0,
    totalLinked = 0,
    totalUnlinked = 0;
  const sorted = [...statsBySport.values()].sort(
    (a, b) => b.marketUniversePlayers - a.marketUniversePlayers
  );

  for (const s of sorted) {
    console.log(
      `| ${s.sport.padEnd(5)} | ${s.totalPlayers.toString().padStart(5)} | ${s.marketUniversePlayers.toString().padStart(10)} | ${s.marketUniverseLinked.toString().padStart(9)} | ${s.marketUniverseUnlinked.toString().padStart(11)} | ${s.linkedPercent.toFixed(1).padStart(7)}% |`
    );
    totalAll += s.totalPlayers;
    totalMU += s.marketUniversePlayers;
    totalLinked += s.marketUniverseLinked;
    totalUnlinked += s.marketUniverseUnlinked;
  }

  const overallPercent = totalMU > 0 ? (totalLinked / totalMU) * 100 : 0;
  console.log('|-------|-------|------------|-----------|-------------|----------|');
  console.log(
    `| TOTAL | ${totalAll.toString().padStart(5)} | ${totalMU.toString().padStart(10)} | ${totalLinked.toString().padStart(9)} | ${totalUnlinked.toString().padStart(11)} | ${overallPercent.toFixed(1).padStart(7)}% |`
  );

  console.log('\n============================================================');
  if (totalMU === 0) {
    console.log('No market universe players found (provider_offers empty).');
  } else if (overallPercent >= 95) {
    console.log(`Market universe linkage: ${overallPercent.toFixed(1)}% - EXCELLENT`);
  } else if (overallPercent >= 80) {
    console.log(`Market universe linkage: ${overallPercent.toFixed(1)}% - NEEDS ATTENTION`);
  } else {
    console.log(`Market universe linkage: ${overallPercent.toFixed(1)}% - CRITICAL`);
  }
  console.log('============================================================');
}

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('MARKET UNIVERSE REPORT');
  console.log('Sprint: SPRINT-MARKET-SCOPED-IDENTITY-100B2');
  console.log('============================================================\n');

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  console.log(`Reference: ${now.toISOString()}`);
  console.log(`30 days ago: ${thirtyDaysAgo.toISOString()}`);
  console.log(`7 days ahead: ${sevenDaysFromNow.toISOString()}\n`);

  const players = await fetchAllPlayers(supabase);
  console.log(`Total players: ${players.length}`);

  const { ids: offeredIds } = await fetchOfferedPlayerIds(supabase, thirtyDaysAgo);
  console.log(`Players in offers (30d): ${offeredIds.size}`);

  const rosterIds = await fetchUpcomingRosterPlayerIds(supabase, now, sevenDaysFromNow);
  console.log(`Players on upcoming rosters: ${rosterIds.size}`);

  const marketUniverseIds = new Set([...offeredIds, ...rosterIds]);
  console.log(`Market universe (union): ${marketUniverseIds.size}`);

  const linkedIds = await fetchLinkedPlayerIds(supabase);
  console.log(`Players with team linkage: ${linkedIds.size}`);

  const statsBySport = computeStatsBySport(players, marketUniverseIds, linkedIds);
  printReport(statsBySport);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
