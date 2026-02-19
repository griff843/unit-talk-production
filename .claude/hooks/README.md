# Claude Code Hooks

This directory contains hooks that can be triggered during Claude Code operations.

## Available Hook Points

| Hook | Trigger | Purpose |
|------|---------|---------|
| `pre-commit.sh` | Before git commit | Validate changes |
| `post-sprint.sh` | After sprint closeout | Cleanup, notifications |
| `pre-migration.sh` | Before migration apply | Safety check |

## Hook Format

Hooks are shell scripts that receive context via environment variables:

```bash
#!/bin/bash
# Hook: pre-commit

# Available variables:
# $CLAUDE_SPRINT - Current sprint name
# $CLAUDE_FILES - Files being committed
# $CLAUDE_MESSAGE - Commit message

# Return 0 to proceed, non-zero to abort
exit 0
```

## Creating a Hook

1. Create script in this directory
2. Make executable: `chmod +x <hook>.sh`
3. Reference in `settings.local.json`

## Example: Pre-Commit Hook

```bash
#!/bin/bash
# .claude/hooks/pre-commit.sh

# Run lifecycle gate before commit
cd apps/api && npm run lifecycle:single-writer -- --strict

if [ $? -ne 0 ]; then
  echo "ERROR: Lifecycle gate failed. Commit blocked."
  exit 1
fi

exit 0
```

## Current Status

No hooks are currently active. This is a placeholder for future hook implementations.
