/**
 * E2E ScoringAgent Runner
 *
 * Runs ScoringAgent with comprehensive telemetry for E2E audit
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { loadBaseAgentDependencies } from '../../agents/BaseAgent/loadDeps';
import { ScoringAgent } from '../../agents/ScoringAgent';
import { scoringAgentConfig } from '../../config/agentConfig';
import { getSupabaseClient } from '../../config/db';

interface E2ETelemetry {
  timestamp: string;
  duration: number;
  result: {
    success: boolean;
    propsProcessed: number;
    propsScored: number;
    propsPromoted: number;
    errors: number;
    avgProcessingTime: number;
  };
  scoringBreakdown?: {
    sTier: number;
    aTier: number;
    bTier: number;
    cTier: number;
    dTier: number;
  };
  error?: string;
}

export async function runScoringAgentE2E(): Promise<E2ETelemetry> {
  const start = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('E2E SCORING AGENT TEST');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toISOString()}\n`);

  const telemetry: E2ETelemetry = {
    timestamp: new Date().toISOString(),
    duration: 0,
    result: {
      success: false,
      propsProcessed: 0,
      propsScored: 0,
      propsPromoted: 0,
      errors: 0,
      avgProcessingTime: 0
    }
  };

  try {
    console.log('Loading dependencies...\n');
    const deps = await loadBaseAgentDependencies();

    console.log('Initializing ScoringAgent with Enhanced45Factor...\n');
    const agent = new ScoringAgent(scoringAgentConfig, deps);

    // Get unscored picks count before
    const supabase = getSupabaseClient();
    const { count: unscoredBefore } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .is('professional_score', null);

    console.log(`Unscored picks found: ${unscoredBefore || 0}\n`);

    // Run scoring
    console.log('Running scoring agent...\n');
    await agent.run();

    // Get counts after scoring
    const { count: unscoredAfter } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .is('professional_score', null);

    const { count: scoredCount } = await supabase
      .from('unified_picks')
      .select('*', { count: 'exact', head: true })
      .not('professional_score', 'is', null);

    // Get tier breakdown
    const { data: tierBreakdown } = await supabase
      .from('unified_picks')
      .select('tier')
      .not('professional_score', 'is', null);

    const scoringBreakdown = {
      sTier: tierBreakdown?.filter(p => p.tier === 'S').length || 0,
      aTier: tierBreakdown?.filter(p => p.tier === 'A').length || 0,
      bTier: tierBreakdown?.filter(p => p.tier === 'B').length || 0,
      cTier: tierBreakdown?.filter(p => p.tier === 'C').length || 0,
      dTier: tierBreakdown?.filter(p => p.tier === 'D').length || 0
    };

    telemetry.result.success = true;
    telemetry.result.propsProcessed = (unscoredBefore || 0) - (unscoredAfter || 0);
    telemetry.result.propsScored = scoredCount || 0;
    telemetry.result.propsPromoted = scoringBreakdown.sTier + scoringBreakdown.aTier;
    telemetry.scoringBreakdown = scoringBreakdown;

    // Display results
    console.log('-'.repeat(80));
    console.log('RESULTS:');
    console.log(`  ✅ Props Processed: ${telemetry.result.propsProcessed}`);
    console.log(`  ✅ Total Scored Props: ${telemetry.result.propsScored}`);
    console.log(`  ✅ Props Promoted (S/A): ${telemetry.result.propsPromoted}`);
    console.log(`  📊 Tier Breakdown:`);
    console.log(`     - S Tier: ${scoringBreakdown.sTier}`);
    console.log(`     - A Tier: ${scoringBreakdown.aTier}`);
    console.log(`     - B Tier: ${scoringBreakdown.bTier}`);
    console.log(`     - C Tier: ${scoringBreakdown.cTier}`);
    console.log(`     - D Tier: ${scoringBreakdown.dTier}`);

  } catch (error) {
    telemetry.result.success = false;
    telemetry.error = error instanceof Error ? error.message : String(error);

    console.log('\n❌ ERROR:');
    console.log(telemetry.error);
  }

  telemetry.duration = Date.now() - start;

  console.log(`\n⏱️  Duration: ${telemetry.duration}ms`);
  console.log('='.repeat(80) + '\n');

  return telemetry;
}

async function main() {
  const result = await runScoringAgentE2E();

  // Save telemetry to file
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-scoring-agent.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`📊 Telemetry saved to: ${outPath}`);

  process.exit(result.result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
