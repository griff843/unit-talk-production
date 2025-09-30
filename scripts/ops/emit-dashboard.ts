import fs from 'fs';
import path from 'path';

// Collects all JSON artifacts under out/** and emits out/dashboard/index.json

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) acc.push(p);
  }
  return acc;
}

function ensureDir(p: string) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

async function main() {
  const outRoot = path.resolve(process.cwd(), 'out');
  ensureDir(outRoot);
  ensureDir(path.join(outRoot, 'dashboard'));

  const files = fs.existsSync(outRoot) ? walk(outRoot) : [];
  const today = new Date().toISOString().slice(0, 10);

  const index = {
    generatedAt: new Date().toISOString(),
    date: today,
    artifacts: files.map(f => path.relative(process.cwd(), f)).sort(),
  };

  const outPath = path.join(outRoot, 'dashboard', 'index.json');
  fs.writeFileSync(outPath, JSON.stringify(index, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch(err => { console.error(err); process.exitCode = 1; });

