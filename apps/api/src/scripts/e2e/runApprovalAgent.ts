/**
 * E2E Approval Agent Runner
 *
 * Runs approval workflow with telemetry for E2E audit
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
    picksReviewed: number;
    picksApproved: number;
    picksRejected: number;
    errors: number;
  };
  error?: string;
}

export async function runApprovalAgentE2E(autoApprove: boolean = false): Promise<E2ETelemetry> {
  const start = Date.now();

  console.log('\n' + '='.repeat(80));
  console.log('E2E APPROVAL AGENT TEST');
  console.log('='.repeat(80));
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Auto-Approve: ${autoApprove}\n`);

  const telemetry: E2ETelemetry = {
    timestamp: new Date().toISOString(),
    duration: 0,
    result: {
      success: false,
      picksReviewed: 0,
      picksApproved: 0,
      picksRejected: 0,
      errors: 0
    }
  };

  try {
    const supabase = getSupabaseClient();

    // Fetch unapproved S/A tier picks from raw_props
    console.log('Fetching unapproved S/A tier picks from raw_props...\n');

    const { data: picks, error } = await supabase
      .from('raw_props')
      .select('id, player_name, market, outcome, professional_score, tier, status')
      .in('tier', ['S', 'A'])
      .or('status.is.null,status.neq.approved')
      .not('professional_score', 'is', null)
      .order('professional_score', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch picks: ${error.message}`);
    }

    telemetry.result.picksReviewed = picks?.length || 0;

    console.log(`Found ${picks?.length || 0} picks needing review\n`);

    if (!picks || picks.length === 0) {
      telemetry.result.success = true;
      console.log('No picks to approve');
    } else {
      if (autoApprove) {
        // Auto-approve all S/A tier picks
        console.log('Auto-approving picks...\n');

        for (const pick of picks) {
          const { error: updateError } = await supabase
            .from('raw_props')
            .update({
              status: 'approved',
              updated_at: new Date().toISOString()
            })
            .eq('id', pick.id);

          if (updateError) {
            console.log(`❌ Failed to approve ${pick.id}`);
            telemetry.result.errors++;
          } else {
            console.log(`✅ Approved: ${pick.player_name} - ${pick.market} ${pick.outcome} (${pick.tier} tier)`);
            telemetry.result.picksApproved++;
          }
        }

        telemetry.result.success = true;
      } else {
        console.log('DRY RUN - Would approve:');
        picks.forEach(pick => {
          console.log(`  - ${pick.player_name} - ${pick.market} ${pick.outcome} (${pick.tier} tier, score: ${pick.professional_score})`);
        });
        telemetry.result.success = true;
      }
    }

    // Display results
    console.log('\n' + '-'.repeat(80));
    console.log('RESULTS:');
    console.log(`  ✅ Picks Reviewed: ${telemetry.result.picksReviewed}`);
    console.log(`  ✅ Picks Approved: ${telemetry.result.picksApproved}`);
    console.log(`  ❌ Errors: ${telemetry.result.errors}`);

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
  const autoApprove = process.argv.includes('--auto-approve');
  const result = await runApprovalAgentE2E(autoApprove);

  // Save telemetry to file
  const fs = await import('fs/promises');
  const outPath = path.join(__dirname, '../../../out/ops/e2e-approval-agent.json');
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));

  console.log(`📊 Telemetry saved to: ${outPath}`);

  process.exit(result.result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}
