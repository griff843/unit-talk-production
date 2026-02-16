// ============================================================================
// ⚠️  DEPRECATED — DO NOT USE  ⚠️
// ============================================================================
// This script is deprecated as of UNIFIED-OPS-002 (2026-01-30).
// Use the operator-safe settlement RPC instead:
//
//   POST /ops/settle { pick_id, result, actual_value, notes, operator }
//
// Or call Supabase RPC directly:
//   SELECT manual_settle_pick(p_pick_id, p_result, p_actual_value, p_operator, p_notes);
//
// This script has NO audit trail, NO idempotency, and NO validation.
// It remains here only for historical reference. Do not execute.
// ============================================================================

if (process.env.ALLOW_UNSAFE_SETTLEMENT_SCRIPTS !== 'true') {
  console.error('ERROR: This script is deprecated. Set ALLOW_UNSAFE_SETTLEMENT_SCRIPTS=true to override.');
  console.error('Use POST /ops/settle or manual_settle_pick() RPC instead.');
  process.exit(1);
}

// Script to update unified_picks settlement columns via Supabase REST API
const https = require("https");
const url = require("url");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const updates = JSON.parse(require("fs").readFileSync("/tmp/unified_picks_updates.json", "utf8"));

async function patchPick(pick) {
  const patchUrl = `${SUPABASE_URL}/rest/v1/unified_picks?id=eq.${pick.id}`;
  const parsed = new url.URL(patchUrl);

  const body = JSON.stringify({
    settlement_status: pick.settlement_status,
    settlement_result: pick.settlement_result,
    actual_outcome: pick.actual_outcome,
    settled_at: pick.settled_at
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => {
        resolve({ id: pick.id, status: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`Updating ${updates.length} unified_picks...`);
  let success = 0;
  let failed = 0;

  for (const pick of updates) {
    const result = await patchPick(pick);
    if (result.status >= 200 && result.status < 300) {
      success++;
    } else {
      failed++;
      console.log(`FAILED: ${result.id} → HTTP ${result.status}: ${result.body}`);
    }
  }

  console.log(`Done: ${success} success, ${failed} failed out of ${updates.length}`);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
