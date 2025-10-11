import { supabaseClient } from './src/services/supabaseClient';

async function verify() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  // Check total feature count
  const { count: totalCount } = await supabaseClient
    .from('feature_values')
    .select('*', { count: 'exact', head: true });

  console.log('📊 Total features stored:', totalCount);

  // Count by feature name
  const { data: byFeature } = await supabaseClient
    .from('feature_values')
    .select('feature_name')
    .limit(10000);

  const featureCounts: Record<string, number> = {};
  byFeature?.forEach(row => {
    featureCounts[row.feature_name] = (featureCounts[row.feature_name] || 0) + 1;
  });

  console.log('\n📋 Features by type:');
  Object.entries(featureCounts).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}`);
  });

  // Sample some feature values
  console.log('\n🔍 Sample feature values:');
  const { data: samples } = await supabaseClient
    .from('feature_values')
    .select('feature_name, value, sport')
    .limit(10);

  samples?.forEach(s => {
    console.log(`  ${s.sport} | ${s.feature_name}: ${s.value}`);
  });

  console.log('\n✅ Verification complete!');
}

verify().then(() => process.exit(0)).catch(console.error);
