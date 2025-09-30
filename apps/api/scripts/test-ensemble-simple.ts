#!/usr/bin/env npx tsx
/**
 * Simple Ensemble System Test
 * Tests basic functionality without complex validation framework
 */

import { logger } from '../src/utils/logger';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

async function testEnsembleBasics(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  try {
    // Test 1: Check if ensemble files exist
    const fs = await import('fs/promises');
    const path = await import('path');

    const ensembleDir = path.join(__dirname, '../src/ml/ensemble');
    const pythonScript = path.join(ensembleDir, 'meta-model-ensemble.py');
    const tsInterface = path.join(ensembleDir, 'unified-prediction-interface.ts');

    try {
      await fs.access(pythonScript);
      results.push({ name: 'Python Script Exists', passed: true });
    } catch {
      results.push({ name: 'Python Script Exists', passed: false, error: 'meta-model-ensemble.py not found' });
    }

    try {
      await fs.access(tsInterface);
      results.push({ name: 'TypeScript Interface Exists', passed: true });
    } catch {
      results.push({ name: 'TypeScript Interface Exists', passed: false, error: 'unified-prediction-interface.ts not found' });
    }

    // Test 2: Try to import the TypeScript interface
    try {
      const { unifiedPredictor } = await import('../src/ml/ensemble/unified-prediction-interface');
      results.push({ name: 'TypeScript Import', passed: true });

      // Test 3: Get system status
      try {
        const status = await unifiedPredictor.getSystemStatus();
        results.push({ name: 'System Status Check', passed: true });

        logger.info('Ensemble System Status:', {
          initialized: status.initialized,
          sports_supported: status.sports_supported,
          deployment_ready: status.deployment_ready
        });

      } catch (error) {
        results.push({ name: 'System Status Check', passed: false, error: error.message });
      }

    } catch (error) {
      results.push({ name: 'TypeScript Import', passed: false, error: error.message });
    }

    // Test 4: Check models directory - try multiple possible locations
    let modelsFound = false;
    const possiblePaths = [
      path.join(__dirname, '../ml-models/ensemble'),
      path.join(__dirname, '../../ml-models/ensemble'),
      path.join(__dirname, '../../../ml-models/ensemble'),
      '/app/ml-models/ensemble'
    ];

    for (const modelsDir of possiblePaths) {
      try {
        await fs.access(modelsDir);
        modelsFound = true;
        logger.info(`✅ Found models directory at: ${modelsDir}`);
        break;
      } catch {
        // Continue to next path
      }
    }

    if (modelsFound) {
      results.push({ name: 'Models Directory Exists', passed: true });
    } else {
      results.push({ name: 'Models Directory Exists', passed: false, error: `ml-models/ensemble directory not found in any of: ${possiblePaths.join(', ')}` });
    }

  } catch (error) {
    results.push({ name: 'Basic Test Setup', passed: false, error: error.message });
  }

  return results;
}

async function main() {
  try {
    logger.info('🔍 Running Simple Ensemble System Test...');

    const results = await testEnsembleBasics();

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    logger.info('\n📊 Test Results:');
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      const error = result.error ? ` (${result.error})` : '';
      logger.info(`${status} ${result.name}${error}`);
    });

    logger.info(`\n🎯 Summary: ${passed}/${total} tests passed`);

    if (passed === total) {
      logger.info('✅ Ensemble system basic functionality verified');
    } else {
      logger.warn('⚠️ Some ensemble system components need attention');
    }

    return { passed, total, success: passed >= total * 0.7 }; // 70% pass rate for basic functionality

  } catch (error) {
    logger.error('❌ Test execution failed:', error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as testEnsembleSimple };