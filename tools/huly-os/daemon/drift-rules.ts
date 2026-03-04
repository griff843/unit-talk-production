// HULY-OS v1: Drift detection rules

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import { REPO_ROOT } from './config.js';

import type { DriftViolation, GitHubPR, HulyIssue, WorkflowRun } from './adapters/types.js';

export type DriftRuleId =
  | 'PR_WITHOUT_ISSUE'
  | 'ISSUE_IN_PROGRESS_WITHOUT_PR'
  | 'DONE_WITHOUT_PROOF_URL'
  | 'PR_MERGED_ISSUE_NOT_DONE'
  | 'CI_FAILURE_ON_SPRINT_BRANCH'
  | 'PROOF_BUNDLE_MISSING'
  | 'ORPHAN_PR';

/**
 * Run all drift rules against gathered data.
 * Returns violations sorted by severity (errors first).
 */
export function evaluateDrift(
  openPRs: GitHubPR[],
  mergedPRs: GitHubPR[],
  hulyIssues: HulyIssue[],
  workflowRuns?: WorkflowRun[]
): DriftViolation[] {
  const violations: DriftViolation[] = [];

  // Build lookup: Huly identifier → issue
  const issueByRef = new Map<string, HulyIssue>();
  for (const issue of hulyIssues) {
    issueByRef.set(issue.identifier, issue);
  }

  // Build lookup: all PR branches and linked refs for cross-referencing
  const allPRs = [...openPRs, ...mergedPRs];
  const prBranches = new Set(allPRs.map(pr => pr.headBranch));
  const prLinkedRefs = new Set(allPRs.flatMap(pr => pr.linkedIssueRefs));

  // Rule 1: PR_WITHOUT_ISSUE — open PR with no Huly issue ref
  for (const pr of openPRs) {
    if (pr.linkedIssueRefs.length === 0) {
      violations.push({
        ruleId: 'PR_WITHOUT_ISSUE',
        severity: 'warning',
        entityType: 'pr',
        entityId: `#${pr.number}`,
        entityTitle: pr.title,
        message: 'Open PR has no linked Huly issue reference in title, body, or branch name',
        evidence: {
          branch: pr.headBranch,
          bodyRefs: pr.linkedIssueRefs,
        },
      });
    }
  }

  // Rule 2: ISSUE_IN_PROGRESS_WITHOUT_PR — In Progress issue with no associated PR
  for (const issue of hulyIssues) {
    if (issue.status !== 'In Progress') continue;

    const hasLinkedPR =
      prLinkedRefs.has(issue.identifier) ||
      [...prBranches].some(b => b.toLowerCase().includes(issue.identifier.toLowerCase()));

    if (!hasLinkedPR) {
      violations.push({
        ruleId: 'ISSUE_IN_PROGRESS_WITHOUT_PR',
        severity: 'warning',
        entityType: 'issue',
        entityId: issue.identifier,
        entityTitle: issue.title,
        message: 'Issue is In Progress but has no associated PR or branch',
        evidence: {
          status: issue.status,
          checkedPRCount: allPRs.length,
        },
      });
    }
  }

  // Rule 3: DONE_WITHOUT_PROOF_URL — Done issue missing proof_url
  for (const issue of hulyIssues) {
    if (issue.status !== 'Done') continue;

    if (!issue.proofUrl) {
      violations.push({
        ruleId: 'DONE_WITHOUT_PROOF_URL',
        severity: 'error',
        entityType: 'issue',
        entityId: issue.identifier,
        entityTitle: issue.title,
        message: 'Issue marked Done but has no proof_url in description',
        evidence: {
          status: issue.status,
          hasProofUrl: false,
        },
      });
    }
  }

  // Rule 4: PR_MERGED_ISSUE_NOT_DONE — merged PR but linked issue not Done
  for (const pr of mergedPRs) {
    for (const ref of pr.linkedIssueRefs) {
      const issue = issueByRef.get(ref);
      if (issue && issue.status !== 'Done' && issue.status !== 'Cancelled') {
        violations.push({
          ruleId: 'PR_MERGED_ISSUE_NOT_DONE',
          severity: 'warning',
          entityType: 'pr',
          entityId: `#${pr.number}`,
          entityTitle: pr.title,
          message: `PR merged but linked issue ${ref} is still "${issue.status}"`,
          evidence: {
            mergedAt: pr.mergedAt,
            linkedIssue: ref,
            issueStatus: issue.status,
          },
        });
      }
    }
  }

  // Rule 5: CI_FAILURE_ON_SPRINT_BRANCH — sprint branch has failing CI
  if (workflowRuns) {
    const sprintBranchRuns = workflowRuns.filter(r => r.headBranch.startsWith('sprint/'));
    for (const run of sprintBranchRuns) {
      if (run.conclusion === 'failure') {
        violations.push({
          ruleId: 'CI_FAILURE_ON_SPRINT_BRANCH',
          severity: 'error',
          entityType: 'pr',
          entityId: `run:${run.id}`,
          entityTitle: run.name,
          message: `CI workflow "${run.name}" failed on sprint branch ${run.headBranch}`,
          evidence: {
            branch: run.headBranch,
            sha: run.headSha,
            conclusion: run.conclusion,
            url: run.url,
          },
        });
      }
    }
  }

  // Rule 6: PROOF_BUNDLE_MISSING — [SPRINT] issue marked Done but proof dir missing
  const SPRINT_ID_RE = /SPRINT-[\w-]+-\d+/;
  for (const issue of hulyIssues) {
    if (!issue.title.startsWith('[SPRINT]')) continue;
    if (issue.status !== 'Done') continue;

    const sprintIdMatch = issue.title.match(SPRINT_ID_RE);
    if (!sprintIdMatch) continue;

    const proofDir = resolve(REPO_ROOT, 'out', 'sprints', sprintIdMatch[0]);
    if (!existsSync(proofDir)) {
      violations.push({
        ruleId: 'PROOF_BUNDLE_MISSING',
        severity: 'error',
        entityType: 'issue',
        entityId: issue.identifier || issue.id,
        entityTitle: issue.title,
        message: `Sprint marked Done but proof bundle directory missing: ${proofDir}`,
        evidence: {
          sprintId: sprintIdMatch[0],
          expectedPath: proofDir,
        },
      });
    }
  }

  // Rule 7: ORPHAN_PR — merged PR on sprint branch with no matching Huly issue
  for (const pr of mergedPRs) {
    if (!pr.headBranch.startsWith('sprint/')) continue;
    if (pr.linkedIssueRefs.length > 0) continue;

    // Check if any Huly issue title contains this branch's sprint pattern
    const branchSuffix = pr.headBranch.replace('sprint/', '').toUpperCase();
    const hasMatchingIssue = hulyIssues.some(
      i => i.title.includes(branchSuffix) || i.title.includes(`SPRINT-${branchSuffix}`)
    );

    if (!hasMatchingIssue) {
      violations.push({
        ruleId: 'ORPHAN_PR',
        severity: 'warning',
        entityType: 'pr',
        entityId: `#${pr.number}`,
        entityTitle: pr.title,
        message: `Merged PR on sprint branch ${pr.headBranch} has no matching Huly issue`,
        evidence: {
          branch: pr.headBranch,
          mergedAt: pr.mergedAt,
        },
      });
    }
  }

  // Sort: errors first, then warnings
  violations.sort((a, b) => {
    if (a.severity === 'error' && b.severity !== 'error') return -1;
    if (a.severity !== 'error' && b.severity === 'error') return 1;
    return 0;
  });

  return violations;
}
