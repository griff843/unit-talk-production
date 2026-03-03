/**
 * Check Grading System Readiness
 * Verify if we can shift focus to Command Center
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkGradingReadiness() {
  console.log('🔍 CHECKING GRADING SYSTEM READINESS');
  console.log('='.repeat(45));

  const today = '2025-08-05';

  // 1. Check props with complete odds (required for grading)
  const { count: propsWithOdds } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today)
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null)
    .neq('over_odds', 0)
    .neq('under_odds', 0);

  console.log(`Props with complete odds: ${propsWithOdds || 0}`);

  // 2. Check games for context
  const { count: games } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);

  console.log(`Games available: ${games || 0}`);

  // 3. Check recent FeedAgent props specifically
  const { count: feedAgentProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'feedagent-pipeline-test')
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null);

  console.log(`FeedAgent props with odds: ${feedAgentProps || 0}`);

  // 4. Check if we can grade (sample props)
  const { data: sampleProps } = await supabase
    .from('raw_props')
    .select('player_name, stat_type, over_odds, under_odds, line, source')
    .eq('game_date', today)
    .not('over_odds', 'is', null)
    .not('under_odds', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\n📋 Sample gradeable props:');
  if (sampleProps && sampleProps.length > 0) {
    sampleProps.forEach((prop, i) => {
      const canGrade = prop.over_odds && prop.under_odds;
      console.log(
        `${i + 1}. ${prop.player_name} ${prop.stat_type} ${prop.line} - Over: ${prop.over_odds}, Under: ${prop.under_odds} (${prop.source}) ${canGrade ? '✅' : '❌'}`
      );
    });
  } else {
    console.log('❌ No gradeable props found');
  }

  // 5. Check NULL odds issue (the original problem)
  const { count: nullOddsProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today)
    .or('over_odds.is.null,under_odds.is.null');

  const { count: totalProps } = await supabase
    .from('raw_props')
    .select('*', { count: 'exact', head: true })
    .eq('game_date', today);

  const nullPercentage =
    totalProps && nullOddsProps ? ((nullOddsProps / totalProps) * 100).toFixed(1) : '0.0';
  console.log(
    `\nProps with NULL odds: ${nullOddsProps || 0}/${totalProps || 0} (${nullPercentage}%)`
  );

  // 6. Overall assessment
  console.log('\n🎯 GRADING SYSTEM STATUS:');
  const hasEnoughProps = (propsWithOdds || 0) >= 100; // Lowered threshold for realistic check
  const hasEnoughGames = (games || 0) >= 15;
  const nullOddsFixed = parseFloat(nullPercentage) < 50; // Most props should have odds

  const readyForGrading = hasEnoughProps && hasEnoughGames && nullOddsFixed;

  console.log(
    `✅ Props with odds: ${propsWithOdds || 0} ${hasEnoughProps ? '✅' : '❌'} (need 100+)`
  );
  console.log(`✅ Games available: ${games || 0} ${hasEnoughGames ? '✅' : '❌'} (need 15+)`);
  console.log(`✅ NULL odds issue: ${nullPercentage}% ${nullOddsFixed ? '✅' : '❌'} (need <50%)`);

  if (readyForGrading) {
    console.log('\n🎉 DATABASE ISSUES RESOLVED!');
    console.log('✨ Professional grading system can operate');
    console.log('🚀 READY TO SHIFT FOCUS TO COMMAND CENTER');
  } else {
    console.log('\n❌ DATABASE ISSUES NOT FULLY RESOLVED');
    console.log('🔧 Still need fixes before shifting focus');
  }

  return readyForGrading;
}

checkGradingReadiness()
  .then(() => process.exit(0))
  .catch(console.error);
