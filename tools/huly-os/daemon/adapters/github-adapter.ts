// SPRINT-HULY-WORKOS-V1-LOCAL-001: GitHub adapter via Octokit REST

import { Octokit } from '@octokit/rest';

import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';
import type { GitHubPR, IGitHubAdapter, WorkflowRun } from './types.js';

/** Regex to extract Huly issue refs like UT-42 from text */
const HULY_ISSUE_REF = /\b([A-Z]{2,10}-\d+)\b/g;

function extractIssueRefs(text: string): string[] {
  const matches = text.match(HULY_ISSUE_REF);
  return matches ? [...new Set(matches)] : [];
}

function extractAllRefs(pr: {
  title: string;
  body: string | null;
  head: { ref: string };
}): string[] {
  const sources = [pr.title, pr.body ?? '', pr.head.ref];
  const refs = new Set<string>();
  for (const src of sources) {
    for (const ref of extractIssueRefs(src)) {
      refs.add(ref);
    }
  }
  return [...refs];
}

export class GitHubAdapter implements IGitHubAdapter {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private audit: AuditLogger;

  constructor(config: DaemonConfig, audit: AuditLogger) {
    this.octokit = new Octokit({ auth: config.GITHUB_TOKEN });
    this.owner = config.GITHUB_OWNER;
    this.repo = config.GITHUB_REPO;
    this.audit = audit;
  }

  async listOpenPRs(): Promise<GitHubPR[]> {
    const pulls = await this.audit.traced(
      'github',
      'list_open_prs',
      `${this.owner}/${this.repo}`,
      async () => {
        const { data } = await this.octokit.pulls.list({
          owner: this.owner,
          repo: this.repo,
          state: 'open',
          per_page: 100,
        });
        return data;
      }
    );

    return pulls.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: 'open' as const,
      merged: false,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      author: pr.user?.login ?? 'unknown',
      linkedIssueRefs: extractAllRefs(pr),
      createdAt: pr.created_at,
      mergedAt: null,
      url: pr.html_url,
    }));
  }

  async listRecentlyMergedPRs(days: number): Promise<GitHubPR[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const pulls = await this.audit.traced(
      'github',
      'list_merged_prs',
      `${this.owner}/${this.repo}`,
      async () => {
        const { data } = await this.octokit.pulls.list({
          owner: this.owner,
          repo: this.repo,
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          per_page: 100,
        });
        return data.filter(pr => pr.merged_at && new Date(pr.merged_at) >= since);
      },
      { days }
    );

    return pulls.map(pr => ({
      number: pr.number,
      title: pr.title,
      state: 'closed' as const,
      merged: true,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
      author: pr.user?.login ?? 'unknown',
      linkedIssueRefs: extractAllRefs(pr),
      createdAt: pr.created_at,
      mergedAt: pr.merged_at,
      url: pr.html_url,
    }));
  }

  async getRepoSummary(): Promise<{
    defaultBranch: string;
    openPrs: number;
    lastCommitSha: string;
    lastCommitDate: string;
  }> {
    const [repo, prs] = await Promise.all([
      this.audit.traced('github', 'get_repo', `${this.owner}/${this.repo}`, async () => {
        const { data } = await this.octokit.repos.get({
          owner: this.owner,
          repo: this.repo,
        });
        return data;
      }),
      this.audit.traced('github', 'count_open_prs', `${this.owner}/${this.repo}`, async () => {
        const { data } = await this.octokit.pulls.list({
          owner: this.owner,
          repo: this.repo,
          state: 'open',
          per_page: 1,
        });
        return data;
      }),
    ]);

    // Get latest commit on default branch
    const commits = await this.audit.traced(
      'github',
      'get_last_commit',
      `${this.owner}/${this.repo}`,
      async () => {
        const { data } = await this.octokit.repos.listCommits({
          owner: this.owner,
          repo: this.repo,
          sha: repo.default_branch,
          per_page: 1,
        });
        return data;
      }
    );

    const lastCommit = commits[0];

    return {
      defaultBranch: repo.default_branch,
      openPrs: prs.length,
      lastCommitSha: lastCommit?.sha.slice(0, 8) ?? 'unknown',
      lastCommitDate: lastCommit?.commit.committer?.date ?? 'unknown',
    };
  }

  async getWorkflowRuns(branch?: string, status?: string): Promise<WorkflowRun[]> {
    const runs = await this.audit.traced(
      'github',
      'get_workflow_runs',
      `${this.owner}/${this.repo}`,
      async () => {
        const params: Record<string, unknown> = {
          owner: this.owner,
          repo: this.repo,
          per_page: 30,
        };
        if (branch) params.branch = branch;
        if (status) params.status = status;

        const { data } = await this.octokit.actions.listWorkflowRunsForRepo(
          params as Parameters<typeof this.octokit.actions.listWorkflowRunsForRepo>[0]
        );
        return data.workflow_runs;
      },
      { branch, status }
    );

    return runs.map(run => ({
      id: run.id,
      name: run.name ?? '',
      status: run.status ?? '',
      conclusion: run.conclusion ?? null,
      headBranch: run.head_branch ?? '',
      headSha: (run.head_sha ?? '').slice(0, 8),
      event: run.event,
      url: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    }));
  }
}
