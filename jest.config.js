module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/index.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80,
    },
    // Specific thresholds for standardized agents
    'src/agents/IngestionAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/FinalizerAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/PromoAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/PromotionAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/RecapAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/ReferralAgent/': {
      branches: 75,
      functions: 80,
      lines: 85,
      statements: 85,
    },
    'src/agents/GradingAgent/scoring/': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  
  // Setup files for global mocks
  setupFiles: ['<rootDir>/src/test/setup.ts'],
  
  // Module name mapper for path aliases (if any)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Mock external dependencies
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
  
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  
  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',
  
  // Timeout for tests in milliseconds
  testTimeout: 30000,
  
  // Global setup for temporal workflows testing
  globalSetup: '<rootDir>/src/test/globalSetup.ts',
  globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
  
  // Verbose output for better debugging
  verbose: true,
  
  // Custom reporters for better CI integration
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './test-results',
      outputName: 'junit.xml',
    }],
  ],
  
  // Mocks for specific modules
  moduleNameMapper: {
    '@supabase/supabase-js': '<rootDir>/src/test/mocks/supabaseMock.ts',
    'prom-client': '<rootDir>/src/test/mocks/promClientMock.ts',
    '@temporalio/(.*)': '<rootDir>/src/test/mocks/temporalMock.ts',
  },
};
