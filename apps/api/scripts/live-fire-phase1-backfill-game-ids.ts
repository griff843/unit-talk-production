#!/usr/bin/env tsx
/**
 * Phase 1 Game ID Backfill
 *
 * Attaches canonical_game_id to raw_props rows from today.
 * Idempotent: safe to run multiple times.
 *
 * Usage:
 *   npx tsx apps/api/scripts/live-fire-phase1-backfill-game-ids.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from '../src/config';

interface RawProp {
  id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_time: string;
  canonical_game_id: string | null;
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
 * Find matching canonical game for a raw prop
 */
function findMatchingGame(
  prop: RawProp,
  canonicalGames: CanonicalGame[]
): CanonicalGame | null {
  const propHomeNorm = normalizeTeamName(prop.home_team);
  const propAwayNorm = normalizeTeamName(prop.away_team);
  const propTime = new Date(prop.game_time).getTime();

  for (const game of canonicalGames) {
    // Must match sport
    if (game.sport !== prop.sport) continue;

    // Must match teams (normalized)
    const gameHomeNorm = normalizeTeamName(game.home_team);
    const gameAwayNorm = normalizeTeamName(game.away_team);

    if (gameHomeNorm !== propHomeNorm || gameAwayNorm !== propAwayNorm) {
      continue;
    }

    // Must match time (within ±30 minutes)
    const gameTime = new Date(game.game_time).getTime();
    const diffMinutes = Math.abs(propTime - gameTime) / 1000 / 60;

    if (diffMinutes <= 30) {
      return game;
    }
  }

  return null;
}

async function main() {
  console.log('🔗 Phase 1 Game ID Backfill - Starting...\n');

  // Initialize Supabase client
  const supabase = createClient(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false }
    }
  );

  // Step 1: Get today's raw_props without game IDs
  console.log('📊 Step 1: Querying raw_props (today, missing game IDs)...');

  const { data: propsToFix, error: propsError } = await supabase
    .from('raw_props')
    .select('id, sport, home_team, away_team, game_time, canonical_game_id')
    .gte('created_at', new Date().toISOString().split('T')[0]) // Today
    .is('canonical_game_id', null)
    .not('home_team', 'is', null)
    .not('away_team', 'is', null)
    .not('game_time', 'is', null);

  if (propsError) {
    console.error('❌ Error querying raw_props:', propsError);
    process.exit(1);
  }

  if (!propsToFix || propsToFix.length === 0) {
    console.log('✅ No props need game ID backfill (all already have IDs)');
    process.exit(0);
  }

  console.log(`   Found ${propsToFix.length} props without game IDs\n`);

  // Step 2: Load canonical_games
  console.log('📊 Step 2: Loading canonical_games...');

  const { data: canonicalGames, error: gamesError } = await supabase
    .from('canonical_games')
    .select('id, sport, home_team, away_team, game_time')
    .gte('game_time', new Date().toISOString().split('T')[0])
    .lte('game_time', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

  if (gamesError) {
    console.error('❌ Error querying canonical_games:', gamesError);
    process.exit(1);
  }

  if (!canonicalGames || canonicalGames.length === 0) {
    console.error('❌ No canonical_games found. Run game-bootstrap first!');
    process.exit(1);
  }

  console.log(`   Found ${canonicalGames.length} canonical games\n`);

  // Step 3: Match and update
  console.log('🔄 Step 3: Matching props to games and updating...\n');

  let matchedCount = 0;
  let unmatchedCount = 0;
  const unmatchedSamples: RawProp[] = [];

  // Process in batches of 50 to avoid overwhelming Supabase
  const BATCH_SIZE = 50;
  for (let i = 0; i < propsToFix.length; i += BATCH_SIZE) {
    const batch = propsToFix.slice(i, i + BATCH_SIZE);

    for (const prop of batch) {
      const matchedGame = findMatchingGame(prop, canonicalGames);

      if (matchedGame) {
        // Update the prop with canonical_game_id
        const { error: updateError } = await supabase
          .from('raw_props')
          .update({ canonical_game_id: matchedGame.id })
          .eq('id', prop.id);

        if (updateError) {
          console.error(`   ⚠️  Failed to update prop ${prop.id}:`, updateError.message);
        } else {
          matchedCount++;
          if (matchedCount <= 5) {
            console.log(`   ✅ Matched: ${prop.sport} ${prop.away_team} @ ${prop.home_team} → game ${matchedGame.id.substring(0, 8)}...`);
          }
        }
      } else {
        unmatchedCount++;
        if (unmatchedSamples.length < 5) {
          unmatchedSamples.push(prop);
        }
      }
    }

    // Progress indicator for large batches
    if (propsToFix.length > 100 && (i + BATCH_SIZE) % 100 === 0) {
      console.log(`   Progress: ${Math.min(i + BATCH_SIZE, propsToFix.length)}/${propsToFix.length} props processed...`);
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 BACKFILL SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total props processed:    ${propsToFix.length}`);
  console.log(`Props matched & updated:  ${matchedCount} (${Math.round(100 * matchedCount / propsToFix.length)}%)`);
  console.log(`Props unmatched:          ${unmatchedCount}`);
  console.log('='.repeat(60));

  if (unmatchedSamples.length > 0) {
    console.log('\n⚠️  Sample of unmatched props (may need manual investigation):');
    for (const prop of unmatchedSamples) {
      console.log(`   - ${prop.sport} ${prop.away_team} @ ${prop.home_team} at ${new Date(prop.game_time).toLocaleString()}`);
    }
  }

  console.log('\n✅ Game ID backfill complete!\n');

  if (unmatchedCount > propsToFix.length * 0.4) {
    console.log('⚠️  WARNING: >40% of props could not be matched. Check team name normalization or run game-bootstrap again.\n');
  }
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
