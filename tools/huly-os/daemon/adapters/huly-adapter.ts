// SPRINT-HULY-WORKOS-V1-LOCAL-001: Huly adapter via HTTP REST API
// Uses: /_accounts/ (JSON-RPC) + /_transactor/api/v1/ (REST)

import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';
import type { HulyIssue, HulyStatusId, IHulyAdapter } from './types.js';

/** Regex to extract proof_url from issue description */
const PROOF_URL_RE = /proof_url:\s*(https?:\/\/\S+|out\/proofs\/\S+)/i;

interface AccountRpcResponse {
  result?: Record<string, unknown>;
  error?: { severity: string; code: string; params: Record<string, unknown> };
}

interface WorkspaceInfo {
  token: string;
  workspace: string;
  endpoint: string;
}

export class HulyAdapter implements IHulyAdapter {
  private baseUrl: string;
  private email: string;
  private password: string;
  private workspaceName: string;
  private audit: AuditLogger;

  private accountToken: string | null = null;
  private workspaceToken: string | null = null;
  private workspaceId: string | null = null;
  private socialId: string | null = null;

  // SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: Space resolution cache
  private projectSpaceCache = new Map<string, string>();
  private teamspaceCache = new Map<string, string>();

  constructor(config: DaemonConfig, audit: AuditLogger) {
    this.baseUrl = config.HULY_URL.replace(/\/$/, '');
    this.email = config.HULY_EMAIL;
    this.password = config.HULY_PASSWORD;
    this.workspaceName = config.HULY_WORKSPACE;
    this.audit = audit;
  }

  /** Step 1: Login via account service JSON-RPC */
  private async login(): Promise<{ token: string; socialId: string }> {
    return this.audit.traced('huly', 'login', this.baseUrl, async () => {
      const res = await fetch(`${this.baseUrl}/_accounts/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: 'login',
          params: { email: this.email, password: this.password },
        }),
      });

      if (!res.ok) {
        throw new Error(`Huly login HTTP ${res.status}: ${res.statusText}`);
      }

      const body = (await res.json()) as AccountRpcResponse;
      if (body.error) {
        throw new Error(`Huly login RPC error: ${body.error.code} (${body.error.severity})`);
      }
      if (!body.result?.token || typeof body.result.token !== 'string') {
        throw new Error('Huly login: no token in response');
      }

      return {
        token: body.result.token,
        socialId: String(body.result.socialId ?? ''),
      };
    });
  }

  /** Step 2: Select workspace to get workspace-scoped JWT */
  private async selectWorkspace(accountToken: string): Promise<WorkspaceInfo> {
    return this.audit.traced('huly', 'select_workspace', this.workspaceName, async () => {
      const res = await fetch(`${this.baseUrl}/_accounts/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountToken}`,
        },
        body: JSON.stringify({
          method: 'selectWorkspace',
          params: { workspaceUrl: this.workspaceName },
        }),
      });

      if (!res.ok) {
        throw new Error(`Huly selectWorkspace HTTP ${res.status}: ${res.statusText}`);
      }

      const body = (await res.json()) as AccountRpcResponse;
      if (body.error) {
        throw new Error(`Huly selectWorkspace RPC error: ${body.error.code}`);
      }
      const r = body.result;
      if (!r?.token || !r?.workspace) {
        throw new Error('Huly selectWorkspace: missing token or workspace in response');
      }

      return {
        token: r.token as string,
        workspace: r.workspace as string,
        endpoint: (r.endpoint as string) ?? '',
      };
    });
  }

  async connect(): Promise<void> {
    const loginResult = await this.login();
    this.accountToken = loginResult.token;
    this.socialId = loginResult.socialId;
    const ws = await this.selectWorkspace(this.accountToken);
    this.workspaceToken = ws.token;
    this.workspaceId = ws.workspace;
  }

  /**
   * Wrap TX fields with the envelope required by Huly v0.7 _NormalizeTxMiddleware.
   * Required: _id, space (core:space:Tx), modifiedBy (socialId), modifiedOn.
   */
  private buildTx(fields: Record<string, unknown>): Record<string, unknown> {
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return {
      _id: txId,
      space: 'core:space:Tx',
      modifiedBy: this.socialId,
      modifiedOn: Date.now(),
      ...fields,
    };
  }

  // SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: Shared TX send helper
  private async sendTx(tx: Record<string, unknown>): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}/_transactor/api/v1/tx/${this.workspaceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.workspaceToken}`,
      },
      body: JSON.stringify(tx),
    });

    if (!res.ok) {
      const snippet = await res.text().catch(() => '');
      throw new Error(`Huly TX HTTP ${res.status}: ${res.statusText} — ${snippet.slice(0, 200)}`);
    }

    return res.json();
  }

  /** Generic findAll query for any Huly class */
  private async findAllRaw(cls: string, limit = 500): Promise<Record<string, unknown>[]> {
    const opts = JSON.stringify({ limit });
    const url =
      `${this.baseUrl}/_transactor/api/v1/find-all/${this.workspaceId}` +
      `?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${this.workspaceToken}` },
    });

    if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);

    const body = await res.json();
    if (Array.isArray(body)) return body;
    if (Array.isArray(body?.value)) return body.value;
    if (Array.isArray(body?.docs)) return body.docs;
    if (Array.isArray(body?.result)) return body.result;
    return [];
  }

  /**
   * Resolve a project identifier (e.g. "UT") to its actual space ID.
   * Caches the result for the lifetime of this adapter instance.
   */
  async resolveProjectSpace(identifier: string): Promise<string> {
    const cached = this.projectSpaceCache.get(identifier);
    if (cached) return cached;

    const projects = await this.findAllRaw('tracker:class:Project');
    for (const p of projects) {
      const pIdent = String(p.identifier ?? '');
      const pName = String(p.name ?? '');
      if (pIdent === identifier || pName === identifier) {
        const spaceId = String(p._id);
        this.projectSpaceCache.set(identifier, spaceId);
        return spaceId;
      }
    }

    throw new Error(
      `Project "${identifier}" not found in Huly workspace. ` +
        `Available: ${projects.map(p => `${p.identifier}(${p._id})`).join(', ')}`
    );
  }

  /**
   * Resolve a teamspace by name, or create it if it doesn't exist.
   * Caches the result for the lifetime of this adapter instance.
   */
  async resolveOrCreateTeamspace(name: string): Promise<string> {
    const cached = this.teamspaceCache.get(name);
    if (cached) return cached;

    const teamspaces = await this.findAllRaw('document:class:Teamspace');
    for (const t of teamspaces) {
      if (String(t.name ?? '') === name) {
        const spaceId = String(t._id);
        this.teamspaceCache.set(name, spaceId);
        return spaceId;
      }
    }

    // Teamspace doesn't exist — create it
    const id = `teamspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tx = this.buildTx({
      _class: 'core:class:TxCreateDoc',
      objectId: id,
      objectClass: 'document:class:Teamspace',
      objectSpace: 'core:space:Space',
      attributes: {
        name,
        description: `${name} — auto-created by HULY-OS operator`,
        private: false,
        archived: false,
        members: [this.socialId],
      },
    });

    await this.sendTx(tx);
    this.teamspaceCache.set(name, id);
    return id;
  }

  async ping(): Promise<boolean> {
    if (!this.workspaceToken || !this.workspaceId) return false;

    try {
      await this.audit.traced('huly', 'ping', this.baseUrl, async () => {
        const url =
          `${this.baseUrl}/_transactor/api/v1/find-all/${this.workspaceId}` +
          `?class=${encodeURIComponent('core:class:Space')}&options=${encodeURIComponent(JSON.stringify({ limit: 1 }))}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.workspaceToken}` },
        });

        if (!res.ok) {
          throw new Error(`Huly ping HTTP ${res.status}`);
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  async listIssues(projectIdentifier: string): Promise<HulyIssue[]> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    const rawIssues = await this.audit.traced(
      'huly',
      'list_issues',
      projectIdentifier,
      async () => {
        const options = JSON.stringify({ limit: 500 });
        const url =
          `${this.baseUrl}/_transactor/api/v1/find-all/${this.workspaceId}` +
          `?class=${encodeURIComponent('tracker:class:Issue')}` +
          `&options=${encodeURIComponent(options)}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${this.workspaceToken}` },
        });

        if (!res.ok) {
          throw new Error(`Huly listIssues HTTP ${res.status}: ${res.statusText}`);
        }

        return res.json() as Promise<Record<string, unknown>[]>;
      },
      { project: projectIdentifier }
    );

    const issuesArr = Array.isArray(rawIssues)
      ? rawIssues
      : Array.isArray((rawIssues as any)?.value)
        ? (rawIssues as any).value
        : Array.isArray((rawIssues as any)?.issues)
          ? (rawIssues as any).issues
          : Array.isArray((rawIssues as any)?.items)
            ? (rawIssues as any).items
            : Array.isArray((rawIssues as any)?.docs)
              ? (rawIssues as any).docs
              : Array.isArray((rawIssues as any)?.result)
                ? (rawIssues as any).result
                : null;

    if (!issuesArr) {
      const keys = rawIssues && typeof rawIssues === 'object' ? Object.keys(rawIssues as any) : [];
      throw new Error(
        `Huly listIssues: expected array-like response, got ${typeof rawIssues} keys=${keys.join(',')}`
      );
    }

    return issuesArr.map((raw: any) => {
      const desc = typeof raw.description === 'string' ? raw.description : null;
      const proofMatch = desc?.match(PROOF_URL_RE);

      return {
        id: String(raw._id ?? ''),
        identifier: String(raw.identifier ?? ''),
        title: String(raw.title ?? ''),
        status: this.resolveStatusName(raw),
        assignee: raw.assignee ? String(raw.assignee) : null,
        description: desc,
        proofUrl: proofMatch ? proofMatch[1] : null,
        modifiedOn: typeof raw.modifiedOn === 'number' ? raw.modifiedOn : 0,
        project: projectIdentifier,
      };
    });
  }

  async upsertDoc(
    teamspaceName: string,
    docTitle: string,
    markdownContent: string
  ): Promise<{ id: string; created: boolean }> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    // Step 1: Search for existing doc by title
    const existing = await this.findDocByTitle(docTitle);

    if (existing) {
      // Update existing document
      await this.audit.traced('huly', 'update_doc', `${teamspaceName}/${docTitle}`, async () => {
        const tx = this.buildTx({
          _class: 'core:class:TxUpdateDoc',
          objectId: existing.id,
          objectClass: 'document:class:Document',
          objectSpace: existing.space,
          operations: {
            content: markdownContent,
          },
        });

        await this.sendTx(tx);
      });

      return { id: existing.id, created: false };
    }

    // Step 2: Create new document — resolve teamspace to real space ID
    const resolvedTeamspace = await this.resolveOrCreateTeamspace(teamspaceName);

    const newId = await this.audit.traced(
      'huly',
      'create_doc',
      `${teamspaceName}/${docTitle}`,
      async () => {
        const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tx = this.buildTx({
          _class: 'core:class:TxCreateDoc',
          objectId: docId,
          objectClass: 'document:class:Document',
          objectSpace: resolvedTeamspace,
          attributes: {
            title: docTitle,
            content: markdownContent,
          },
        });

        await this.sendTx(tx);
        return docId;
      }
    );

    return { id: newId, created: true };
  }

  /** Search for a document by title via fulltext search */
  async findDocByTitle(title: string): Promise<{ id: string; space: string } | null> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    return this.audit.traced('huly', 'find_doc_by_title', title, async () => {
      const url =
        `${this.baseUrl}/_transactor/api/v1/search-fulltext/${this.workspaceId}` +
        `?query=${encodeURIComponent(title)}` +
        `&classes=${encodeURIComponent(JSON.stringify(['document:class:Document']))}` +
        `&limit=10`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${this.workspaceToken}` },
      });

      if (!res.ok) {
        throw new Error(`Huly findDocByTitle HTTP ${res.status}: ${res.statusText}`);
      }

      const body = await res.json();
      // v0.7 returns { docs: [...], total: N }, v0.6 returns [...]
      const results: Record<string, unknown>[] = Array.isArray(body) ? body : (body.docs ?? []);

      // Find exact title match
      const match = results.find(r => typeof r.title === 'string' && r.title === title);

      if (!match) return null;

      return {
        id: String(match._id ?? ''),
        space: String(match.space ?? ''),
      };
    });
  }

  /** Create a new tracker issue in a project */
  async createIssue(
    projectIdentifier: string,
    title: string,
    body: string
  ): Promise<{ id: string }> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    // SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: Resolve to real space ID
    const resolvedSpace = await this.resolveProjectSpace(projectIdentifier);

    const issueId = await this.audit.traced(
      'huly',
      'create_issue',
      `${projectIdentifier}/${title}`,
      async () => {
        const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tx = this.buildTx({
          _class: 'core:class:TxCreateDoc',
          objectId: id,
          objectClass: 'tracker:class:Issue',
          objectSpace: resolvedSpace,
          attributes: { title, description: body },
        });

        await this.sendTx(tx);
        return id;
      }
    );

    return { id: issueId };
  }

  /** Update an existing issue's description */
  async updateIssue(issueId: string, body: string): Promise<void> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    // SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: Look up the issue's actual space
    const issues = await this.findAllRaw('tracker:class:Issue');
    const issue = issues.find(i => String(i._id) === issueId);
    const space = issue ? String(issue.space) : 'tracker:project:DefaultProject';

    await this.audit.traced('huly', 'update_issue', issueId, async () => {
      const tx = this.buildTx({
        _class: 'core:class:TxUpdateDoc',
        objectId: issueId,
        objectClass: 'tracker:class:Issue',
        objectSpace: space,
        operations: { description: body },
      });

      await this.sendTx(tx);
    });
  }

  /** Add a comment to an existing issue */
  async addComment(issueId: string, body: string): Promise<{ id: string }> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    const commentId = await this.audit.traced('huly', 'add_comment', issueId, async () => {
      const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tx = this.buildTx({
        _class: 'core:class:TxCreateDoc',
        objectId: id,
        objectClass: 'chunter:class:ChatMessage',
        objectSpace: issueId,
        attributes: { message: body },
      });

      await this.sendTx(tx);
      return id;
    });

    return { id: commentId };
  }

  // ── HULY-OS v1 Extensions ────────────────────────────────────────────

  /** Find a single issue by exact title match within a project */
  async findIssueByTitle(projectIdentifier: string, title: string): Promise<HulyIssue | null> {
    const issues = await this.listIssues(projectIdentifier);
    return issues.find(i => i.title === title) ?? null;
  }

  /**
   * Idempotent issue create-or-update by exact title match.
   * If an issue with the same title exists, updates its description.
   * Otherwise creates a new issue.
   */
  async upsertIssueByTitle(
    projectIdentifier: string,
    title: string,
    body: string,
    extra?: Record<string, unknown>
  ): Promise<{ id: string; created: boolean }> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    // SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: Resolve to real space ID
    const resolvedSpace = await this.resolveProjectSpace(projectIdentifier);
    const existing = await this.findIssueByTitle(projectIdentifier, title);

    if (existing) {
      // Update description (idempotent — same content is a no-op on Huly side)
      await this.audit.traced(
        'huly',
        'upsert_issue_update',
        `${projectIdentifier}/${title}`,
        async () => {
          const tx = this.buildTx({
            _class: 'core:class:TxUpdateDoc',
            objectId: existing.id,
            objectClass: 'tracker:class:Issue',
            objectSpace: resolvedSpace,
            operations: { description: body, ...extra },
          });

          await this.sendTx(tx);
        }
      );

      return { id: existing.id, created: false };
    }

    // Create new issue
    const result = await this.audit.traced(
      'huly',
      'upsert_issue_create',
      `${projectIdentifier}/${title}`,
      async () => {
        const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tx = this.buildTx({
          _class: 'core:class:TxCreateDoc',
          objectId: id,
          objectClass: 'tracker:class:Issue',
          objectSpace: resolvedSpace,
          attributes: { title, description: body, ...extra },
        });

        await this.sendTx(tx);
        return id;
      }
    );

    return { id: result, created: true };
  }

  /** Update an issue's status via TX API */
  async updateIssueStatus(issueId: string, statusId: HulyStatusId, space: string): Promise<void> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    await this.audit.traced('huly', 'update_issue_status', `${issueId}→${statusId}`, async () => {
      const tx = this.buildTx({
        _class: 'core:class:TxUpdateDoc',
        objectId: issueId,
        objectClass: 'tracker:class:Issue',
        objectSpace: space,
        operations: { status: statusId },
      });

      await this.sendTx(tx);
    });
  }

  /** Link a Huly issue to a GitHub PR by adding a structured comment */
  async linkIssueToPR(
    issueId: string,
    prNumber: number,
    prTitle: string,
    prUrl: string
  ): Promise<void> {
    const marker = `<!-- pr-link:${prNumber} -->`;
    const message = `${marker}\n**Linked PR #${prNumber}:** [${prTitle}](${prUrl})`;
    await this.addComment(issueId, message);
  }

  /** Resolve a Huly issue's status category name from raw data */
  private resolveStatusName(raw: Record<string, unknown>): string {
    // Huly stores status as a reference. We extract the category if available,
    // otherwise fall back to the raw status value.
    if (typeof raw.status === 'string') {
      // Common Huly status category suffixes
      const s = raw.status.toLowerCase();
      if (s.includes('done') || s.includes('won')) return 'Done';
      if (s.includes('progress') || s.includes('active')) return 'In Progress';
      if (s.includes('todo') || s.includes('backlog')) return 'Todo';
      if (s.includes('cancelled') || s.includes('lost')) return 'Cancelled';
      return raw.status;
    }
    // If there's a statusCategory field, use it
    if (typeof raw.statusCategory === 'string') {
      return raw.statusCategory;
    }
    return 'Unknown';
  }
}
