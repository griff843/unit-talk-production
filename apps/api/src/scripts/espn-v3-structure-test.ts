/**
 * Quick ESPN v3 API Structure Test
 *
 * Diagnoses the actual response structure from ESPN's v3 statistics API.
 */

const ESPN_V3_STRUCTURE_URL = 'https://site.api.espn.com/apis/common/v3/sports';

async function testV3Structure() {
  console.log('🔍 Testing ESPN v3 API structure...\n');

  // Test with a known NBA player ID (LeBron James = 1966)
  const testPlayerId = '1966';
  const season = '2025';

  const url = `${ESPN_V3_STRUCTURE_URL}/basketball/nba/statistics/byathlete?athlete=${testPlayerId}&season=${season}`;
  console.log(`URL: ${url}\n`);

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`❌ HTTP Error: ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();

    console.log('=== TOP LEVEL KEYS ===');
    console.log(Object.keys(data));

    if (data.athletes && data.athletes.length > 0) {
      const athlete = data.athletes[0];
      console.log('\n=== ATHLETE TOP LEVEL KEYS ===');
      console.log(Object.keys(athlete));

      // Check for categories at athlete level
      if (athlete.categories) {
        console.log('\n=== CATEGORIES (athlete.categories) ===');
        console.log('Number of categories:', athlete.categories.length);

        for (const cat of athlete.categories) {
          console.log(`\nCategory: ${cat.name} (${cat.displayName})`);
          console.log('  Keys:', Object.keys(cat));

          // Check for labels/names mapping
          if (cat.labels) {
            console.log('  Labels:', cat.labels.slice(0, 10));
          }
          if (cat.names) {
            console.log('  Names:', cat.names.slice(0, 10));
          }

          // Check totals
          if (cat.totals) {
            console.log('  Totals (first 10):', cat.totals.slice(0, 10));
          }
        }
      }

      // Check for statistics at athlete level
      if (athlete.statistics) {
        console.log('\n=== STATISTICS (athlete.statistics) ===');
        console.log('Keys:', Object.keys(athlete.statistics));

        if (athlete.statistics.splits) {
          console.log('Splits keys:', Object.keys(athlete.statistics.splits));
        }
      }

      // Check for displayName/name
      console.log('\n=== ATHLETE INFO ===');
      console.log('displayName:', athlete.displayName);
      console.log('fullName:', athlete.fullName);
      console.log('id:', athlete.id);
    }

    // Try alternate endpoint - athlete stats page
    console.log('\n\n=== TRYING ALTERNATE ENDPOINT (athletes page) ===');
    const altUrl = `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${testPlayerId}/stats`;
    console.log(`URL: ${altUrl}`);

    const altRes = await fetch(altUrl);
    if (altRes.ok) {
      const altData = await altRes.json();
      console.log('\nTop level keys:', Object.keys(altData));

      if (altData.statistics) {
        console.log('statistics keys:', Object.keys(altData.statistics));

        // Check splits
        if (altData.statistics.splits) {
          console.log('splits keys:', Object.keys(altData.statistics.splits));

          if (altData.statistics.splits.categories) {
            console.log('\nCategories found in splits!');
            for (const cat of altData.statistics.splits.categories) {
              console.log(`\n  Category: ${cat.name || cat.displayName}`);
              if (cat.stats) {
                console.log('  Stats (first 5):');
                for (const stat of cat.stats.slice(0, 5)) {
                  console.log(`    ${stat.name}: ${stat.value}`);
                }
              }
            }
          }
        }
      }
    } else {
      console.log(`Alternate endpoint failed: ${altRes.status}`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testV3Structure();
