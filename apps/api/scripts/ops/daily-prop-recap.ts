/**
 * Daily Prop Recap Script
 *
 * Generates daily recap of props processed, graded, and results
 * Charter v3.0 compliant: canonical picks + professional grading
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

interface DailyRecapMetrics {
  date: string;
  props_processed: number;
  picks_created: number;
  clv_tracking_rows: number;
  tier_distribution: Record<string, number>;
  avg_professional_score: number;
  total_devigged_edge: number;
  wins: number;
  losses: number;
  pushes: number;
  pending: number;
}

async function generateDailyRecap(targetDate?: string) {
  const date = targetDate || getYesterday();
  console.log(`[Daily Recap] Generating recap for ${date}...`);

  const metrics: DailyRecapMetrics = {
    date,
    props_processed: 0,
    picks_created: 0,
    clv_tracking_rows: 0,
    tier_distribution: {},
    avg_professional_score: 0,
    total_devigged_edge: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    pending: 0,
  };

  try {
    // Query picks created on target date
    const startOfDay = `${date}T00:00:00Z`;
    const endOfDay = `${date}T23:59:59Z`;

    const { data: picks, error: picksError } = await supabase
      .from('picks')
      .select('id, metadata, status, created_at')
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay)
      .eq('metadata->>source', 'professional_pipeline');

    if (picksError) {
      throw new Error(`Failed to fetch picks: ${picksError.message}`);
    }

    metrics.picks_created = picks?.length || 0;

    if (picks && picks.length > 0) {
      let totalScore = 0;
      let totalEdge = 0;

      picks.forEach((pick: any) => {
        const metadata = pick.metadata || {};

        // Tier distribution
        const tier = metadata.tier || 'Unknown';
        metrics.tier_distribution[tier] = (metrics.tier_distribution[tier] || 0) + 1;

        // Professional score
        const score = Number(metadata.professional_score || 0);
        totalScore += score;

        // Devigged edge
        const edge = Number(metadata.devigged_edge || 0);
        totalEdge += edge;

        // Status distribution
        switch (pick.status) {
          case 'won':
            metrics.wins++;
            break;
          case 'lost':
            metrics.losses++;
            break;
          case 'push':
            metrics.pushes++;
            break;
          default:
            metrics.pending++;
        }
      });

      metrics.avg_professional_score = totalScore / picks.length;
      metrics.total_devigged_edge = totalEdge;
    }

    // Query CLV tracking for the date
    const { count: clvCount } = await supabase
      .from('clv_tracking')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    metrics.clv_tracking_rows = clvCount || 0;

    // Query raw props processed on this date
    const { count: propsCount } = await supabase
      .from('raw_props')
      .select('id', { count: 'exact', head: true })
      .gte('processed_at', startOfDay)
      .lte('processed_at', endOfDay)
      .eq('processed_by', 'professional_system');

    metrics.props_processed = propsCount || 0;

  } catch (error) {
    console.error('[Daily Recap] Error:', error);
    throw error;
  }

  return metrics;
}

function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

async function main() {
  const targetDate = process.argv[2] || getYesterday();

  console.log('[Daily Recap] Starting for date:', targetDate);

  const metrics = await generateDailyRecap(targetDate);

  // Write JSON artifact
  const artifactDir = path.join('out', 'ops', 'cutover', 'metrics', 'recap');
  fs.mkdirSync(artifactDir, { recursive: true });

  const jsonPath = path.join(artifactDir, `PROP_RECAP_${targetDate}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(metrics, null, 2), 'utf-8');

  // Write Markdown summary
  const mdPath = path.join(artifactDir, `PROP_RECAP_${targetDate}.md`);
  const mdLines = [
    `# Daily Prop Recap - ${targetDate}`,
    '',
    '## Summary',
    `- **Raw Props Processed**: ${metrics.props_processed}`,
    `- **Picks Created**: ${metrics.picks_created}`,
    `- **CLV Tracking Rows**: ${metrics.clv_tracking_rows}`,
    '',
    '## Performance',
    `- **Avg Professional Score**: ${metrics.avg_professional_score.toFixed(2)}`,
    `- **Total Devigged Edge**: ${metrics.total_devigged_edge.toFixed(2)}`,
    '',
    '## Tier Distribution',
    ...Object.entries(metrics.tier_distribution).map(([tier, count]) => `- **Tier ${tier}**: ${count} picks`),
    '',
    '## Results',
    `- **Wins**: ${metrics.wins}`,
    `- **Losses**: ${metrics.losses}`,
    `- **Pushes**: ${metrics.pushes}`,
    `- **Pending**: ${metrics.pending}`,
    '',
    '## Conclusion',
    metrics.picks_created > 0 ? `✅ Processed ${metrics.picks_created} professional picks` : '⚠️  No picks processed on this date',
  ];

  fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf-8');

  console.log(`\n[Daily Recap] Complete!`);
  console.log(`  Picks Created: ${metrics.picks_created}`);
  console.log(`  Props Processed: ${metrics.props_processed}`);
  console.log(`  Artifacts: ${artifactDir}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Daily recap failed:', err);
  process.exit(1);
});
