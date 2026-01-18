#!/usr/bin/env tsx
/**
 * Trigger local raw_props ingestion for testing
 */

import { ingestUnifiedData } from '../src/agents/FeedAgent/activities/index';

async function main() {
  console.log('🚀 Triggering FeedAgent ingestion for NFL...\n');

  try {
    const result = await ingestUnifiedData({
      league: 'NFL',
      batchSize: 200,
      timeout: 30000
    });

    console.log('\n📊 Ingestion Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`\n✅ SUCCESS: ${result.count} props ingested from ${result.source}`);
    } else {
      console.log(`\n❌ FAILED: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
