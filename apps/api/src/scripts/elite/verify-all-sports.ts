#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function verifyAllSports() {
  console.log('🔍 Verifying outcome distribution for all sports\n');
  console.log('='.repeat(70));
  console.log('Sport'.padEnd(10), 'Wins'.padEnd(10), 'Losses'.padEnd(10), 'Total'.padEnd(10), 'Win%');
  console.log('='.repeat(70));

  for (const sport of ['NFL', 'MLB', 'NBA', 'NHL']) {
    const { data } = await supabase
      .from('settled_outcomes')
      .select('outcome')
      .eq('sport', sport)
      .not('actual_value', 'is', null)
      .in('outcome', ['win', 'loss'])
      .gte('game_date', '2024-01-01')
      .limit(5000);

    if (!data || data.length === 0) {
      console.log(sport.padEnd(10), 'No data'.padEnd(40));
      continue;
    }

    const wins = data.filter(r => r.outcome === 'win').length;
    const losses = data.filter(r => r.outcome === 'loss').length;
    const total = wins + losses;
    const winPct = ((wins / total) * 100).toFixed(1);

    console.log(
      sport.padEnd(10),
      wins.toString().padEnd(10),
      losses.toString().padEnd(10),
      total.toString().padEnd(10),
      `${winPct}%`
    );
  }

  console.log('='.repeat(70));
}

verifyAllSports();
