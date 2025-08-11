/**
 * Analyze Optimal Offer Structure
 * Deep dive into the actual offer structure to understand why we're missing "under" odds
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

async function analyzeOptimalOfferStructure() {
  console.log('🔍 ANALYZING OPTIMAL OFFER STRUCTURE');
  console.log('='.repeat(60));
  
  const apiKey = process.env.OPTIMAL_API_KEY;
  
  if (!apiKey) {
    console.log('❌ OPTIMAL_API_KEY not found');
    return;
  }
  
  const baseUrl = 'https://api.optimal-bet.com';
  
  try {
    // Get events first
    const eventsResponse = await axios.get(`${baseUrl}/v1/events`, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });
    
    const mlbEvents = eventsResponse.data.events.filter((e: any) => e.league === 'MLB');
    if (mlbEvents.length === 0) {
      console.log('❌ No MLB events found');
      return;
    }
    
    const testEvent = mlbEvents[0];
    console.log(`🎯 Analyzing event: ${testEvent.id} (${testEvent.away_display} @ ${testEvent.home_display})`);
    
    // Get props for this event
    const propsResponse = await axios.get(`${baseUrl}/v1/playerProps/MLB`, {
      headers: {
        'accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      params: {
        eventId: testEvent.id
      }
    });
    
    if (!propsResponse.data.players || propsResponse.data.players.length === 0) {
      console.log('❌ No players found');
      return;
    }
    
    const testPlayer = propsResponse.data.players[0];
    console.log(`\n📊 Analyzing player: ${testPlayer.name} (${testPlayer.team})`);
    console.log(`   Total offers: ${testPlayer.offers.length}`);
    
    // Analyze offer types
    const offerTypeStats: Record<string, number> = {};
    const propTypeStats: Record<string, { over: number; under: number; total: number }> = {};
    const sportsbookStats: Record<string, number> = {};
    
    testPlayer.offers.forEach((offer: any) => {
      // Count offer types
      offerTypeStats[offer.offerType] = (offerTypeStats[offer.offerType] || 0) + 1;
      
      // Count by prop type and offer type
      if (!propTypeStats[offer.propType]) {
        propTypeStats[offer.propType] = { over: 0, under: 0, total: 0 };
      }
      propTypeStats[offer.propType].total++;
      if (offer.offerType === 'over') {
        propTypeStats[offer.propType].over++;
      } else if (offer.offerType === 'under') {
        propTypeStats[offer.propType].under++;
      }
      
      // Count sportsbooks
      sportsbookStats[offer.sportsbook] = (sportsbookStats[offer.sportsbook] || 0) + 1;
    });
    
    console.log('\n📈 OFFER TYPE DISTRIBUTION:');
    Object.entries(offerTypeStats).forEach(([type, count]) => {
      const percentage = ((count / testPlayer.offers.length) * 100).toFixed(1);
      console.log(`   ${type}: ${count} (${percentage}%)`);
    });
    
    console.log('\n📊 PROP TYPE ANALYSIS:');
    Object.entries(propTypeStats).forEach(([propType, stats]) => {
      const overPct = ((stats.over / stats.total) * 100).toFixed(1);
      const underPct = ((stats.under / stats.total) * 100).toFixed(1);
      const paired = Math.min(stats.over, stats.under);
      const pairedPct = ((paired / (stats.total / 2)) * 100).toFixed(1);
      
      console.log(`   ${propType}:`);
      console.log(`     Total: ${stats.total} | Over: ${stats.over} (${overPct}%) | Under: ${stats.under} (${underPct}%)`);
      console.log(`     Pairable: ${paired} pairs (${pairedPct}% of possible pairs)`);
    });
    
    console.log('\n🏪 SPORTSBOOK DISTRIBUTION:');
    Object.entries(sportsbookStats).forEach(([book, count]) => {
      const percentage = ((count / testPlayer.offers.length) * 100).toFixed(1);
      console.log(`   ${book}: ${count} (${percentage}%)`);
    });
    
    // Look for specific examples of props that have both over and under
    console.log('\n🔍 SEARCHING FOR COMPLETE OVER/UNDER PAIRS...');
    
    const offersByPropAndBook = new Map<string, { over?: any; under?: any }>();
    
    testPlayer.offers.forEach((offer: any) => {
      const key = `${offer.propType}-${offer.line}-${offer.sportsbook}`;
      if (!offersByPropAndBook.has(key)) {
        offersByPropAndBook.set(key, {});
      }
      
      const existing = offersByPropAndBook.get(key)!;
      if (offer.offerType === 'over') {
        existing.over = offer;
      } else if (offer.offerType === 'under') {
        existing.under = offer;
      }
    });
    
    const completePairs = Array.from(offersByPropAndBook.entries())
      .filter(([key, pair]) => pair.over && pair.under);
      
    console.log(`   Found ${completePairs.length} complete over/under pairs out of ${offersByPropAndBook.size} unique prop/book combinations`);
    
    if (completePairs.length > 0) {
      console.log('\n✅ SAMPLE COMPLETE PAIRS:');
      completePairs.slice(0, 5).forEach(([key, pair], i) => {
        console.log(`${i+1}. ${key}`);
        console.log(`   Over: ${pair.over.oddsAmerican} (${pair.over.sportsbook})`);
        console.log(`   Under: ${pair.under.oddsAmerican} (${pair.under.sportsbook})`);
      });
    } else {
      console.log('\n❌ NO COMPLETE PAIRS FOUND');
      
      // Show sample incomplete offers
      console.log('\n📋 SAMPLE INCOMPLETE OFFERS:');
      const incompleteSamples = Array.from(offersByPropAndBook.entries()).slice(0, 10);
      incompleteSamples.forEach(([key, pair], i) => {
        console.log(`${i+1}. ${key}`);
        console.log(`   Has over: ${!!pair.over} | Has under: ${!!pair.under}`);
        if (pair.over) {
          console.log(`   Over odds: ${pair.over.oddsAmerican}`);
        }
        if (pair.under) {
          console.log(`   Under odds: ${pair.under.oddsAmerican}`);
        }
      });
    }
    
    // Check if this is a market structure issue (single-sided markets)
    console.log('\n🤔 MARKET STRUCTURE ANALYSIS:');
    const propTypesWithOnlyOvers = Object.entries(propTypeStats)
      .filter(([prop, stats]) => stats.over > 0 && stats.under === 0)
      .map(([prop]) => prop);
      
    const propTypesWithOnlyUnders = Object.entries(propTypeStats)
      .filter(([prop, stats]) => stats.under > 0 && stats.over === 0)
      .map(([prop]) => prop);
      
    if (propTypesWithOnlyOvers.length > 0) {
      console.log(`   Props with ONLY over offers: ${propTypesWithOnlyOvers.join(', ')}`);
    }
    
    if (propTypesWithOnlyUnders.length > 0) {
      console.log(`   Props with ONLY under offers: ${propTypesWithOnlyUnders.join(', ')}`);
    }
    
    // Final diagnosis
    console.log('\n🩺 DIAGNOSIS:');
    const totalOffers = testPlayer.offers.length;
    const overOffers = offerTypeStats['over'] || 0;
    const underOffers = offerTypeStats['under'] || 0;
    
    if (underOffers === 0) {
      console.log('   ❌ CRITICAL: No "under" offers found in API response');
      console.log('   📋 This explains why all database props have NULL under_odds');
      console.log('   🔧 Possible fixes:');
      console.log('      1. Check if API endpoint parameters are correct');
      console.log('      2. Verify if "under" offers are in different response structure');
      console.log('      3. Contact Optimal API support about missing under offers');
    } else if (completePairs.length < offersByPropAndBook.size * 0.5) {
      console.log('   ⚠️  WARNING: Very few complete over/under pairs');
      console.log('   📋 This suggests single-sided markets or pricing strategy');
    } else {
      console.log('   ✅ Market structure appears normal');
    }
    
  } catch (error: any) {
    console.error('❌ Analysis failed:', error.message);
  }
}

analyzeOptimalOfferStructure().then(() => {
  console.log('\n✅ OPTIMAL OFFER STRUCTURE ANALYSIS COMPLETE');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Analysis failed:', error);
  process.exit(1);
});