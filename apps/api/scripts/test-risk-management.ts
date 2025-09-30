#!/usr/bin/env npx tsx
/**
 * Risk Management System Test
 * Tests basic functionality and compilation
 */

import { logger } from '../src/utils/logger';

async function testRiskManagement() {
  try {
    logger.info('🔍 Testing Risk Management System...');

    // Test import
    try {
      const riskModule = await import('../src/risk-management/index');
      logger.info('✅ Risk management module imported successfully');

      // Test if main classes exist
      if (riskModule.RiskManagementEngine) {
        logger.info('✅ RiskManagementEngine class found');
      } else {
        logger.warn('⚠️ RiskManagementEngine class not found');
      }

    } catch (error) {
      logger.error('❌ Risk management import failed:', error);
    }

    // Test individual components
    const components = [
      'kelly/KellySizingEngine',
      'correlation/CorrelationManager',
      'metrics/RiskMetricsCalculator',
      'controls/AutomatedRiskControls',
      'portfolio/PortfolioOptimizer'
    ];

    for (const component of components) {
      try {
        await import(`../src/risk-management/${component}`);
        logger.info(`✅ ${component} imported successfully`);
      } catch (error) {
        logger.error(`❌ ${component} import failed:`, error.message);
      }
    }

  } catch (error) {
    logger.error('❌ Risk management test failed:', error);
  }
}

if (require.main === module) {
  testRiskManagement().catch(error => {
    logger.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testRiskManagement };