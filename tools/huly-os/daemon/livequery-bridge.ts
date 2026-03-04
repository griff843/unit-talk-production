// UT-157: Real-time dashboard bridge via LiveQuery broadcasts
// Maintains live issue state from WebSocket broadcasts and exposes a snapshot API.
// The command center can poll getSnapshot() or subscribe via onChange callback.

import type { AuditLogger } from './audit-log.js';
import type { BroadcastEvent, ReactionRule } from './broadcast-listener.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface IssueSnapshot {
  id: string;
  status: string;
  title?: string;
  lastUpdated: number;
}

export interface DashboardSnapshot {
  timestamp: number;
  issues: Map<string, IssueSnapshot>;
  byStatus: Record<string, number>;
  totalIssues: number;
  lastBroadcast: number;
}

export type SnapshotChangeHandler = (snapshot: DashboardSnapshot) => void;

// ── Bridge ───────────────────────────────────────────────────────────────

export class LiveQueryBridge {
  private issues = new Map<string, IssueSnapshot>();
  private lastBroadcast = 0;
  private onChange: SnapshotChangeHandler | null = null;

  /** Register a callback for snapshot changes */
  subscribe(handler: SnapshotChangeHandler): void {
    this.onChange = handler;
  }

  /** Get current dashboard snapshot */
  getSnapshot(): DashboardSnapshot {
    const byStatus: Record<string, number> = {};
    for (const issue of this.issues.values()) {
      byStatus[issue.status] = (byStatus[issue.status] ?? 0) + 1;
    }
    return {
      timestamp: Date.now(),
      issues: new Map(this.issues),
      byStatus,
      totalIssues: this.issues.size,
      lastBroadcast: this.lastBroadcast,
    };
  }

  /** Build reaction rules to plug into BroadcastListener */
  buildRules(): ReactionRule[] {
    return [
      {
        id: 'livequery-status-update',
        objectClass: 'tracker:class:Issue',
        txClass: 'core:class:TxUpdateDoc',
        watchField: 'status',
        handler: async (event: BroadcastEvent, _audit: AuditLogger) => {
          const newStatus = resolveStatusName(String(event.operations?.status ?? ''));
          const existing = this.issues.get(event.objectId);
          this.issues.set(event.objectId, {
            id: event.objectId,
            status: newStatus,
            title: existing?.title,
            lastUpdated: event.modifiedOn,
          });
          this.lastBroadcast = Date.now();
          this.notify();
        },
      },
      {
        id: 'livequery-issue-created',
        objectClass: 'tracker:class:Issue',
        txClass: 'core:class:TxCreateDoc',
        handler: async (event: BroadcastEvent, _audit: AuditLogger) => {
          const status = resolveStatusName(String(event.attributes?.status ?? 'Backlog'));
          const title = String(event.attributes?.title ?? '');
          this.issues.set(event.objectId, {
            id: event.objectId,
            status,
            title,
            lastUpdated: event.modifiedOn,
          });
          this.lastBroadcast = Date.now();
          this.notify();
        },
      },
    ];
  }

  /** Seed initial state from a list of issues (call after connect) */
  seed(issues: Array<{ id: string; title: string; status: string }>): void {
    for (const issue of issues) {
      this.issues.set(issue.id, {
        id: issue.id,
        status: issue.status,
        title: issue.title,
        lastUpdated: Date.now(),
      });
    }
    this.notify();
  }

  private notify(): void {
    if (this.onChange) {
      this.onChange(this.getSnapshot());
    }
  }
}

/** Resolve a Huly status reference to a human-readable name */
function resolveStatusName(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('won')) return 'Done';
  if (s.includes('progress') || s.includes('active')) return 'In Progress';
  if (s.includes('todo')) return 'Todo';
  if (s.includes('backlog')) return 'Backlog';
  if (s.includes('cancel')) return 'Cancelled';
  return status || 'Unknown';
}
