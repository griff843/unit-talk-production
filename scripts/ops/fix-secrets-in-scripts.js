#!/usr/bin/env node

/**
 * Fix Secrets In Scripts
 *
 * Rewrites any lingering hardcoded Supabase URL/keys in known utility scripts
 * to use env variables with fail-fast guards. Designed to be idempotent and
 * safe: only edits if it detects target patterns.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const targets = [
  'apps/smart-form/setup-ncaaf-test-data.js',
  'apps/smart-form/scripts/test-form-submission.js',
  'apps/smart-form/scripts/test-remaining-bet-types.js',
  'apps/command-center/scripts/create-tables-simple.ts',
  'apps/api/scripts/check-schema.ts'
];

function patchContent(p) {
  let src = fs.readFileSync(p, 'utf8');
  let changed = false;

  // Replace supabase url/key lines if present
  const patterns = [
    /const\s+supabaseUrl\s*=\s*'https:\/\/[^']*supabase\.co';?/g,
    /const\s+SUPABASE_URL\s*=\s*'https:\/\/[^']*supabase\.co';?/g,
    /const\s+supabaseKey\s*=\s*'eyJ[^']+';?/g,
    /const\s+SUPABASE_ANON_KEY\s*=\s*'eyJ[^']+';?/g
  ];

  const before = src;
  src = src.replace(patterns[0], "const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;");
  src = src.replace(patterns[1], "const SUPABASE_URL = process.env.SUPABASE_URL as string");
  src = src.replace(patterns[2], "const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;");
  src = src.replace(patterns[3], "const SUPABASE_ANON_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string");

  if (src !== before) {
    changed = true;
  }

  // Ensure fail-fast guard exists (simple heuristic)
  if (!/process\.exit\(1\)/.test(src) && /createClient\(/.test(src)) {
    const guard = "\nif (!supabaseUrl || !supabaseKey) {\n  console.error('Missing Supabase env vars');\n  process.exit(1);\n}\n";
    // Insert guard after first supabaseUrl occurrence
    const idx = src.indexOf('supabaseUrl');
    if (idx !== -1) {
      const beforePart = src.slice(0, idx);
      const afterPart = src.slice(idx);
      src = beforePart + guard + afterPart;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(p, src, 'utf8');
    console.log(`Patched: ${p}`);
  } else {
    console.log(`No changes: ${p}`);
  }
}

(async function main() {
  for (const rel of targets) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      patchContent(p);
    } else {
      console.log(`Missing file (skip): ${rel}`);
    }
  }
})();

