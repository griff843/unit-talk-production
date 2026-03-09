import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run Vitest-native tests in src/**/__tests__/
    // Jest tests live in test/ and are run via `npm run test`
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'test/**',
      '**/__quarantine__/**',
      'src/runner/**',
      'src/scripts/**',
      'src/**/_archived/**',
    ],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Prevent test isolation issues from process.env mutation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@unit-talk/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
