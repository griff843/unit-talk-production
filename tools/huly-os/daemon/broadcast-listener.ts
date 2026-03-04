// UT-154: Huly WebSocket broadcast listener for UI-driven changes
// Subscribes to workspace broadcasts and triggers configurable reaction rules.
// Plugs into the existing HulyAdapter WebSocket — call attachListener() after connect().

import type { AuditLogger } from './audit-log.js';

// ── Types ────────────────────────────────────────────────────────────────

/** A parsed broadcast event from the Huly transactor */
export interface BroadcastEvent {
  txClass: string;
  objectClass: string;
  objectId: string;
  objectSpace: string;
  operations?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  modifiedBy: string;
  modifiedOn: number;
  raw: Record<string, unknown>;
}

/** A reaction rule that runs when a broadcast matches */
export interface ReactionRule {
  /** Unique rule ID for logging */
  id: string;
  /** Object class to match (e.g. 'tracker:class:Issue') */
  objectClass: string;
  /** TX class to match (e.g. 'core:class:TxUpdateDoc') — optional, matches all if omitted */
  txClass?: string;
  /** Field to watch in operations (e.g. 'status') — optional */
  watchField?: string;
  /** Handler called when rule matches */
  handler: (event: BroadcastEvent, audit: AuditLogger) => Promise<void>;
}

// ── Broadcast Parser ─────────────────────────────────────────────────────

/** Parse a raw WebSocket message into a BroadcastEvent, or null if not a broadcast */
export function parseBroadcast(data: Record<string, unknown>): BroadcastEvent | null {
  // Broadcasts have no 'id' field (TX responses have numeric id)
  if (typeof data.id === 'number') return null;

  // Must be a TX-like object
  const txClass = String(data._class ?? '');
  if (!txClass.startsWith('core:class:Tx')) return null;

  return {
    txClass,
    objectClass: String(data.objectClass ?? ''),
    objectId: String(data.objectId ?? ''),
    objectSpace: String(data.objectSpace ?? ''),
    operations: data.operations as Record<string, unknown> | undefined,
    attributes: data.attributes as Record<string, unknown> | undefined,
    modifiedBy: String(data.modifiedBy ?? ''),
    modifiedOn: typeof data.modifiedOn === 'number' ? data.modifiedOn : Date.now(),
    raw: data,
  };
}

// ── Listener Engine ──────────────────────────────────────────────────────

export class BroadcastListener {
  private rules: ReactionRule[] = [];
  private audit: AuditLogger;
  private selfSocialId: string;

  constructor(audit: AuditLogger, selfSocialId: string) {
    this.audit = audit;
    this.selfSocialId = selfSocialId;
  }

  /** Register a reaction rule */
  addRule(rule: ReactionRule): void {
    this.rules.push(rule);
  }

  /** Process a raw WebSocket message. Call this from HulyAdapter's onmessage handler. */
  async onMessage(data: Record<string, unknown>): Promise<void> {
    const event = parseBroadcast(data);
    if (!event) return;

    // Skip self-originated broadcasts to avoid feedback loops
    if (event.modifiedBy === this.selfSocialId) return;

    for (const rule of this.rules) {
      if (!this.matches(rule, event)) continue;

      try {
        await rule.handler(event, this.audit);
        this.audit.log({
          source: 'huly',
          op: `broadcast_reaction:${rule.id}`,
          target: event.objectId,
          ok: true,
          latencyMs: 0,
          meta: { txClass: event.txClass, objectClass: event.objectClass },
        });
      } catch (err) {
        this.audit.log({
          source: 'huly',
          op: `broadcast_reaction:${rule.id}`,
          target: event.objectId,
          ok: false,
          latencyMs: 0,
          error: (err as Error).message,
        });
      }
    }
  }

  private matches(rule: ReactionRule, event: BroadcastEvent): boolean {
    if (event.objectClass !== rule.objectClass) return false;
    if (rule.txClass && event.txClass !== rule.txClass) return false;
    if (rule.watchField && event.operations && !(rule.watchField in event.operations)) return false;
    return true;
  }
}

// ── Built-in Reaction Rules ──────────────────────────────────────────────

/** Rule: Log all issue status changes from the UI */
export const issueStatusChangeRule: ReactionRule = {
  id: 'issue-status-change',
  objectClass: 'tracker:class:Issue',
  txClass: 'core:class:TxUpdateDoc',
  watchField: 'status',
  handler: async (event, audit) => {
    const newStatus = event.operations?.status as string | undefined;
    console.log(
      `[broadcast] Issue ${event.objectId} status changed to ${newStatus ?? 'unknown'} ` +
        `by ${event.modifiedBy}`
    );
    audit.log({
      source: 'huly',
      op: 'ui_status_change',
      target: event.objectId,
      ok: true,
      latencyMs: 0,
      meta: { newStatus, modifiedBy: event.modifiedBy },
    });
  },
};

/** Rule: Log new issues created from the UI */
export const issueCreatedRule: ReactionRule = {
  id: 'issue-created',
  objectClass: 'tracker:class:Issue',
  txClass: 'core:class:TxCreateDoc',
  handler: async (event, audit) => {
    const title = event.attributes?.title as string | undefined;
    console.log(
      `[broadcast] New issue created: "${title ?? event.objectId}" by ${event.modifiedBy}`
    );
    audit.log({
      source: 'huly',
      op: 'ui_issue_created',
      target: event.objectId,
      ok: true,
      latencyMs: 0,
      meta: { title, modifiedBy: event.modifiedBy },
    });
  },
};
