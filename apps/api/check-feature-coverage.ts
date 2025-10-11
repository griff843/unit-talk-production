import { supabaseClient } from './src/services/supabaseClient';

async function check() {
  if (!supabaseClient) {
    console.log('Supabase client not initialized');
    process.exit(1);
  }

  // Count unique prop IDs that have features
  const { data: features } = await supabaseClient
    .from('feature_values')
    .select('entity_id, feature_name')
    .limit(10000);

  const uniquePropsWithFeatures = new Set(features?.map(f => f.entity_id) || []);
  
  console.log('📊 Unique props with features:', uniquePropsWithFeatures.size);
  console.log('📊 Total feature records:', features?.length);
  console.log('📊 Expected features per prop: 5');
  console.log('📊 Actual average features per prop:', (features?.length || 0) / uniquePropsWithFeatures.size);

  // Check how many props total
  const { count: totalProps } = await supabaseClient
    .from('market_props')
    .select('*', { count: 'exact', head: true });

  console.log('\n📦 Total market_props:', totalProps);
  console.log('📈 Feature coverage:', ((uniquePropsWithFeatures.size / (totalProps || 1)) * 100).toFixed(2) + '%');
}

check().then(() => process.exit(0)).catch(console.error);
