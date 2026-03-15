/**
 * @unit-talk/mcp-decision — adapters
 *
 * Filesystem reads + CLI invocations. No Supabase, no HTTP.
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import type {
  Finding,
  FindingBacklogResult,
  LifecycleStatusResult,
  McpDecisionConfig,
  RoutingDecisionResult,
  SprintGateResult,
} from '../schemas/index.js';

// ─── Filesystem helpers ───────────────────────────────────────────────────────

function findMostRecentRoutingDecision(
  repoRoot: string,
  sprintId?: string
): { filePath: string; sprintId: string | null } | null {
  const sprintsDir = join(repoRoot, 'out', 'sprints');
  if (!existsSync(sprintsDir)) return null;

  const sprints = readdirSync(sprintsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !sprintId || name.toLowerCase().includes(sprintId.toLowerCase()))
    .sort()
    .reverse(); // most recent first (alphabetical ≈ chronological for SPRINT-NNN names)

  for (const sprint of sprints) {
    const sprintDir = join(sprintsDir, sprint);
    const dates = readdirSync(sprintDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort()
      .reverse();

    for (const date of dates) {
      const candidate = join(sprintDir, date, 'LLM_ROUTING_DECISION.md');
      if (existsSync(candidate)) {
        return { filePath: candidate, sprintId: sprint };
      }
    }
  }
  return null;
}

// ─── Adapter functions ────────────────────────────────────────────────────────

export function getRoutingDecision(
  config: McpDecisionConfig,
  sprintId?: string
): RoutingDecisionResult {
  const found = findMostRecentRoutingDecision(config.repoRoot, sprintId);

  if (!found) {
    return {
      sprint_id: sprintId ?? null,
      file_path: '',
      content: 'No LLM_ROUTING_DECISION.md found. Run a sprint to generate one.',
      found_at: new Date().toISOString(),
    };
  }

  const content = readFileSync(found.filePath, 'utf8');
  return {
    sprint_id: found.sprintId,
    file_path: found.filePath.replace(config.repoRoot, '<REPO_ROOT>'),
    content,
    found_at: new Date().toISOString(),
  };
}

export function getSprintGateStatus(
  config: McpDecisionConfig,
  sprintId?: string
): SprintGateResult {
  const checked_at = new Date().toISOString();

  try {
    const sprintArg = sprintId ? ` ${sprintId}` : '';
    const cmd = `node tools/governance/sprint-gate.js${sprintArg}`;
    const output = execSync(cmd, {
      cwd: config.repoRoot,
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { passed: true, exit_code: 0, output, checked_at };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
    const combined = [e.stdout ?? '', e.stderr ?? ''].filter(Boolean).join('\n');
    const output = combined || (e.message ?? '');
    return { passed: false, exit_code: e.status ?? 1, output, checked_at };
  }
}

export function getFindingBacklog(
  config: McpDecisionConfig,
  severity?: string,
  limit = 20
): FindingBacklogResult {
  const queried_at = new Date().toISOString();

  // Try to read finding-backlog artifacts from out/ directory
  const candidatePaths = [
    join(config.repoRoot, 'out', 'findings', 'backlog.json'),
    join(config.repoRoot, 'out', 'findings', 'current.json'),
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      try {
        const raw = JSON.parse(readFileSync(p, 'utf8')) as unknown;
        // Attempt to extract findings array
        const arr = Array.isArray(raw)
          ? (raw as Finding[])
          : Array.isArray((raw as Record<string, unknown>)['findings'])
            ? ((raw as Record<string, unknown>)['findings'] as Finding[])
            : [];

        const filtered = severity ? arr.filter((f: Finding) => f.severity === severity) : arr;
        const limited = filtered.slice(0, limit);
        const critical = arr.filter((f: Finding) => f.severity === 'critical').length;

        return { findings: limited, total: arr.length, critical_count: critical, queried_at };
      } catch {
        // Malformed JSON — fall through
      }
    }
  }

  // Try to generate backlog via CLI
  try {
    const output = execSync('node_modules/.bin/tsx src/cli.ts findings --format json', {
      cwd: join(config.repoRoot, 'tools', 'claude-os'),
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(output) as { findings?: Finding[] };
    const arr = parsed.findings ?? [];
    const filtered = severity ? arr.filter(f => f.severity === severity) : arr;
    const critical = arr.filter(f => f.severity === 'critical').length;
    return {
      findings: filtered.slice(0, limit),
      total: arr.length,
      critical_count: critical,
      queried_at,
    };
  } catch {
    return {
      findings: [],
      total: 0,
      critical_count: 0,
      queried_at,
    };
  }
}

export function getLifecycleStatus(config: McpDecisionConfig): LifecycleStatusResult {
  const checked_at = new Date().toISOString();

  try {
    const output = execSync('npm run lifecycle:single-writer -- --strict', {
      cwd: join(config.repoRoot, 'apps', 'api'),
      encoding: 'utf8',
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse the gate output for structured data
    const filesMatch = /Files scanned:\s*(\d+)/i.exec(output);
    const violationsMatch = /Violations found:\s*(\d+)/i.exec(output);
    const allowlistMatch = /Allowlisted files:\s*(\d+)/i.exec(output);
    const passed = /GATE PASSED/i.test(output);

    return {
      passed,
      violations: violationsMatch ? parseInt(violationsMatch[1] ?? '0', 10) : 0,
      files_scanned: filesMatch ? parseInt(filesMatch[1] ?? '0', 10) : 0,
      allowlisted: allowlistMatch ? parseInt(allowlistMatch[1] ?? '0', 10) : 0,
      output,
      checked_at,
    };
  } catch (err: unknown) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    const output = [e.stdout ?? '', e.stderr ?? ''].filter(Boolean).join('\n');
    const violationsMatch = /Violations found:\s*(\d+)/i.exec(output);
    const filesMatch = /Files scanned:\s*(\d+)/i.exec(output);

    return {
      passed: false,
      violations: violationsMatch ? parseInt(violationsMatch[1] ?? '0', 10) : -1,
      files_scanned: filesMatch ? parseInt(filesMatch[1] ?? '0', 10) : 0,
      allowlisted: 0,
      output,
      checked_at,
    };
  }
}
