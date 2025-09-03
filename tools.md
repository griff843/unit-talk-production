# Tools Available in Claude Code

This document lists all the tools and hooks available in Claude Code for maintaining code quality and automation.

## Core Tools

### Prettier
- **Purpose**: Code formatting and style enforcement
- **Command**: `prettier --write <files>`
- **File Types**: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.yml`, `.yaml`
- **Configuration**: `.prettierrc` (root level)

### ESLint
- **Purpose**: Code linting, quality checks, and error detection
- **Command**: `eslint --fix <files>`
- **File Types**: `.ts`, `.tsx`, `.js`, `.jsx`
- **Configuration**: `.eslintrc.js` (root level with workspace support)

### TypeScript Compiler (tsc)
- **Purpose**: Type checking and compilation validation
- **Command**: `tsc --noEmit` (type checking only)
- **Command**: `tsc --project <tsconfig>` (for specific projects)
- **File Types**: `.ts`, `.tsx`
- **Configuration**: `tsconfig.json` files per workspace

## Available Hooks in Claude Code

### File Change Hooks
- **`post-file-edit`**: Triggered after any file is edited
- **`post-file-create`**: Triggered after any file is created
- **`post-file-write`**: Triggered after any file is written

### Tool Execution Hooks  
- **`pre-tool-use`**: Triggered before any tool is used
- **`post-tool-use`**: Triggered after any tool is used
- **`tool-error`**: Triggered when a tool encounters an error

### Session Hooks
- **`session-start`**: Triggered when Claude Code starts
- **`session-end`**: Triggered when Claude Code ends

## File Pattern Matching

Hooks support glob patterns for file matching:
- `**/*.ts` - All TypeScript files
- `**/*.tsx` - All TypeScript React files  
- `**/*.{ts,tsx}` - All TypeScript files
- `apps/**/*` - All files in apps directory
- `src/**/*.ts` - All TypeScript files in src directories

## Command Execution

All tools can be executed with:
- Working directory context
- Environment variables
- Conditional execution based on file types
- Error handling and retry logic
- Output capture and logging

## Integration Features

- **Workspace Support**: Commands can target specific workspaces
- **Parallel Execution**: Multiple commands can run simultaneously
- **Conditional Logic**: Hooks can include conditions for execution
- **Error Recovery**: Failed commands can trigger corrective actions
- **Build Validation**: Integration with build systems and CI/CD