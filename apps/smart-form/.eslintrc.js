module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'next/core-web-vitals',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  root: true,
  env: {
    browser: true,
    es6: true,
    node: true,
    jest: true,
  },
  globals: {
    React: 'readonly',
    JSX: 'readonly',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  ignorePatterns: [
    '.next/',
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.d.ts',
    'playwright-report/',
    'test-results/',
  ],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for development
    '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions

    // React specific rules
    'react/react-in-jsx-scope': 'off', // Next.js doesn't require React import
    'react/prop-types': 'off', // Using TypeScript for prop validation
    'react/no-unescaped-entities': 'off', // Allow unescaped entities
    'react-hooks/exhaustive-deps': 'off', // Disable exhaustive deps for now

    // General rules
    'no-console': 'off', // Allow console for development
    'no-debugger': 'error',
    'no-unused-vars': 'off', // Use TypeScript version instead
    'prefer-const': 'error',
    'no-var': 'error',

    // Import rules
    'no-duplicate-imports': 'error',

    // Code quality
    eqeqeq: ['error', 'always'],
    curly: 'off', // Relax curly brace requirement
    'no-eval': 'error',
    'no-implied-eval': 'error',

    // Async/await
    'require-await': 'off', // Allow async without await
    'no-return-await': 'error',

    // Error handling
    'no-throw-literal': 'error',

    // Performance
    'no-loop-func': 'error',

    // Security
    'no-script-url': 'error',
  },
  overrides: [
    {
      files: ['*.test.ts', '*.test.tsx', '*.spec.ts', '*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
    {
      files: ['app/api/**/*.ts'],
      rules: {
        'no-console': 'off', // Allow console logs in API routes for debugging
      },
    },
  ],
};
