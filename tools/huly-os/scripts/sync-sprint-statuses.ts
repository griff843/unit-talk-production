/**
 * sync-sprint-statuses.ts
 *
 * One-time backfill: reads git tags/branches and syncs Huly [SPRINT] issue statuses.
 *
 * Logic:
 *   - SPRINT-*-COMPLETE tag exists → issue status = Done
 *   - Active sprint/* branch (no -COMPLETE tag) → issue status = InProgress
 *   - Creates [SPRINT] issues for historical sprints not yet tracked in Huly
 *
 * Usage:
 *   npx tsx scripts/sync-sprint-statuses.ts              # dry-run
 *   npx tsx scripts/sync-sprint-statuses.ts --live        # apply changes
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';

import { HulyAdapter } from '../daemon/adapters/huly-adapter.js';
import { HULY_STATUS } from '../daemon/adapters/types.js';
import { AuditLogger } from '../daemon/audit-log.js';
import { loadConfig, REPO_ROOT } from '../daemon/config.js';
import { renderTemplate } from '../daemon/issue-templates.js';

import type { HulyIssue } from '../daemon/adapters/types.js';

const DRY_RUN = !process.argv.includes('--live');

/** Rate-limit delay between Huly TX operations */
const TX_DELAY_MS = 200;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Git Helpers ─────────────────────────────────────────────────────────

function getSprintTags(): string[] {
  const out = execSync('git tag -l "SPRINT-*"', { cwd: REPO_ROOT, encoding: 'utf-8' });
  return out.trim().split('\n').filter(Boolean);
}

function getRemoteSprintBranches(): string[] {
  const out = execSync('git branch -r --list "origin/sprint/*"', {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
  });
  return out
    .trim()
    .split('\n')
    .map(b => b.trim().replace('origin/', ''))
    .filter(Boolean);
}

/** Normalize a sprint tag to a sprint ID (strip -COMPLETE/-CLOSURE/-PARTIAL suffixes) */
function tagToSprintId(tag: string): string {
  return tag.replace(/-(COMPLETE|CLOSURE|PARTIAL)$/i, '');
}

/** Convert sprint ID to expected branch name */
function sprintIdToBranch(sprintId: string): string {
  return `sprint/${sprintId.replace(/^SPRINT-/, '').toLowerCase()}`;
}

/** Check if a sprint tag indicates completion */
function isCompleteTag(tag: string): boolean {
  return /-(COMPLETE|CLOSURE)$/i.test(tag);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log(
    `║  Sprint Status Sync  ${DRY_RUN ? '[DRY RUN]' : '[LIVE]'}                        ║`
  );
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  // ── Load git data ──────────────────────────────────────────────────
  const tags = getSprintTags();
  const branches = getRemoteSprintBranches();

  console.log(`Git: ${tags.length} sprint tags, ${branches.length} sprint branches\n`);

  // Build sprint map: sprintId → { complete, tags, branch }
  const sprintMap = new Map<string, { complete: boolean; tags: string[]; branch: string | null }>();

  for (const tag of tags) {
    const id = tagToSprintId(tag);
    const existing = sprintMap.get(id) ?? { complete: false, tags: [], branch: null };
    existing.tags.push(tag);
    if (isCompleteTag(tag)) existing.complete = true;
    sprintMap.set(id, existing);
  }

  // Add branch info
  for (const branch of branches) {
    const id = `SPRINT-${branch.replace('sprint/', '').toUpperCase()}`;
    const existing = sprintMap.get(id);
    if (existing) {
      existing.branch = branch;
    } else {
      // Branch exists but no tag — active sprint
      sprintMap.set(id, { complete: false, tags: [], branch });
    }
  }

  const completedCount = [...sprintMap.values()].filter(v => v.complete).length;
  const activeCount = [...sprintMap.values()].filter(v => !v.complete && v.branch).length;
  console.log(
    `Sprint map: ${sprintMap.size} total — ${completedCount} completed, ${activeCount} active\n`
  );

  // ── Connect to Huly ────────────────────────────────────────────────
  const config = loadConfig();
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);
  await huly.connect();
  console.log('Connected to Huly\n');

  // Fetch ALL issues (listIssues fetches all regardless of project param)
  const allIssues = await huly.listIssues(config.HULY_PROJECT);
  console.log(`Huly: ${allIssues.length} issues total\n`);

  // Index existing [SPRINT] issues by sprint ID
  const sprintIssueMap = new Map<string, HulyIssue>();
  const SPRINT_TITLE_RE = /^\[SPRINT\]\s*(.+)$/;
  const SPRINT_ID_RE = /SPRINT-[\w-]+-\d+/;

  for (const issue of allIssues) {
    if (!SPRINT_TITLE_RE.test(issue.title)) continue;
    const m = issue.title.match(SPRINT_ID_RE);
    if (m) sprintIssueMap.set(m[0], issue);
  }

  console.log(`Existing [SPRINT] issues in Huly: ${sprintIssueMap.size}\n`);

  // ── Sync statuses ──────────────────────────────────────────────────
  let created = 0;
  let transitioned = 0;
  let skipped = 0;

  for (const [sprintId, info] of sprintMap) {
    const existing = sprintIssueMap.get(sprintId);
    const desiredStatus = info.complete ? 'Done' : info.branch ? 'In Progress' : 'Todo';
    const desiredStatusId = info.complete
      ? HULY_STATUS.Done
      : info.branch
        ? HULY_STATUS.InProgress
        : HULY_STATUS.Todo;

    if (existing) {
      // Issue exists — check if status needs updating
      if (existing.status === desiredStatus || existing.status === 'Cancelled') {
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [DRY] ${sprintId}: ${existing.status} → ${desiredStatus}`);
        transitioned++;
      } else {
        try {
          await huly.updateIssueStatus(existing.id, desiredStatusId, existing.space);
          await huly.addComment(
            existing.id,
            `**Status sync from git:** ${existing.status} → ${desiredStatus}\n` +
              `Tags: ${info.tags.join(', ') || 'none'}\n` +
              `Branch: ${info.branch ?? 'none'}`
          );
          console.log(`  [OK]  ${sprintId}: ${existing.status} → ${desiredStatus}`);
          transitioned++;
          await sleep(TX_DELAY_MS);
        } catch (e) {
          console.error(`  [ERR] ${sprintId}: ${(e as Error).message}`);
        }
      }
    } else {
      // No [SPRINT] issue exists — create one
      const sprintTitle = `[SPRINT] ${sprintId}`;
      const body = renderTemplate('sprint', {
        title: sprintTitle,
        sprintId,
        description: `Auto-created by sprint status sync.\n\nBranch: ${info.branch ?? 'n/a'}\nTags: ${info.tags.join(', ') || 'none'}`,
      });

      if (DRY_RUN) {
        console.log(`  [DRY] CREATE ${sprintTitle} → ${desiredStatus}`);
        created++;
      } else {
        try {
          const result = await huly.upsertIssueByTitle(config.HULY_PROJECT, sprintTitle, body);
          // Now set the correct status
          if (desiredStatusId !== HULY_STATUS.Todo) {
            // Need to resolve the space for the newly created issue
            const freshIssues = await huly.listIssues(config.HULY_PROJECT);
            const fresh = freshIssues.find(i => i.id === result.id);
            if (fresh) {
              await huly.updateIssueStatus(result.id, desiredStatusId, fresh.space);
            }
          }
          console.log(`  [OK]  CREATE ${sprintTitle} → ${desiredStatus}`);
          created++;
          await sleep(TX_DELAY_MS);
        } catch (e) {
          console.error(`  [ERR] CREATE ${sprintTitle}: ${(e as Error).message}`);
        }
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`Created: ${created}`);
  console.log(`Transitioned: ${transitioned}`);
  console.log(`Skipped (already correct): ${skipped}`);
  console.log(`Total sprints processed: ${sprintMap.size}`);

  if (DRY_RUN) {
    console.log('\nThis was a DRY RUN. Re-run with --live to apply changes.');
  }
  console.log('═══════════════════════════════════════════════════════');

  await huly.disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
