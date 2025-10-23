const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('📊 SCORING STATUS\n');

  // Get scored props
  const { data: scored, error: scoredError } = await supabase
    .from('raw_props')
    .select('id')
    .not('professional_score', 'is', null);

  // Get all props
  const { data: all, error: allError } = await supabase
    .from('raw_props')
    .select('id');

  if (allError || scoredError) {
    console.error('Error:', allError || scoredError);
    return;
  }

  const totalCount = all?.length || 0;
  const scoredCount = scored?.length || 0;
  const unscoredCount = totalCount - scoredCount;

  console.log(`Total props: ${totalCount.toLocaleString()}`);
  console.log(`Scored props: ${scoredCount.toLocaleString()}`);
  console.log(`Unscored props: ${unscoredCount.toLocaleString()}`);
  console.log(`\nScoring rate: ${totalCount > 0 ? ((scoredCount / totalCount) * 100).toFixed(1) : '0.0'}%`);

  if (scoredCount > 0) {
    console.log('\n✅ SCORING: ACTIVE');
  } else {
    console.log('\n❌ SCORING: NO PROPS SCORED');
  }
})();
