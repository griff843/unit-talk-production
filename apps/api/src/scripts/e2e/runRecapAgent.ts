/**
 * E2E Recap Agent Runner
 *
 * Generates daily recap with telemetry for E2E audit
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

import { getSupabaseClient } from '../../config/db';

interface E2ETelemetry {
  timestamp: string;
  duration: number;
  result: {
    success: boolean;
    totalPicks: number;
    approvedPicks: number;
    settledPicks: number;
    winRate: number;
    avgScore: number;
  };
  tierBreakdown?: {
    sTier: { count: number; settled: number; won: number };
    aTier: { count: number; settled: number; won: number };
    bTier: { count: number; settled: number; won: number };
  };
  error?: string;
}

export async function runRecapAgentE2E(): Promise<E2ETelemetry> {
  const start = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('E2E RECAP AGENT TEST');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toISOString()}\n`);

  const telemetry: E2ETelemetry = {
    timestamp: new Date().toISOString(),
    duration: 0,
    result: {
      success: false,
      totalPicks: 0,
      approvedPicks: 0,
      settledPicks: 0,
      winRate: 0,
      avgScore: 0
    }
  };

  try {
    const supabase = getSupabaseClient();

    // Calculate 24 hours ago
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    console.log(`Generating recap for picks since: ${yesterday.toISOString()}\n`);

    // Fetch all picks from last 24 hours
    const { data: allPicks, error: allError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .not('professional_score', 'is', null);

    if (allError) {
      throw new Error(`Failed to fetch picks: ${allError.message}`);
    }

    // Fetch approved picks
    const { data: approvedPicks, error: approvedError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .eq('status', 'approved')
      .not('professional_score', 'is', null);

    if (approvedError) {
      throw new Error(`Failed to fetch approved picks: ${approvedError.message}`);
    }

    // Fetch settled picks
    const { data: settledPicks, error: settledError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', yesterday.toISOString())
      .in('result', ['won', 'lost', 'push'])
      .not('professional_score', 'is', null);

    if (settledError) {
      throw new Error(`Failed to fetch settled picks: ${settledError.message}`);
    }

    const totalPicks = allPicks?.length || 0;
    const approved = approvedPicks?.length || 0;
    const settled = settledPicks?.length || 0;
    const won = settledPicks?.filter(p => p.settlement_status === 'won').length || 0;
    const winRate = settled > 0 ? (won / settled) * 100 : 0;

    // Calculate average score
    const scores = allPicks?.map(p => p.professional_score).filter(s => s !== null) || [];
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Tier breakdown
    const tierBreakdown = {
      sTier: {
        count: allPicks?.filter(p => p.tier === 'S').length || 0,
        settled: settledPicks?.filter(p => p.tier === 'S').length || 0,
        won: settledPicks?.filter(p => p.tier === 'S' && p.settlement_status === 'won').length || 0
      },
      aTier: {
        count: allPicks?.filter(p => p.tier === 'A').length || 0,
        settled: settledPicks?.filter(p => p.tier === 'A').length || 0,
        won: settledPicks?.filter(p => p.tier === 'A' && p.settlement_status === 'won').length || 0
      },
      bTier: {
        count: allPicks?.filter(p => p.tier === 'B').length || 0,
        settled: settledPicks?.filter(p => p.tier === 'B').length || 0,
        won: settledPicks?.filter(p => p.tier === 'B' && p.settlement_status === 'won').length || 0
      }
    };

    telemetry.result = {
      success: true,
      totalPicks,
      approvedPicks: approved,
      settledPicks: settled,
      winRate,
      avgScore
    };
    telemetry.tierBreakdown = tierBreakdown;

    // Display recap
    console.log('-'.repeat(80));
    console.log('DAILY RECAP:');
    console.log(`  📊 Total Picks: ${totalPicks}`);
    console.log(`  ✅ Approved: ${approved}`);
    console.log(`  ⚖️  Settled: ${settled}`);
    console.log(`  🏆 Win Rate: ${winRate.toFixed(1)}% (${won}/${settled})`);
    console.log(`  📈 Avg Score: ${(avgScore * 100).toFixed(1)}%\n`);

    console.log('TIER BREAKDOWN:');
    console.log(`  S-Tier: ${tierBreakdown.sTier.count} picks | ${tierBreakdown.sTier.won}/${tierBreakdown.sTier.settled} won`);
    console.log(`  A-Tier: ${tierBreakdown.aTier.count} picks | ${tierBreakdown.aTier.won}/${tierBreakdown.aTier.settled} won`);
    console.log(`  B-Tier: ${tierBreakdown.bTier.count} picks | ${tierBreakdown.bTier.won}/${tierBreakdown.bTier.settled} won`);

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
  const result = await runRecapAgentE2E();

  // Save telemetry to file
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-recap-agent.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`📊 Telemetry saved to: ${outPath}`);

  process.exit(result.result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
