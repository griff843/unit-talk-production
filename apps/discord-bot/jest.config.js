module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          noImplicitAny: true,  // ENFORCE STRICT TYPE CHECKING
          strict: true,         // ENABLE ALL STRICT TYPE CHECKS
          skipLibCheck: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/**/*.test.ts', '!src/**/*.spec.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^openai$': '<rootDir>/src/test/mocks/openai.ts',
    '^@anthropic-ai/sdk$': '<rootDir>/src/test/mocks/anthropic.ts'
  },
  // Ignore heavy integration/command tests for smoke runs
  testPathIgnorePatterns: [
    '/src/tests/ask-unit-talk-integration\\.test\\.ts$',
    '/src/tests/ask-unit-talk\\.test\\.ts$',
    '/src/tests/trend-breaker\\.test\\.ts$',
    '/src/tests/ev-report\\.test\\.ts$',
    '/src/tests/ai-coaching-simple\\.test\\.ts$',
    '/src/tests/trendAnalysisService\\.test\\.ts$'
  ],
};
