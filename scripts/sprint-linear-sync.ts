#!/usr/bin/env npx tsx
/**
 * SPRINT LINEAR SYNC
 * Sprint: SPRINT-CLAUDE-OS-COS002-LINEAR-SYNC
 *
 * Posts a sprint closeout comment to a Linear issue and marks it Done.
 * Called automatically by sprint:close when --linear <UNI-N> is provided
 * and LINEAR_API_KEY is set. Gracefully skips if the key is missing.
 *
 * Usage:
 *   npm run sprint:linear-sync -- --issue UNI-63 --sprint SPRINT-FOO-123
 *   npm run sprint:linear-sync -- --issue UNI-63 --sprint SPRINT-FOO-123 --date 2026-03-14
 *
 * Required env:
 *   LINEAR_API_KEY=lin_api_xxxx   (Linear personal API key)
 *   Get one: Linear Settings → API → Personal API keys
 *
 * Reference: docs/02_architecture/claude_os_ceiling_blueprint.md §10 COS-002
 */

/* eslint-disable no-console, security/detect-non-literal-fs-filename */

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const WORKSPACE_ROOT = path.resolve(__dirname, '..');
const SPRINTS_DIR = path.join(WORKSPACE_ROOT, 'out', 'sprints');
const LINEAR_API_URL = 'https://api.linear.app/graphql';

// Done state ID for Unit Talk team (from list_issue_statuses)
const LINEAR_DONE_STATE_ID = '915d4e1d-b4de-43f2-932e-24cf8ced5734';

// ─── Arg parsing ──────────────────────────────────────────────────────────────

interface ParsedArgs {
  issueKey: string;
  sprintId: string;
  date: string | null;
  dryRun: boolean;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let issueKey = '';
  let sprintId = '';
  let date: string | null = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--issue' && next) {
      issueKey = next;
      i++;
    } else if (arg === '--sprint' && next) {
      sprintId = next;
      i++;
    } else if (arg === '--date' && next) {
      date = next;
      i++;
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { issueKey, sprintId, date, dryRun };
}

// ─── Linear GraphQL helper ────────────────────────────────────────────────────

function linearRequest(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const req = https.request(
      LINEAR_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: apiKey,
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Failed to parse Linear response: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ─── Issue ID resolver ────────────────────────────────────────────────────────

async function resolveIssueId(apiKey: string, issueKey: string): Promise<string> {
  const query = `
    query IssueByKey($key: String!) {
      issue(id: $key) {
        id
        identifier
        title
        state { name }
      }
    }
  `;
  const resp = (await linearRequest(apiKey, query, { key: issueKey })) as {
    data?: { issue?: { id: string; identifier: string; title: string; state: { name: string } } };
    errors?: { message: string }[];
  };
  if (resp.errors?.length) {
    throw new Error(`Linear API error: ${resp.errors.map(e => e.message).join(', ')}`);
  }
  if (!resp.data?.issue) {
    throw new Error(`Issue not found: ${issueKey}`);
  }
  console.log(
    `   Found: ${resp.data.issue.identifier} — ${resp.data.issue.title} (${resp.data.issue.state.name})`
  );
  return resp.data.issue.id;
}

// ─── Post comment ─────────────────────────────────────────────────────────────

async function postComment(apiKey: string, issueId: string, body: string): Promise<void> {
  const mutation = `
    mutation CreateComment($issueId: String!, $body: String!) {
      commentCreate(input: { issueId: $issueId, body: $body }) {
        success
        comment { id }
      }
    }
  `;
  const resp = (await linearRequest(apiKey, mutation, { issueId, body })) as {
    data?: { commentCreate?: { success: boolean } };
    errors?: { message: string }[];
  };
  if (resp.errors?.length) {
    throw new Error(`Comment failed: ${resp.errors.map(e => e.message).join(', ')}`);
  }
  if (!resp.data?.commentCreate?.success) {
    throw new Error('Comment create returned success=false');
  }
}

// ─── Mark Done ────────────────────────────────────────────────────────────────

async function markDone(apiKey: string, issueId: string): Promise<void> {
  const mutation = `
    mutation UpdateIssue($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) {
        success
        issue { state { name } }
      }
    }
  `;
  const resp = (await linearRequest(apiKey, mutation, {
    id: issueId,
    stateId: LINEAR_DONE_STATE_ID,
  })) as {
    data?: { issueUpdate?: { success: boolean; issue: { state: { name: string } } } };
    errors?: { message: string }[];
  };
  if (resp.errors?.length) {
    throw new Error(`State update failed: ${resp.errors.map(e => e.message).join(', ')}`);
  }
  if (!resp.data?.issueUpdate?.success) {
    throw new Error('Issue update returned success=false');
  }
  console.log(`   State → ${resp.data.issueUpdate.issue.state.name}`);
}

// ─── Build comment body ───────────────────────────────────────────────────────

function buildCommentBody(sprintId: string, date: string, closeoutExists: boolean): string {
  const lines: string[] = [
    `## ✅ Sprint Closeout: ${sprintId}`,
    '',
    `**Date**: ${date}`,
    `**Status**: COMPLETE`,
    '',
  ];

  if (closeoutExists) {
    lines.push('Proof artifacts and closeout report generated.');
    lines.push(`See: \`out/sprints/${sprintId}/${date}/SPRINT_CLOSEOUT_REPORT.md\``);
  }

  lines.push('', '_Synced automatically by `npm run sprint:linear-sync`_');
  return lines.join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { issueKey, sprintId, date, dryRun } = parseArgs();

  if (!issueKey || !sprintId) {
    console.error('Usage: npm run sprint:linear-sync -- --issue <UNI-N> --sprint <SPRINT-ID>');
    process.exit(1);
  }

  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  LINEAR_API_KEY not set — skipping Linear sync.');
    console.warn('   To enable: add LINEAR_API_KEY=lin_api_xxxx to .env.local');
    console.warn('   Get a key: Linear Settings → API → Personal API keys');
    process.exit(0); // graceful skip, not a failure
  }

  const targetDate = date || new Date().toISOString().slice(0, 10);
  const sprintDir = path.join(SPRINTS_DIR, sprintId, targetDate);
  const closeoutExists = fs.existsSync(path.join(sprintDir, 'SPRINT_CLOSEOUT_REPORT.md'));

  console.log('\n' + '='.repeat(60));
  console.log('LINEAR SYNC');
  console.log('='.repeat(60));
  console.log(`   Issue:  ${issueKey}`);
  console.log(`   Sprint: ${sprintId}`);
  console.log(`   Date:   ${targetDate}`);
  if (dryRun) console.log('   Mode:   DRY RUN (no writes to Linear)');

  try {
    console.log('\n🔍 Resolving issue...');
    const issueId = await resolveIssueId(apiKey, issueKey);

    const commentBody = buildCommentBody(sprintId, targetDate, closeoutExists);

    if (dryRun) {
      console.log('\n📝 [DRY RUN] Would post comment:');
      console.log(commentBody);
      console.log('\n📝 [DRY RUN] Would set state → Done');
    } else {
      console.log('\n💬 Posting closeout comment...');
      await postComment(apiKey, issueId, commentBody);
      console.log('   ✅ Comment posted');

      console.log('\n✅ Marking issue Done...');
      await markDone(apiKey, issueId);
    }

    // Write sync proof
    const proofsDir = path.join(sprintDir, 'proofs');
    if (fs.existsSync(proofsDir) && !dryRun) {
      const proofPath = path.join(proofsDir, 'proof_linear_sync.txt');
      fs.writeFileSync(
        proofPath,
        [
          `LINEAR SYNC PROOF`,
          `Issue: ${issueKey} (id: ${issueId})`,
          `Sprint: ${sprintId}`,
          `Date: ${targetDate}`,
          `Synced: ${new Date().toISOString()}`,
          `Actions: comment posted, state → Done`,
        ].join('\n')
      );
      console.log(`\n📄 Proof written: ${proofPath}`);
    }

    console.log('\n✅ LINEAR SYNC COMPLETE');
    console.log('='.repeat(60));
  } catch (err) {
    console.error(`\n❌ LINEAR SYNC FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
