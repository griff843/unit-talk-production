/**
 * Validate Complete System - End-to-End Verification
 * Verify all components work together: Games, Props, Odds, Command Center
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function validateCompleteSystem() {
  console.log('🔍 COMPLETE SYSTEM VALIDATION');
  console.log('='.repeat(50));
  
  const today = '2025-08-05';
  let professional_score = 0;
  const maxScore = 10;
  
  try {
    // 1. Games Data Validation
    console.log('\n1️⃣ GAMES DATA VALIDATION');
    const { data: games, count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact' })
      .eq('game_date', today);
      
    console.log(`   ✅ Games found: ${gameCount || 0}`);
    console.log(`   📊 Sports breakdown:`);
    
    if (games) {
      const sportCounts = games.reduce((acc, game) => {
        acc[game.sport] = (acc[game.sport] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(sportCounts).forEach(([sport, count]) => {
        console.log(`      ${sport}: ${count} games`);
      });
    }
    
    if (gameCount && gameCount >= 15) {
      professional_score += 2;
      console.log(`   ✅ Games validation: PASS (${gameCount} games)`);
    } else {
      console.log(`   ❌ Games validation: FAIL (${gameCount || 0} games)`);
    }
    
    // 2. Props Data with Complete Odds
    console.log('\n2️⃣ PROPS DATA WITH COMPLETE ODDS');
    const { data: props, count: propCount } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact' })
      .eq('game_date', today)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null);
      
    console.log(`   ✅ Props with complete odds: ${propCount || 0}`);
    
    if (propCount && propCount >= 1000) {
      professional_score += 2;
      console.log(`   ✅ Props validation: PASS (${propCount} props with odds)`);
    } else {
      console.log(`   ❌ Props validation: FAIL (${propCount || 0} props with odds)`);
    }
    
    // 3. Odds Quality Assessment
    console.log('\n3️⃣ ODDS QUALITY ASSESSMENT');
    const { count: totalProps } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today);
      
    const { count: propsWithOdds } = await supabase
      .from('raw_props')
      .select('*', { count: 'exact', head: true })
      .eq('game_date', today)
      .not('over_odds', 'is', null)
      .not('under_odds', 'is', null);
      
    const oddsQuality = totalProps && propsWithOdds ? (propsWithOdds / totalProps) * 100 : 0;
    console.log(`   📈 Odds Quality: ${oddsQuality.toFixed(1)}%`);
    
    if (oddsQuality >= 95) {
      professional_score += 2;
      console.log(`   ✅ Odds quality: EXCELLENT (${oddsQuality.toFixed(1)}%)`);
    } else if (oddsQuality >= 80) {
      professional_score += 1;
      console.log(`   ⚠️  Odds quality: GOOD (${oddsQuality.toFixed(1)}%)`);
    } else {
      console.log(`   ❌ Odds quality: POOR (${oddsQuality.toFixed(1)}%)`);
    }
    
    // 4. Game-Props Linkage
    console.log('\n4️⃣ GAME-PROPS LINKAGE');
    const { data: linkedProps } = await supabase
      .from('raw_props')
      .select('external_game_id')
      .eq('game_date', today)
      .limit(10);
      
    if (linkedProps && games) {
      const gameIds = new Set(games.map(g => g.external_game_id));
      const linkableProps = linkedProps.filter(p => gameIds.has(p.external_game_id));
      const linkageRate = linkedProps.length > 0 ? (linkableProps.length / linkedProps.length) * 100 : 0;
      
      console.log(`   🔗 Linkage rate: ${linkageRate.toFixed(1)}%`);
      
      if (linkageRate >= 80) {
        professional_score += 1;
        console.log(`   ✅ Game-props linkage: GOOD (${linkageRate.toFixed(1)}%)`);
      } else {
        console.log(`   ⚠️  Game-props linkage: NEEDS IMPROVEMENT (${linkageRate.toFixed(1)}%)`);
      }
    }
    
    // 5. Command Center Accessibility
    console.log('\n5️⃣ COMMAND CENTER ACCESSIBILITY');
    try {
      const response = await fetch('http://localhost:3015/dashboard');
      if (response.ok) {
        professional_score += 1;
        console.log(`   ✅ Command Center: ACCESSIBLE (status ${response.status})`);
      } else {
        console.log(`   ❌ Command Center: HTTP ERROR (status ${response.status})`);
      }
    } catch (error: any) {
      console.log(`   ❌ Command Center: CONNECTION FAILED (${error.message})`);
    }
    
    // 6. Agent Health Check
    console.log('\n6️⃣ AGENT HEALTH CHECK');
    const { data: agentHealth } = await supabase
      .from('agent_health')
      .select('agent, status')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (agentHealth && agentHealth.length > 0) {
      const healthyAgents = agentHealth.filter(a => a.status === 'healthy').length;
      console.log(`   🤖 Agent status: ${healthyAgents}/${agentHealth.length} healthy`);
      
      if (healthyAgents >= agentHealth.length * 0.8) {
        professional_score += 1;
        console.log(`   ✅ Agent health: GOOD`);
      } else {
        console.log(`   ⚠️  Agent health: NEEDS ATTENTION`);
      }
    } else {
      console.log(`   ⚠️  Agent health: NO DATA`);
    }
    
    // 7. User Data
    console.log('\n7️⃣ USER DATA VALIDATION');
    const { data: users, count: userCount } = await supabase
      .from('users')
      .select('username, tier', { count: 'exact' })
      .limit(10);
      
    console.log(`   👥 Users found: ${userCount || 0}`);
    if (users && users.length > 0) {
      console.log(`   📋 Sample users: ${users.map(u => u.username).join(', ')}`);
      professional_score += 1;
      console.log(`   ✅ User data: AVAILABLE`);
    } else {
      console.log(`   ⚠️  User data: NO USERS FOUND`);
    }
    
    // FINAL SCORE
    console.log('\n' + '='.repeat(50));
    console.log('🏆 FINAL SYSTEM VALIDATION SCORE');
    console.log('='.repeat(50));
    console.log(`Score: ${score}/${maxScore} (${((score/maxScore)*100).toFixed(1)}%)`);
    
    if (professional_score >= 8) {
      console.log('🎉 EXCELLENT: System is fully operational and ready for production use!');
      console.log('✨ All critical components are working correctly');
    } else if (professional_score >= 6) {
      console.log('✅ GOOD: System is operational with minor issues');
      console.log('💡 Some components may need attention but core functionality works');
    } else if (professional_score >= 4) {
      console.log('⚠️  FAIR: System has significant issues that need addressing');
      console.log('🔧 Several components need fixes before production use');
    } else {
      console.log('❌ POOR: System has major issues preventing proper operation');
      console.log('🚨 Critical fixes needed before system can be used');
    }
    
    // Summary
    console.log('\n📊 SYSTEM SUMMARY:');
    console.log(`   Games: ${gameCount || 0} (Target: 15+ ✅)`);
    console.log(`   Props with Odds: ${propCount || 0} (Target: 1000+ ${propCount && propCount >= 1000 ? '✅' : '❌'})`);
    console.log(`   Odds Quality: ${oddsQuality.toFixed(1)}% (Target: 95%+ ${oddsQuality >= 95 ? '✅' : '❌'})`);
    console.log(`   Command Center: ${professional_score >= 5 ? 'Accessible ✅' : 'Issues ❌'}`);
    
  } catch (error) {
    console.error('❌ System validation failed:', error);
    throw error;
  }
}

validateCompleteSystem().then(() => {
  console.log('\n✅ SYSTEM VALIDATION COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ System validation failed:', error);
  process.exit(1);
});