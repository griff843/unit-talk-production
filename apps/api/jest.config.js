/** @type {import('jest').Config} */
module.exports = {
  rootDir: __dirname,
  preset: 'ts-jest',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  detectOpenHandles: false,

  roots: ['<rootDir>/test'],
  testMatch: [
    '<rootDir>/test/contracts/**/*.test.ts',
    '<rootDir>/test/smartform/**/*.test.ts'
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test/(.*)$': '<rootDir>/test/$1'
  },
  moduleDirectories: ['node_modules', 'src'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      useESM: true,
      diagnostics: false,
      isolatedModules: true
    }]
  },
  coverageThreshold: {
    global: {
      branches: 80,    // PRODUCTION STANDARD: 80% coverage
      functions: 80,   // PRODUCTION STANDARD: 80% coverage
      lines: 80,       // PRODUCTION STANDARD: 80% coverage
      statements: 80   // PRODUCTION STANDARD: 80% coverage
    }
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/types/**/*'
  ]
};