import { supabaseClient } from './src/services/supabaseClient';

async function checkProfessionalStatus() {
  console.log('🔍 CHECKING PROFESSIONAL SCORING SYSTEM STATUS');
  console.log('Environment Configuration:');
  console.log('USE_PRO_SCORER:', process.env.USE_PRO_SCORER);
  console.log('USE_ENHANCED_45_FACTOR:', process.env.USE_ENHANCED_45_FACTOR);
  console.log('');

  try {
    // Check recent props
    const { data: recentProps, error } = await supabaseClient
      .from('raw_props')
      .select('id, player_name, stat_type, tier, confidence, edge_score, professional_score, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching props:', error.message);
      return;
    }

    console.log('📊 RECENT PROPS STATUS:');
    console.log('Total props found:', recentProps?.length || 0);

    if (recentProps && recentProps.length > 0) {
      console.log('\nRecent Props:');
      recentProps.slice(0, 5).forEach((prop, index) => {
        console.log(`${index + 1}. ${prop.player_name} ${prop.stat_type}`);
        console.log(`   Tier: ${prop.tier || 'NULL'}`);
        console.log(`   Confidence: ${prop.confidence || 'NULL'}`);
        console.log(`   Edge Score: ${prop.edge_score || 'NULL'}`);
        console.log(`   Professional Score: ${prop.professional_score || 'NULL'}`);
        console.log(`   Created: ${prop.created_at}`);
        console.log('');
      });

      // Calculate statistics
      const withTiers = recentProps.filter(p => p.tier).length;
      const withProfessionalScores = recentProps.filter(p => p.professional_score).length;
      const withEdgeScores = recentProps.filter(p => p.edge_score).length;

      console.log('🎯 PROCESSING STATISTICS:');
      console.log(`Props with tiers: ${withTiers}/${recentProps.length} (${((withTiers / recentProps.length) * 100).toFixed(1)}%)`);
      console.log(`Props with professional scores: ${withProfessionalScores}/${recentProps.length} (${((withProfessionalScores / recentProps.length) * 100).toFixed(1)}%)`);
      console.log(`Props with edge scores: ${withEdgeScores}/${recentProps.length} (${((withEdgeScores / recentProps.length) * 100).toFixed(1)}%)`);

      if (withProfessionalScores === 0) {
        console.log('\n⚠️  WARNING: No props have professional scores! System may be using basic scoring.');
      } else if (withProfessionalScores === recentProps.length) {
        console.log('\n✅ EXCELLENT: All props have professional scores! Enhanced system is working.');
      } else {
        console.log('\n🔄 MIXED: Some props have professional scores. System may be transitioning.');
      }
    } else {
      console.log('\n📭 No props found. System may be idle or props not yet ingested.');
    }

  } catch (error) {
    console.error('❌ Error checking professional status:', error);
  }
}

checkProfessionalStatus().catch(console.error);