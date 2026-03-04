// SPRINT-AUTO-PR-GENERATION-009: Auto PR orchestrator
// Selects top-N task candidates, generates patches via LLM, opens PRs.
// Failure-isolated: individual PR failures don't abort the batch.
// Returns null when AUTO_PR_ENABLED is false or LLM is not configured.

import { createHash } from 'node:crypto';

import { GitHubPRAdapter, PathAllowlistError } from '../adapters/github-pr.js';

import { generatePatch } from './patch-generator.js';

import type { PatchFile } from '../adapters/github-pr.js';
import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';
import type { TaskCandidate } from './task-generator.js';

export interface AutoPRResult {
  enabled: boolean;
  attempted: number;
  created: AutoPRSuccess[];
  skipped: AutoPRSkip[];
  failed: AutoPRFailure[];
}

export interface AutoPRSuccess {
  candidate: string;
  prNumber: number;
  prUrl: string;
  branch: string;
  filesChanged: number;
}

export interface AutoPRSkip {
  candidate: string;
  reason: string;
}

export interface AutoPRFailure {
  candidate: string;
  error: string;
}

/**
 * Orchestrate Auto PR generation from task candidates.
 * Returns null when disabled. Never throws — all errors are captured.
 */
export async function orchestrateAutoPRs(
  candidates: TaskCandidate[],
  config: DaemonConfig,
  audit: AuditLogger
): Promise<AutoPRResult | null> {
  if (!config.AUTO_PR_ENABLED) {
    return null;
  }

  const llmProvider = process.env.LLM_PROVIDER;
  if (llmProvider !== 'openai' && llmProvider !== 'anthropic') {
    console.log('Auto PR: skipped (LLM_PROVIDER not set — patches require LLM)');
    return {
      enabled: true,
      attempted: 0,
      created: [],
      skipped: candidates.map(c => ({
        candidate: c.title,
        reason: 'LLM_PROVIDER not configured',
      })),
      failed: [],
    };
  }

  // Select top-N candidates (priority > risk > action)
  const selected = selectCandidates(candidates, config.AUTO_PR_MAX_TASKS);
  console.log(
    `Auto PR: ${selected.length} candidate(s) selected (max: ${config.AUTO_PR_MAX_TASKS})`
  );

  let prAdapter: GitHubPRAdapter;
  try {
    prAdapter = await GitHubPRAdapter.create(config, audit);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`Auto PR: auth failed — ${msg}`);
    return {
      enabled: true,
      attempted: 0,
      created: [],
      skipped: [],
      failed: [{ candidate: '*', error: `Auth failed: ${msg}` }],
    };
  }

  const created: AutoPRSuccess[] = [];
  const skipped: AutoPRSkip[] = [];
  const failed: AutoPRFailure[] = [];

  for (const candidate of selected) {
    try {
      const result = await processSingleCandidate(candidate, prAdapter, config, audit);
      if (result.type === 'created') {
        created.push(result.value);
      } else {
        skipped.push(result.value);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ candidate: candidate.title, error: msg });
      console.warn(`Auto PR failed for "${candidate.title}": ${msg}`);
    }
  }

  return {
    enabled: true,
    attempted: selected.length,
    created,
    skipped,
    failed,
  };
}

/** Priority order: priority > risk > action */
const SOURCE_PRIORITY: Record<TaskCandidate['source'], number> = {
  priority: 0,
  risk: 1,
  action: 2,
};

function selectCandidates(candidates: TaskCandidate[], max: number): TaskCandidate[] {
  return [...candidates]
    .sort((a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source])
    .slice(0, max);
}

type ProcessResult =
  | { type: 'created'; value: AutoPRSuccess }
  | { type: 'skipped'; value: AutoPRSkip };

async function processSingleCandidate(
  candidate: TaskCandidate,
  prAdapter: GitHubPRAdapter,
  config: DaemonConfig,
  audit: AuditLogger
): Promise<ProcessResult> {
  // Generate patch via LLM
  const patchResult = await generatePatch(candidate, config.AUTO_PR_ALLOWED_PATHS);
  if (!patchResult) {
    return {
      type: 'skipped',
      value: { candidate: candidate.title, reason: 'LLM returned null' },
    };
  }

  if (patchResult.files.length === 0) {
    return {
      type: 'skipped',
      value: {
        candidate: candidate.title,
        reason: `LLM returned no files: ${patchResult.explanation}`,
      },
    };
  }

  // Build branch name from fingerprint
  const branchSlug = slugify(candidate.title);
  const hash = createHash('sha256').update(candidate.fingerprint).digest('hex').slice(0, 6);
  const branchName = `${config.AUTO_PR_BRANCH_PREFIX}${branchSlug}-${hash}`;

  // Build PR body
  const body = buildPRBody(candidate, patchResult.files, patchResult.explanation);

  try {
    const pr = await prAdapter.createPR(
      branchName,
      config.AUTO_PR_BASE,
      `auto: ${candidate.title}`,
      body,
      patchResult.files,
      config.AUTO_PR_LABEL
    );

    audit.log({
      source: 'github',
      op: 'auto_pr_created',
      target: pr.url,
      ok: true,
      latencyMs: 0,
    });

    return {
      type: 'created',
      value: {
        candidate: candidate.title,
        prNumber: pr.number,
        prUrl: pr.url,
        branch: pr.branch,
        filesChanged: patchResult.files.length,
      },
    };
  } catch (err) {
    if (err instanceof PathAllowlistError) {
      return {
        type: 'skipped',
        value: {
          candidate: candidate.title,
          reason: `Path allowlist violation: ${err.path}`,
        },
      };
    }
    throw err;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function buildPRBody(candidate: TaskCandidate, files: PatchFile[], explanation: string): string {
  const lines: string[] = [];
  lines.push('## Auto-generated PR');
  lines.push('');
  lines.push(`**Source:** ${candidate.source}`);
  lines.push(`**Task:** ${candidate.title}`);
  lines.push(`**Fingerprint:** \`${candidate.fingerprint}\``);
  lines.push('');
  lines.push('## Changes');
  lines.push('');
  lines.push(explanation);
  lines.push('');
  lines.push('### Files modified');
  lines.push('');
  for (const f of files) {
    lines.push(`- \`${f.path}\``);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> This PR was auto-generated by the Huly-OS Reality Report daemon.');
  lines.push('> Review carefully before merging.');
  return lines.join('\n');
}

/**
 * Render Auto PR results as a markdown section for appending to the report.
 */
export function renderAutoPRMarkdown(result: AutoPRResult): string {
  const lines: string[] = [];
  lines.push('## Auto-Generated PRs');
  lines.push('');

  if (result.created.length > 0) {
    lines.push(`**Created:** ${result.created.length} PR(s)`);
    for (const pr of result.created) {
      lines.push(`- [#${pr.prNumber}](${pr.prUrl}) — ${pr.candidate} (${pr.filesChanged} file(s))`);
    }
    lines.push('');
  }

  if (result.skipped.length > 0) {
    lines.push(`**Skipped:** ${result.skipped.length}`);
    for (const s of result.skipped) {
      lines.push(`- ${s.candidate}: ${s.reason}`);
    }
    lines.push('');
  }

  if (result.failed.length > 0) {
    lines.push(`**Failed:** ${result.failed.length}`);
    for (const f of result.failed) {
      lines.push(`- ${f.candidate}: ${f.error}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
