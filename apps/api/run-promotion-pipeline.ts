import { promoteToDailyPicks } from './src/agents/EligibilityAgent/promoteToDailyPicks';

async function main() {
  console.log('🚀 Starting promotion pipeline: raw_props → unified_picks');

  try {
    await promoteToDailyPicks();
    console.log('✅ Promotion pipeline completed successfully');
  } catch (error) {
    console.error('❌ Promotion pipeline failed:', error);
    process.exit(1);
  }
}

main().catch(console.error);