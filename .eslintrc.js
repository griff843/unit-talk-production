module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  plugins: ['@typescript-eslint', 'import', 'security'],
  rules: {
    // TypeScript specific rules
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/explicit-function-return-type': 'off', // Too restrictive during development
    '@typescript-eslint/no-explicit-any': 'off', // Allow during migration phase
    // Note: Type-aware rules disabled for now - require project configuration
    // '@typescript-eslint/prefer-nullish-coalescing': 'error',
    // '@typescript-eslint/prefer-optional-chain': 'error',
    // '@typescript-eslint/no-floating-promises': 'error',
    // '@typescript-eslint/await-thenable': 'error',
    // '@typescript-eslint/no-misused-promises': 'error',

    // Import rules
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-unused-modules': 'warn',

    // Security rules
    'security/detect-object-injection': 'warn',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-unsafe-regex': 'error',
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'warn',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-non-literal-require': 'warn',
    'security/detect-possible-timing-attacks': 'warn',
    'security/detect-pseudoRandomBytes': 'error',

    // Best practices
    'prefer-const': 'error',
    'no-var': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-return-await': 'error',
    'prefer-promise-reject-errors': 'error',

    // Fortune 100 standards
    complexity: ['error', { max: 10 }],
    'max-depth': ['error', 4],
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-params': ['error', 4],
  },
  overrides: [
    // TypeScript files
    {
      files: ['**/*.ts', '**/*.tsx'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
      },
      rules: {
        '@typescript-eslint/no-unused-vars': 'warn',
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
    // Frontend apps
    {
      files: ['apps/dashboard/**/*', 'apps/smart-form/**/*', 'apps/command-center/**/*'],
      env: {
        browser: true,
        es6: true,
      },
    },
    // Command Center - relax code quality rules (pre-existing technical debt)
    // TODO: SPRINT-LINT-CLEANUP - address these issues in dedicated sprint
    {
      files: ['apps/command-center/**/*.ts', 'apps/command-center/**/*.tsx'],
      env: {
        browser: true,
        node: true,
      },
      globals: {
        NodeJS: 'readonly',
        React: 'readonly',
      },
      rules: {
        complexity: 'warn',
        'max-lines': 'warn',
        'max-lines-per-function': 'warn',
        'max-depth': 'warn',
        'max-params': 'warn',
        'import/order': 'warn',
        'import/no-duplicates': 'warn', // Pre-existing duplicate imports
        'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
        'no-case-declarations': 'warn', // Pre-existing switch case patterns
        'prefer-const': 'warn', // Pre-existing let declarations
        'no-return-await': 'warn', // Pre-existing async patterns
        'no-alert': 'warn', // Pre-existing browser alerts
        'no-unreachable': 'warn', // Pre-existing dead code
      },
    },
    // Test files
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-lines-per-function': 'off',
      },
    },
    // Configuration files
    {
      files: ['*.config.js', '*.config.ts', '.eslintrc.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'import/no-anonymous-default-export': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.min.js',
    'public/',
    // Generated Supabase types - auto-generated from production schema
    'apps/command-center/src/types/database.ts',
    'apps/command-center/src/types/database-extensions.ts',
  ],
};
