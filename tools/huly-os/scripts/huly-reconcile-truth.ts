/**
 * huly-reconcile-truth.ts
 *
 * Audit ALL Huly issues against the truth engine and optionally fix statuses.
 *
 * Usage:
 *   npx tsx scripts/huly-reconcile-truth.ts              # dry-run, console table
 *   npx tsx scripts/huly-reconcile-truth.ts --live        # apply corrections
 *   npx tsx scripts/huly-reconcile-truth.ts --json        # JSON report to stdout
 *   npx tsx scripts/huly-reconcile-truth.ts --csv         # CSV report to stdout
 */

import { execSync } from 'node:child_process';

import { GitHubAdapter } from '../daemon/adapters/github-adapter.js';
import { HulyAdapter } from '../daemon/adapters/huly-adapter.js';
import { AuditLogger } from '../daemon/audit-log.js';
import { loadConfig, REPO_ROOT } from '../daemon/config.js';
import { buildEvidence, deriveStatus } from '../daemon/truth-engine.js';

import type { GitHubPR, HulyIssue } from '../daemon/adapters/types.js';
import type { StatusVerdict } from '../daemon/truth-engine.js';

// ── CLI Flags ────────────────────────────────────────────────────────────

const LIVE = process.argv.includes('--live');
const JSON_OUT = process.argv.includes('--json');
const CSV_OUT = process.argv.includes('--csv');
const TX_DELAY_MS = 200;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Git Helpers ──────────────────────────────────────────────────────────

function getCompleteTags(): Set<string> {
  try {
    const out = execSync('git tag -l "SPRINT-*"', { cwd: REPO_ROOT, encoding: 'utf-8' });
    const tags = out.trim().split('\n').filter(Boolean);
    return new Set(tags.filter(t => /-(COMPLETE|CLOSURE)$/i.test(t)));
  } catch {
    return new Set();
  }
}

// ── Report Row ───────────────────────────────────────────────────────────

interface ReportRow {
  identifier: string;
  title: string;
  currentStatus: string;
  derivedStatus: string;
  needsChange: boolean;
  reason: string;
  applied: boolean;
  error?: string;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  if (!JSON_OUT && !CSV_OUT) {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log(
      `║  Truth Reconciliation  ${LIVE ? '[LIVE]' : '[DRY RUN]'}                            ║`
    );
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  }

  const config = loadConfig();
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);
  const github = new GitHubAdapter(config, audit);

  await huly.connect();

  // Gather all data sources in parallel
  const [allIssues, openPRs, mergedPRs] = await Promise.all([
    huly.listIssues(config.HULY_PROJECT),
    github.listOpenPRs(),
    github.listRecentlyMergedPRs(90), // 90 days of merge history
  ]);

  const completeTags = getCompleteTags();

  if (!JSON_OUT && !CSV_OUT) {
    console.log(
      `Data: ${allIssues.length} issues, ${openPRs.length} open PRs, ${mergedPRs.length} merged PRs, ${completeTags.size} complete tags\n`
    );
  }

  // Process every issue
  const rows: ReportRow[] = [];
  let changed = 0;
  let skipped = 0;
  let errors = 0;

  for (const issue of allIssues) {
    const evidence = buildEvidence(
      issue.identifier,
      issue.status,
      openPRs,
      mergedPRs,
      completeTags
    );

    const verdict: StatusVerdict = deriveStatus(evidence);

    if (!verdict.needsTransition) {
      skipped++;
      rows.push({
        identifier: issue.identifier,
        title: truncate(issue.title, 50),
        currentStatus: issue.status,
        derivedStatus: verdict.status,
        needsChange: false,
        reason: verdict.reason,
        applied: false,
      });
      continue;
    }

    const row: ReportRow = {
      identifier: issue.identifier,
      title: truncate(issue.title, 50),
      currentStatus: issue.status,
      derivedStatus: verdict.status,
      needsChange: true,
      reason: verdict.reason,
      applied: false,
    };

    if (LIVE) {
      try {
        await huly.updateIssueStatus(issue.id, verdict.statusId, issue.space);
        await huly.addComment(
          issue.id,
          `**Truth reconciliation**: ${issue.status} → ${verdict.status}\n` +
            `Reason: ${verdict.reason}`
        );
        row.applied = true;
        changed++;
        await sleep(TX_DELAY_MS);
      } catch (e) {
        row.error = (e as Error).message;
        errors++;
      }
    } else {
      changed++;
    }

    rows.push(row);
  }

  // ── Output ──────────────────────────────────────────────────────────────

  if (JSON_OUT) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: LIVE ? 'live' : 'dry-run',
      summary: {
        total: allIssues.length,
        needsChange: rows.filter(r => r.needsChange).length,
        applied: rows.filter(r => r.applied).length,
        skipped,
        errors,
      },
      dataSources: {
        openPRs: openPRs.length,
        mergedPRs: mergedPRs.length,
        completeTags: completeTags.size,
      },
      changes: rows.filter(r => r.needsChange),
    };
    console.log(JSON.stringify(report, null, 2));
  } else if (CSV_OUT) {
    console.log('identifier,title,currentStatus,derivedStatus,reason,applied,error');
    for (const r of rows.filter(r => r.needsChange)) {
      console.log(
        [
          r.identifier,
          `"${r.title.replace(/"/g, '""')}"`,
          r.currentStatus,
          r.derivedStatus,
          `"${r.reason.replace(/"/g, '""')}"`,
          r.applied,
          r.error ? `"${r.error}"` : '',
        ].join(',')
      );
    }
  } else {
    // Console table for changes
    const changes = rows.filter(r => r.needsChange);
    if (changes.length > 0) {
      console.log('Changes needed:\n');
      for (const r of changes) {
        const mark = r.applied ? '[OK] ' : LIVE && r.error ? '[ERR]' : '[DRY]';
        console.log(
          `  ${mark} ${r.identifier.padEnd(8)} ${r.currentStatus.padEnd(12)} → ${r.derivedStatus.padEnd(12)} | ${r.reason}`
        );
      }
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`Total issues:    ${allIssues.length}`);
    console.log(`Needs change:    ${rows.filter(r => r.needsChange).length}`);
    console.log(`Already correct: ${skipped}`);
    if (LIVE) {
      console.log(`Applied:         ${rows.filter(r => r.applied).length}`);
      console.log(`Errors:          ${errors}`);
    }
    console.log('═══════════════════════════════════════════════════════');

    if (!LIVE && changed > 0) {
      console.log('\nThis was a DRY RUN. Re-run with --live to apply changes.');
    }
  }

  await huly.disconnect();
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
