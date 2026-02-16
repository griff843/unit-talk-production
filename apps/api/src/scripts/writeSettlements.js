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

// Script to write prop_settlements JSON to /tmp for Supabase REST API insertion
const settlements = [
  // === HARD BAND (6 picks) ===
  {
    final_pick_id: "3b57c062-2b20-4c9d-9e4f-ae8790660fdd",
    game_result_id: "cfdd4063-049d-42a4-8f63-567e52ab117d",
    player_name: "New England Patriots",
    stat_type: "moneyline",
    line: 0,
    bet_side: "yes",
    actual_value: 7,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "ba64bbec-cbfd-448b-af4e-58ef5239996e",
    game_result_id: "cfdd4063-049d-42a4-8f63-567e52ab117d",
    player_name: "Seattle Seahawks",
    stat_type: "moneyline",
    line: 0,
    bet_side: "yes",
    actual_value: -7,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "0f149dc4-321e-4c72-aeb5-b95dae732112",
    game_result_id: "497421a7-c913-41db-a589-509c7a9ac651",
    player_name: "Dallas Mavericks",
    stat_type: "spread",
    line: -3.5,
    bet_side: "yes",
    actual_value: 6,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "9f27e156-2b4e-4d1c-a38f-a872542c3ff2",
    game_result_id: "497421a7-c913-41db-a589-509c7a9ac651",
    player_name: "Player (Dallas Mavericks)",
    stat_type: "Points",
    line: 26,
    bet_side: "yes",
    actual_value: 28,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "33338b53-9db3-4240-a03b-c1efd159a6e1",
    game_result_id: "0cf4d38f-0005-4142-b6c8-16740a32fec6",
    player_name: "Los Angeles Lakers",
    stat_type: "spread",
    line: -4.5,
    bet_side: "home",
    actual_value: 3,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "d49cfc81-b801-42bc-8177-4a70bd4904f1",
    game_result_id: "72f7a47f-fb4c-426f-809e-a57424535704",
    player_name: "Kansas City Chiefs",
    stat_type: "spread",
    line: -3.5,
    bet_side: "home",
    actual_value: 7,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  // === SOFT BAND (5 picks) ===
  {
    final_pick_id: "54fcc5aa-ae95-4a42-8a66-3fabf1398a0e",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Moneyline",
    line: 0,
    bet_side: "home",
    actual_value: 13,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "d47b3119-33ca-41d2-afdc-fcb9ba293ba4",
    game_result_id: "0cf4d38f-0005-4142-b6c8-16740a32fec6",
    player_name: "Los Angeles Lakers",
    stat_type: "spread",
    line: -4.5,
    bet_side: "home",
    actual_value: 3,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "2ee87cf8-173b-4371-a331-216478996de7",
    game_result_id: "0cf4d38f-0005-4142-b6c8-16740a32fec6",
    player_name: "Los Angeles Lakers",
    stat_type: "spread",
    line: -4.5,
    bet_side: "home",
    actual_value: 3,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "f11cb7c8-c218-4506-8514-3f3fa5bdc2f4",
    game_result_id: "32e7794c-dc07-4724-95f5-aef94ccf73ab",
    player_name: "Boston Celtics",
    stat_type: "spread",
    line: -3.5,
    bet_side: "yes",
    actual_value: 5,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "2cc04a61-7771-4fb8-9a48-da749f0af1a4",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Team Total Points",
    line: 112.5,
    bet_side: "over",
    actual_value: 121,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  // === NONE BAND (10 settleable picks, all LAL vs ATL) ===
  {
    final_pick_id: "f671b55a-e976-4e03-9575-586e2730ccb0",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Player (Los Angeles Lakers)",
    stat_type: "Points",
    line: 25.5,
    bet_side: "over",
    actual_value: 22,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "ee22419c-bb2c-4aa3-816a-ddb27e181012",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Team Total Points",
    line: 112.5,
    bet_side: "over",
    actual_value: 121,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "0e3c3c48-9545-4635-a56b-aa4fb53ea9ff",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Moneyline",
    line: 0,
    bet_side: "home",
    actual_value: 13,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "5408b7b7-7109-4950-a915-59cc12bd7d50",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Player (Los Angeles Lakers)",
    stat_type: "Points",
    line: 25.5,
    bet_side: "over",
    actual_value: 22,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "b678fe30-d683-45fe-86ec-a7f4684f7a1e",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Team Total Points",
    line: 112.5,
    bet_side: "over",
    actual_value: 121,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "ab5a0d2a-fe72-4b8d-9b8d-72b7a8591d6f",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Moneyline",
    line: 0,
    bet_side: "home",
    actual_value: 13,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "2e8d0b9e-3f02-43ea-9b92-3d60b46daa32",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Player (Los Angeles Lakers)",
    stat_type: "Points",
    line: 25.5,
    bet_side: "over",
    actual_value: 22,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "44cc192b-c473-420b-9da0-70ec6920af3c",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Team Total Points",
    line: 112.5,
    bet_side: "over",
    actual_value: 121,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "d4346a04-9c1b-48b2-ac87-cab92dbc8c9c",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Los Angeles Lakers",
    stat_type: "Moneyline",
    line: 0,
    bet_side: "home",
    actual_value: 13,
    settlement_result: "win",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  },
  {
    final_pick_id: "9f806ded-40df-4a95-9387-3f06dcada64e",
    game_result_id: "50864a1a-a40e-4d19-8c13-f77df33538ae",
    player_name: "Player (Los Angeles Lakers)",
    stat_type: "Points",
    line: 25.5,
    bet_side: "over",
    actual_value: 22,
    settlement_result: "loss",
    settlement_method: "manual",
    data_source: "manual",
    settlement_confidence: 1.0,
    data_quality_score: 1.0
  }
];

require("fs").writeFileSync("/tmp/prop_settlements.json", JSON.stringify(settlements));
console.log("Wrote " + settlements.length + " prop settlements to /tmp/prop_settlements.json");

// Also write the unified_picks update data — one PATCH per pick
// We'll build a list of {id, settlement_result} for the update script
const updates = settlements.map(s => ({
  id: s.final_pick_id,
  settlement_status: "settled",
  settlement_result: s.settlement_result,
  actual_outcome: s.actual_value,
  settled_at: new Date().toISOString()
}));
require("fs").writeFileSync("/tmp/unified_picks_updates.json", JSON.stringify(updates));
console.log("Wrote " + updates.length + " unified_picks updates to /tmp/unified_picks_updates.json");
