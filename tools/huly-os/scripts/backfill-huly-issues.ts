// HULY-OS v1: Backfill script — scan GitHub PR history, link to Huly issues
// Idempotent: uses title-based dedup to prevent duplicate issue creation.
// Usage: npx tsx scripts/backfill-huly-issues.ts [--dry-run]

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { GitHubAdapter } from '../daemon/adapters/github-adapter.js';
import { HulyAdapter } from '../daemon/adapters/huly-adapter.js';
import { AuditLogger } from '../daemon/audit-log.js';
import { loadConfig } from '../daemon/config.js';

import type { GitHubPR, HulyIssue } from '../daemon/adapters/types.js';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

interface BackfillResult {
  scanned: number;
  linked: number;
  created: number;
  skipped: number;
  errors: string[];
}

const ISSUE_REF_RE = /\b(UT-\d+)\b/g;

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const daysBack = 90;

  console.log(`\nHULY-OS Backfill — scanning last ${daysBack} days of GitHub PRs`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}\n`);

  const config = loadConfig();
  const audit = new AuditLogger();

  // Connect adapters
  const github = new GitHubAdapter(config, audit);
  const huly = new HulyAdapter(config, audit);
  await huly.connect();

  // Gather data
  console.log('Fetching GitHub PRs...');
  const [openPRs, mergedPRs] = await Promise.all([
    github.listOpenPRs(),
    github.listRecentlyMergedPRs(daysBack),
  ]);
  const allPRs = [...openPRs, ...mergedPRs];
  console.log(`  Found ${allPRs.length} PRs (${openPRs.length} open, ${mergedPRs.length} merged)`);

  console.log('Fetching Huly issues...');
  const hulyIssues = await huly.listIssues(config.HULY_PROJECT);
  console.log(`  Found ${hulyIssues.length} Huly issues\n`);

  // Build lookup: identifier → issue
  const issueByRef = new Map<string, HulyIssue>();
  for (const issue of hulyIssues) {
    if (issue.identifier) issueByRef.set(issue.identifier, issue);
  }

  const result: BackfillResult = { scanned: 0, linked: 0, created: 0, skipped: 0, errors: [] };

  for (const pr of allPRs) {
    result.scanned++;
    const refs = extractRefs(pr);

    if (refs.length === 0) {
      // PR has no UT-* refs — check if sprint branch
      if (pr.headBranch.startsWith('sprint/')) {
        await handleSprintBranchPR(huly, config, pr, hulyIssues, result, dryRun);
      } else {
        result.skipped++;
      }
      continue;
    }

    // Link each ref to its Huly issue
    for (const ref of refs) {
      const issue = issueByRef.get(ref);
      if (issue) {
        // Link existing issue to PR
        console.log(`  PR #${pr.number} → ${ref} (existing: ${issue.id})`);
        if (!dryRun) {
          try {
            await huly.linkIssueToPR(issue.id, pr.number, pr.title, pr.url);
            result.linked++;
          } catch (err) {
            const msg = `Link PR #${pr.number} → ${ref}: ${(err as Error).message}`;
            console.warn(`    ERROR: ${msg}`);
            result.errors.push(msg);
          }
        } else {
          result.linked++;
        }
      } else {
        console.log(`  PR #${pr.number} references ${ref} — no matching Huly issue`);
        result.skipped++;
      }
    }
  }

  // Print summary
  console.log('\n── Backfill Summary ──');
  console.log(`  PRs scanned:     ${result.scanned}`);
  console.log(`  Links created:   ${result.linked}`);
  console.log(`  Issues created:  ${result.created}`);
  console.log(`  Skipped:         ${result.skipped}`);
  console.log(`  Errors:          ${result.errors.length}`);

  // Write report
  const outDir = resolve(import.meta.dirname ?? '.', '..', '..', '..', 'out', 'ops', 'backfill');
  mkdirSync(outDir, { recursive: true });
  const reportPath = resolve(outDir, `backfill-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`\n  Report: ${reportPath}`);

  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
  }
}

function extractRefs(pr: GitHubPR): string[] {
  const sources = [pr.title, pr.headBranch];
  const refs = new Set<string>();
  for (const src of sources) {
    const matches = src.match(ISSUE_REF_RE);
    if (matches) {
      for (const m of matches) refs.add(m);
    }
  }
  return [...refs];
}

async function handleSprintBranchPR(
  huly: HulyAdapter,
  config: { HULY_PROJECT: string },
  pr: GitHubPR,
  hulyIssues: HulyIssue[],
  result: BackfillResult,
  dryRun: boolean
): Promise<void> {
  // Try to match sprint branch to a [SPRINT] issue
  const branchSuffix = pr.headBranch.replace('sprint/', '').toUpperCase();
  const sprintIssue = hulyIssues.find(
    i =>
      i.title.startsWith('[SPRINT]') &&
      (i.title.includes(branchSuffix) || i.title.includes(`SPRINT-${branchSuffix}`))
  );

  if (sprintIssue) {
    console.log(`  PR #${pr.number} (${pr.headBranch}) → sprint issue ${sprintIssue.id}`);
    if (!dryRun) {
      try {
        await huly.linkIssueToPR(sprintIssue.id, pr.number, pr.title, pr.url);
        result.linked++;
      } catch (err) {
        result.errors.push(`Sprint link PR #${pr.number}: ${(err as Error).message}`);
      }
    } else {
      result.linked++;
    }
  } else {
    result.skipped++;
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
