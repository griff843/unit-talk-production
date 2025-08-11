import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

async function testPromotionCriteria() {
  console.log('🔍 Testing Professional Sharp Betting Promotion Criteria...');
  console.log('');

  try {
    // Get sample of graded props for analysis (more efficient)
    const { data: gradedProps, error } = await supabase
      .from('raw_props')
      .select('id, tier, edge_score, confidence, player_name, stat_type')
      .not('tier', 'is', null)
      .not('edge_score', 'is', null)
      .limit(5000); // Sample for faster analysis

    if (error) {
      throw new Error('Failed to fetch graded props: ' + error.message);
    }

    console.log(`📊 Analyzing ${gradedProps.length} graded props...`);
    console.log('');

    // Simulate professional promotion criteria
    function meetsPromotionCriteria(prop) {
      // Rule 1: Edge Score Threshold (minimum 8% edge)
      const MIN_EDGE_SCORE = 800; // 800 basis points = 8% edge
      if (prop.edge_score < MIN_EDGE_SCORE) {
        return { promoted: false, reason: 'Edge score too low (<8%)' };
      }

      // Rule 2: Ultra-High Confidence Requirement (85%+)
      // Note: confidence is stored as 0/1, need to convert percentage
      const confidencePercent = prop.confidence === 1 ? 90 : 45; // Simulate realistic confidence
      const MIN_CONFIDENCE = 85;
      if (confidencePercent < MIN_CONFIDENCE) {
        return { promoted: false, reason: 'Confidence too low (<85%)' };
      }

      // Rule 3: Tier Requirements (S-tier or exceptional A-tier only)
      if (prop.tier === 'S') {
        return { promoted: true, reason: 'S-tier with sufficient edge/confidence' };
      } else if (prop.tier === 'A') {
        // A-tier needs exceptional edge (12%+) and confidence (90%+)
        if (prop.edge_score >= 1200 && confidencePercent >= 90) {
          return { promoted: true, reason: 'Exceptional A-tier (12%+ edge, 90%+ confidence)' };
        } else {
          return { promoted: false, reason: 'A-tier needs 12%+ edge and 90%+ confidence' };
        }
      } else {
        return { promoted: false, reason: 'Only S/A-tier eligible for promotion' };
      }
    }

    // Apply criteria to all props
    let totalPromoted = 0;
    let promotionReasons = {};
    let rejectionReasons = {};
    let tierCounts = {};
    let edgeScoreRanges = {
      under_0: 0,
      '0_to_400': 0,
      '400_to_800': 0,
      '800_to_1200': 0,
      '1200_plus': 0,
    };

    gradedProps.forEach(prop => {
      // Count tiers
      tierCounts[prop.tier] = (tierCounts[prop.tier] || 0) + 1;

      // Count edge score ranges
      if (prop.edge_score < 0) {
        edgeScoreRanges.under_0++;
      } else if (prop.edge_score < 400) {
        edgeScoreRanges['0_to_400']++;
      } else if (prop.edge_score < 800) {
        edgeScoreRanges['400_to_800']++;
      } else if (prop.edge_score < 1200) {
        edgeScoreRanges['800_to_1200']++;
      } else {
        edgeScoreRanges['1200_plus']++;
      }

      // Test promotion criteria
      const result = meetsPromotionCriteria(prop);

      if (result.promoted) {
        totalPromoted++;
        promotionReasons[result.reason] = (promotionReasons[result.reason] || 0) + 1;
      } else {
        rejectionReasons[result.reason] = (rejectionReasons[result.reason] || 0) + 1;
      }
    });

    console.log('🏆 PROFESSIONAL SHARP BETTING ANALYSIS:');
    console.log('=====================================');
    console.log('');

    console.log('📊 Current Database Statistics:');
    console.log(`   • Total Graded Props: ${gradedProps.length.toLocaleString()}`);
    Object.entries(tierCounts).forEach(([tier, count]) => {
      const percentage = ((count / gradedProps.length) * 100).toFixed(1);
      const icon =
        tier === 'S'
          ? '🌟'
          : tier === 'A'
            ? '⭐'
            : tier === 'B'
              ? '🔸'
              : tier === 'C'
                ? '🔹'
                : '◽';
      console.log(`   • ${icon} ${tier}-Tier: ${count} props (${percentage}%)`);
    });
    console.log('');

    console.log('📈 Edge Score Distribution:');
    console.log(`   • Under 0%: ${edgeScoreRanges.under_0.toLocaleString()} props`);
    console.log(`   • 0-4%: ${edgeScoreRanges['0_to_400'].toLocaleString()} props`);
    console.log(`   • 4-8%: ${edgeScoreRanges['400_to_800'].toLocaleString()} props`);
    console.log(
      `   • 8-12%: ${edgeScoreRanges['800_to_1200'].toLocaleString()} props (PROMOTION ELIGIBLE)`
    );
    console.log(
      `   • 12%+: ${edgeScoreRanges['1200_plus'].toLocaleString()} props (PREMIUM PROMOTION)`
    );
    console.log('');

    console.log('🎯 PROFESSIONAL PROMOTION RESULTS:');
    console.log(`   • Total Promoted: ${totalPromoted.toLocaleString()} props`);
    console.log(`   • Promotion Rate: ${((totalPromoted / gradedProps.length) * 100).toFixed(2)}%`);
    console.log(
      `   • Rejection Rate: ${(((gradedProps.length - totalPromoted) / gradedProps.length) * 100).toFixed(2)}%`
    );
    console.log('');

    if (Object.keys(promotionReasons).length > 0) {
      console.log('✅ Promotion Breakdown:');
      Object.entries(promotionReasons).forEach(([reason, count]) => {
        console.log(`   • ${reason}: ${count} props`);
      });
      console.log('');
    }

    console.log('❌ Top Rejection Reasons:');
    Object.entries(rejectionReasons)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([reason, count]) => {
        console.log(`   • ${reason}: ${count} props`);
      });
    console.log('');

    // Profitability assessment
    const dailyProps = 8000; // User's expected daily volume
    const expectedPromotions = Math.round(dailyProps * (totalPromoted / gradedProps.length));

    console.log('💰 PROFITABILITY ASSESSMENT:');
    console.log(`   • Expected Daily Props: ${dailyProps.toLocaleString()}`);
    console.log(`   • Expected Daily Promotions: ${expectedPromotions.toLocaleString()}`);

    if (expectedPromotions <= 50) {
      console.log('   • ✅ EXCELLENT: Highly selective, profit-focused');
    } else if (expectedPromotions <= 150) {
      console.log('   • ✅ GOOD: Selective enough for profitability');
    } else if (expectedPromotions <= 300) {
      console.log('   • ⚠️ CAUTION: May need tighter criteria');
    } else {
      console.log('   • ❌ TOO MANY: Will hurt profitability');
    }

    console.log('');
    console.log('🏦 SHARP BETTING STANDARDS:');
    console.log('   • Target Promotion Rate: 1-3% (elite selectivity)');
    console.log('   • Minimum Edge: 8% (800 basis points)');
    console.log('   • Minimum Confidence: 85%');
    console.log('   • Tier Requirements: S-tier or exceptional A-tier only');
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

testPromotionCriteria();
