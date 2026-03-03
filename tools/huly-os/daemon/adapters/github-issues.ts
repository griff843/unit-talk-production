// SPRINT-LLM-TASK-GENERATOR-006: GitHub Issues adapter for task generation
// Supports idempotent create/update via sha256 fingerprint embedded in issue body.

import { createHash } from 'node:crypto';

import { Octokit } from '@octokit/rest';

import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';

const FINGERPRINT_PREFIX = 'UT-HULYOS';

/** Compute a stable fingerprint for deduplication */
export function computeFingerprint(text: string, sprintId: string, repo: string): string {
  const input = `${text}::${sprintId}::${repo}`;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 8);
  return `${FINGERPRINT_PREFIX}-${hash}`;
}

/** Extract fingerprint from an issue body if present */
function extractFingerprint(body: string): string | null {
  const match = body.match(/```task_fingerprint\n(.+?)\n```/s);
  return match ? match[1].trim() : null;
}

/** Build the fingerprint fenced block for embedding in issue body */
export function buildFingerprintBlock(fingerprint: string): string {
  return `\`\`\`task_fingerprint\n${fingerprint}\n\`\`\``;
}

export interface GitHubIssueResult {
  number: number;
  url: string;
  created: boolean;
}

export class GitHubIssuesAdapter {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private audit: AuditLogger;

  constructor(config: DaemonConfig, audit: AuditLogger) {
    // Prefer GH_TOKEN (gh CLI OAuth token with issues:write) over GITHUB_TOKEN
    // which may be a fine-grained PAT without issues scope.
    const token = process.env.GH_TOKEN ?? config.GITHUB_TOKEN;
    this.octokit = new Octokit({ auth: token });
    this.owner = config.GITHUB_OWNER;
    this.repo = config.GITHUB_REPO;
    this.audit = audit;
  }

  /** Search for an open issue containing the given fingerprint */
  async findIssueByFingerprint(
    fingerprint: string
  ): Promise<{ number: number; url: string } | null> {
    return this.audit.traced('github', 'find_issue_by_fingerprint', fingerprint, async () => {
      const query = `repo:${this.owner}/${this.repo} is:issue is:open "${fingerprint}" in:body`;
      const { data } = await this.octokit.request('GET /search/issues', {
        q: query,
        per_page: 5,
      });

      for (const item of data.items) {
        if (item.body && extractFingerprint(item.body) === fingerprint) {
          return { number: item.number, url: item.html_url };
        }
      }
      return null;
    });
  }

  /** Create a new GitHub issue with fingerprint embedded in body */
  async createIssue(
    title: string,
    body: string,
    labels: string[],
    fingerprint: string
  ): Promise<GitHubIssueResult> {
    return this.audit.traced('github', 'create_issue', title, async () => {
      const fullBody = `${body}\n\n---\n${buildFingerprintBlock(fingerprint)}`;
      const { data } = await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body: fullBody,
        labels,
      });
      return { number: data.number, url: data.html_url, created: true };
    });
  }

  /** Update an existing GitHub issue body and labels */
  async updateIssue(
    issueNumber: number,
    body: string,
    labels: string[],
    fingerprint: string
  ): Promise<GitHubIssueResult> {
    return this.audit.traced('github', 'update_issue', `#${issueNumber}`, async () => {
      const fullBody = `${body}\n\n---\n${buildFingerprintBlock(fingerprint)}`;
      const { data } = await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        issue_number: issueNumber,
        body: fullBody,
        labels,
      });
      return { number: data.number, url: data.html_url, created: false };
    });
  }

  /**
   * Idempotent upsert: find existing issue by fingerprint, update if found, create if not.
   */
  async upsertIssue(
    title: string,
    body: string,
    labels: string[],
    fingerprint: string
  ): Promise<GitHubIssueResult> {
    const existing = await this.findIssueByFingerprint(fingerprint);
    if (existing) {
      return this.updateIssue(existing.number, body, labels, fingerprint);
    }
    return this.createIssue(title, body, labels, fingerprint);
  }
}
