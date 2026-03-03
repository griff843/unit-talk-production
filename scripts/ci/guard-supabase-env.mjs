#!/usr/bin/env node
/**
 * CI Guard: Enforce environment declaration for Supabase secrets
 *
 * Any GitHub Actions job that references secrets.*SUPABASE* MUST declare
 * `environment:` so secrets resolve from the correct GitHub Environment
 * (ci, staging, or production) rather than empty repository-level lookups.
 *
 * Usage:  node scripts/ci/guard-supabase-env.mjs
 * Exit 0: all jobs compliant
 * Exit 1: violations found (prints file + job name)
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml");

const WORKFLOWS_DIR = join(
  process.cwd(),
  ".github",
  "workflows",
);

// Pattern: secrets.SUPABASE_*, secrets.STAGING_SUPABASE_*, secrets.NEXT_PUBLIC_SUPABASE_*
const SUPABASE_SECRET_RE =
  /secrets\.\w*SUPABASE_\w*/;

// Hardcoded test placeholders are NOT real secret references
const PLACEHOLDER_RE =
  /http:\/\/localhost|ci-test-placeholder|echo\s+"NOTE:/;

function extractSecretRefs(obj) {
  const refs = [];
  const text = JSON.stringify(obj);
  const matches = text.match(/secrets\.\w*SUPABASE_\w*/g);
  if (matches) {
    for (const m of matches) {
      // Exclude if the surrounding context is a placeholder
      refs.push(m);
    }
  }
  return [...new Set(refs)];
}

function isPlaceholderOnly(steps) {
  if (!steps) return false;
  const text = JSON.stringify(steps);
  // If EVERY supabase reference is inside a placeholder/echo context, skip it
  const secretMatches = text.match(/secrets\.\w*SUPABASE_\w*/g);
  return !secretMatches || secretMatches.length === 0;
}

function checkStepsForRealSecrets(steps) {
  if (!Array.isArray(steps)) return [];
  const refs = [];
  for (const step of steps) {
    const stepText = JSON.stringify(step);
    // Skip steps that are just echo/note messages
    if (PLACEHOLDER_RE.test(stepText) && !SUPABASE_SECRET_RE.test(stepText)) {
      continue;
    }
    const matches = stepText.match(/secrets\.\w*SUPABASE_\w*/g);
    if (matches) {
      refs.push(...matches);
    }
  }
  return [...new Set(refs)];
}

function main() {
  const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml"));
  const violations = [];

  for (const file of files) {
    const filepath = join(WORKFLOWS_DIR, file);
    let doc;
    try {
      doc = yaml.load(readFileSync(filepath, "utf8"));
    } catch {
      // Skip unparseable files
      continue;
    }

    if (!doc || !doc.jobs) continue;

    for (const [jobKey, job] of Object.entries(doc.jobs)) {
      // Check if this job references real Supabase secrets
      const refs = checkStepsForRealSecrets(job.steps);

      // Also check job-level env and other fields
      const jobText = JSON.stringify(job);
      const jobLevelRefs = jobText.match(/secrets\.\w*SUPABASE_\w*/g) || [];
      const allRefs = [...new Set([...refs, ...jobLevelRefs])];

      // Filter out hardcoded placeholders: if the only "SUPABASE" references
      // are in env values like "http://localhost:0" or "ci-test-placeholder",
      // those are not real secret lookups
      const realRefs = allRefs.filter((ref) => {
        // ref is like "secrets.SUPABASE_URL" - these are real ${{ secrets.X }} expansions
        return true;
      });

      // Check if the job text has REAL secret template expressions (not just env var names)
      const hasSecretExpansions =
        /\$\{\{\s*secrets\.\w*SUPABASE_\w*\s*\}\}/.test(jobText);

      // But exclude jobs where ALL supabase env values are hardcoded placeholders
      const hasOnlyPlaceholders = (() => {
        const expansions = jobText.match(
          /\$\{\{\s*secrets\.(\w*SUPABASE_\w*)\s*\}\}/g,
        );
        if (!expansions || expansions.length === 0) return true;
        // Check if every expansion appears ONLY in a context with a placeholder fallback
        return false;
      })();

      if (!hasSecretExpansions || hasOnlyPlaceholders) continue;

      // Check if job declares environment
      const hasEnv = job.environment !== undefined && job.environment !== null;

      if (!hasEnv) {
        violations.push({
          file,
          job: jobKey,
          name: job.name || jobKey,
          secrets: realRefs,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(
      "SUPABASE ENV GUARD: All jobs with Supabase secrets declare environment.",
    );
    process.exit(0);
  }

  console.error("SUPABASE ENV GUARD FAILED: Jobs reference Supabase secrets without environment:");
  console.error("");
  for (const v of violations) {
    console.error(`  ${v.file} -> job "${v.job}" (${v.name})`);
    console.error(`    secrets: ${v.secrets.join(", ")}`);
    console.error(`    fix: add \`environment: ci|staging|production\` to this job`);
    console.error("");
  }
  console.error(
    `${violations.length} violation(s) found. See docs/ops/SUPABASE_CI_ENVIRONMENT_SETUP.md`,
  );
  process.exit(1);
}

main();
