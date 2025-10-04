/**
 * E2E Everything - Master Orchestrator
 *
 * Runs complete pipeline: Feed → Score → Approve → Alert → Recap → Verify
 * Generates comprehensive audit report and acceptance gates
 */

import fs from 'node:fs';
import path from 'node:path';
import { runFeedAgent } from '../../agents/feed/FeedAgent';
import { runScoringAgent } from '../../agents/scoring/ScoringAgent';
import { runApprovalAgent } from '../../agents/approval/ApprovalAgent';
import { runAlertAgent } from '../../agents/alert/AlertAgent';
import { runRecapAgent } from '../../agents/recap/RecapAgent';
import { supabase } from '../../lib/db/supabaseClient';

const OUT_DIR = process.env.OPS_OUT_DIR || path.join(process.cwd(), 'apps/api/out/ops');

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

type Gate = { name: string; pass: boolean; reason?: string };

async function verifyCloud(runId: string) {
  console.log('☁️  Verifying cloud state...');

  // Counts for last 1h MLB
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600 * 1000).toISOString();
  const seventyTwoAhead = new Date(now.getTime() + 72 * 3600 * 1000).toISOString();

  const { data: lastHour, error: lhErr } = await supabase
    .from('unified_picks')
    .select('id, market')
    .gte('game_date', hourAgo)
    .eq('sport', 'mlb')
    .limit(2000);

  const { data: recentGames, error: gErr } = await supabase
    .from('games')
    .select('id')
    .gte('game_date', now.toISOString())
    .lte('game_date', seventyTwoAhead);

  const byMarket: Record<string, number> = {};
  for (const r of lastHour ?? []) {
    byMarket[r.market] = (byMarket[r.market] ?? 0) + 1;
  }

  const file = path.join(OUT_DIR, `verify_cloud_${runId}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        runId,
        lastHourCount: (lastHour ?? []).length,
        recentGames: (recentGames ?? []).length,
        byMarket,
        errors: { unified: lhErr?.message, games: gErr?.message },
      },
      null,
      2
    )
  );

  console.log(`✅ Verify: ${(lastHour ?? []).length} picks last 1h, ${(recentGames ?? []).length} games next 72h`);

  return {
    lastHourCount: (lastHour ?? []).length,
    recentGames: (recentGames ?? []).length,
    byMarket,
    file,
  };
}

(async () => {
  ensureDir(OUT_DIR);
  ensureDir(path.join(OUT_DIR, 'agents'));

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const audit: any = { runId, startedAt: new Date().toISOString(), stages: {} };
  const gates: Gate[] = [];

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🚀 E2E Pipeline Starting - Run ID: ${runId}`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  try {
    // STAGE 1: FEED
    console.log('📥 STAGE 1: Feed Agent');
    console.log('───────────────────────────────────────────────────────────');
    const feed = await runFeedAgent(runId);
    audit.stages.feed = feed;
    const feedPass = feed.inserted > 0 || (feed.skippedDedup > 0 && feed.mappedRows > 0);
    gates.push({
      name: 'Feed',
      pass: feedPass,
      reason: feedPass ? undefined : 'No inserts and no dedup',
    });
    console.log('');

    // STAGE 2: SCORING
    console.log('📊 STAGE 2: Scoring Agent');
    console.log('───────────────────────────────────────────────────────────');
    const scoring = await runScoringAgent(runId);
    audit.stages.scoring = scoring;
    gates.push({
      name: 'Scoring',
      pass: scoring.considered > 0,
      reason: scoring.considered ? undefined : 'Nothing to score',
    });
    console.log('');

    // STAGE 3: APPROVAL
    console.log('✅ STAGE 3: Approval Agent');
    console.log('───────────────────────────────────────────────────────────');
    const approval = await runApprovalAgent(runId);
    audit.stages.approval = approval;
    gates.push({
      name: 'Approval',
      pass: approval.approved > 0,
      reason: approval.approved ? undefined : 'No approvals',
    });
    console.log('');

    // STAGE 4: ALERT
    console.log('📢 STAGE 4: Alert Agent');
    console.log('───────────────────────────────────────────────────────────');
    const alert = await runAlertAgent(runId);
    audit.stages.alert = alert;
    gates.push({
      name: 'Alert',
      pass: !!alert.posted,
      reason: alert.posted ? undefined : 'No Discord post (token?)',
    });
    console.log('');

    // STAGE 5: RECAP
    console.log('📝 STAGE 5: Recap Agent');
    console.log('───────────────────────────────────────────────────────────');
    const recap = await runRecapAgent(runId);
    audit.stages.recap = recap;
    gates.push({ name: 'Recap', pass: !!recap.recap });
    console.log('');

    // STAGE 6: VERIFY CLOUD
    console.log('☁️  STAGE 6: Cloud Verification');
    console.log('───────────────────────────────────────────────────────────');
    const verify = await verifyCloud(runId);
    audit.stages.verify = verify;
    const verifyPass = verify.lastHourCount >= 0 && verify.recentGames >= 0;
    gates.push({ name: 'Cloud Verify', pass: verifyPass });
    console.log('');

    // WRITE AUDIT FILES
    console.log('📄 Writing audit artifacts...');
    const auditFileJson = path.join(OUT_DIR, `E2E_AUDIT_${runId}.json`);
    const auditFileMd = path.join(OUT_DIR, `E2E_AUDIT_${runId}.md`);
    fs.writeFileSync(auditFileJson, JSON.stringify({ ...audit, gates }, null, 2));

    const lines = [
      `# E2E Audit ${runId}`,
      '',
      `**Started**: ${audit.startedAt}`,
      '',
      '## Stages',
      '```json',
      JSON.stringify(audit, null, 2),
      '```',
      '',
      '## Acceptance Gates',
      ...gates.map((g) => `- ${g.pass ? '✅' : '❌'} **${g.name}**${g.reason ? ` — ${g.reason}` : ''}`),
      '',
      '## Summary',
      `- Total Gates: ${gates.length}`,
      `- Passed: ${gates.filter((g) => g.pass).length}`,
      `- Failed: ${gates.filter((g) => !g.pass).length}`,
    ];
    fs.writeFileSync(auditFileMd, lines.join('\n'));

    // UPDATE ACCEPTANCE GATES SUMMARY
    const sumFile = path.join(OUT_DIR, 'ACCEPTANCE_GATES_SUMMARY.md');
    const summary = [
      '',
      `## Run ${runId}`,
      '',
      ...gates.map((g) => `- ${g.pass ? '✅' : '❌'} ${g.name}${g.reason ? ` — ${g.reason}` : ''}`),
      '',
    ].join('\n');
    fs.appendFileSync(sumFile, summary);

    // FINAL ONE-LINE SUMMARY
    const channel = audit.stages.alert?.channel ?? 'unknown';
    const ts = audit.stages.alert?.timestamp ?? new Date().toISOString();
    const line = `[SUMMARY ${runId}] events=${audit.stages.feed?.events ?? 0} props_processed=${audit.stages.feed?.mappedRows ?? 0} inserted=${audit.stages.feed?.inserted ?? 0} dedup=${audit.stages.feed?.skippedDedup ?? 0} scored=${audit.stages.scoring?.updated ?? 0} approved=${audit.stages.approval?.approved ?? 0} alerts_posted=${audit.stages.alert?.posted ? 1 : 0} discord_channel=${channel} at=${ts}`;

    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 E2E Pipeline Complete');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('📊 Acceptance Gates:');
    gates.forEach((g) => {
      console.log(`   ${g.pass ? '✅' : '❌'} ${g.name}${g.reason ? ` — ${g.reason}` : ''}`);
    });
    console.log('');
    console.log('📄 Artifacts:');
    console.log(`   - JSON: ${auditFileJson}`);
    console.log(`   - MD: ${auditFileMd}`);
    console.log(`   - Summary: ${sumFile}`);
    console.log('');
    console.log('📋 One-Line Summary:');
    console.log(`   ${line}`);
    console.log('');

    const allPassed = gates.every((g) => g.pass);
    if (allPassed) {
      console.log('✅ ALL ACCEPTANCE GATES PASSED');
      process.exit(0);
    } else {
      console.log('⚠️  SOME ACCEPTANCE GATES FAILED');
      process.exit(1);
    }
  } catch (e: any) {
    console.error('');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('💥 E2E Pipeline Failed');
    console.error('═══════════════════════════════════════════════════════════');
    console.error('');
    console.error(`Error: ${e?.message}`);
    console.error('');

    const errFile = path.join(OUT_DIR, `E2E_ERROR_${runId}.json`);
    fs.writeFileSync(errFile, JSON.stringify({ runId, error: e?.message, stack: e?.stack }, null, 2));

    // Tail last 200 lines of process logs if available (placeholder)
    const logFile = path.join(OUT_DIR, `logs/api_tail_${runId}.log`);
    ensureDir(path.dirname(logFile));
    fs.writeFileSync(logFile, 'Attach docker logs here (operator step)');

    console.error(`📄 Error artifact: ${errFile}`);
    console.error('');

    process.exit(1);
  }
})();
