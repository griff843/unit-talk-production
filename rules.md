# Code Quality Rules for Unit Talk Enterprise System

This document defines the code quality rules that must be enforced automatically for the Unit Talk TypeScript system.

## Formatting Rules

1. **Auto-format all TypeScript files** after any edit using Prettier
2. **Auto-format all JSON files** after any edit using Prettier  
3. **Auto-format all Markdown files** after any edit using Prettier
4. **Enforce consistent line endings** (LF) across all text files
5. **Remove trailing whitespace** from all files
6. **Ensure files end with newline** character

## TypeScript Quality Rules

1. **Run type checking** after every TypeScript file edit
2. **Fix auto-fixable ESLint issues** immediately after edit
3. **Enforce strict TypeScript compilation** with no errors
4. **Validate import organization** and fix automatically
5. **Check for unused variables** and warn appropriately
6. **Enforce security rules** for Node.js applications
7. **Validate complexity metrics** (max 10 cyclomatic complexity)
8. **Limit function length** (max 50 lines per function)
9. **Limit file length** (max 300 lines per file)
10. **Enforce proper async/await** usage patterns

## Build and Validation Rules

1. **Validate TypeScript compilation** succeeds without errors
2. **Run ESLint validation** and ensure no errors remain
3. **Check Prettier formatting** is applied correctly
4. **Validate workspace consistency** across monorepo apps
5. **Ensure proper dependency management** in package.json files
6. **Validate import paths** are resolvable and correct

## Security and Best Practices Rules

1. **Scan for security vulnerabilities** in TypeScript code
2. **Prevent dangerous patterns** (eval, Function constructor, etc.)
3. **Enforce proper error handling** patterns
4. **Validate environment variable usage** is secure
5. **Check for hardcoded secrets** or sensitive information
6. **Enforce proper logging practices** (no sensitive data)

## Error Recovery Rules

1. **If TypeScript compilation fails**, attempt automatic fixes where possible
2. **If ESLint errors occur**, run `eslint --fix` and retry compilation
3. **If formatting issues exist**, run Prettier and retry validation
4. **If build errors persist**, provide detailed error information
5. **Maintain file backup** before applying automatic fixes
6. **Log all automatic fixes** for audit purposes

## File-Specific Rules

### TypeScript Files (*.ts, *.tsx)
- Must pass type checking with `tsc --noEmit`
- Must pass ESLint validation with security rules
- Must be formatted with Prettier
- Must have proper import organization

### JSON Files (*.json)
- Must be valid JSON
- Must be formatted with Prettier
- Must follow consistent key ordering where applicable

### Markdown Files (*.md)
- Must be formatted with Prettier
- Must have consistent heading structure
- Must have proper line length (80 chars for prose)

### Configuration Files
- Must be syntactically valid
- Must follow project conventions
- Must be formatted appropriately

## Execution Priority

1. **Format first** - Apply Prettier formatting
2. **Fix linting** - Run ESLint with auto-fix
3. **Type check** - Validate TypeScript compilation
4. **Build validation** - Ensure project builds successfully
5. **Security scan** - Check for security issues
6. **Error reporting** - Provide clear feedback on any remaining issues

## Exceptions and Overrides

1. **Test files** may have relaxed complexity rules
2. **Configuration files** may skip certain TypeScript rules
3. **Generated files** should be excluded from validation
4. **Third-party code** in node_modules is excluded
5. **Build outputs** (dist/, build/, .next/) are excluded

## Success Criteria

A file or change is considered "ready" when:
- All formatting rules pass
- No ESLint errors remain
- TypeScript compilation succeeds
- No security warnings for new code
- Build process completes successfully
- All relevant tests pass