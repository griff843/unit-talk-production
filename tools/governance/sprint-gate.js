#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const roadmapPath = path.resolve(
  process.cwd(),
  'docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md'
);

if (!fs.existsSync(roadmapPath)) {
  console.error('[SPRINT GATE] FAIL: roadmap lock file not found:', roadmapPath);
  process.exit(1);
}

const text = fs.readFileSync(roadmapPath, 'utf8');

const sprintMatches = [...text.matchAll(/###\s+(SPRINT-[0-9A-Z-]+)\s+—\s+(.+)/g)];
if (sprintMatches.length === 0) {
  console.error('[SPRINT GATE] FAIL: no sprint definitions found in roadmap lock file.');
  process.exit(1);
}

const completedSection =
  text.split('## Completed Sprints')[1]?.split('## Next Sprint (LOCKED)')[0] || '';
const nextSection =
  text.split('## Next Sprint (LOCKED)')[1]?.split('## Future Sprint Order (Locked)')[0] || '';

const completed = [...completedSection.matchAll(/###\s+(SPRINT-[0-9A-Z-]+)/g)].map(m => m[1]);
const next = [...nextSection.matchAll(/###\s+(SPRINT-[0-9A-Z-]+)/g)].map(m => m[1])[0];

if (!next) {
  console.error('[SPRINT GATE] FAIL: could not determine locked next sprint.');
  process.exit(1);
}

const requested = process.argv[2];

if (!requested) {
  console.log('[SPRINT GATE] PASS');
  console.log('Completed:', completed.join(', ') || '(none)');
  console.log('Next locked sprint:', next);
  process.exit(0);
}

if (requested !== next) {
  console.error(
    `[SPRINT GATE] FAIL: requested sprint "${requested}" is not the locked next sprint.`
  );
  console.error(`[SPRINT GATE] Allowed next sprint: "${next}"`);
  process.exit(1);
}

console.log(`[SPRINT GATE] PASS: "${requested}" matches locked next sprint.`);
process.exit(0);
