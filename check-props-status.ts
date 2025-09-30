import { createSupabaseClient } from './apps/api/src/utils/supabase';

async function checkPropsStatus() {
  console.log('🔍 Checking props scoring status...');

  const supabase = createSupabaseClient();

  // Check total props in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentProps, error: recentError } = await supabase
    .from('unified_picks')
    .select('id, market, professional_score, created_at')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`📊 Recent props (last hour): ${recentProps?.length || 0}`);

  if (recentProps?.length > 0) {
    console.log('🔍 Sample recent props:');
    recentProps.slice(0, 5).forEach(prop => {
      console.log(`  ${prop.market}: score=${prop.professional_score}`);
    });
  }

  // Check props needing scoring
  const { data: needsScoring } = await supabase
    .from('unified_picks')
    .select('id, market')
    .is('professional_score', null)
    .limit(5);

  console.log(`\n📊 Props needing scoring: ${needsScoring?.length || 0}`);

  // Check props with scoring
  const { data: withScoring } = await supabase
    .from('unified_picks')
    .select('id, market, professional_score')
    .not('professional_score', 'is', null)
    .limit(5);

  console.log(`📊 Props with scoring: ${withScoring?.length || 0}`);

  if (withScoring?.length > 0) {
    console.log('✅ Sample scored props:');
    withScoring.forEach(prop => {
      console.log(`  ${prop.market}: score=${prop.professional_score}`);
    });
  }
}

checkPropsStatus().catch(console.error);