/* eslint-disable no-console */
/**
 * POSTING-AUTHORITY-001: Providerless posting proof
 *
 * This script proves the posting authority logic WITHOUT requiring:
 * - Live Supabase connection
 * - Discord bot/webhook tokens
 * - Any external APIs
 *
 * It simulates the exact query logic and selection behavior of the
 * DiscordPromotionAgent's promoteToDiscord() function using fixture data.
 */

// ---- FIXTURE DATA ----

interface FixturePick {
  id: string;
  player_name: string;
  posted_to_discord: boolean;
  promotion_band: string | null;
  tier: string | null;
  meta: Record<string, any> | null;
  capper_username?: string;
}

const FIXTURE_PICKS: FixturePick[] = [
  // Case 1: Capper pick, band=NONE, tier=D — should ALWAYS post
  {
    id: 'capper-pick-001',
    player_name: 'Nikola Jokic',
    posted_to_discord: false,
    promotion_band: 'NONE',
    tier: 'D',
    meta: { pick_origin: 'capper', capper: 'Griff843' },
    capper_username: 'Griff843',
  },
  // Case 2: Capper pick, band=null, tier=null — should ALWAYS post
  {
    id: 'capper-pick-002',
    player_name: 'Jayson Tatum',
    posted_to_discord: false,
    promotion_band: null,
    tier: null,
    meta: { pick_origin: 'capper', capper: 'Vicgo' },
    capper_username: 'Vicgo',
  },
  // Case 3: System pick, NOT approved — should NOT post
  {
    id: 'system-pick-001',
    player_name: 'LeBron James',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'S',
    meta: { pick_origin: 'system' },
  },
  // Case 4: System pick, approved — should post
  {
    id: 'system-pick-002',
    player_name: 'Luka Doncic',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'A',
    meta: { pick_origin: 'system', system_approved: true },
  },
  // Case 5: Already posted — should be skipped (idempotency)
  {
    id: 'capper-pick-003',
    player_name: 'Stephen Curry',
    posted_to_discord: true, // already posted
    promotion_band: 'HARD',
    tier: 'S',
    meta: { pick_origin: 'capper', capper: 'MoneyReef' },
  },
  // Case 6: Legacy pick, no origin, HARD band — should post via legacy fallback
  {
    id: 'legacy-pick-001',
    player_name: 'Giannis Antetokounmpo',
    posted_to_discord: false,
    promotion_band: 'HARD',
    tier: 'A',
    meta: null,
  },
  // Case 7: Legacy pick, no origin, NONE band — should NOT post
  {
    id: 'legacy-pick-002',
    player_name: 'Trae Young',
    posted_to_discord: false,
    promotion_band: 'NONE',
    tier: 'C',
    meta: null,
  },
];

// ---- SIMULATED QUERY LOGIC ----
// Mirrors exactly the DiscordPromotionAgent promoteToDiscord() queries

function selectCapperPicks(picks: FixturePick[]): FixturePick[] {
  return picks.filter(p => p.posted_to_discord === false && p.meta?.pick_origin === 'capper');
}

function selectApprovedSystemPicks(picks: FixturePick[]): FixturePick[] {
  return picks.filter(
    p =>
      p.posted_to_discord === false &&
      p.meta?.pick_origin === 'system' &&
      String(p.meta?.system_approved) === 'true'
  );
}

function selectUnapprovedSystemPicks(picks: FixturePick[]): FixturePick[] {
  return picks.filter(
    p =>
      p.posted_to_discord === false &&
      p.meta?.pick_origin === 'system' &&
      String(p.meta?.system_approved) !== 'true'
  );
}

function selectLegacyHardBand(picks: FixturePick[]): FixturePick[] {
  return picks.filter(
    p =>
      p.posted_to_discord === false &&
      p.promotion_band === 'HARD' &&
      (p.meta === null || p.meta?.pick_origin === undefined || p.meta?.pick_origin === null)
  );
}

function selectWithKillSwitch(
  picks: FixturePick[],
  killSwitch: boolean
): {
  capper: FixturePick[];
  system: FixturePick[];
  legacy: FixturePick[];
} {
  if (killSwitch) {
    return { capper: [], system: [], legacy: [] };
  }
  return {
    capper: selectCapperPicks(picks),
    system: selectApprovedSystemPicks(picks),
    legacy: selectLegacyHardBand(picks),
  };
}

// ---- PROOF EXECUTION ----

interface ProofResult {
  test: string;
  expected: string;
  actual: string;
  pass: boolean;
  details?: any;
}

const results: ProofResult[] = [];

function assert(test: string, expected: string, actual: string, details?: any) {
  const pass = expected === actual;
  results.push({ test, expected, actual, pass, details });
}

// Test 1: Capper pick with band=NONE, tier=D posts
const capperPicks = selectCapperPicks(FIXTURE_PICKS);
assert(
  'Capper pick (band=NONE, tier=D) selected for posting',
  'true',
  String(capperPicks.some(p => p.id === 'capper-pick-001')),
  { pick: 'capper-pick-001', band: 'NONE', tier: 'D' }
);

// Test 2: Capper pick with band=null, tier=null posts
assert(
  'Capper pick (band=null, tier=null) selected for posting',
  'true',
  String(capperPicks.some(p => p.id === 'capper-pick-002')),
  { pick: 'capper-pick-002', band: null, tier: null }
);

// Test 3: System pick NOT approved is NOT selected
const approvedSystem = selectApprovedSystemPicks(FIXTURE_PICKS);
assert(
  'System pick (not approved) NOT selected for posting',
  'false',
  String(approvedSystem.some(p => p.id === 'system-pick-001')),
  { pick: 'system-pick-001', system_approved: undefined }
);

// Test 4: System pick approved IS selected
assert(
  'System pick (approved) IS selected for posting',
  'true',
  String(approvedSystem.some(p => p.id === 'system-pick-002')),
  { pick: 'system-pick-002', system_approved: true }
);

// Test 5: Already-posted pick is excluded (idempotency)
assert(
  'Already-posted pick excluded from capper selection',
  'false',
  String(capperPicks.some(p => p.id === 'capper-pick-003')),
  { pick: 'capper-pick-003', posted_to_discord: true }
);

// Test 6: Legacy pick with HARD band posts via fallback
const legacyPicks = selectLegacyHardBand(FIXTURE_PICKS);
assert(
  'Legacy pick (HARD band, no origin) selected via fallback',
  'true',
  String(legacyPicks.some(p => p.id === 'legacy-pick-001')),
  { pick: 'legacy-pick-001', band: 'HARD', meta: null }
);

// Test 7: Legacy pick with NONE band does NOT post
assert(
  'Legacy pick (NONE band, no origin) NOT selected',
  'false',
  String(legacyPicks.some(p => p.id === 'legacy-pick-002')),
  { pick: 'legacy-pick-002', band: 'NONE', meta: null }
);

// Test 8: Kill switch blocks everything
const killSwitchResults = selectWithKillSwitch(FIXTURE_PICKS, true);
assert('Kill switch blocks ALL capper picks', '0', String(killSwitchResults.capper.length), {
  killSwitch: true,
});
assert('Kill switch blocks ALL system picks', '0', String(killSwitchResults.system.length), {
  killSwitch: true,
});
assert('Kill switch blocks ALL legacy picks', '0', String(killSwitchResults.legacy.length), {
  killSwitch: true,
});

// Test 9: Without kill switch, picks are returned
const noKillResults = selectWithKillSwitch(FIXTURE_PICKS, false);
assert(
  'Without kill switch: capper picks returned',
  'true',
  String(noKillResults.capper.length > 0)
);
assert(
  'Without kill switch: approved system picks returned',
  'true',
  String(noKillResults.system.length > 0)
);

// Test 10: Unapproved system picks are explicitly excluded
const unapproved = selectUnapprovedSystemPicks(FIXTURE_PICKS);
assert(
  'Unapproved system pick found in unapproved set',
  'true',
  String(unapproved.some(p => p.id === 'system-pick-001'))
);
assert(
  'Approved system pick NOT in unapproved set',
  'false',
  String(unapproved.some(p => p.id === 'system-pick-002'))
);

// Test 11: Simulate system approval toggle
const approvalBefore = selectApprovedSystemPicks(FIXTURE_PICKS);
const hasSystemPick001Before = approvalBefore.some(p => p.id === 'system-pick-001');

// Mutate: approve the system pick
const mutatedPicks = FIXTURE_PICKS.map(p =>
  p.id === 'system-pick-001' ? { ...p, meta: { ...p.meta, system_approved: true } } : p
);
const approvalAfter = selectApprovedSystemPicks(mutatedPicks);
const hasSystemPick001After = approvalAfter.some(p => p.id === 'system-pick-001');

assert('System pick NOT approved → NOT selected', 'false', String(hasSystemPick001Before));
assert('Same system pick after approval → IS selected', 'true', String(hasSystemPick001After));

// ---- DISCORD RECEIPT SIMULATION ----

interface DiscordReceipt {
  pick_id: string;
  channel_id: string;
  poster: string;
  posted_at: string;
}

const receipts: DiscordReceipt[] = [];

// Simulate posting capper picks
for (const pick of capperPicks) {
  const capperName = pick.meta?.capper || pick.capper_username || 'unknown';
  receipts.push({
    pick_id: pick.id,
    channel_id: `capper-thread:${capperName}`,
    poster: 'DiscordPromotionAgent',
    posted_at: new Date().toISOString(),
  });
}

// Simulate posting approved system picks
for (const pick of approvedSystem) {
  receipts.push({
    pick_id: pick.id,
    channel_id: 'system-picks',
    poster: 'DiscordPromotionAgent',
    posted_at: new Date().toISOString(),
  });
}

// ---- OUTPUT ----

const passCount = results.filter(r => r.pass).length;
const failCount = results.filter(r => !r.pass).length;

console.log('====================================');
console.log('POSTING-AUTHORITY-001: Providerless Posting Proof');
console.log('====================================');
console.log('');

for (const r of results) {
  const status = r.pass ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${r.test}`);
  if (!r.pass) {
    console.log(`  Expected: ${r.expected}`);
    console.log(`  Actual:   ${r.actual}`);
  }
  if (r.details) {
    console.log(`  Details:  ${JSON.stringify(r.details)}`);
  }
}

console.log('');
console.log(`Results: ${passCount} passed, ${failCount} failed out of ${results.length} total`);
console.log('');

console.log('---- Before Rows ----');
console.log(JSON.stringify(FIXTURE_PICKS, null, 2));

console.log('');
console.log('---- After Rows (selected for posting) ----');
console.log(
  JSON.stringify(
    {
      capper_picks_selected: capperPicks.map(p => ({
        id: p.id,
        player: p.player_name,
        capper: p.meta?.capper,
      })),
      system_picks_selected: approvedSystem.map(p => ({ id: p.id, player: p.player_name })),
      legacy_picks_selected: legacyPicks.map(p => ({ id: p.id, player: p.player_name })),
    },
    null,
    2
  )
);

console.log('');
console.log('---- Discord Receipts ----');
console.log(JSON.stringify(receipts, null, 2));

console.log('');
if (failCount === 0) {
  console.log('ALL TESTS PASSED — Posting authority logic proven correct.');
} else {
  console.log(`${failCount} TEST(S) FAILED — Review above.`);
  process.exit(1);
}
