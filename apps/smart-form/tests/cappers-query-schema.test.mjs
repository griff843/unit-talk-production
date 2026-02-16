/**
 * Unit test: cappers API QuerySchema active param parsing.
 * Run with: node tests/cappers-query-schema.test.mjs
 *
 * Verifies:
 *   missing active  => true  (active cappers by default)
 *   active='true'   => true
 *   active='false'  => false
 *   active=null     => true  (same as missing)
 *   active=undefined=> true  (same as missing)
 */
import { z } from 'zod';
import { strict as assert } from 'node:assert';

// Identical to the schema in app/api/cappers/route.ts line 9-12
const QuerySchema = z.object({
  active: z.string().nullish().transform(val => val == null ? true : val === 'true'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF']).nullish(),
});

const tests = [
  { input: { active: null, sport: null },        expected: true,  label: 'missing active (null) => true' },
  { input: { active: undefined, sport: null },    expected: true,  label: 'missing active (undefined) => true' },
  { input: { active: 'true', sport: null },       expected: true,  label: "active='true' => true" },
  { input: { active: 'false', sport: null },      expected: false, label: "active='false' => false" },
  { input: { sport: null },                       expected: true,  label: 'active key absent => true' },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = QuerySchema.safeParse(t.input);
  if (!result.success) {
    console.error(`FAIL: ${t.label} — parse failed: ${result.error.message}`);
    failed++;
    continue;
  }
  try {
    assert.equal(result.data.active, t.expected);
    console.log(`PASS: ${t.label}`);
    passed++;
  } catch (e) {
    console.error(`FAIL: ${t.label} — got ${result.data.active}, expected ${t.expected}`);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${tests.length} tests`);
process.exit(failed > 0 ? 1 : 0);
