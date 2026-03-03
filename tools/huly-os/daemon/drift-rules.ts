// SPRINT-HULY-WORKOS-V1-LOCAL-001: Drift detection rules

import type { DriftViolation, GitHubPR, HulyIssue } from './adapters/types.js';

export type DriftRuleId =
  | 'PR_WITHOUT_ISSUE'
  | 'ISSUE_IN_PROGRESS_WITHOUT_PR'
  | 'DONE_WITHOUT_PROOF_URL'
  | 'PR_MERGED_ISSUE_NOT_DONE';

/**
 * Run all drift rules against gathered data.
 * Returns violations sorted by severity (errors first).
 */
export function evaluateDrift(
  openPRs: GitHubPR[],
  mergedPRs: GitHubPR[],
  hulyIssues: HulyIssue[]
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

  // Sort: errors first, then warnings
  violations.sort((a, b) => {
    if (a.severity === 'error' && b.severity !== 'error') return -1;
    if (a.severity !== 'error' && b.severity === 'error') return 1;
    return 0;
  });

  return violations;
}
