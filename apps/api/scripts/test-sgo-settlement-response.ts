/**
 * Test SGO API Response Structure for Settlement Data
 * This script fetches a small sample to understand what settlement data SGO provides
 */

import axios from 'axios';

const SGO_API_KEY = process.env.SGO_API_KEY;

interface SGOSettlementTestConfig {
  leagueID: string;
  startsAfter: string;
  startsBefore: string;
  maxGames: number;
}

async function testSGOSettlementResponse(config: SGOSettlementTestConfig) {
  if (!SGO_API_KEY) {
    throw new Error('SGO_API_KEY environment variable not set');
  }

  console.log(`🔍 Testing SGO settlement response for ${config.leagueID}`);
  console.log(`📅 Date range: ${config.startsAfter} to ${config.startsBefore}`);

  try {
    const response = await axios.get('https://api.sportsgameodds.com/v2/events', {
      params: {
        apiKey: SGO_API_KEY,
        leagueID: config.leagueID,
        startsAfter: config.startsAfter,
        startsBefore: config.startsBefore,
        includeAltLine: true,
        finalized: true // This should include settlement data
      },
      timeout: 30000
    });

    console.log(`✅ API Response received`);
    console.log(`📋 Response type: ${typeof response.data}`);
    console.log(`📋 Response keys: ${Object.keys(response.data)}`);

    // SGO returns { success: true, data: [...events], nextCursor: ... }
    let events = response.data.data;

    console.log(`📊 Events found: ${events ? events.length : 0}`);

    if (!events || events.length === 0) {
      console.log('❌ No events returned');
      return;
    }

    // Analyze first few events for settlement structure
    const sampleEvents = events.slice(0, Math.min(config.maxGames, events.length));

    for (let i = 0; i < sampleEvents.length; i++) {
      const event = sampleEvents[i];
      console.log(`\n📊 EVENT ${i + 1}: ${event.eventID}`);
      console.log(`   Teams: ${event.teams?.home?.names?.full} vs ${event.teams?.away?.names?.full}`);
      console.log(`   Status: ${event.info?.status}`);
      console.log(`   Start Time: ${event.info?.startsAtUTC}`);

      // Check if event has final scores/results
      if (event.info?.scores) {
        console.log(`   ✅ SCORES FOUND:`, event.info.scores);
      } else {
        console.log(`   ❌ No scores found`);
      }

      // Analyze odds structure for settlement data
      if (event.odds) {
        const oddsKeys = Object.keys(event.odds);
        console.log(`   📈 ${oddsKeys.length} props available`);

        // Check first few props for settlement structure
        const sampleProps = oddsKeys.slice(0, 3);
        for (const propKey of sampleProps) {
          const prop = event.odds[propKey];
          console.log(`\n      PROP: ${propKey}`);
          console.log(`      Player: ${prop.statEntityID || 'Team'}`);
          console.log(`      Stat: ${prop.statID}`);
          console.log(`      Line: ${prop.bookOverUnder || prop.fairOverUnder}`);
          console.log(`      Odds: ${prop.bookOdds || prop.fairOdds}`);
          console.log(`      Side: ${prop.sideID}`);

          // Look for settlement fields
          console.log(`      📋 SETTLEMENT CHECK:`);
          console.log(`         - Result: ${prop.result || 'MISSING'}`);
          console.log(`         - Actual Value: ${prop.actualValue || prop.actual_value || 'MISSING'}`);
          console.log(`         - Status: ${prop.status || 'MISSING'}`);
          console.log(`         - Settled: ${prop.settled || prop.finalized || 'MISSING'}`);
          console.log(`         - Settlement Time: ${prop.settledAt || prop.finalizedAt || 'MISSING'}`);

          // Check all available fields
          const allFields = Object.keys(prop);
          const settlementFields = allFields.filter(field =>
            field.toLowerCase().includes('result') ||
            field.toLowerCase().includes('actual') ||
            field.toLowerCase().includes('settled') ||
            field.toLowerCase().includes('final') ||
            field.toLowerCase().includes('status') ||
            field.toLowerCase().includes('outcome')
          );

          if (settlementFields.length > 0) {
            console.log(`      🎯 POTENTIAL SETTLEMENT FIELDS: ${settlementFields.join(', ')}`);
            settlementFields.forEach(field => {
              console.log(`         ${field}: ${prop[field]}`);
            });
          } else {
            console.log(`      ❌ NO SETTLEMENT FIELDS DETECTED`);
          }
        }
      }
    }

    // Print raw structure of first event for analysis
    console.log(`\n🔍 RAW STRUCTURE SAMPLE (First Event):`);
    console.log('================================');
    console.log(JSON.stringify(sampleEvents[0], null, 2));

  } catch (error: any) {
    console.error('❌ Error testing SGO settlement response:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

async function runSettlementTests() {
  console.log('🚀 SGO SETTLEMENT DATA ANALYSIS');
  console.log('===============================\n');

  // Test with a recent completed game to ensure settlement data exists
  const testConfigs: SGOSettlementTestConfig[] = [
    {
      leagueID: 'MLB',
      startsAfter: '2024-09-01T00:00:00Z',
      startsBefore: '2024-09-03T23:59:59Z',
      maxGames: 2
    },
    {
      leagueID: 'NBA',
      startsAfter: '2025-01-01T00:00:00Z',
      startsBefore: '2025-01-03T23:59:59Z',
      maxGames: 2
    }
  ];

  for (const config of testConfigs) {
    await testSGOSettlementResponse(config);
    console.log('\n' + '='.repeat(60) + '\n');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  }
}

if (require.main === module) {
  runSettlementTests().catch(error => {
    console.error('Settlement test failed:', error.message);
    process.exit(1);
  });
}