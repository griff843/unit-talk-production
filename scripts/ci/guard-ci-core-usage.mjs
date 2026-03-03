#!/usr/bin/env node
/**
 * CI Guard: Enforce CI Core usage for all Node/pnpm jobs
 * SPRINT-CI-MASTER-TEMPLATE-LOCK-003
 *
 * Every GitHub Actions job that sets up Node.js / pnpm MUST call the
 * reusable _ci-core.yml workflow instead of inlining setup steps.
 *
 * This prevents:
 *   - Version drift (Node 18 vs 20, pnpm version mismatch)
 *   - Missing shared package builds (vitest not found, config dist missing)
 *   - Inconsistent install flags (--frozen-lockfile, --ignore-scripts)
 *
 * Detected patterns (violations):
 *   - uses: actions/setup-node@*  (in job steps)
 *   - uses: pnpm/action-setup@*   (in job steps)
 *   - run: pnpm install            (in job steps)
 *   - run: npm ci                   (in job steps)
 *   - run: npm install              (in job steps)
 *
 * Exempt files:
 *   - _ci-core.yml itself (defines the canonical setup)
 *
 * Exempt jobs (via allowlist):
 *   - Jobs with service containers (postgres, redis)
 *   - Jobs with matrix strategy
 *   - Jobs documented with `# ci-core-exempt: <reason>` comment
 *
 * Usage:  node scripts/ci/guard-ci-core-usage.mjs
 * Exit 0: all jobs compliant
 * Exit 1: violations found
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

// Files that ARE CI Core (exempt from the check)
const CORE_FILES = new Set(["_ci-core.yml"]);

// Files not yet migrated to CI Core (batch 2+).
// Remove files from this set as they are migrated.
const UNMIGRATED_FILES = new Set([
  "agent-control-plane-verify.yml",
  "ci-cd-pipeline.yml",
  "ci-failure-resolver.yml",
  "command-center-deploy.yml",
  "compile-green.yml",
  "deploy.yml",
  "docs-validation.yml",
  "global-deploy.yml",
  "mint-governed-tag.yml",
  "notion-ci-failure.yml",
  "notion-contract-drift.yml",
  "notion-lock-tag.yml",
  "notion-pr-sync.yml",
  "phase5-prod-validation.yml",
  "prod-acceptance.yml",
  "sgo-sync.yml",
  "supabase-migrate.yml",
  "tag-guard.yml",
]);

// Jobs exempt from CI Core requirement (with reason).
// Format: "filename:jobKey"
const EXEMPT_JOBS = new Map([
  // ci.yml — guard job (bootstraps itself, can't call CI Core)
  [
    "ci.yml:guard-ci-core",
    "Guard script must run standalone to validate CI Core usage",
  ],
  // ci.yml — jobs with service containers or matrix strategy
  [
    "ci.yml:test",
    "Requires postgres + redis service containers (not supported by reusable workflows)",
  ],
  [
    "ci.yml:build",
    "Uses matrix strategy across 5 apps (not supported by reusable workflow calls)",
  ],
  ["ci.yml:performance", "PR-only job with custom performance test runner"],
  ["ci.yml:e2e", "PR-only job with full Playwright browser install"],
  // autopilot-policy-acceptance.yml — specialized per-file checks
  [
    "autopilot-policy-acceptance.yml:typescript-check",
    "Custom per-file tsc compilation checks (not a standard gate)",
  ],
  [
    "autopilot-policy-acceptance.yml:policy-unit-tests",
    "Custom vitest with --passWithNoTests (not a standard gate)",
  ],
]);

// Patterns that indicate a job is setting up Node/pnpm directly
const SETUP_PATTERNS = [
  {
    type: "uses",
    pattern: /^actions\/setup-node@/,
    name: "actions/setup-node",
  },
  {
    type: "uses",
    pattern: /^pnpm\/action-setup@/,
    name: "pnpm/action-setup",
  },
];

const INSTALL_PATTERNS = [
  /\bpnpm install\b/,
  /\bnpm ci\b/,
  /\bnpm install\b/,
];

/**
 * Check if a job calls CI Core (uses: ./.github/workflows/_ci-core.yml)
 */
function jobCallsCiCore(job) {
  return (
    typeof job.uses === "string" &&
    job.uses.includes("_ci-core.yml")
  );
}

/**
 * Check if a job has service containers
 */
function jobHasServices(job) {
  return job.services && Object.keys(job.services).length > 0;
}

/**
 * Check if a job has matrix strategy
 */
function jobHasMatrix(job) {
  return job.strategy && job.strategy.matrix;
}

/**
 * Detect if a job inlines Node/pnpm setup
 */
function detectInlineSetup(steps) {
  if (!Array.isArray(steps)) return [];
  const findings = [];

  for (const step of steps) {
    // Check `uses:` patterns
    if (step.uses) {
      for (const p of SETUP_PATTERNS) {
        if (p.pattern.test(step.uses)) {
          findings.push({
            step: step.name || step.uses,
            pattern: p.name,
          });
        }
      }
    }

    // Check `run:` patterns
    if (step.run) {
      for (const re of INSTALL_PATTERNS) {
        if (re.test(step.run)) {
          findings.push({
            step: step.name || "(unnamed run step)",
            pattern: step.run.trim().split("\n")[0].substring(0, 60),
          });
        }
      }
    }
  }

  return findings;
}

function main() {
  const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml"));
  const violations = [];
  let scanned = 0;
  let exempted = 0;

  let unmigrated = 0;

  for (const file of files) {
    // Skip CI Core itself
    if (CORE_FILES.has(file)) continue;

    // Skip files not yet migrated (batch 2+)
    if (UNMIGRATED_FILES.has(file)) {
      unmigrated++;
      continue;
    }

    const filepath = join(WORKFLOWS_DIR, file);
    let doc;
    try {
      doc = yaml.load(readFileSync(filepath, "utf8"));
    } catch {
      // Skip unparseable files (comments-only, etc.)
      continue;
    }

    if (!doc || !doc.jobs) continue;

    for (const [jobKey, job] of Object.entries(doc.jobs)) {
      scanned++;

      // Jobs that call CI Core are compliant
      if (jobCallsCiCore(job)) continue;

      // Check for inline setup patterns
      const findings = detectInlineSetup(job.steps);
      if (findings.length === 0) continue;

      // Check exemption list
      const exemptKey = `${file}:${jobKey}`;
      if (EXEMPT_JOBS.has(exemptKey)) {
        exempted++;
        continue;
      }

      // Check for ci-core-exempt comment in the raw YAML
      const rawContent = readFileSync(filepath, "utf8");
      const jobSection = rawContent.substring(
        rawContent.indexOf(`${jobKey}:`),
      );
      const nextJobMatch = jobSection
        .substring(jobKey.length + 1)
        .match(/\n  \w[\w-]*:/);
      const jobBlock = nextJobMatch
        ? jobSection.substring(0, jobKey.length + 1 + nextJobMatch.index)
        : jobSection;

      if (/# ci-core-exempt:/.test(jobBlock)) {
        exempted++;
        continue;
      }

      // Auto-exempt: jobs with services or matrix that aren't in the list
      if (jobHasServices(job) || jobHasMatrix(job)) {
        exempted++;
        continue;
      }

      violations.push({
        file,
        job: jobKey,
        name: job.name || jobKey,
        findings,
      });
    }
  }

  console.log("CI CORE USAGE GUARD");
  console.log("=".repeat(60));
  console.log(`Workflow files scanned: ${files.length}`);
  console.log(`  Core files (skipped): ${CORE_FILES.size}`);
  console.log(`  Unmigrated files (batch 2+): ${unmigrated}`);
  console.log(`Jobs scanned: ${scanned}`);
  console.log(`Jobs exempted: ${exempted}`);
  console.log(`Violations: ${violations.length}`);
  console.log("");

  if (violations.length === 0) {
    console.log(
      "✅ All Node/pnpm jobs either call CI Core or are exempted.",
    );
    process.exit(0);
  }

  console.error("❌ VIOLATIONS FOUND:");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.file} → job "${v.job}" (${v.name})`);
    for (const f of v.findings) {
      console.error(`    ├─ ${f.pattern} (step: ${f.step})`);
    }
    console.error(
      `    └─ Fix: Convert to \`uses: ./.github/workflows/_ci-core.yml\``,
    );
    console.error(
      `         Or add to EXEMPT_JOBS in scripts/ci/guard-ci-core-usage.mjs`,
    );
    console.error("");
  }

  console.error(
    `${violations.length} violation(s). Every CI job that needs Node/pnpm MUST call _ci-core.yml.`,
  );
  process.exit(1);
}

main();
