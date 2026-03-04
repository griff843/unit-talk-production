// SPRINT-AUTO-PR-GENERATION-009: GitHub PR adapter with path allowlist enforcement
// Creates branches, commits patches, and opens PRs via GitHub API.
// Never pushes to main. Never auto-merges. Path allowlist is fail-closed.

import { Octokit } from '@octokit/rest';

import { getGitHubAuth, type AuthSource } from './github-auth.js';

import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';

export interface PatchFile {
  /** Repo-relative path (forward slashes) */
  path: string;
  /** Full file content after patch */
  content: string;
}

export interface CreatePRResult {
  number: number;
  url: string;
  branch: string;
}

export class GitHubPRAdapter {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private audit: AuditLogger;
  private authSource: AuthSource;
  private allowedPaths: string[];

  private constructor(
    octokit: Octokit,
    owner: string,
    repo: string,
    audit: AuditLogger,
    authSource: AuthSource,
    allowedPaths: string[]
  ) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.audit = audit;
    this.authSource = authSource;
    this.allowedPaths = allowedPaths;
  }

  /**
   * Create a PR adapter with layered auth and path allowlist.
   * @throws if no valid credential is available.
   */
  static async create(config: DaemonConfig, audit: AuditLogger): Promise<GitHubPRAdapter> {
    const auth = await getGitHubAuth();
    console.log(`GitHub PR auth: source=${auth.source}`);
    audit.log({
      source: 'github',
      op: 'pr_auth_resolved',
      target: auth.source,
      ok: true,
      latencyMs: 0,
    });
    const octokit = new Octokit({ auth: auth.token });
    return new GitHubPRAdapter(
      octokit,
      config.GITHUB_OWNER,
      config.GITHUB_REPO,
      audit,
      auth.source,
      config.AUTO_PR_ALLOWED_PATHS
    );
  }

  getAuthSource(): AuthSource {
    return this.authSource;
  }

  /**
   * Validate that all patch file paths fall within the allowlist.
   * @throws if any path is outside the allowlist.
   */
  validatePaths(files: PatchFile[]): void {
    for (const file of files) {
      const normalized = file.path.replace(/\\/g, '/');
      const allowed = this.allowedPaths.some(prefix => normalized.startsWith(prefix));
      if (!allowed) {
        throw new PathAllowlistError(
          `Path "${normalized}" is outside allowed paths: [${this.allowedPaths.join(', ')}]`,
          normalized
        );
      }
    }
  }

  /**
   * Create a branch, commit patch files, and open a PR.
   * Fail-closed: validates all paths before any mutation.
   *
   * @param branchName - Full branch name (e.g. sprint/huly-auto-pr-fix-drift-abc123)
   * @param baseBranch - Base branch for the PR (e.g. main)
   * @param title - PR title
   * @param body - PR body (markdown)
   * @param files - Patch files to commit
   * @param label - Label to apply to the PR
   * @returns PR number, URL, and branch name
   */
  async createPR(
    branchName: string,
    baseBranch: string,
    title: string,
    body: string,
    files: PatchFile[],
    label: string
  ): Promise<CreatePRResult> {
    // Fail-closed path validation
    this.validatePaths(files);

    // Guard: never push to main/master
    if (branchName === 'main' || branchName === 'master') {
      throw new Error(`Refusing to push to protected branch: ${branchName}`);
    }

    return this.audit.traced('github', 'create_pr', title, async () => {
      // 1. Get base branch SHA
      const baseSha = await this.getRef(baseBranch);

      // 2. Create tree with patch files
      const treeSha = await this.createTree(baseSha, files);

      // 3. Create commit
      const commitSha = await this.createCommit(`auto: ${title}`, treeSha, baseSha);

      // 4. Create branch ref
      await this.createRef(branchName, commitSha);

      // 5. Open PR
      const pr = await this.openPR(branchName, baseBranch, title, body, label);

      return { number: pr.number, url: pr.url, branch: branchName };
    });
  }

  /** Get the SHA of a branch ref */
  private async getRef(branch: string): Promise<string> {
    const { data } = await this.octokit.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${branch}`,
    });
    return data.object.sha;
  }

  /** Create a git tree from patch files, based on a parent tree */
  private async createTree(baseSha: string, files: PatchFile[]): Promise<string> {
    const tree = files.map(f => ({
      path: f.path.replace(/\\/g, '/'),
      mode: '100644' as const,
      type: 'blob' as const,
      content: f.content,
    }));

    const { data } = await this.octokit.git.createTree({
      owner: this.owner,
      repo: this.repo,
      base_tree: baseSha,
      tree,
    });
    return data.sha;
  }

  /** Create a git commit */
  private async createCommit(message: string, treeSha: string, parentSha: string): Promise<string> {
    const { data } = await this.octokit.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message,
      tree: treeSha,
      parents: [parentSha],
    });
    return data.sha;
  }

  /** Create a branch ref pointing to a commit */
  private async createRef(branch: string, sha: string): Promise<void> {
    await this.octokit.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${branch}`,
      sha,
    });
  }

  /** Open a pull request */
  private async openPR(
    head: string,
    base: string,
    title: string,
    body: string,
    label: string
  ): Promise<{ number: number; url: string }> {
    const { data } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      head,
      base,
    });

    // Apply label (best-effort — don't fail the PR if labeling fails)
    try {
      await this.octokit.issues.addLabels({
        owner: this.owner,
        repo: this.repo,
        issue_number: data.number,
        labels: [label],
      });
    } catch {
      console.warn(`Failed to add label "${label}" to PR #${data.number}`);
    }

    return { number: data.number, url: data.html_url };
  }
}

export class PathAllowlistError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'PathAllowlistError';
    this.path = path;
  }
}
