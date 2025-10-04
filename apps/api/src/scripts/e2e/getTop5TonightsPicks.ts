#!/usr/bin/env tsx
/**
 * Get top 5 picks for tonight's games (Oct 2, 2025)
 * Based on Enhanced45Factor professional_score
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getTop5Picks() {
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  TOP 5 PICKS FOR TONIGHT - OCTOBER 2, 2025');
  console.log('  Enhanced45Factor Professional Scoring (195 factors)');
  console.log('══════════════════════════════════════════════════════════\n');

  // Get top 5 picks by professional_score
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('*')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z')
    .not('professional_score', 'is', null)
    .order('professional_score', { ascending: false })
    .limit(5);

  if (error || !picks || picks.length === 0) {
    console.log('❌ No picks found for tonight');
    return;
  }

  console.log(`Found ${picks.length} top picks:\n`);

  picks.forEach((pick, idx) => {
    console.log(`\n${idx + 1}. 🎯 ${pick.selection || pick.team || 'Unknown'}`);
    console.log(`   Sport: ${pick.sport?.toUpperCase() || 'Unknown'}`);
    console.log(`   Market: ${pick.market || 'Unknown'}`);
    console.log(`   Line: ${pick.line || 'N/A'}`);
    console.log(`   Odds: ${pick.odds || 'N/A'}`);
    console.log(`   Professional Score: ${pick.professional_score?.toFixed(2)} / 100`);
    console.log(`   Confidence: ${pick.confidence}%`);
    console.log(`   Bookmaker: ${pick.metadata?.bookmaker || 'Unknown'}`);

    if (pick.metadata?.home_team && pick.metadata?.away_team) {
      console.log(`   Game: ${pick.metadata.away_team} @ ${pick.metadata.home_team}`);
    }

    if (pick.game_date) {
      const gameTime = new Date(pick.game_date);
      console.log(`   Game Time: ${gameTime.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short'
      })}`);
    }
  });

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('  GAMES TONIGHT');
  console.log('══════════════════════════════════════════════════════════\n');

  // Get unique games
  const { data: allPicks } = await supabase
    .from('unified_picks')
    .select('sport, metadata')
    .gte('game_date', '2025-10-02T04:00:00Z')
    .lt('game_date', '2025-10-03T04:00:00Z');

  if (allPicks) {
    const games = new Set<string>();
    allPicks.forEach(p => {
      if (p.metadata?.home_team && p.metadata?.away_team) {
        games.add(`${p.sport?.toUpperCase()}: ${p.metadata.away_team} @ ${p.metadata.home_team}`);
      }
    });

    games.forEach(game => console.log(`   📅 ${game}`));
  }

  console.log('\n══════════════════════════════════════════════════════════\n');
}

getTop5Picks().catch(console.error);
