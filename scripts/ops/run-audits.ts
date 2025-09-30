import path from 'path';

async function main() {
  // Run all audits sequentially so their JSON artifacts are written under out/db/**
  const scripts = [
    'verify-shape.ts',
    'rls-audit.ts',
    'index-audit.ts',
    'fk-audit.ts',
    'dup-audit.ts',
    'view-exists-audit.ts',
    'matview-refresh.ts',
    'provider-truth.ts'
  ];

  for (const s of scripts) {
    const modPath = path.resolve(process.cwd(), 'scripts/ops', s);
    const mod = await import(modPath);
    // Each script runs on import via top-level main(); nothing else to do
  }
}

main().catch(err => { console.error('run-audits failed', err); process.exitCode = 1; });

