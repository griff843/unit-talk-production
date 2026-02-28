// Discord Bot ESLint Config
// Inherits from root config, relaxes rules for pre-existing technical debt
// TODO: SPRINT-LINT-CLEANUP - address these issues in dedicated sprint
module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // Align with root config - use 'warn' instead of 'error' for unused vars
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
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    // Pre-existing technical debt - relax to warnings
    // CI-TRUTH-UNBLOCK-005: Relaxing rules for pre-existing code
    complexity: 'warn',
    'max-lines': 'warn',
    'max-lines-per-function': 'warn',
    'max-depth': 'warn',
    'max-params': 'warn',
    'no-console': 'warn',
    'no-return-await': 'warn',
    'import/order': 'warn',
    'import/no-duplicates': 'warn',
    // Additional pre-existing issues
    '@typescript-eslint/no-var-requires': 'warn',
    'no-case-declarations': 'warn',
    'prefer-const': 'warn',
    'security/detect-unsafe-regex': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/ban-types': 'warn',
  },
  env: {
    node: true,
    es6: true,
  },
};
