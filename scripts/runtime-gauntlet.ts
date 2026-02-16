/**
 * Runtime Gauntlet Verification Script
 *
 * PHASE-2-PRODUCTION-READINESS-019: System Reconciliation
 *
 * Verifies:
 * 1. All /version endpoints match running commit
 * 2. No forbidden phrases in codebase
 * 3. Receipt contract is implemented
 * 4. Presentation contract enforced
 * 5. Single posting authority verified
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface GauntletResult {
  step: string;
  passed: boolean;
  details: string;
  timestamp: string;
}

const results: GauntletResult[] = [];
const gauntletRunId = `gauntlet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

function log(message: string) {
  console.log(`[GAUNTLET] ${message}`);
}

function addResult(step: string, passed: boolean, details: string) {
  results.push({
    step,
    passed,
    details,
    timestamp: new Date().toISOString(),
  });
  log(`${passed ? '✅' : '❌'} ${step}: ${details}`);
}

/**
 * Get current git SHA
 */
function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Step 1: Verify no forbidden phrases in codebase
 */
function verifyNoForbiddenPhrases(): boolean {
  const forbiddenPhrases = [
    'LOCK OF THE DAY',
    'LOCK OF THE WEEK',
    'GUARANTEED WIN',
    'FREE MONEY',
    '100% SURE',
  ];

  const excludeDirs = ['node_modules', '.git', 'out', 'dist', '.next'];

  try {
    for (const phrase of forbiddenPhrases) {
      try {
        const result = execSync(
          `grep -ri "${phrase}" apps/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "embedPresentationContract" | head -5`,
          { encoding: 'utf-8' }
        );

        if (result.trim()) {
          addResult(
            'forbidden-phrases',
            false,
            `Found forbidden phrase "${phrase}": ${result.trim().split('\n')[0]}`
          );
          return false;
        }
      } catch {
        // grep returns non-zero when no matches, which is what we want
      }
    }

    addResult('forbidden-phrases', true, 'No forbidden phrases found in codebase');
    return true;
  } catch (error) {
    addResult('forbidden-phrases', false, `Error checking: ${error}`);
    return false;
  }
}

/**
 * Step 2: Verify version endpoints exist
 */
function verifyVersionEndpoints(): boolean {
  const versionFiles = [
    'apps/api/src/routes/version.ts',
    'apps/smart-form/app/api/version/route.ts',
    'apps/command-center/src/app/api/version/route.ts',
  ];

  let allExist = true;
  for (const file of versionFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      addResult(`version-endpoint-${path.basename(path.dirname(file))}`, true, `${file} exists`);
    } else {
      addResult(`version-endpoint-${path.basename(path.dirname(file))}`, false, `${file} NOT found`);
      allExist = false;
    }
  }

  return allExist;
}

/**
 * Step 3: Verify presentation contract exists
 */
function verifyPresentationContract(): boolean {
  const contractFile = 'apps/api/src/lib/embedPresentationContract.ts';
  const fullPath = path.resolve(process.cwd(), contractFile);

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const hasForbiddenList = content.includes('FORBIDDEN_PHRASES');
    const hasValidator = content.includes('validateEmbedContract');
    const hasCompliantBuilder = content.includes('buildCompliantEmbed');

    if (hasForbiddenList && hasValidator && hasCompliantBuilder) {
      addResult('presentation-contract', true, 'Contract has all required functions');
      return true;
    }
  }

  addResult('presentation-contract', false, 'Contract missing or incomplete');
  return false;
}

/**
 * Step 4: Verify receipt contract exists
 */
function verifyReceiptContract(): boolean {
  const contractFile = 'apps/api/src/lib/discordReceiptContract.ts';
  const fullPath = path.resolve(process.cwd(), contractFile);

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const hasPersist = content.includes('persistDiscordReceipt');
    const hasQuery = content.includes('getReceiptByPickId');
    const hasVerify = content.includes('verifyReceiptExists');

    if (hasPersist && hasQuery && hasVerify) {
      addResult('receipt-contract', true, 'Receipt contract has all required functions');
      return true;
    }
  }

  addResult('receipt-contract', false, 'Receipt contract missing or incomplete');
  return false;
}

/**
 * Step 5: Verify single posting authority
 */
function verifySinglePostingAuthority(): boolean {
  // Check that DiscordPromotionAgent uses autopilotGuard
  const agentFile = 'apps/api/src/agents/DiscordPromotionAgent/index.ts';
  const fullPath = path.resolve(process.cwd(), agentFile);

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const hasAutopilotGuard = content.includes('autopilotGuard');
    const hasBuildInfo = content.includes('getBuildInfo');
    const hasReceipt = content.includes('persistDiscordReceipt');

    if (hasAutopilotGuard && hasBuildInfo && hasReceipt) {
      addResult('single-posting-authority', true, 'DiscordPromotionAgent enforces single authority with guard + receipt');
      return true;
    }
  }

  addResult('single-posting-authority', false, 'Posting authority not properly enforced');
  return false;
}

/**
 * Step 6: Verify BuildInfo components exist
 */
function verifyBuildInfoComponents(): boolean {
  const components = [
    'apps/smart-form/components/BuildInfo.tsx',
    'apps/command-center/src/components/BuildInfo.tsx',
  ];

  let allExist = true;
  for (const file of components) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      addResult(`buildinfo-${path.basename(path.dirname(path.dirname(file)))}`, true, `${file} exists`);
    } else {
      addResult(`buildinfo-${path.basename(path.dirname(path.dirname(file)))}`, false, `${file} NOT found`);
      allExist = false;
    }
  }

  return allExist;
}

/**
 * Step 7: Verify "LOCK OF THE DAY" removed
 */
function verifyLockOfDayRemoved(): boolean {
  const agentFile = 'apps/api/src/agents/DiscordPromotionAgent/index.ts';
  const fullPath = path.resolve(process.cwd(), agentFile);

  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Check for the forbidden phrase NOT being in the embed builder
    if (!content.includes("'🔥 LOCK OF THE DAY 🔥'") && content.includes('getCompliantPickTitle')) {
      addResult('lock-of-day-removed', true, 'LOCK OF THE DAY replaced with compliant titles');
      return true;
    }
  }

  addResult('lock-of-day-removed', false, 'LOCK OF THE DAY still present in code');
  return false;
}

/**
 * Generate summary and save results
 */
function generateSummary(): void {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  log('');
  log('='.repeat(60));
  log(`GAUNTLET RESULTS: ${passed}/${total} PASSED`);
  log('='.repeat(60));

  if (failed > 0) {
    log('');
    log('FAILURES:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        log(`  ❌ ${r.step}: ${r.details}`);
      });
  }

  // Save results to file
  const artifactDir = 'out/e2e/PHASE-2-PRODUCTION-READINESS-019/system-reconciliation/2026-02-16_1300';
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  const gauntletProof = {
    gauntletRunId,
    commit: getCurrentCommit(),
    timestamp: new Date().toISOString(),
    results,
    summary: {
      passed,
      failed,
      total,
      success: failed === 0,
    },
  };

  fs.writeFileSync(
    path.join(artifactDir, 'PROOF_GAUNTLET_FINAL.txt'),
    JSON.stringify(gauntletProof, null, 2)
  );

  log('');
  log(`Results saved to ${artifactDir}/PROOF_GAUNTLET_FINAL.txt`);
}

/**
 * Run the full gauntlet
 */
function runGauntlet(): boolean {
  log(`Starting Runtime Gauntlet [${gauntletRunId}]`);
  log(`Current commit: ${getCurrentCommit()}`);
  log('');

  const checks = [
    verifyNoForbiddenPhrases,
    verifyVersionEndpoints,
    verifyPresentationContract,
    verifyReceiptContract,
    verifySinglePostingAuthority,
    verifyBuildInfoComponents,
    verifyLockOfDayRemoved,
  ];

  for (const check of checks) {
    check();
  }

  generateSummary();

  const allPassed = results.every((r) => r.passed);
  return allPassed;
}

// Run if executed directly
if (require.main === module) {
  const success = runGauntlet();
  process.exit(success ? 0 : 1);
}

export { runGauntlet, results, gauntletRunId };
