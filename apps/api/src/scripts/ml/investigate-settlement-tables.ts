#!/usr/bin/env tsx
/**
 * Investigate Settlement Data Tables
 *
 * MISSION: Find where the 2.3M settled outcomes are stored
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function investigateTables() {
  console.log('🔍 INVESTIGATING SETTLEMENT TABLES\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check settled_outcomes table
  console.log('📊 Table: settled_outcomes');
  console.log('-'.repeat(80));
  const { count: settledCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records: ${settledCount?.toLocaleString() || 0}`);

  const { data: settledSample } = await supabase
    .from('settled_outcomes')
    .select('*')
    .limit(3);

  console.log('\nSample structure:');
  if (settledSample?.[0]) {
    console.log(JSON.stringify(settledSample[0], null, 2));
  }

  // Check sgo_props table
  console.log('\n\n📊 Table: sgo_props');
  console.log('-'.repeat(80));
  const { count: sgoCount } = await supabase
    .from('sgo_props')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records: ${sgoCount?.toLocaleString() || 0}`);

  const { data: sgoSample } = await supabase
    .from('sgo_props')
    .select('*')
    .limit(3);

  console.log('\nSample structure:');
  if (sgoSample?.[0]) {
    console.log(JSON.stringify(sgoSample[0], null, 2));
  }

  // Check if sgo_props has score/actual data
  console.log('\n\n🔍 Checking sgo_props for settlement data...');
  console.log('-'.repeat(80));

  const { data: sgoWithScore } = await supabase
    .from('sgo_props')
    .select('id, player_name, stat_type, line, score, game_date, sport')
    .not('score', 'is', null)
    .limit(10);

  if (sgoWithScore && sgoWithScore.length > 0) {
    console.log(`\n✅ Found ${sgoWithScore.length} records with 'score' field (actual values)`);
    console.log('\nSample records with scores:');
    console.log('-'.repeat(80));
    sgoWithScore.forEach(r => {
      console.log(`${r.player_name} | ${r.stat_type} | Line: ${r.line} | Score: ${r.score} | ${r.game_date}`);
    });
  }

  // Check sport distribution in sgo_props
  console.log('\n\n📈 Sport Distribution in sgo_props');
  console.log('-'.repeat(80));

  const { data: sportData } = await supabase
    .from('sgo_props')
    .select('sport, score');

  const sportMap = new Map<string, { total: number; withScore: number }>();
  sportData?.forEach(r => {
    const sport = r.sport || 'unknown';
    if (!sportMap.has(sport)) {
      sportMap.set(sport, { total: 0, withScore: 0 });
    }
    const stats = sportMap.get(sport)!;
    stats.total++;
    if (r.score !== null && r.score !== undefined) {
      stats.withScore++;
    }
  });

  console.log('\nSport          | Total      | With Score | Settlement %');
  console.log('-'.repeat(70));
  Array.from(sportMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([sport, stats]) => {
      const rate = stats.total > 0 ? (stats.withScore / stats.total * 100).toFixed(1) : '0.0';
      console.log(
        `${sport.padEnd(14)} | ${stats.total.toLocaleString().padStart(10)} | ${stats.withScore.toLocaleString().padStart(10)} | ${rate.padStart(7)}%`
      );
    });

  // Check raw_props table
  console.log('\n\n📊 Table: raw_props');
  console.log('-'.repeat(80));
  const { count: rawCount } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records: ${rawCount?.toLocaleString() || 0}`);

  // Summary
  console.log('\n\n📋 SUMMARY');
  console.log('='.repeat(80));
  console.log(`settled_outcomes: ${settledCount?.toLocaleString() || 0} records`);
  console.log(`sgo_props:        ${sgoCount?.toLocaleString() || 0} records`);
  console.log(`raw_props:        ${rawCount?.toLocaleString() || 0} records`);

  const totalWithScore = Array.from(sportMap.values()).reduce((sum, s) => sum + s.withScore, 0);
  console.log(`\nsgo_props with scores: ${totalWithScore.toLocaleString()} records`);

  if (totalWithScore > 1000000) {
    console.log('\n✅ Found the 2.3M settled outcomes in sgo_props table!');
    console.log('   - Settlement data is in the "score" field');
    console.log('   - This is the SGO historical ingestion data');
  }
}

investigateTables().catch(console.error);
