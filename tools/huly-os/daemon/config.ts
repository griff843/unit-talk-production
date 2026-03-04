// SPRINT-HULY-WORKOS-V1-LOCAL-001: Zod-validated config (fail-closed)

import path, { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Repo root: tools/huly-os/daemon/config.ts -> ../../.. = repo root
const REPO_ROOT = path.resolve(import.meta.dirname ?? __dirname, '..', '..', '..');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, 'out', 'ops', 'reality');

// Load .env from tools/huly-os/ directory
loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const DaemonConfigSchema = z.object({
  // GitHub (always required)
  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  GITHUB_OWNER: z.string().min(1).default('your-org'),
  GITHUB_REPO: z.string().min(1).default('unit-talk-production'),

  // Huly (required for --run and --smoke; optional for --dry-run)
  HULY_URL: z.string().url().default('http://localhost:8087'),
  HULY_EMAIL: z.string().min(1).default('user1@example.com'),
  HULY_PASSWORD: z.string().min(1).default('1234'),
  HULY_WORKSPACE: z.string().min(1).default('ws1'),
  HULY_PROJECT: z.string().min(1).default('UT'),
  HULY_TEAMSPACE: z.string().min(1).default('Operations'),

  // Publish fallback: known issue ID for comment-based fallback
  HULY_REPORT_FALLBACK_ISSUE_ID: z.string().optional(),

  // Output
  OUTPUT_DIR: z.string().min(1).default(DEFAULT_OUTPUT_DIR),

  // Auto PR (opt-in — disabled by default)
  AUTO_PR_ENABLED: z
    .string()
    .transform(v => v === 'true' || v === '1')
    .default('false'),
  AUTO_PR_MAX_TASKS: z.coerce.number().int().min(0).max(10).default(2),
  AUTO_PR_BRANCH_PREFIX: z.string().min(1).default('sprint/huly-auto-pr-'),
  AUTO_PR_LABEL: z.string().min(1).default('autopr'),
  AUTO_PR_BASE: z.string().min(1).default('main'),
  AUTO_PR_ALLOWED_PATHS: z
    .string()
    .default('tools/huly-os/,docs/huly-os/')
    .transform(v =>
      v
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
    ),
  AUTO_PR_REQUIRE_GREEN_LOCAL: z
    .string()
    .transform(v => v === 'true' || v === '1')
    .default('true'),
});

export type DaemonConfig = z.infer<typeof DaemonConfigSchema>;

/** Fail-closed guard: OUTPUT_DIR must NOT resolve inside tools/huly-os/out */
function guardOutputDir(config: DaemonConfig): void {
  const resolved = path.resolve(config.OUTPUT_DIR);
  if (resolved.includes(path.join('tools', 'huly-os', 'out'))) {
    throw new Error(`OUTPUT_DIR must be repo-root out/*, got: ${resolved}`);
  }
}

/**
 * Load and validate config from environment.
 * @param requireHuly - If true, validates Huly vars are non-default. If false, uses defaults.
 */
export function loadConfig(): DaemonConfig {
  const result = DaemonConfigSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Config validation failed (fail-closed):\n${issues}`);
  }
  guardOutputDir(result.data);
  return result.data;
}

/**
 * Load config but only require GitHub vars.
 * Used by --dry-run mode where Huly is optional.
 */
export function loadConfigGitHubOnly(): DaemonConfig {
  const GithubOnlySchema = z.object({
    GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
    GITHUB_OWNER: z.string().min(1).default('your-org'),
    GITHUB_REPO: z.string().min(1).default('unit-talk-production'),
    HULY_URL: z.string().default('http://localhost:8087'),
    HULY_EMAIL: z.string().default('user1@example.com'),
    HULY_PASSWORD: z.string().default('1234'),
    HULY_WORKSPACE: z.string().default('ws1'),
    HULY_PROJECT: z.string().default('UT'),
    HULY_TEAMSPACE: z.string().default('Operations'),
    HULY_REPORT_FALLBACK_ISSUE_ID: z.string().optional(),
    OUTPUT_DIR: z.string().default(DEFAULT_OUTPUT_DIR),
    AUTO_PR_ENABLED: z
      .string()
      .transform(v => v === 'true' || v === '1')
      .default('false'),
    AUTO_PR_MAX_TASKS: z.coerce.number().int().min(0).max(10).default(2),
    AUTO_PR_BRANCH_PREFIX: z.string().min(1).default('sprint/huly-auto-pr-'),
    AUTO_PR_LABEL: z.string().min(1).default('autopr'),
    AUTO_PR_BASE: z.string().min(1).default('main'),
    AUTO_PR_ALLOWED_PATHS: z
      .string()
      .default('tools/huly-os/,docs/huly-os/')
      .transform(v =>
        v
          .split(',')
          .map(p => p.trim())
          .filter(Boolean)
      ),
    AUTO_PR_REQUIRE_GREEN_LOCAL: z
      .string()
      .transform(v => v === 'true' || v === '1')
      .default('true'),
  });
  const result = GithubOnlySchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Config validation failed (fail-closed):\n${issues}`);
  }
  guardOutputDir(result.data as DaemonConfig);
  return result.data as DaemonConfig;
}
