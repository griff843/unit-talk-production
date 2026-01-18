#!/usr/bin/env tsx
/**
 * Phase 1 Game Bootstrap
 *
 * Populates canonical_games table with today's games from raw_props.
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   npx tsx apps/api/scripts/live-fire-phase1-game-bootstrap.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config';

interface RawPropsGame {
  sport: string;
  home_team: string;
  away_team: string;
  game_time: string;
}

interface CanonicalGame {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_time: string;
}

/**
 * Normalize team name for fuzzy matching
 * Handles common variations (St/Saint, &/And, etc.)
 */
function normalizeTeamName(team: string): string {
  return team
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\bst\b\.?/g, 'saint')
    .replace(/\b&\b/g, 'and')
    .replace(/[^a-z0-9\s]/g, '');
}

/**
 * Check if two team names are equivalent after normalization
 */
function teamsMatch(team1: string, team2: string): boolean {
  return normalizeTeamName(team1) === normalizeTeamName(team2);
}

/**
 * Check if two game times are within acceptable window (±30 minutes)
 */
function timesMatch(time1: string, time2: string): boolean {
  const t1 = new Date(time1).getTime();
  const t2 = new Date(time2).getTime();
  const diffMinutes = Math.abs(t1 - t2) / 1000 / 60;
  return diffMinutes <= 30;
}

async function main() {
  console.log('🏀 Phase 1 Game Bootstrap - Starting...\n');

  // Initialize Supabase client
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false }
    }
  );

  // Step 1: Get distinct games from today's raw_props
  console.log('📊 Step 1: Querying distinct games from raw_props (today)...');

  // Query most recent props without date filter to avoid index scan timeout
  console.log('   Querying most recent 100 props...');
  const { data: distinctGames, error: queryError } = await supabase
    .from('raw_props')
    .select('sport, home_team, away_team, game_time, created_at')
    .not('home_team', 'is', null)
    .not('away_team', 'is', null)
    .not('game_time', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100); // Get most recent 100 props (includes today's 36)

  if (queryError) {
    console.error('❌ Error querying raw_props:', queryError);
    process.exit(1);
  }

  if (!distinctGames || distinctGames.length === 0) {
    console.log('⚠️  No games found in raw_props');
    process.exit(0);
  }

  // Filter to today's props only (in-memory to avoid DB timeout)
  const today = new Date().toISOString().split('T')[0];
  const todaysGames = distinctGames.filter(g =>
    g.created_at && g.created_at.startsWith(today)
  );

  console.log(`   Found ${distinctGames.length} recent prop entries`);
  console.log(`   Filtered to ${todaysGames.length} from today`);

  if (todaysGames.length === 0) {
    console.log('⚠️  No games from today found');
    process.exit(0);
  }

  // Deduplicate games (same sport + teams + time)
  const uniqueGames = new Map<string, RawPropsGame>();
  for (const game of todaysGames) {
    const key = `${game.sport}:${normalizeTeamName(game.home_team)}:${normalizeTeamName(game.away_team)}:${game.game_time}`;
    if (!uniqueGames.has(key)) {
      uniqueGames.set(key, game);
    }
  }

  console.log(`   Reduced to ${uniqueGames.size} distinct games\n`);

  // Step 2: Get existing canonical_games for comparison
  console.log('📊 Step 2: Loading existing canonical_games...');

  const { data: existingGames, error: existingError } = await supabase
    .from('canonical_games')
    .select('id, sport, home_team, away_team, game_time')
    .gte('game_time', new Date().toISOString().split('T')[0]) // Today onwards
    .lte('game_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()); // Next 7 days

  if (existingError) {
    console.error('❌ Error querying canonical_games:', existingError);
    process.exit(1);
  }

  console.log(`   Found ${existingGames?.length || 0} existing canonical games\n`);

  // Step 3: Match and create games
  console.log('🔄 Step 3: Matching and creating canonical_games...');

  let reusedCount = 0;
  let createdCount = 0;
  const gamesToCreate: Array<Omit<CanonicalGame, 'id'>> = [];

  for (const [_key, game] of uniqueGames.entries()) {
    // Check if game already exists
    const existing = existingGames?.find(eg =>
      eg.sport === game.sport &&
      teamsMatch(eg.home_team, game.home_team) &&
      teamsMatch(eg.away_team, game.away_team) &&
      timesMatch(eg.game_time, game.game_time)
    );

    if (existing) {
      reusedCount++;
      console.log(`   ♻️  Reusing: ${game.sport} ${game.away_team} @ ${game.home_team} (${new Date(game.game_time).toLocaleString()})`);
    } else {
      gamesToCreate.push({
        sport: game.sport,
        home_team: game.home_team,
        away_team: game.away_team,
        game_time: game.game_time,
      });
    }
  }

  // Batch insert new games
  if (gamesToCreate.length > 0) {
    console.log(`\n   Creating ${gamesToCreate.length} new canonical_games...`);

    const { data: insertedGames, error: insertError } = await supabase
      .from('canonical_games')
      .insert(gamesToCreate)
      .select('id, sport, home_team, away_team, game_time');

    if (insertError) {
      console.error('❌ Error inserting canonical_games:', insertError);
      process.exit(1);
    }

    createdCount = insertedGames?.length || 0;

    if (insertedGames) {
      for (const game of insertedGames) {
        console.log(`   ✅ Created: ${game.sport} ${game.away_team} @ ${game.home_team} (ID: ${game.id.substring(0, 8)}...)`);
      }
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BOOTSTRAP SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total distinct games identified: ${uniqueGames.size}`);
  console.log(`Canonical games reused:          ${reusedCount}`);
  console.log(`Canonical games created:         ${createdCount}`);
  console.log('='.repeat(60));
  console.log('\n✅ Game bootstrap complete!\n');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
