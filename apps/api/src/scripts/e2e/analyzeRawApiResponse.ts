#!/usr/bin/env tsx
import axios from 'axios';

async function check() {
  const apiKey = process.env.ODDS_API_KEY;
  const eventId = 'c4b72eabb3d557e73022ec730d8e3944';
  const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${eventId}/odds`;

  console.log('\n═══ ANALYZING RAW API RESPONSE ═══\n');

  const response = await axios.get(url, {
    params: {
      apiKey,
      regions: 'us',
      markets: 'h2h,spreads,totals',
      bookmakers: 'draftkings,fanduel',
      oddsFormat: 'american',
      dateFormat: 'iso'
    }
  });

  const game = response.data;
  console.log(`Game: ${game.away_team} @ ${game.home_team}`);
  console.log(`Bookmakers: ${game.bookmakers?.length || 0}\n`);

  // Flatten all outcomes from all bookmakers
  const allOutcomes: any[] = [];

  game.bookmakers?.forEach((book: any) => {
    book.markets?.forEach((market: any) => {
      market.outcomes?.forEach((outcome: any) => {
        allOutcomes.push({
          bookmaker: book.key,
          market: market.key,
          selection: outcome.name,
          odds: outcome.price,
          line: outcome.point || null
        });
      });
    });
  });

  console.log(`Total outcomes from API: ${allOutcomes.length}\n`);

  // Check for exact duplicates
  const seen = new Map<string, any[]>();
  allOutcomes.forEach(outcome => {
    const key = `${outcome.bookmaker}|${outcome.market}|${outcome.selection}|${outcome.odds}|${outcome.line || 'null'}`;
    if (!seen.has(key)) {
      seen.set(key, []);
    }
    seen.get(key)!.push(outcome);
  });

  const duplicates = Array.from(seen.entries()).filter(([k, v]) => v.length > 1);

  if (duplicates.length > 0) {
    console.log(`❌ Found ${duplicates.length} duplicate outcomes in API response:\n`);
    duplicates.slice(0, 3).forEach(([key, outcomes]) => {
      console.log(`  Key: ${key}`);
      console.log(`  Count: ${outcomes.length}`);
      console.log(`  Sample:`, outcomes[0]);
      console.log();
    });
  } else {
    console.log('✅ No duplicates in API response\n');
  }

  // Group by constraint that's failing
  const byConstraint = new Map<string, any[]>();
  allOutcomes.forEach(outcome => {
    // idx_unified_picks_core_markets_dedup uses:
    // (source, market, selection, bookmaker_key, game_date, COALESCE(line, 0))
    const constraintKey = `odds-api|${outcome.market}|${outcome.selection}|${outcome.bookmaker}|2025-10-03T00:16:00Z|${outcome.line || 0}`;
    if (!byConstraint.has(constraintKey)) {
      byConstraint.set(constraintKey, []);
    }
    byConstraint.get(constraintKey)!.push(outcome);
  });

  const constraintDuplicates = Array.from(byConstraint.entries()).filter(([k, v]) => v.length > 1);

  if (constraintDuplicates.length > 0) {
    console.log(`❌ Found ${constraintDuplicates.length} violations of idx_unified_picks_core_markets_dedup:\n`);
    constraintDuplicates.slice(0, 3).forEach(([key, outcomes]) => {
      console.log(`  Constraint key: ${key}`);
      console.log(`  Count: ${outcomes.length}`);
      console.log();
    });
  } else {
    console.log('✅ No constraint violations - API response should insert cleanly\n');
  }

  console.log('════════════════════════════════════════════════════════\n');
}

check().catch(console.error);
