import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkData() {
  console.log('🔍 Checking SGO settled_outcomes data...\n');

  // Get total counts
  const { count: total } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true });

  const { count: withActual } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .not('actual_value', 'is', null);

  const { count: withNull } = await supabase
    .from('settled_outcomes')
    .select('*', { count: 'exact', head: true })
    .is('actual_value', null);

  const settlementRate = ((withActual || 0) * 100 / (total || 1)).toFixed(2);

  console.log('📊 Settlement Statistics:');
  console.log('Total outcomes:', total);
  console.log('With actual_value:', withActual);
  console.log('With null actual_value:', withNull);
  console.log('Settlement rate:', settlementRate + '%\n');

  // Get sample with actual_value
  const { data: withData } = await supabase
    .from('settled_outcomes')
    .select('*')
    .not('actual_value', 'is', null)
    .limit(3);

  console.log('✅ Sample outcomes WITH actual_value:');
  console.log(JSON.stringify(withData, null, 2));
  console.log('\n');

  // Get sample with null actual_value
  const { data: nullData } = await supabase
    .from('settled_outcomes')
    .select('*')
    .is('actual_value', null)
    .limit(3);

  console.log('❌ Sample outcomes WITH NULL actual_value:');
  console.log(JSON.stringify(nullData, null, 2));
  console.log('\n');

  // Check metadata field for SGO raw data
  const { data: metadataCheck } = await supabase
    .from('settled_outcomes')
    .select('metadata')
    .eq('source', 'sgo')
    .limit(5);

  console.log('🔍 Metadata samples from SGO source:');
  console.log(JSON.stringify(metadataCheck, null, 2));
}

checkData();
