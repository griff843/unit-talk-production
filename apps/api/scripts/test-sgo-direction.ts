#!/usr/bin/env npx tsx
import { fetchAndFlattenSGOProps } from '../src/logic/providers/sgoFetcher';

async function testSGODirection() {
  const apiKey = process.env.SGO_API_KEY;
  if (!apiKey) throw new Error('SGO_API_KEY not set');

  console.log('🔍 Testing SGO Direction Field...');

  const props = await fetchAndFlattenSGOProps({
    apiKey,
    leagueID: 'NFL',
    limit: 10
  });

  console.log(`\nFound ${props.length} props from SGO:`);
  console.log('='.repeat(80));

  props.slice(0, 5).forEach((p, i) => {
    console.log(`${i+1}. Player: ${p.playerName || 'Unknown'}`);
    console.log(`   Stat: ${p.statType}`);
    console.log(`   Line: ${p.line}`);
    console.log(`   Direction: ${p.direction}`);
    console.log(`   Odds: ${p.odds}`);
    console.log(`   OU: ${p.ou}`);
    console.log(`   Market Key: ${p.marketKey}`);
    console.log('-'.repeat(50));
  });

  // Check for grouped pairs
  const grouped = props.reduce((acc, prop) => {
    const key = `${prop.playerName}-${prop.statType}-${prop.line}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(prop);
    return acc;
  }, {} as Record<string, any[]>);

  console.log('\n🔄 Checking for OVER/UNDER pairs:');
  Object.entries(grouped).forEach(([key, propGroup]) => {
    if (propGroup.length > 1) {
      console.log(`\n📊 ${key}:`);
      propGroup.forEach(p => {
        console.log(`   ${p.direction || 'Unknown direction'}: ${p.odds}`);
      });
    }
  });
}

testSGODirection().catch(console.error);