/**
 * MARKET-ID-TRUTH-BRIDGE-003
 * Check scored_legs with probability primitives
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '../../../.env') });

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function check() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  SCORED_LEGS WITH PROBABILITY PRIMITIVES');
  console.log('═══════════════════════════════════════════════════════════════');

  // Check scored_legs with probability
  const { data: legs, error } = await supabase
    .from('scored_legs')
    .select('leg_id, p_final, p_market_devig, uncertainty_final, edge_final, clv_forecast')
    .not('p_final', 'is', null)
    .limit(20);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('\nscored_legs with p_final (non-null):');
  console.log('Count:', legs ? legs.length : 0);

  if (legs && legs.length > 0) {
    console.log('\nSample records:');
    legs.slice(0, 15).forEach((l, i) => {
      const legId = l.leg_id ? String(l.leg_id).substring(0, 8) : 'unknown';
      const pFinal = l.p_final !== null ? Number(l.p_final).toFixed(4) : 'null';
      const uncertainty =
        l.uncertainty_final !== null ? Number(l.uncertainty_final).toFixed(4) : 'null';
      const edge = l.edge_final !== null ? Number(l.edge_final).toFixed(4) : 'null';
      console.log(
        `  ${i + 1}. leg_id=${legId}... p_final=${pFinal}, uncertainty=${uncertainty}, edge=${edge}`
      );
    });
  }

  // Check scored_legs schema by getting one row
  const { data: sample } = await supabase.from('scored_legs').select('*').limit(1);
  if (sample && sample.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('scored_legs columns:', Object.keys(sample[0]).join(', '));
  }

  // Count total
  const { count } = await supabase.from('scored_legs').select('*', { count: 'exact', head: true });

  console.log('\nTotal scored_legs rows:', count);
}

check().catch(console.error);
