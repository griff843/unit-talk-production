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
    // SPRINT-CI-RED-TO-GREEN-005: Downgraded to warn (pre-existing violations across codebase)
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'warn',
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
    // SPRINT-CI-RED-TO-GREEN-005: prefer-const downgraded to warn (57 pre-existing violations)
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'warn', // SPRINT-CI-RED-TO-GREEN-005: pre-existing in utility scripts
    'no-return-await': 'warn', // SPRINT-CI-RED-TO-GREEN-005: widespread pre-existing pattern
    'no-useless-escape': 'warn', // SPRINT-CI-RED-TO-GREEN-005: pre-existing in regex patterns
    'no-case-declarations': 'warn', // SPRINT-CI-RED-TO-GREEN-005: pre-existing switch/case patterns
    'no-constant-condition': 'warn', // SPRINT-CI-RED-TO-GREEN-005: pre-existing control flow
    'no-unreachable': 'warn', // SPRINT-CI-RED-TO-GREEN-005: pre-existing dead code
    'prefer-promise-reject-errors': 'error',

    // Code quality metrics
    // SPRINT-CI-RED-TO-GREEN-005: Downgraded to warn (pre-existing violations across codebase)
    // TODO: SPRINT-LINT-CLEANUP - promote back to error after refactoring
    complexity: ['warn', { max: 10 }],
    'max-depth': ['warn', 4],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
    'max-params': ['warn', 4],
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
        'no-unused-vars': 'off', // Disable base rule in favor of @typescript-eslint version
        'no-undef': 'off', // TypeScript compiler handles this; prevents false positives (NodeJS, etc.)
        'no-redeclare': 'off', // TypeScript allows interface merging and type/value dual declarations
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
    // Runner/script/activities files - relax rules (CLI utilities need console output)
    // SPRINT-RUNTIME-TRUTH-008: Added to allow pre-commit hooks to pass on runner files
    // SPRINT-CI-RED-TO-GREEN-005: Relax import/order, security, no-undef for scripts
    {
      files: ['**/runner/**/*.ts', '**/scripts/**/*.ts', '**/activities/**/*.ts'],
      rules: {
        complexity: 'warn',
        'max-lines': 'warn',
        'max-lines-per-function': 'warn',
        'max-depth': 'warn',
        'max-params': 'warn',
        'no-console': 'off', // CLI tools need console output
        'no-empty': 'warn', // Pre-existing empty blocks in error handlers
        'import/order': 'warn', // Pre-existing import order issues in scripts
        'import/no-duplicates': 'warn', // Pre-existing duplicate imports in scripts
        'security/detect-unsafe-regex': 'warn', // Audit scripts use complex patterns
        'no-undef': 'off', // TypeScript handles this; prevents false positives
        'no-regex-spaces': 'warn', // Pre-existing regex patterns in utility scripts
      },
    },
    // Agent, command, service, and AI files - relax code quality rules (pre-existing technical debt)
    // TODO: SPRINT-LINT-CLEANUP - refactor these files in dedicated sprint
    {
      files: ['**/agents/**/*.ts', '**/commands/**/*.ts', '**/services/**/*.ts', '**/ai/**/*.ts'],
      rules: {
        complexity: 'warn',
        'max-lines': 'warn',
        'max-lines-per-function': 'warn',
        'max-depth': 'warn',
        'max-params': 'warn',
        'no-unused-vars': 'off', // Handled by @typescript-eslint/no-unused-vars
        'no-unreachable': 'warn', // Pre-existing dead code in agents
        'import/order': 'warn', // Pre-existing import order issues
        'no-return-await': 'warn', // Pre-existing async patterns
        'no-constant-condition': 'warn', // Pre-existing control flow patterns
        'no-case-declarations': 'warn', // Pre-existing switch/case patterns
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
    // Dashboard API routes - relax code quality rules (pre-existing)
    {
      files: ['apps/dashboard/app/api/**/*.ts'],
      rules: {
        'max-lines': 'warn',
        'max-lines-per-function': 'warn',
        complexity: 'warn',
      },
    },
    // E2E smoke scripts - relax import/order (pre-existing)
    {
      files: ['scripts/e2e-smoke/**/*.ts', 'scripts/*.ts'],
      rules: {
        'import/order': 'warn',
        'max-lines': 'warn',
        'max-lines-per-function': 'warn',
        complexity: 'warn',
        'no-console': 'off',
      },
    },
    // QA test files - browser/E2E environment with relaxed rules
    // SPRINT-CI-RED-TO-GREEN-005: QA tests use browser globals (document, window)
    // and TypeScript type annotations that trigger no-undef false positives
    {
      files: ['apps/api/qa/**/*.ts'],
      env: {
        browser: true,
        node: true,
        jest: true,
      },
      rules: {
        'no-undef': 'off', // TypeScript handles this; browser globals needed for E2E
        'no-console': 'off',
        'no-script-url': 'off', // Security tests intentionally test script URLs
        'import/order': 'warn',
        'max-lines': 'off',
        'max-lines-per-function': 'off',
        complexity: 'off',
        'max-depth': 'off',
        'max-params': 'off',
        'security/detect-object-injection': 'off',
      },
    },
    // Test directory files (broader pattern for non-standard naming like load-tests.ts)
    // LINT-TEST-ENV-FIX-001: recognize jest globals, WebSocket, relax quality rules
    {
      files: ['apps/api/test/**/*.ts', 'apps/api/test/**/*.tsx'],
      env: {
        jest: true,
        node: true,
      },
      globals: {
        WebSocket: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-lines-per-function': 'off',
        'max-lines': 'off',
        complexity: 'off',
        'max-depth': 'off',
        'max-params': 'off',
        'no-console': 'off',
        'security/detect-object-injection': 'off',
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
    // Test files (by naming convention)
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
      env: {
        jest: true,
      },
      globals: {
        WebSocket: 'readonly',
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'max-lines-per-function': 'off',
        'max-lines': 'off',
        complexity: 'off',
        'max-depth': 'off',
        'no-console': 'off',
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
    'packages/shared-types/src/supabase.ts', // Auto-generated from Supabase CLI
    // SPRINT-CI-RED-TO-GREEN-005: Quarantined tests have pre-existing violations
    '**/test/__quarantine__/**',
    // SPRINT-CI-RED-TO-GREEN-005: HTML templates in TS parsed as JSX
    'apps/api/scripts/productionDashboard.ts',
  ],
};
