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
  space: string; // Huly space ID (e.g. "project-1772682311049-q1pijc")
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

/** Result of a publish operation through the layered strategy */
export interface PublishResult {
  surface: 'doc' | 'issue' | 'comment' | 'chunter';
  id: string;
  url?: string;
}

/** GitHub workflow run */
export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  headBranch: string;
  headSha: string;
  event: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

/** Huly issue status IDs (from live audit) */
export const HULY_STATUS = {
  Backlog: 'tracker:status:Backlog',
  Todo: 'tracker:status:Todo',
  InProgress: 'tracker:status:InProgress',
  Done: 'tracker:status:Done',
  Canceled: 'tracker:status:Canceled',
} as const;

export type HulyStatusId = (typeof HULY_STATUS)[keyof typeof HULY_STATUS];

/**
 * Sprint-phase status mapping.
 * Maps governance phases to the best-available Huly status.
 * When custom statuses are added to the Huly workspace, update mappings here.
 */
export const SPRINT_PHASE_STATUS: Record<string, HulyStatusId> = {
  Planning: HULY_STATUS.Todo,
  Implementing: HULY_STATUS.InProgress,
  Verifying: HULY_STATUS.InProgress,
  Blocked: HULY_STATUS.InProgress, // no native blocked; stays InProgress
  'Ready for Closeout': HULY_STATUS.InProgress,
  Closing: HULY_STATUS.Done,
};

/** Sprint phase label used in issue comments for richer status context */
export const SPRINT_PHASE_LABELS: Record<string, string> = {
  Planning: 'Planning',
  Implementing: 'Implementing',
  Verifying: 'Verifying',
  Blocked: 'Blocked',
  'Ready for Closeout': 'Ready for Closeout',
  Closing: 'Closing',
};

/** Huly platform adapter interface */
export interface IHulyAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;
  listIssues(projectIdentifier: string): Promise<HulyIssue[]>;
  upsertDoc(
    teamspaceName: string,
    docTitle: string,
    markdownContent: string
  ): Promise<{ id: string; created: boolean }>;
  createIssue(projectIdentifier: string, title: string, body: string): Promise<{ id: string }>;
  updateIssue(issueId: string, body: string): Promise<void>;
  addComment(issueId: string, body: string): Promise<{ id: string }>;

  // HULY-OS v1 extensions
  findIssueByTitle(projectIdentifier: string, title: string): Promise<HulyIssue | null>;
  upsertIssueByTitle(
    projectIdentifier: string,
    title: string,
    body: string,
    extra?: Record<string, unknown>
  ): Promise<{ id: string; created: boolean }>;
  updateIssueStatus(issueId: string, statusId: HulyStatusId, space: string): Promise<void>;
  linkIssueToPR(issueId: string, prNumber: number, prTitle: string, prUrl: string): Promise<void>;
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
  getWorkflowRuns(branch?: string, status?: string): Promise<WorkflowRun[]>;
}
