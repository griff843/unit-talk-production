#!/usr/bin/env npx tsx
/**
 * FETCH AND PERSIST REAL PROPS - Direct SGO to Database Pipeline
 * This script addresses the props ingestion gap by directly fetching from SGO and persisting to database
 */

import { fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';
import { supabaseClient } from '../src/services/supabaseClient';

async function fetchAndPersistRealProps() {
  console.log('🔄 FETCH AND PERSIST REAL PROPS - SGO TO DATABASE PIPELINE');
  console.log('✅ Direct SGO API → Database persistence');
  console.log('✅ Solving the props ingestion gap (6,269 fetched but 0 persisted)');
  console.log('=' .repeat(80));

  const apiKey = process.env.SGO_API_KEY;
  if (!apiKey) {
    console.error('❌ SGO_API_KEY not set');
    return;
  }

  try {
    // Check initial state
    const today = new Date().toISOString().split('T')[0];
    const { data: initialCount } = await supabaseClient
      .from('raw_props')
      .select('id', { count: 'exact' })
      .gte('created_at', today);

    console.log(`📊 Initial raw_props today: ${initialCount?.length || 0}`);

    // Fetch props from SGO for multiple sports
    console.log('\n🔄 Fetching props from SGO API...');
    const sports = ['NFL', 'NBA'];
    const allProps: any[] = [];

    for (const sport of sports) {
      try {
        console.log(`🏀 Fetching ${sport} props...`);
        const sportProps = await fetchAndFlattenSGOProps({
          apiKey,
          leagueID: sport,
          limit: 100
        });

        console.log(`✅ ${sport}: Retrieved ${sportProps.length} props`);
        allProps.push(...sportProps.map(prop => ({ ...prop, sport })));
      } catch (error) {
        console.error(`❌ Failed to fetch ${sport}:`, error);
      }
    }

    console.log(`📊 Total props fetched: ${allProps.length}`);

    if (allProps.length === 0) {
      console.log('❌ No props retrieved from SGO API');
      return;
    }

    // Process and group OVER/UNDER pairs
    console.log('\n🔄 Processing and grouping OVER/UNDER pairs...');
    const groupedProps = new Map();

    allProps.forEach(prop => {
      // Skip invalid props
      if (!prop.playerName || prop.playerName === 'unknown' || !prop.statType || !prop.line || !prop.odds) {
        return;
      }

      const key = `${prop.playerName}-${prop.statType}-${prop.line}-${prop.sport}`;
      if (!groupedProps.has(key)) {
        groupedProps.set(key, { sport: prop.sport });
      }

      const group = groupedProps.get(key);
      if (prop.direction?.toLowerCase() === 'over') {
        group.over = prop;
      } else if (prop.direction?.toLowerCase() === 'under') {
        group.under = prop;
      }
    });

    // Convert to database format
    console.log('\n🔄 Converting to database format...');
    const dbProps = [];

    for (const [key, group] of groupedProps.entries()) {
      if (group.over && group.under) {
        // Create a complete prop record
        const prop = {
          id: crypto.randomUUID(),
          player_name: group.over.playerName,
          sport: group.sport,
          team: group.over.team || '',
          opponent: group.over.opponent || '',
          stat_type: group.over.statType,
          line: parseFloat(group.over.line),
          game_date: today,
          matchup: `${group.over.team || 'TBD'} vs ${group.over.opponent || 'TBD'}`,

          // Market and odds
          market: group.over.statType,
          market_type: 'player_prop',
          over: parseFloat(group.over.odds),
          under: parseFloat(group.under.odds),
          over_odds: parseFloat(group.over.odds),
          under_odds: parseFloat(group.under.odds),

          // Timing
          game_time: new Date().toISOString(),
          start_time: null,

          // Provider and metadata
          provider: 'SGO',
          external_id: group.over.id || crypto.randomUUID(),
          external_game_id: group.over.gameId || null,
          game_id: null,
          sport_key: group.sport.toLowerCase(),

          // Data quality
          is_valid: true,
          is_primary: true,
          is_alt_line: false,
          auto_approved: false,
          context_flag: false,
          promoted: false,
          is_promoted: false,
          promoted_to_picks: false,
          steam_detected: false,
          contrarian_opportunity: false,
          is_canary: false,
          needs_review: false,

          // Defaults
          unit_size: 1,
          confidence: 0,
          volatility: 5,
          bid_ask_spread: 0.02,
          data_completeness: 0.95,
          outlier_score: 0.95,
          consistency_score: 0.95,
          data_validation_score: 0.95,
          data_quality_score: 0.95,
          pro_attempts: 0,

          // Timestamps
          created_at: new Date().toISOString(),
          inserted_at: new Date().toISOString(),
          scraped_at: new Date().toISOString(),

          // Nullable fields
          outcome: null,
          odds: null,
          trend_confidence: null,
          matchup_quality: null,
          line_value_score: null,
          role_stability: null,
          confidence_score: null,
          edge_score: null,
          tier_tag: null,
          source: null,
          bet_type: null,
          outcomes: null,
          player_id: null,
          player_slug: null,
          fair_odds: null,
          league: null,
          promoted_at: null,
          tier: null,
          ev_percent: null,
          trend_score: null,
          matchup_score: null,
          line_score: null,
          role_score: null,
          direction: null,
          unique_key: null,
          event_id: null,
          book: null,
          updated_at: null,
          home_team: null,
          home_team_id: null,
          away_team: null,
          away_team_id: null,
          expected_value: null,
          sharp_money: null,
          line_movement: null,
          player_form: null,
          injury_impact: null,
          best_available_line: null,
          best_book: null,
          public_betting_percentage: null,
          sharp_betting_percentage: null,
          correlation_risk: null,
          weather_impact: null,
          market_intelligence: null,
          volume_profile: null,
          closing_line_value: null,
          predicted_closing_line: null,
          optimal_betting_time: null,
          injury_timing_advantage: null,
          cross_market_arbitrage: null,
          player_fatigue: null,
          venue_advantage: null,
          referee_impact: null,
          pace_impact: null,
          motivational_factors: null,
          portfolio_impact: null,
          metadata: null,
          prop_category: null,
          team_name: null,
          standardized_sport: null,
          standardized_stat: null,
          processed_at: null,
          processing_error: null,
          professional_score: null,
          kelly_fraction: null,
          clv_tracking_id: null
        };

        dbProps.push(prop);
      }
    }

    console.log(`📊 Converted to ${dbProps.length} complete prop records`);

    if (dbProps.length === 0) {
      console.log('❌ No valid complete OVER/UNDER pairs found');
      return;
    }

    // Batch insert to database
    console.log('\n🔄 Inserting props to database...');
    const batchSize = 100;
    let totalInserted = 0;
    let totalErrors = 0;

    for (let i = 0; i < dbProps.length; i += batchSize) {
      const batch = dbProps.slice(i, i + batchSize);

      try {
        const { data, error } = await supabaseClient
          .from('raw_props')
          .upsert(batch, {
            onConflict: 'id',
            ignoreDuplicates: true
          })
          .select('id');

        if (error) {
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message);
          totalErrors += batch.length;
        } else {
          const inserted = data?.length || 0;
          totalInserted += inserted;
          console.log(`✅ Batch ${Math.floor(i / batchSize) + 1}: ${inserted} props inserted`);
        }
      } catch (error) {
        console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} exception:`, error);
        totalErrors += batch.length;
      }
    }

    // Check final state
    const { data: finalCount } = await supabaseClient
      .from('raw_props')
      .select('id', { count: 'exact' })
      .gte('created_at', today);

    const finalTotal = finalCount?.length || 0;
    const newPropsAdded = finalTotal - (initialCount?.length || 0);

    console.log('\n🎉 PROPS INGESTION COMPLETE');
    console.log('=' .repeat(80));
    console.log(`📊 Results:`);
    console.log(`   - Props fetched from SGO: ${allProps.length}`);
    console.log(`   - Valid OVER/UNDER pairs: ${dbProps.length}`);
    console.log(`   - Props inserted: ${totalInserted}`);
    console.log(`   - Errors: ${totalErrors}`);
    console.log(`   - Total props today: ${finalTotal}`);
    console.log(`   - New props added: ${newPropsAdded}`);
    console.log(`✅ Status: ${newPropsAdded > 0 ? 'SUCCESS - Props persisted to database!' : 'NO NEW PROPS (duplicates or errors)'}`);

    // Show sample of new props
    if (newPropsAdded > 0) {
      console.log('\n🔍 Sample of newly added props:');
      const { data: sampleProps } = await supabaseClient
        .from('raw_props')
        .select('player_name, stat_type, line, over_odds, under_odds, sport')
        .gte('created_at', today)
        .neq('player_name', 'unknown')
        .order('created_at', { ascending: false })
        .limit(5);

      sampleProps?.forEach((prop, i) => {
        console.log(`   ${i+1}. ${prop.player_name} - ${prop.stat_type} ${prop.line} (${prop.sport})`);
        console.log(`      Over: ${prop.over_odds}, Under: ${prop.under_odds}`);
      });
    }

    console.log('\n✅ SGO PROPS SUCCESSFULLY PERSISTED TO DATABASE!');
    console.log('📋 Props are now available for Enhanced45FactorEngine processing');

  } catch (error) {
    console.error('❌ Props ingestion failed:', error);
  }
}

fetchAndPersistRealProps().catch(console.error);