// [ENH][P0] Sprint closeout writes back to Huly (Done + proof links)
// Updates all sprint-related Huly issues to Done, attaches proof artifact links,
// and publishes a closeout document.
// Usage: npx tsx scripts/sprint-close.ts <SPRINT-ID> [--dry-run]

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

import { HulyAdapter } from '../daemon/adapters/huly-adapter.js';
import { HULY_STATUS } from '../daemon/adapters/types.js';
import { AuditLogger } from '../daemon/audit-log.js';
import { loadConfig, REPO_ROOT } from '../daemon/config.js';

import type { HulyIssue } from '../daemon/adapters/types.js';

async function main(): Promise<void> {
  const sprintId = process.argv[2];
  const dryRun = process.argv.includes('--dry-run');

  if (!sprintId) {
    console.error('Usage: npx tsx scripts/sprint-close.ts <SPRINT-ID> [--dry-run]');
    console.error('Example: npx tsx scripts/sprint-close.ts SPRINT-HULY-REST-LIVEQUERY-BRIDGE-017');
    process.exit(1);
  }

  console.log(`\nSprint Closeout — ${sprintId} ${dryRun ? '(DRY-RUN)' : '(LIVE)'}\n`);

  // Check proof directory
  const proofDir = resolve(REPO_ROOT, 'out', 'sprints', sprintId);
  const proofExists = existsSync(proofDir);
  console.log(`Proof directory: ${proofDir} — ${proofExists ? 'EXISTS' : 'NOT FOUND'}`);

  // Connect to Huly
  const config = loadConfig();
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);
  await huly.connect();
  console.log('Connected to Huly.\n');

  // List all issues
  const allIssues = await huly.listIssues(config.HULY_PROJECT);
  console.log(`Total issues: ${allIssues.length}`);

  // Find [SPRINT] parent issue
  const sprintTitle = `[SPRINT] ${sprintId}`;
  const sprintIssue = allIssues.find(i => i.title === sprintTitle);
  if (!sprintIssue) {
    console.error(`\nSprint issue not found: "${sprintTitle}"`);
    console.error('Available sprint issues:');
    for (const i of allIssues.filter(i => i.title.startsWith('[SPRINT]'))) {
      console.error(`  - ${i.identifier}: ${i.title} (${i.status})`);
    }
    process.exit(1);
  }
  console.log(
    `Sprint issue: ${sprintIssue.identifier} — ${sprintIssue.title} (${sprintIssue.status})`
  );

  // Find related issues: title contains SPRINT-ID, or task issues like "Plan — SPRINT-ID"
  const sprintIdUpper = sprintId.toUpperCase();
  const relatedIssues = allIssues.filter(i => {
    if (i.id === sprintIssue.id) return false; // exclude parent
    return (
      i.title.includes(sprintId) ||
      i.title.includes(sprintIdUpper) ||
      i.title.toUpperCase().includes(sprintIdUpper)
    );
  });
  console.log(`Related issues: ${relatedIssues.length}\n`);

  // Transition non-Done issues
  const closedIssues: HulyIssue[] = [];
  const skippedIssues: HulyIssue[] = [];
  const proofNote = proofExists
    ? `Proof: \`${proofDir.replace(REPO_ROOT + '/', '').replace(REPO_ROOT + '\\', '')}\``
    : 'Proof: not found (generate before final closeout)';

  for (const issue of relatedIssues) {
    if (issue.status === 'Done' || issue.status === 'Cancelled') {
      skippedIssues.push(issue);
      console.log(`  SKIP: ${issue.identifier} — ${issue.title} (already ${issue.status})`);
      continue;
    }

    if (dryRun) {
      console.log(
        `  [DRY-RUN] Would close: ${issue.identifier} — ${issue.title} (${issue.status})`
      );
      closedIssues.push(issue);
      continue;
    }

    try {
      await huly.updateIssueStatus(issue.id, HULY_STATUS.Done, issue.project);
      await huly.addComment(
        issue.id,
        `**Sprint closed:** ${sprintId}\n\n${proofNote}\nClosed at: ${new Date().toISOString()}`
      );
      closedIssues.push(issue);
      console.log(`  CLOSED: ${issue.identifier} — ${issue.title}`);
    } catch (err) {
      console.error(`  ERROR: ${issue.identifier} — ${(err as Error).message}`);
    }
  }

  // Close the [SPRINT] parent issue itself
  if (sprintIssue.status !== 'Done' && sprintIssue.status !== 'Cancelled') {
    if (dryRun) {
      console.log(`\n  [DRY-RUN] Would close sprint issue: ${sprintIssue.identifier}`);
    } else {
      try {
        await huly.updateIssueStatus(sprintIssue.id, HULY_STATUS.Done, sprintIssue.project);

        // Build closeout summary comment
        const summary = [
          `**Sprint Closeout — ${sprintId}**`,
          '',
          `Closed at: ${new Date().toISOString()}`,
          `${proofNote}`,
          '',
          `**Issues closed (${closedIssues.length}):**`,
          ...closedIssues.map(i => `- ${i.identifier}: ${i.title}`),
          '',
          `**Already done/skipped (${skippedIssues.length}):**`,
          ...skippedIssues.map(i => `- ${i.identifier}: ${i.title} (${i.status})`),
        ].join('\n');

        await huly.addComment(sprintIssue.id, summary);
        console.log(`\n  CLOSED sprint issue: ${sprintIssue.identifier}`);
      } catch (err) {
        console.error(`\n  ERROR closing sprint issue: ${(err as Error).message}`);
      }
    }
  } else {
    console.log(`\n  Sprint issue already ${sprintIssue.status}`);
  }

  // Publish closeout document
  if (!dryRun) {
    const closeoutMd = buildCloseoutDocument(
      sprintId,
      closedIssues,
      skippedIssues,
      proofDir,
      proofExists
    );
    try {
      const docTitle = `Sprint Closeout — ${sprintId}`;
      const { id, created } = await huly.upsertDoc(config.HULY_TEAMSPACE, docTitle, closeoutMd);
      console.log(`\n  Closeout document ${created ? 'created' : 'updated'}: ${id}`);
    } catch (err) {
      console.warn(`  Document publish failed (non-fatal): ${(err as Error).message}`);
    }
  }

  await huly.disconnect();

  // Summary
  console.log(`\n── Sprint Closeout Summary ──`);
  console.log(`  Sprint: ${sprintId}`);
  console.log(`  Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}`);
  console.log(`  Issues closed: ${closedIssues.length}`);
  console.log(`  Issues skipped: ${skippedIssues.length}`);
  console.log(`  Proof exists: ${proofExists}`);
}

function buildCloseoutDocument(
  sprintId: string,
  closed: HulyIssue[],
  skipped: HulyIssue[],
  proofDir: string,
  proofExists: boolean
): string {
  const now = new Date().toISOString();
  let md = `# Sprint Closeout — ${sprintId}\n\n`;
  md += `**Date:** ${now.slice(0, 10)}\n`;
  md += `**Generated:** ${now}\n`;
  md += `**Proof:** ${proofExists ? proofDir : 'Not found'}\n\n`;

  md += `## Issues Closed (${closed.length})\n\n`;
  if (closed.length === 0) {
    md += '_No issues closed._\n\n';
  } else {
    md += '| Identifier | Title |\n';
    md += '|------------|-------|\n';
    for (const i of closed) {
      md += `| ${i.identifier} | ${i.title} |\n`;
    }
    md += '\n';
  }

  md += `## Already Done/Skipped (${skipped.length})\n\n`;
  if (skipped.length === 0) {
    md += '_No issues skipped._\n\n';
  } else {
    for (const i of skipped) {
      md += `- ${i.identifier}: ${i.title} (${i.status})\n`;
    }
    md += '\n';
  }

  md += `## Proof Artifacts\n\n`;
  md += proofExists
    ? `Proof bundle: \`${proofDir}\`\n`
    : '_Proof bundle not found. Generate before final closeout._\n';

  return md;
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
