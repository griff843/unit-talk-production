#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkDistribution() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('🔍 Checking Sport Distribution\n');

  // Get total count
  const { count: totalCount } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  console.log(`Total records: ${totalCount?.toLocaleString()}\n`);

  // Get distinct sports
  const { data: sports } = await supabase
    .from('settled_outcomes')
    .select('sport')
    .order('sport');

  if (!sports) {
    console.log('No data returned');
    return;
  }

  // Count by sport
  const sportMap = new Map<string, number>();
  sports.forEach(r => {
    const sport = r.sport || 'unknown';
    sportMap.set(sport, (sportMap.get(sport) || 0) + 1);
  });

  console.log('Sport Distribution:');
  console.log('-'.repeat(50));
  Array.from(sportMap.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([sport, count]) => {
      const pct = ((count / (totalCount || 1)) * 100).toFixed(2);
      console.log(`${sport.padEnd(20)} ${count.toLocaleString().padStart(12)} (${pct.padStart(6)}%)`);
    });

  console.log('-'.repeat(50));
  console.log(`Total: ${Array.from(sportMap.values()).reduce((a, b) => a + b, 0).toLocaleString()}`);
}

checkDistribution().catch(console.error);
