#!/usr/bin/env node
/**
 * check-dev-env.ts
 * Sprint: RELEASE-READINESS-ENV-NORMALIZATION-042
 *
 * Preflight check for development environment.
 * Detects problematic paths (OneDrive, Dropbox, etc.) that cause
 * symlink/readlink errors with Next.js builds on Windows.
 *
 * Usage:
 *   npx tsx scripts/check-dev-env.ts
 *
 * Behavior:
 *   - In CI (CI=true): Exits with code 1 if problematic path detected
 *   - In dev mode: Prints warning but continues (exit 0)
 */

const PROBLEMATIC_PATHS = [
  'OneDrive',
  'Dropbox',
  'Google Drive',
  'iCloud',
  'Box Sync',
];

const RECOMMENDED_PATHS = {
  windows: 'C:\\dev\\unit-talk-production',
  mac: '~/dev/unit-talk-production',
  linux: '~/dev/unit-talk-production',
};

function detectProblematicPath(cwd: string): string | null {
  const normalizedPath = cwd.toLowerCase().replace(/\\/g, '/');

  for (const problematic of PROBLEMATIC_PATHS) {
    if (normalizedPath.includes(problematic.toLowerCase())) {
      return problematic;
    }
  }

  return null;
}

function getPlatform(): 'windows' | 'mac' | 'linux' {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'mac';
    default:
      return 'linux';
  }
}

function printWarning(problematicPath: string, cwd: string): void {
  const platform = getPlatform();
  const recommended = RECOMMENDED_PATHS[platform];

  console.log('\n' + '='.repeat(70));
  console.log('⚠️  DEVELOPMENT ENVIRONMENT WARNING');
  console.log('='.repeat(70));
  console.log('');
  console.log(`  Detected: Repository is inside ${problematicPath}`);
  console.log(`  Path:     ${cwd}`);
  console.log('');
  console.log('  ISSUE:');
  console.log('    Next.js builds fail on Windows when the project is inside');
  console.log('    cloud-synced folders due to symlink/readlink EINVAL errors.');
  console.log('    The .next build cache uses symlinks that cloud sync breaks.');
  console.log('');
  console.log('  SOLUTION:');
  console.log('    Move the repository to a local path outside cloud sync:');
  console.log(`    Recommended: ${recommended}`);
  console.log('');
  console.log('  WORKAROUND:');
  console.log('    If you must work from this location, delete .next folders');
  console.log('    before each build:');
  console.log('      rm -rf apps/command-center/.next apps/smart-form/.next');
  console.log('');
  console.log('='.repeat(70) + '\n');
}

function main(): void {
  const cwd = process.cwd();
  const isCI = process.env.CI === 'true';
  const problematicPath = detectProblematicPath(cwd);

  if (problematicPath) {
    printWarning(problematicPath, cwd);

    if (isCI) {
      console.error('ERROR: CI build blocked due to problematic path.');
      console.error('       Please run builds from a non-cloud-synced location.');
      process.exit(1);
    } else {
      console.log('Continuing despite warning (dev mode)...\n');
      process.exit(0);
    }
  } else {
    // Clean environment
    if (process.argv.includes('--verbose')) {
      console.log('✅ Development environment check passed');
      console.log(`   Path: ${cwd}`);
    }
    process.exit(0);
  }
}

main();
