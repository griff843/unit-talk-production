import { createSupabaseClient } from './apps/api/src/utils/supabase';

async function debugUnifiedPicksScoring() {
  console.log('🔍 Debugging unified picks scoring status...\n');

  const supabase = createSupabaseClient();

  // Get sample of recent picks with all relevant fields
  const { data: picks, error } = await supabase
    .from('unified_picks')
    .select('id, published, professional_score, implied_prob, scored_at, created_at, player_name, stat_type, sport')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  if (!picks || picks.length === 0) {
    console.log('📭 No unified picks found');
    return;
  }

  console.log(`📊 Found ${picks.length} recent unified picks:\n`);

  picks.forEach((pick, index) => {
    console.log(`${index + 1}. Pick ID: ${pick.id}`);
    console.log(`   Published: ${pick.published}`);
    console.log(`   Professional Score: ${pick.professional_score}`);
    console.log(`   Implied Prob: ${pick.implied_prob}`);
    console.log(`   Scored At: ${pick.scored_at}`);
    console.log(`   Player: ${pick.player_name}`);
    console.log(`   Stat: ${pick.stat_type}`);
    console.log(`   Sport: ${pick.sport}`);
    console.log(`   Created: ${pick.created_at}`);
    console.log('');
  });

  // Count by status
  const publishedCount = picks.filter(p => p.published).length;
  const scoredCount = picks.filter(p => p.professional_score !== null).length;
  const needsScoringCount = picks.filter(p => p.professional_score === null).length;

  console.log(`📈 Status Summary:`);
  console.log(`   Published: ${publishedCount}/${picks.length}`);
  console.log(`   Scored: ${scoredCount}/${picks.length}`);
  console.log(`   Needs Scoring: ${needsScoringCount}/${picks.length}`);

  // Show what filtering logic should be
  console.log(`\n🔧 Filtering Logic Recommendations:`);
  console.log(`   - ScoringAgent should look for professional_score = null`);
  console.log(`   - Don't filter by published = true (props may not be published yet)`);
  console.log(`   - Include all props regardless of publication status for scoring`);

  // Test the actual ScoringAgent filter logic
  console.log(`\n🧪 Testing ScoringAgent Filter Logic:`);

  // Current logic: published: true AND (!professional_score OR !implied_prob OR !scored_at)
  const currentLogicPicks = picks.filter(pick =>
    pick.published && (
      !pick.implied_prob ||
      !pick.professional_score ||
      !pick.scored_at ||
      // Re-score if data is older than 1 hour
      (pick.scored_at && Date.now() - new Date(pick.scored_at).getTime() > 3600000)
    )
  );

  // Recommended logic: professional_score = null (regardless of published status)
  const recommendedLogicPicks = picks.filter(pick => pick.professional_score === null);

  console.log(`   Current ScoringAgent logic finds: ${currentLogicPicks.length} picks`);
  console.log(`   Recommended logic would find: ${recommendedLogicPicks.length} picks`);

  if (currentLogicPicks.length === 0 && recommendedLogicPicks.length > 0) {
    console.log(`\n❗ ISSUE IDENTIFIED: ScoringAgent filters for published=true, but`);
    console.log(`   ${recommendedLogicPicks.length} props need scoring and are not published yet.`);
    console.log(`   This explains why ScoringAgent reports "Found 0 unified picks needing scoring".`);
  }
}

debugUnifiedPicksScoring().catch(console.error);