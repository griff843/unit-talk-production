#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnoseNFL() {
  console.log('🔍 Diagnosing NFL records...\n');

  const { data, error } = await supabase
    .from('settled_outcomes')
    .select('id, player_name, actual_value, line, outcome')
    .eq('sport', 'NFL')
    .not('actual_value', 'is', null)
    .order('id')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('First 20 NFL records:');
  console.log('='.repeat(90));

  let correct = 0;
  let wrong = 0;

  data?.forEach((r, idx) => {
    const shouldBe = r.actual_value > r.line ? 'win' : 'loss';
    const isCorrect = r.outcome === shouldBe;

    if (isCorrect) correct++;
    else wrong++;

    const status = isCorrect ? '✅' : '❌ WRONG';
    console.log(
      `${(idx + 1).toString().padStart(2)}. ${status} | ` +
      `Actual: ${r.actual_value.toString().padEnd(5)} | ` +
      `Line: ${r.line.toString().padEnd(5)} | ` +
      `Outcome: ${r.outcome.padEnd(4)} | ` +
      `Should be: ${shouldBe}`
    );
  });

  console.log('='.repeat(90));
  console.log(`Correct: ${correct}, Wrong: ${wrong}`);
  console.log('\nDid the SQL UPDATE run successfully in Supabase?');
}

diagnoseNFL();
