/**
 * Claude OS — Context Loader
 *
 * Reads context-manifest.json and resolves context packs for sprint execution.
 * Fail-closed: missing required context sources produce fatal entries.
 */

import {
  resolveRepoPath,
  safeReadText,
  safeReadJson,
  safeReadGlob,
  fileExists,
  normalizePath,
} from './fs-utils.js';

import type {
  ContextManifest,
  ContextPack,
  ContextSource,
  SprintContextSource,
  LoadedContextEntry,
  FailedContextEntry,
  FailClosedReason,
} from './types.js';

// ---------------------------------------------------------------------------
// Context Resolution
// ---------------------------------------------------------------------------

function resolveSource(
  source: ContextSource | SprintContextSource,
  category: 'always' | 'sprint_specific' | 'optional',
  sprintId?: string
): LoadedContextEntry | FailedContextEntry {
  // Resolve path — handle path_template for sprint-specific sources
  let resolvedPath: string;
  if ('path_template' in source && source.path_template && sprintId) {
    resolvedPath = source.path_template.replace('{sprint_id}', sprintId);
  } else if (source.path) {
    resolvedPath = source.path;
  } else {
    // Entry has path_template but no sprintId and no static path — skip gracefully
    return {
      id: source.id,
      path: ('path_template' in source ? source.path_template : '(unknown)') ?? '(unknown)',
      category,
      reason: `Source has path_template but no sprintId was provided and no static path fallback exists`,
      isFatal: false,
    } satisfies FailedContextEntry;
  }

  const absolutePath = resolveRepoPath(resolvedPath);

  // Handle directory glob loading
  if (source.load_type === 'directory_glob' && source.glob) {
    const results = safeReadGlob(absolutePath, source.glob);
    const successfulResults = results.filter(r => r.success);

    if (successfulResults.length === 0) {
      const failOnMissing = source.fail_on_missing ?? source.required ?? false;
      return {
        id: source.id,
        path: resolvedPath,
        category,
        reason: `No files matched glob ${source.glob} in ${resolvedPath}`,
        isFatal: failOnMissing && category === 'always',
      } satisfies FailedContextEntry;
    }

    // Concatenate all matched file contents
    const combined = successfulResults
      .map(r => `--- ${normalizePath(r.path)} ---\n${r.content}`)
      .join('\n\n');

    return {
      id: source.id,
      path: resolvedPath,
      category,
      contentType: 'text',
      content: combined,
      parsed: null,
    } satisfies LoadedContextEntry;
  }

  // Handle single file loading
  const isJson = resolvedPath.endsWith('.json');

  if (isJson) {
    const result = safeReadJson(absolutePath);
    if (result.success && result.content !== null) {
      return {
        id: source.id,
        path: resolvedPath,
        category,
        contentType: 'json',
        content: JSON.stringify(result.content, null, 2),
        parsed: result.content,
      } satisfies LoadedContextEntry;
    }
    const failOnMissing = source.fail_on_missing ?? source.required ?? false;
    return {
      id: source.id,
      path: resolvedPath,
      category,
      reason: result.error ?? `Failed to load ${resolvedPath}`,
      isFatal: failOnMissing && category === 'always',
    } satisfies FailedContextEntry;
  }

  // Markdown or text file
  const result = safeReadText(absolutePath);
  if (result.success && result.content !== null) {
    return {
      id: source.id,
      path: resolvedPath,
      category,
      contentType: 'markdown',
      content: result.content,
      parsed: null,
    } satisfies LoadedContextEntry;
  }

  const failOnMissing = source.fail_on_missing ?? source.required ?? false;
  return {
    id: source.id,
    path: resolvedPath,
    category,
    reason: result.error ?? `Failed to load ${resolvedPath}`,
    isFatal: failOnMissing && category === 'always',
  } satisfies FailedContextEntry;
}

function isLoaded(entry: LoadedContextEntry | FailedContextEntry): entry is LoadedContextEntry {
  return 'content' in entry && 'contentType' in entry;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a context pack from a manifest.
 *
 * @param manifest - The context manifest loaded from governance
 * @param sprintId - Optional sprint ID for resolving sprint-specific paths
 * @param relevantDomains - Optional list of domains to determine which sprint-specific contexts to load
 */
export function buildContextPack(
  manifest: ContextManifest,
  sprintId?: string,
  relevantDomains?: string[]
): ContextPack {
  const loaded: LoadedContextEntry[] = [];
  const failed: FailedContextEntry[] = [];
  const failClosedReasons: FailClosedReason[] = [];

  // --- Always load ---
  for (const source of manifest.always_load) {
    const entry = resolveSource(source, 'always');
    if (isLoaded(entry)) {
      loaded.push(entry);
    } else {
      failed.push(entry);
      if (entry.isFatal) {
        failClosedReasons.push({
          rule: 'Rule 1: Missing Truth Source',
          description: `Required always-load context missing: ${source.id} at ${source.path}`,
          severity: 'blocking',
          source: 'context-manifest.json / always_load',
          resolution: `Ensure ${source.path} exists in the repo`,
        });
      }
    }
  }

  // --- Sprint-specific (conditional loading) ---
  for (const source of manifest.sprint_specific) {
    // If we have relevantDomains, check if this source is relevant
    if (relevantDomains && source.when_relevant) {
      const isRelevant = relevantDomains.some(d =>
        source.when_relevant!.toLowerCase().includes(d.toLowerCase())
      );
      if (!isRelevant) continue;
    }

    const entry = resolveSource(source, 'sprint_specific', sprintId);
    if (isLoaded(entry)) {
      loaded.push(entry);
    } else {
      failed.push(entry);
      // Sprint-specific required sources that fail are fatal when relevant
      if (entry.isFatal) {
        failClosedReasons.push({
          rule: 'Rule 1: Missing Truth Source',
          description: `Required sprint-specific context missing: ${source.id} at ${source.path}`,
          severity: 'blocking',
          source: 'context-manifest.json / sprint_specific',
          resolution: `Ensure ${source.path} exists, or confirm this context is not required for the current sprint`,
        });
      }
    }
  }

  // --- Optional ---
  for (const source of manifest.optional_context) {
    const entry = resolveSource(source, 'optional');
    if (isLoaded(entry)) {
      loaded.push(entry);
    } else {
      failed.push(entry);
      // Optional sources are never fatal
    }
  }

  const isComplete = failClosedReasons.length === 0;

  return {
    manifest,
    loaded,
    failed,
    truthPriorityOrder: manifest.truth_priority_order,
    forbiddenSources: manifest.forbidden_context_sources,
    isComplete,
    failClosedReasons,
  };
}

/**
 * Check if a specific truth source file exists in the repo.
 * Useful for pre-flight checks before sprint execution.
 */
export function checkTruthSourceExists(relativePath: string): boolean {
  return fileExists(resolveRepoPath(relativePath));
}
