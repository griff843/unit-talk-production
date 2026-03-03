// SPRINT-HULY-WORKOS-V1-LOCAL-001: Huly adapter via HTTP REST API
// Uses: /_accounts/ (JSON-RPC) + /_transactor/api/v1/ (REST)

import type { AuditLogger } from '../audit-log.js';
import type { DaemonConfig } from '../config.js';
import type { HulyIssue, IHulyAdapter } from './types.js';

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

  constructor(config: DaemonConfig, audit: AuditLogger) {
    this.baseUrl = config.HULY_URL.replace(/\/$/, '');
    this.email = config.HULY_EMAIL;
    this.password = config.HULY_PASSWORD;
    this.workspaceName = config.HULY_WORKSPACE;
    this.audit = audit;
  }

  /** Step 1: Login via account service JSON-RPC */
  private async login(): Promise<string> {
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

      return body.result.token;
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
    this.accountToken = await this.login();
    const ws = await this.selectWorkspace(this.accountToken);
    this.workspaceToken = ws.token;
    this.workspaceId = ws.workspace;
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
        const tx = {
          _class: 'core:class:TxUpdateDoc',
          objectId: existing.id,
          objectClass: 'document:class:Document',
          objectSpace: existing.space,
          operations: {
            content: markdownContent,
          },
        };

        const res = await fetch(`${this.baseUrl}/_transactor/api/v1/tx/${this.workspaceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.workspaceToken}`,
          },
          body: JSON.stringify(tx),
        });

        if (!res.ok) {
          throw new Error(`Huly updateDoc HTTP ${res.status}: ${res.statusText}`);
        }
      });

      return { id: existing.id, created: false };
    }

    // Step 2: Create new document
    const newId = await this.audit.traced(
      'huly',
      'create_doc',
      `${teamspaceName}/${docTitle}`,
      async () => {
        const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tx = {
          _class: 'core:class:TxCreateDoc',
          objectId: docId,
          objectClass: 'document:class:Document',
          objectSpace: teamspaceName,
          attributes: {
            title: docTitle,
            content: markdownContent,
          },
        };

        const res = await fetch(`${this.baseUrl}/_transactor/api/v1/tx/${this.workspaceId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.workspaceToken}`,
          },
          body: JSON.stringify(tx),
        });

        if (!res.ok) {
          throw new Error(`Huly createDoc HTTP ${res.status}: ${res.statusText}`);
        }

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

    const issueId = await this.audit.traced(
      'huly',
      'create_issue',
      `${projectIdentifier}/${title}`,
      async () => {
        const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const tx = {
          _class: 'core:class:TxCreateDoc',
          objectId: id,
          objectClass: 'tracker:class:Issue',
          objectSpace: projectIdentifier,
          attributes: { title, description: body },
        };

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
          throw new Error(
            `Huly createIssue HTTP ${res.status}: ${res.statusText}` +
              (snippet ? ` — ${snippet.slice(0, 200)}` : '')
          );
        }

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

    await this.audit.traced('huly', 'update_issue', issueId, async () => {
      const tx = {
        _class: 'core:class:TxUpdateDoc',
        objectId: issueId,
        objectClass: 'tracker:class:Issue',
        objectSpace: 'tracker:project:default',
        operations: { description: body },
      };

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
        throw new Error(
          `Huly updateIssue HTTP ${res.status}: ${res.statusText}` +
            (snippet ? ` — ${snippet.slice(0, 200)}` : '')
        );
      }
    });
  }

  /** Add a comment to an existing issue */
  async addComment(issueId: string, body: string): Promise<{ id: string }> {
    if (!this.workspaceToken || !this.workspaceId) {
      throw new Error('HulyAdapter not connected. Call connect() first.');
    }

    const commentId = await this.audit.traced('huly', 'add_comment', issueId, async () => {
      const id = `comment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tx = {
        _class: 'core:class:TxCreateDoc',
        objectId: id,
        objectClass: 'chunter:class:ChatMessage',
        objectSpace: issueId,
        attributes: { message: body },
      };

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
        throw new Error(
          `Huly addComment HTTP ${res.status}: ${res.statusText}` +
            (snippet ? ` — ${snippet.slice(0, 200)}` : '')
        );
      }

      return id;
    });

    return { id: commentId };
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
