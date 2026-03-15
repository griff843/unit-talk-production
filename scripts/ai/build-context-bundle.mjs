#!/usr/bin/env node
/**
 * build-context-bundle.mjs
 *
 * Orchestrates all AI context generation scripts and assembles a ChatGPT-ready
 * context bundle. This is the primary entrypoint — run via `pnpm ai:context`.
 *
 * Pipeline:
 *   1. repo-intelligence-snapshot.mjs → repo_snapshot.json
 *   2. generate-repo-map.mjs          → repo_map.md
 *   3. (optional) export-command-center-state.mjs → command_center_snapshot.json
 *   4. Reads status docs (SYSTEM_BRAIN.md, NEXT_5_SPRINTS.md, DRIFT_REPORT.md)
 *   5. Assembles context_bundle.json (machine-readable) + context_bundle.md (paste-ready)
 *
 * Output:
 *   out/ai/context/context_bundle.json
 *   out/ai/context/context_bundle.md
 *
 * Usage:
 *   pnpm ai:context
 *   node scripts/ai/build-context-bundle.mjs
 *   API_BASE_URL=http://localhost:3001 OPERATOR_TOKEN=xxx pnpm ai:context
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CONTEXT_DIR = join(ROOT, 'out', 'ai', 'context');
const SNAPSHOT_DIR = join(ROOT, 'out', 'ai', 'snapshots');
const SCRIPTS_DIR = join(__dirname);

// Max characters per section in the markdown bundle (ChatGPT context cap)
const MAX_SECTION_CHARS = 4000;

function truncate(text, max = MAX_SECTION_CHARS) {
  if (text.length <= max) return text;
  return text.slice(0, max) + `\n\n... [truncated — ${text.length - max} chars omitted]`;
}

function runScript(scriptPath, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [scriptPath], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${scriptPath} exited ${code}: ${stderr}`));
    });
  });
}

async function readStatusDoc(relPath, maxChars = MAX_SECTION_CHARS) {
  try {
    const content = await readFile(join(ROOT, relPath), 'utf-8');
    return truncate(content, maxChars);
  } catch {
    return `[not found: ${relPath}]`;
  }
}

async function readJSON(path) {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function main() {
  await mkdir(CONTEXT_DIR, { recursive: true });
  await mkdir(SNAPSHOT_DIR, { recursive: true });

  console.log('=== Unit Talk Context Bundle Generator ===');
  console.log('');

  // Step 1: Generate repo snapshot
  console.log('Step 1/4 — Generating repo intelligence snapshot...');
  try {
    const out = await runScript(join(SCRIPTS_DIR, 'repo-intelligence-snapshot.mjs'));
    process.stdout.write(out);
  } catch (err) {
    console.error('  ⚠️  repo-intelligence-snapshot failed:', err.message);
  }

  // Step 2: Generate repo map
  console.log('Step 2/4 — Generating repo map...');
  try {
    const out = await runScript(join(SCRIPTS_DIR, 'generate-repo-map.mjs'));
    process.stdout.write(out);
  } catch (err) {
    console.error('  ⚠️  generate-repo-map failed:', err.message);
  }

  // Step 3: Export command center state (optional — requires API_BASE_URL)
  if (process.env.API_BASE_URL) {
    console.log('Step 3/4 — Exporting command center state...');
    try {
      const out = await runScript(join(SCRIPTS_DIR, 'export-command-center-state.mjs'));
      process.stdout.write(out);
    } catch (err) {
      console.warn('  ⚠️  export-command-center-state failed (skipping):', err.message);
    }
  } else {
    console.log('Step 3/4 — Skipping command center state (API_BASE_URL not set)');
  }

  // Step 4: Assemble context bundle
  console.log('Step 4/4 — Assembling context bundle...');

  const repoSnapshot = await readJSON(join(SNAPSHOT_DIR, 'repo_snapshot.json'));
  const repoMap = await readStatusDoc('out/ai/snapshots/repo_map.md', 6000);
  const systemBrain = await readStatusDoc('docs/system/UNIT_TALK_SYSTEM_BRAIN.md', 6000);
  const nextSprints = await readStatusDoc('docs/status/NEXT_5_SPRINTS.md', 3000);
  const driftReport = await readStatusDoc('docs/status/DRIFT_REPORT.md', 2000);
  const commandCenter = await readJSON(join(SNAPSHOT_DIR, 'command_center_snapshot.json'));

  // Machine-readable bundle
  const jsonBundle = {
    generated_at: new Date().toISOString(),
    instructions: 'Paste context_bundle.md into ChatGPT before asking questions about Unit Talk. This JSON version is for programmatic use.',
    sections: {
      system_brain: systemBrain,
      repo_map: repoMap,
      sprint_queue: nextSprints,
      drift_report: driftReport,
      repo_snapshot: repoSnapshot,
      command_center_snapshot: commandCenter,
    },
  };

  // Human-readable / paste-ready markdown bundle
  const mdParts = [];
  mdParts.push('# Unit Talk — AI Context Bundle');
  mdParts.push('');
  mdParts.push(`> Generated: ${new Date().toISOString()}`);
  mdParts.push('> Paste this entire document into ChatGPT before asking questions about Unit Talk.');
  mdParts.push('> This bundle covers platform architecture, current sprint state, and key invariants.');
  mdParts.push('');
  mdParts.push('---');
  mdParts.push('');

  mdParts.push('## 1. Platform Overview');
  mdParts.push('');
  mdParts.push(systemBrain);
  mdParts.push('');
  mdParts.push('---');
  mdParts.push('');

  mdParts.push('## 2. Repository Map');
  mdParts.push('');
  mdParts.push(repoMap);
  mdParts.push('');
  mdParts.push('---');
  mdParts.push('');

  mdParts.push('## 3. Sprint Queue');
  mdParts.push('');
  mdParts.push(nextSprints);
  mdParts.push('');
  mdParts.push('---');
  mdParts.push('');

  mdParts.push('## 4. Drift Report');
  mdParts.push('');
  mdParts.push(driftReport);
  mdParts.push('');
  mdParts.push('---');
  mdParts.push('');

  if (repoSnapshot) {
    mdParts.push('## 5. Intelligence Snapshot');
    mdParts.push('');
    mdParts.push('```json');
    mdParts.push(JSON.stringify({
      generated_at: repoSnapshot.generated_at,
      layer_phase: repoSnapshot.layer_phase,
      mcp_layer: repoSnapshot.mcp_layer,
      claude_os: repoSnapshot.claude_os,
      drift_summary: repoSnapshot.drift_summary,
      sprint_queue: repoSnapshot.sprint_queue?.slice(0, 3),
    }, null, 2));
    mdParts.push('```');
    mdParts.push('');
    mdParts.push('---');
    mdParts.push('');
  }

  if (commandCenter) {
    mdParts.push('## 6. Live Platform State');
    mdParts.push('');
    if (commandCenter.platform_health) {
      const h = commandCenter.platform_health;
      mdParts.push(`**Platform Status**: ${h.platform_status ?? 'unknown'}`);
      mdParts.push(`**SLO Breaches**: ${h.slo_breaches ?? 'unknown'} | **SLO Warns**: ${h.slo_warns ?? 'unknown'}`);
      if (h.subsystems?.length) {
        mdParts.push('');
        mdParts.push('| Subsystem | Status |');
        mdParts.push('| --------- | ------ |');
        for (const sub of h.subsystems) {
          mdParts.push(`| ${sub.name} | ${sub.status} |`);
        }
      }
    }
    mdParts.push('');
    if (commandCenter.slo_status && !commandCenter.slo_status.skipped && !commandCenter.slo_status.error) {
      const s = commandCenter.slo_status;
      mdParts.push(`**SLO Window**: ${s.window_days ?? '?'}d | **Computed**: ${s.computed_at ?? 'unknown'}`);
      if (s.slos?.length) {
        mdParts.push('');
        mdParts.push('| SLO | Target | Actual | Status |');
        mdParts.push('| --- | ------ | ------ | ------ |');
        for (const slo of s.slos) {
          const target = slo.target != null ? `${(slo.target * 100).toFixed(1)}%` : '—';
          const actual = slo.attainment != null ? `${(slo.attainment * 100).toFixed(1)}%` : '—';
          mdParts.push(`| ${slo.name} | ${target} | ${actual} | ${slo.status} |`);
        }
      }
    } else if (commandCenter.slo_status?.skipped) {
      mdParts.push('*SLO data not available — OPERATOR_TOKEN not set.*');
    }
    mdParts.push('');
    mdParts.push('---');
    mdParts.push('');
  }

  mdParts.push('## Instructions for ChatGPT');
  mdParts.push('');
  mdParts.push('You are reviewing the Unit Talk sports betting intelligence platform. Use the context above to:');
  mdParts.push('- Understand the architecture before making recommendations');
  mdParts.push('- Reference specific files and packages by path');
  mdParts.push('- Respect the single-writer discipline for `unified_picks`');
  mdParts.push('- Never suggest bypassing lifecycle adapters');
  mdParts.push('- Use the Layer/Phase model for sprint classification');
  mdParts.push('- For live diagnostics, recommend Claude MCP skills (`/pipeline-health`, `/pick-trace`, etc.)');
  mdParts.push('');

  const mdBundle = mdParts.join('\n');

  // Write outputs
  const jsonPath = join(CONTEXT_DIR, 'context_bundle.json');
  const mdPath = join(CONTEXT_DIR, 'context_bundle.md');

  await writeFile(jsonPath, JSON.stringify(jsonBundle, null, 2), 'utf-8');
  await writeFile(mdPath, mdBundle, 'utf-8');

  console.log('');
  console.log('=== Context Bundle Complete ===');
  console.log(`  JSON: ${relative(ROOT, jsonPath)}`);
  console.log(`  Markdown: ${relative(ROOT, mdPath)}`);
  console.log(`  Bundle size: ${(mdBundle.length / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('Paste out/ai/context/context_bundle.md into ChatGPT to ground it with Unit Talk context.');
}

main().catch((err) => {
  console.error('❌ build-context-bundle failed:', err.message);
  process.exit(1);
});
