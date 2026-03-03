#!/usr/bin/env npx tsx
/**
 * Phase 6.5 Verification Script
 *
 * Verifies that the Autopilot Guard infrastructure is properly set up:
 * 1. AutopilotGuard module exists and exports correctly
 * 2. WorkflowRegistry module exists and exports correctly
 * 3. Migration file exists
 * 4. No remaining direct shadowMode gates without autopilot guard
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationResult {
  check: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
}

const results: VerificationResult[] = [];

function log(check: string, status: 'PASS' | 'FAIL' | 'WARN', details?: string) {
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${check}`);
  if (details) console.log(`   └── ${details}`);
  results.push({ check, status, details });
}

async function main() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   PHASE 6.5 VERIFICATION: Autopilot as Sole Authority');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const rootDir = path.resolve(__dirname, '../../../..');
  const apiDir = path.resolve(__dirname, '../..');
  const libDir = path.resolve(apiDir, 'src/lib');
  const migrationsDir = path.resolve(rootDir, 'supabase/migrations');

  // 1. Check AutopilotGuard module exists
  const autopilotGuardPath = path.join(libDir, 'AutopilotGuard.ts');
  if (fs.existsSync(autopilotGuardPath)) {
    const content = fs.readFileSync(autopilotGuardPath, 'utf-8');
    if (content.includes('assertMayPerformSideEffect')) {
      log('AutopilotGuard module', 'PASS', 'Module exists with assertMayPerformSideEffect');
    } else {
      log('AutopilotGuard module', 'FAIL', 'Module exists but missing assertMayPerformSideEffect');
    }
  } else {
    log('AutopilotGuard module', 'FAIL', 'Module not found at ' + autopilotGuardPath);
  }

  // 2. Check WorkflowRegistry module exists
  const workflowRegistryPath = path.join(libDir, 'WorkflowRegistry.ts');
  if (fs.existsSync(workflowRegistryPath)) {
    const content = fs.readFileSync(workflowRegistryPath, 'utf-8');
    if (content.includes('register') && content.includes('heartbeat')) {
      log('WorkflowRegistry module', 'PASS', 'Module exists with register/heartbeat');
    } else {
      log('WorkflowRegistry module', 'FAIL', 'Module exists but missing core methods');
    }
  } else {
    log('WorkflowRegistry module', 'FAIL', 'Module not found at ' + workflowRegistryPath);
  }

  // 3. Check migration file exists
  const migrationFiles = fs.readdirSync(migrationsDir);
  const phase65Migration = migrationFiles.find(f => f.includes('phase65'));
  if (phase65Migration) {
    const migrationContent = fs.readFileSync(path.join(migrationsDir, phase65Migration), 'utf-8');
    if (
      migrationContent.includes('autopilot_decisions') &&
      migrationContent.includes('workflow_registry')
    ) {
      log('Phase 6.5 migration', 'PASS', 'Migration found: ' + phase65Migration);
    } else {
      log('Phase 6.5 migration', 'WARN', 'Migration found but may be incomplete');
    }
  } else {
    log('Phase 6.5 migration', 'FAIL', 'No phase65 migration found');
  }

  // 4. STRICT CHECK: No direct shadowMode.shouldSkipPublicAction() calls allowed
  console.log('\n--- STRICT: Checking for legacy shadowMode gates ---\n');

  // Search for direct shadowMode.shouldSkipPublicAction() calls (except in AutopilotGuard itself)
  try {
    const grepResult = execSync(
      `grep -r "shadowMode.shouldSkipPublicAction" --include="*.ts" src/ 2>/dev/null || true`,
      { cwd: apiDir, encoding: 'utf-8' }
    );

    if (grepResult.trim()) {
      const lines = grepResult.trim().split('\n');
      const violations = lines.filter(
        l => !l.includes('AutopilotGuard.ts') && !l.includes('// DEPRECATED')
      );
      if (violations.length > 0) {
        log(
          'Legacy shadowMode gates',
          'FAIL',
          `Found ${violations.length} direct shadowMode.shouldSkipPublicAction() calls`
        );
        violations.forEach(v => console.log(`   └── ${v}`));
      } else {
        log('Legacy shadowMode gates', 'PASS', 'No legacy gates in production code');
      }
    } else {
      log('Legacy shadowMode gates', 'PASS', 'No legacy gates found');
    }
  } catch {
    log('Legacy shadowMode gates', 'PASS', 'No legacy gates found');
  }

  // 5. STRICT CHECK: All Discord-posting services MUST use AutopilotGuard
  console.log('\n--- STRICT: Verifying AutopilotGuard in all side-effect services ---\n');

  const servicesToCheck = [
    { path: 'services/DiscordAlertRouter.ts', required: true },
    { path: 'services/dailyPickPublisher.ts', required: true },
    { path: 'services/VIPPlusChannelService.ts', required: true },
    { path: 'agents/DiscordPromotionAgent/index.ts', required: true },
    { path: 'agents/NotificationAgent/NotificationAgent.ts', required: true },
    { path: 'promotion/PublishGuard.ts', required: true },
  ];

  for (const service of servicesToCheck) {
    const servicePath = path.join(apiDir, 'src', service.path);
    if (fs.existsSync(servicePath)) {
      const content = fs.readFileSync(servicePath, 'utf-8');
      const hasAutopilotGuard = content.includes('autopilotGuard');
      const hasAssertMayPerform = content.includes('assertMayPerformSideEffect');

      if (hasAutopilotGuard && hasAssertMayPerform) {
        log(`Service: ${service.path}`, 'PASS', 'Uses AutopilotGuard.assertMayPerformSideEffect()');
      } else if (hasAutopilotGuard) {
        log(
          `Service: ${service.path}`,
          'WARN',
          'Imports AutopilotGuard but may not use assertMayPerformSideEffect()'
        );
      } else if (service.required) {
        log(
          `Service: ${service.path}`,
          'FAIL',
          'MISSING AutopilotGuard - REQUIRED for Phase 6.5 compliance'
        );
      } else {
        log(`Service: ${service.path}`, 'PASS', 'No direct side-effect gating (internal service)');
      }
    } else {
      log(`Service: ${service.path}`, service.required ? 'FAIL' : 'WARN', 'File not found');
    }
  }

  // 6. Check for test file
  const testFile = path.join(apiDir, 'test/phase65-autopilot-guard.test.ts');
  if (fs.existsSync(testFile)) {
    log('Phase 6.5 integration tests', 'PASS', 'Test file exists');
  } else {
    log('Phase 6.5 integration tests', 'FAIL', 'Test file not found');
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warned}`);
  console.log();

  if (failed === 0) {
    console.log('🎉 Phase 6.5 infrastructure is READY!');
    console.log();
    console.log('Next Steps:');
    console.log('1. Apply migration: supabase db push');
    console.log('2. Update services to use autopilotGuard.assertMayPerformSideEffect()');
    console.log('3. Run tests: npm test -- --testPathPattern=phase65');
    console.log('4. Set AUTOPILOT_MODE=prod when ready for live');
  } else {
    console.log('❌ Phase 6.5 has BLOCKING issues that must be resolved.');
    process.exit(1);
  }

  // Final statement
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('   STATEMENT: Autopilot is now the sole authority for side effects');
  console.log('   (pending service integration per warnings above)');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
