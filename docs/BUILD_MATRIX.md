# Build Matrix

> **Sprint**: SPRINT-SYNDICATE-FOUNDATION-REALIGN-114A
> **Status**: AUTHORITATIVE
> **Last Updated**: 2026-02-22

This document defines the build matrix for all applications in the Unit Talk
Platform. All gates MUST pass before merge.

---

## Build Matrix Overview

| App             | Type-Check | Lint   | Build  | Unit Tests | E2E Tests |
| --------------- | ---------- | ------ | ------ | ---------- | --------- |
| API             | GATE       | GATE   | GATE   | GATE       | Optional  |
| Command Center  | GATE       | GATE   | GATE   | Optional   | Optional  |
| Smart Form      | GATE       | GATE   | GATE   | GATE       | GATE      |
| Dashboard       | GATE       | GATE   | GATE   | Optional   | Optional  |
| Discord Bot     | GATE       | GATE   | GATE   | Optional   | N/A       |

**GATE** = Must pass for merge
**Optional** = Run but don't block merge
**N/A** = Not applicable

---

## Current Status (2026-02-22)

### Type-Check Status

| App             | Status    | Issues                                    |
| --------------- | --------- | ----------------------------------------- |
| API             | PASSING   | -                                         |
| Command Center  | PASSING   | -                                         |
| Smart Form      | PASSING   | -                                         |
| Dashboard       | BYPASSED  | Legacy: `echo` instead of `tsc --noEmit`  |
| Discord Bot     | FAILING   | ~48 errors - DB types out of sync         |

### Build Status

| App             | Status    | Issues                                    |
| --------------- | --------- | ----------------------------------------- |
| API             | PASSING   | `tsc --project tsconfig.prod.json`        |
| Command Center  | PASSING*  | Windows symlink issues (Docker OK)        |
| Smart Form      | PASSING*  | Windows symlink issues (Docker OK)        |
| Dashboard       | UNKNOWN   | Type-check bypassed                       |
| Discord Bot     | FAILING   | Type errors block build                   |

---

## Gate Commands

### Full Matrix

```bash
# Run all gates
pnpm run verify:merge

# Individual gates
pnpm run type-check      # All apps type-check
pnpm run lint            # All apps lint
pnpm run build           # All apps build
pnpm run test            # All apps tests
```

### Per-App Commands

```bash
# API
cd apps/api
pnpm run type-check
pnpm run lint
pnpm run build
pnpm run test

# Command Center
cd apps/command-center
pnpm run type-check
pnpm run lint
pnpm run build

# Smart Form
cd apps/smart-form
pnpm run type-check
pnpm run lint
pnpm run build
pnpm run test

# Dashboard
cd apps/dashboard
pnpm run type-check  # Currently bypassed
pnpm run lint
pnpm run build

# Discord Bot
cd apps/discord-bot
pnpm run type-check  # Currently failing
pnpm run lint
pnpm run build
```

---

## Docker Build Matrix

### Development Builds

```bash
# All services
docker-compose build

# Individual services
docker-compose build api
docker-compose build smart-form
docker-compose build command-center
docker-compose build dashboard
docker-compose build discord-bot
```

### Production Builds

```bash
# Smart Form production
docker build -f apps/smart-form/Dockerfile --target production -t smart-form:prod .

# Command Center production
docker build -f apps/command-center/Dockerfile --target production -t command-center:prod .

# API production
docker build -f apps/api/Dockerfile --target production -t api:prod .
```

---

## CI Pipeline Gates

### Pre-Merge (Required)

1. **Lint Check**
   ```yaml
   - run: pnpm run lint
   ```

2. **Type Check**
   ```yaml
   - run: pnpm run type-check
   ```

3. **Build Check**
   ```yaml
   - run: pnpm run build
   ```

4. **Unit Tests**
   ```yaml
   - run: pnpm run test
   ```

5. **Lifecycle Gate**
   ```yaml
   - run: cd apps/api && pnpm run lifecycle:single-writer -- --strict
   ```

### Post-Merge (Optional)

1. **E2E Tests**
2. **Docker Build Verification**
3. **Staging Deployment**

---

## Known Issues

### Dashboard Type-Check Bypass

**Issue**: Line 10 in `apps/dashboard/package.json` uses `echo` bypass.

**Current**:
```json
"type-check": "echo 'Dashboard type checking temporarily disabled due to legacy integration issues'"
```

**Fix Required**: Enable type-check and fix underlying issues.

**Tracking**: Documented in ARCHITECTURE_REALIGNMENT.md

### Discord Bot Type Errors

**Issue**: ~48 TypeScript errors related to missing database types.

**Root Cause**: Tables like `ab_test_cohorts`, `message_templates`, etc. not in
Supabase schema or types not regenerated.

**Fix Options**:
1. Add missing tables to schema
2. Remove/stub code referencing missing tables
3. Regenerate Supabase types

**Tracking**: Documented in ARCHITECTURE_REALIGNMENT.md

---

## Build Environment Requirements

### Local Development

- Node.js >= 18.0.0
- pnpm >= 10.29.3
- TypeScript 5.x
- Git

### Docker Development

- Docker Engine >= 24.0
- Docker Compose >= 2.0
- 8GB+ RAM for full stack

### CI Environment

- Node.js 20 (LTS)
- pnpm (via corepack)
- Docker (for integration tests)

---

## Regression Guards

To prevent build regressions:

1. **Pre-commit Hook**: Runs `lint-staged` on changed files
2. **CI Gate**: Blocks merge if any GATE fails
3. **Sprint Protocol**: All sprints verify build matrix

### Pre-commit Configuration

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

---

## Monitoring

### Build Health Dashboard

Check build status at: CI/CD pipelines

### Metrics

- Build success rate (target: 100%)
- Build time (target: < 5min for full matrix)
- Type-check coverage (target: 100% apps)

---

## References

- `docs/ENV_CONTRACT.md` - Environment requirements
- `CLAUDE_EXECUTION_CONTRACT.md` - Merge gates
- `.github/workflows/` - CI configuration
