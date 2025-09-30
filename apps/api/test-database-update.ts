import { createSupabaseClient } from './src/utils/supabase';
import { CacheFirstUnifiedPicksService } from './src/services/CacheFirstUnifiedPicksService';

async function testDatabaseUpdate() {
  console.log('🧪 Testing database update for scoring fields...\n');

  const supabase = createSupabaseClient();
  const cacheService = CacheFirstUnifiedPicksService.getInstance();

  // Get a sample pick to test with
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('id, professional_score')
    .limit(1);

  if (error || !picks || picks.length === 0) {
    console.error('❌ Error getting test pick:', error);
    return;
  }

  const testPickId = picks[0].id;
  console.log(`🎯 Testing with pick ID: ${testPickId}`);
  console.log(`   Current professional_score: ${picks[0].professional_score}`);

  // Test direct database update
  console.log('\n1. Testing direct Supabase update...');
  try {
    const { data: directResult, error: directError } = await supabase
      .from('unified_picks')
      .update({
        professional_score: 75.5,
        kelly_fraction: 0.05,
        feature_contributions: { test: 'direct update' }
      })
      .eq('id', testPickId)
      .select()
      .single();

    if (directError) {
      console.error('❌ Direct update error:', directError.message);
    } else {
      console.log('✅ Direct update successful');
      console.log('   Updated professional_score:', directResult.professional_score);
    }
  } catch (err) {
    console.error('❌ Direct update exception:', err);
  }

  // Test cache service update
  console.log('\n2. Testing CacheFirstUnifiedPicksService update...');
  try {
    const result = await cacheService.updatePick(testPickId, {
      professionalScore: 85.5,
      kellyFraction: 0.08,
      featureContributions: { test: 'cache service update' }
    });

    console.log('✅ Cache service update successful');
    console.log('   Updated professional_score:', result.professionalScore);
  } catch (err) {
    console.error('❌ Cache service update error:', err);
  }

  // Verify final state
  console.log('\n3. Verifying final state...');
  const { data: finalState } = await supabase
    .from('unified_picks')
    .select('professional_score, kelly_fraction, feature_contributions')
    .eq('id', testPickId)
    .single();

  console.log('   Final professional_score:', finalState?.professional_score);
  console.log('   Final kelly_fraction:', finalState?.kelly_fraction);
  console.log('   Final feature_contributions:', JSON.stringify(finalState?.feature_contributions));
}

testDatabaseUpdate().catch(console.error);