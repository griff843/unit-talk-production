// SPRINT-HULY-WORKOS-V1-LOCAL-001: Shared types for Truth Daemon

/** A Huly tracker issue */
export interface HulyIssue {
  id: string;
  identifier: string; // e.g. "UT-42"
  title: string;
  status: string; // "Todo", "In Progress", "Done", etc.
  assignee: string | null;
  description: string | null;
  proofUrl: string | null; // extracted from description via regex
  modifiedOn: number;
  project: string;
}

/** A GitHub pull request */
export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  headBranch: string;
  baseBranch: string;
  author: string;
  linkedIssueRefs: string[]; // extracted: "UT-42", "#123", etc.
  createdAt: string;
  mergedAt: string | null;
  url: string;
}

/** A drift violation detected by the rules engine */
export interface DriftViolation {
  ruleId: string;
  severity: 'error' | 'warning';
  entityType: 'pr' | 'issue';
  entityId: string;
  entityTitle: string;
  message: string;
  evidence: Record<string, unknown>;
}

/** Single audit log entry (written as JSONL) */
export interface AuditEntry {
  ts: string;
  source: 'huly' | 'github' | 'fs' | 'daemon';
  op: string;
  target: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
  meta?: Record<string, unknown>;
}

/** The complete reality report structure */
export interface RealityReport {
  meta: {
    generatedAt: string;
    daemonVersion: string;
    sprintId: string;
    dryRun: boolean;
    hulyAvailable: boolean;
    githubAvailable: boolean;
  };
  githubSummary: {
    repo: string;
    defaultBranch: string;
    openPrs: number;
    recentlyMergedPrs: number;
    lastCommit: { sha: string; date: string };
  };
  hulySummary: {
    project: string;
    totalIssues: number;
    byStatus: Record<string, number>;
    issuesWithoutProof: number;
  } | null;
  drift: {
    totalViolations: number;
    errors: number;
    warnings: number;
    violations: DriftViolation[];
  };
  auditStats: {
    totalCalls: number;
    failedCalls: number;
    totalLatencyMs: number;
  };
}

/** Huly platform adapter interface */
export interface IHulyAdapter {
  connect(): Promise<void>;
  ping(): Promise<boolean>;
  listIssues(projectIdentifier: string): Promise<HulyIssue[]>;
  upsertDoc(
    teamspaceName: string,
    docTitle: string,
    markdownContent: string
  ): Promise<{ id: string; created: boolean }>;
}

/** GitHub adapter interface */
export interface IGitHubAdapter {
  listOpenPRs(): Promise<GitHubPR[]>;
  listRecentlyMergedPRs(days: number): Promise<GitHubPR[]>;
  getRepoSummary(): Promise<{
    defaultBranch: string;
    openPrs: number;
    lastCommitSha: string;
    lastCommitDate: string;
  }>;
}
