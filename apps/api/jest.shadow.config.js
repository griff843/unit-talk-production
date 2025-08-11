/**
 * Jest Configuration for Shadow Mode Tests
 * Focused testing configuration for shadow mode functionality
 */

const baseConfig = require('./jest.config.js');

// Override ts-jest configuration
const tsJestConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
};

module.exports = {
  ...tsJestConfig,
  
  // Focus on shadow mode tests only
  testMatch: [
    '<rootDir>/test/shadow-mode/**/*.test.ts',
    '<rootDir>/test/shadow-mode/**/*.test.js'
  ],
  
  // Shadow mode specific setup
  setupFilesAfterEnv: [
    '<rootDir>/test/shadow-mode/setup.ts'
  ],
  
  // Environment variables for testing
  setupFiles: [
    '<rootDir>/test/shadow-mode/env.setup.js'
  ],
  
  // Coverage configuration for shadow mode
  collectCoverageFrom: [
    'src/shadow/**/*.ts',
    'src/promotion/PublishGuard.ts',
    'src/services/PromotionGatekeeper.ts',
    'src/services/AutoRecheckService.ts',
    'src/services/PickMonitoringService.ts',
    'src/services/RollingMetricsService.ts',
    'src/agents/AlertAgent/integrations/discord.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85
    },
    'src/shadow/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    }
  },
  
  // Shadow mode test environment
  testEnvironment: 'node',
  
  // Longer timeout for integration tests
  testTimeout: 30000,
  
  // Verbose output for shadow mode tests
  verbose: true,
  
  // Display test names
  displayName: 'Shadow Mode Tests'
};