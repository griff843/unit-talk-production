#!/usr/bin/env node
/**
 * Schema Drift Preflight — CI Core gate
 * SPRINT-CI-MASTER-TEMPLATE-LOCK-003
 *
 * Verifies critical tables and columns exist in the target Supabase database
 * before downstream verification steps run. Catches schema drift early and
 * produces actionable errors rather than cryptic "column not found" failures.
 *
 * Required env:
 *   SUPABASE_URL              — project REST URL
 *   SUPABASE_SERVICE_ROLE_KEY — service-role JWT
 *
 * Exit 0: all critical tables/columns present
 * Exit 1: drift detected (prints missing objects)
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "SCHEMA DRIFT PREFLIGHT: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

// ── Critical tables that MUST exist ─────────────────────────────────────
const CRITICAL_TABLES = [
  "unified_picks",
  "bridge_outbox",
  "participants",
  "participant_memberships",
  "agent_health",
  "prop_settlements",
  "autopilot_decisions",
  "autopilot_policy_config",
  "autopilot_cooldowns",
];

// ── Critical columns per table (spot-checks, not exhaustive) ────────────
const CRITICAL_COLUMNS = {
  unified_picks: [
    "id",
    "lifecycle_stage",
    "posted_to_discord",
    "settlement_status",
  ],
  autopilot_decisions: [
    "decision_id",
    "trace_id",
    "action_type",
    "evaluation_result",
    "executed",
  ],
  autopilot_policy_config: ["id", "version", "default_mode", "rules"],
  autopilot_cooldowns: ["entity_id", "action_type", "expires_at"],
};

// ── Critical functions ──────────────────────────────────────────────────
const CRITICAL_FUNCTIONS = [
  "get_active_cooldowns",
  "cleanup_expired_cooldowns",
  "get_autopilot_decision_stats",
];

async function query(sql) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({}),
  });
  // Fallback: use information_schema via PostgREST
  return resp;
}

/**
 * Check table existence via PostgREST HEAD request.
 * A 200 or 406 means the table exists; 404 means it doesn't.
 */
async function tableExists(tableName) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=count&limit=0`,
      {
        method: "HEAD",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    // 200 = table exists (even if empty), 404 = not found
    // 400 can mean permission issue but table exists
    return resp.status !== 404;
  } catch {
    return false;
  }
}

/**
 * Check column existence by requesting it via PostgREST select.
 * A 400 with "column not found" means drift.
 */
async function columnExists(tableName, columnName) {
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=${columnName}&limit=0`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    // 200 = column exists, 400 with specific message = column not found
    if (resp.status === 200) return true;
    const body = await resp.text();
    return !body.includes("does not exist") && !body.includes("not found");
  } catch {
    return false;
  }
}

/**
 * Check function existence by calling it via RPC with empty/default args.
 * A 404 means the function doesn't exist.
 */
async function functionExists(funcName) {
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    // 404 = function not found, anything else = exists (even if args wrong)
    return resp.status !== 404;
  } catch {
    return false;
  }
}

async function main() {
  console.log("SCHEMA DRIFT PREFLIGHT");
  console.log("=".repeat(60));
  console.log(`Target: ${SUPABASE_URL}`);
  console.log("");

  const issues = [];

  // ── Check tables ────────────────────────────────────────────────────
  console.log("Checking critical tables...");
  for (const table of CRITICAL_TABLES) {
    const exists = await tableExists(table);
    if (exists) {
      console.log(`  ✅ ${table}`);
    } else {
      console.log(`  ❌ ${table} — MISSING`);
      issues.push(`Table missing: ${table}`);
    }
  }

  // ── Check columns ──────────────────────────────────────────────────
  console.log("\nChecking critical columns...");
  for (const [table, columns] of Object.entries(CRITICAL_COLUMNS)) {
    for (const col of columns) {
      const exists = await columnExists(table, col);
      if (exists) {
        console.log(`  ✅ ${table}.${col}`);
      } else {
        console.log(`  ❌ ${table}.${col} — MISSING`);
        issues.push(`Column missing: ${table}.${col}`);
      }
    }
  }

  // ── Check functions ────────────────────────────────────────────────
  console.log("\nChecking critical functions...");
  for (const func of CRITICAL_FUNCTIONS) {
    const exists = await functionExists(func);
    if (exists) {
      console.log(`  ✅ ${func}()`);
    } else {
      console.log(`  ❌ ${func}() — MISSING`);
      issues.push(`Function missing: ${func}()`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  if (issues.length === 0) {
    console.log("SCHEMA DRIFT PREFLIGHT: PASS");
    console.log("All critical objects present.");
    process.exit(0);
  } else {
    console.error(`SCHEMA DRIFT PREFLIGHT: FAIL — ${issues.length} issue(s)`);
    console.error("");
    for (const issue of issues) {
      console.error(`  • ${issue}`);
    }
    console.error("");
    console.error(
      "Fix: Apply missing migrations via `supabase db push --include-all`",
    );
    console.error(
      "Or check supabase/migrations/ for the relevant migration file.",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("SCHEMA DRIFT PREFLIGHT: UNEXPECTED ERROR");
  console.error(err);
  process.exit(1);
});
