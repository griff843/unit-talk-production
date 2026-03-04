// SPRINT-HULY-OS-WRITE-SURFACE-STABILIZATION-003: Layered publish strategy
// Surfaces: doc → issue → comment. Fail only if ALL surfaces fail.

import type { HulyAdapter } from './adapters/huly-adapter.js';
import type { PublishResult } from './adapters/types.js';
import type { AuditLogger } from './audit-log.js';

export interface PublishPayload {
  /** Huly teamspace for doc surface */
  teamspaceName: string;
  /** Huly project identifier for issue surface */
  projectIdentifier: string;
  /** Title for the doc or issue */
  title: string;
  /** Markdown content body */
  markdownContent: string;
  /** Relative path to repo-root artifact (for issue body linkage) */
  artifactPath?: string;
  /** Known fallback issue ID for comment surface */
  fallbackIssueId?: string;
}

interface SurfaceFailure {
  surface: string;
  error: string;
  status?: number;
}

/**
 * Execute the layered publish strategy.
 * Order: doc → issue → comment.
 * Returns on first success. Fails only if ALL surfaces fail.
 */
export async function publish(
  huly: HulyAdapter,
  payload: PublishPayload,
  audit: AuditLogger
): Promise<PublishResult> {
  const failures: SurfaceFailure[] = [];

  // Surface 1: createDoc (existing behavior)
  const docResult = await attemptDoc(huly, payload, failures);
  if (docResult) return docResult;

  // Surface 2: create/upsert issue
  const issueResult = await attemptIssue(huly, payload, failures);
  if (issueResult) return issueResult;

  // Surface 3: comment on fallback issue
  const commentResult = await attemptComment(huly, payload, failures);
  if (commentResult) return commentResult;

  // All surfaces failed — log structured multi-surface failure
  audit.log({
    source: 'daemon',
    op: 'publish_all_surfaces_failed',
    target: payload.title,
    ok: false,
    latencyMs: 0,
    meta: { failures },
  });

  const summary = failures.map(f => `[${f.surface}] ${f.error}`).join('; ');
  throw new Error(`All publish surfaces failed: ${summary}`);
}

/** Surface 1: Attempt upsertDoc */
async function attemptDoc(
  huly: HulyAdapter,
  payload: PublishPayload,
  failures: SurfaceFailure[]
): Promise<PublishResult | null> {
  try {
    const result = await huly.upsertDoc(
      payload.teamspaceName,
      payload.title,
      payload.markdownContent
    );
    return { surface: 'doc', id: result.id };
  } catch (err) {
    const failure = buildFailure('doc', err);
    failures.push(failure);
    logSurfaceFailure('doc', err);
    return null;
  }
}

/** Surface 2: Attempt createIssue */
async function attemptIssue(
  huly: HulyAdapter,
  payload: PublishPayload,
  failures: SurfaceFailure[]
): Promise<PublishResult | null> {
  try {
    const body = buildIssueBody(payload);
    const result = await huly.createIssue(payload.projectIdentifier, payload.title, body);
    return { surface: 'issue', id: result.id };
  } catch (err) {
    const failure = buildFailure('issue', err);
    failures.push(failure);
    logSurfaceFailure('issue', err);
    return null;
  }
}

/** Surface 3: Attempt addComment on fallback issue */
async function attemptComment(
  huly: HulyAdapter,
  payload: PublishPayload,
  failures: SurfaceFailure[]
): Promise<PublishResult | null> {
  if (!payload.fallbackIssueId) {
    failures.push({ surface: 'comment', error: 'No HULY_REPORT_FALLBACK_ISSUE_ID configured' });
    return null;
  }

  try {
    const body = `**${payload.title}**\n\n${payload.markdownContent}`;
    const result = await huly.addComment(payload.fallbackIssueId, body);
    return { surface: 'comment', id: result.id };
  } catch (err) {
    const failure = buildFailure('comment', err);
    failures.push(failure);
    logSurfaceFailure('comment', err);
    return null;
  }
}

/** Build issue body with artifact path linkage */
function buildIssueBody(payload: PublishPayload): string {
  let body = payload.markdownContent;
  if (payload.artifactPath) {
    body += `\n\n---\nArtifact: \`${payload.artifactPath}\``;
  }
  return body;
}

function buildFailure(surface: string, err: unknown): SurfaceFailure {
  const msg = err instanceof Error ? err.message : String(err);
  const statusMatch = msg.match(/HTTP (\d+)/);
  return {
    surface,
    error: msg,
    ...(statusMatch ? { status: Number(statusMatch[1]) } : {}),
  };
}

function logSurfaceFailure(surface: string, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  console.warn(`Publish surface [${surface}] failed: ${msg}`);
}
