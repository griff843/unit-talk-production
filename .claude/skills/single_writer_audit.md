# Skill: Single-Writer Audit

> Model tier: **Sonnet** — pattern scanning, violation classification

## Purpose

Audit codebase for single-writer violations and ensure lifecycle adapter
compliance.

## Invocation

```
/single-writer-audit [scope]
```

Scope: `all` (default), `staged`, `<path>`

## Procedure

### Step 1: Quick Pattern Search

Find potential violations:

```bash
# Search for direct unified_picks writes
rg "\.from\s*\(\s*['\"]unified_picks['\"]\s*\)\s*\.\s*(insert|update|upsert|delete)" apps/api/src --type ts -n
```

### Step 2: Filter Results

Allowed locations (not violations):

- `apps/api/src/lib/lifecycle/**` - The adapters themselves
- `**/*.test.ts`, `**/*.spec.ts` - Test files
- `scripts/smoke-*` - Smoke test utilities
- `runner/fix*` - Development utilities

### Step 3: Run Lifecycle Gate

```bash
cd apps/api && npm run lifecycle:single-writer -- --strict
```

Expected output:

```
🔍 SINGLE-WRITER GATE
   Scanning: apps/api/src
   Mode: STRICT

📊 Results:
   Files scanned: XXX
   Violations found: 0
   Allowlisted files: 0

✅ GATE PASSED
```

### Step 4: Verify Allowlist Empty

```bash
cat apps/api/src/lib/lifecycle/single-writer-allowlist.ts
```

Expected: `SINGLE_WRITER_ALLOWLIST` array is empty.

### Step 5: Generate Report

```markdown
# Single-Writer Audit Report

**Date**: <date> **Scope**: <audited scope>

## Gate Status

| Metric        | Value     |
| ------------- | --------- |
| Files Scanned | XXX       |
| Violations    | 0         |
| Allowlisted   | 0         |
| Gate Status   | ✅ PASSED |

## Authorized Write Paths

All `unified_picks` writes use lifecycle adapters:

| Adapter            | Location                       | Writer Role |
| ------------------ | ------------------------------ | ----------- |
| lifecycleInsert    | SmartFormBridge.ts             | submitter   |
| lifecycleInsert    | gradeAndPromoteFinalPicks.ts   | promoter    |
| atomicClaimForPost | DiscordPromotionAgent/index.ts | poster      |
| lifecycleUpdate    | DiscordPromotionAgent/index.ts | poster      |
| lifecycleSettle    | SettlementAgent/index.ts       | settler     |

## Violations Found

None.

## Audit Status: ✅ CLEAN
```

## Violation Response

If violations found:

### 1. Identify Violation

```
File: apps/api/src/path/to/file.ts
Line: 42
Pattern: .from('unified_picks').insert(...)
```

### 2. Required Fix

Replace direct write with lifecycle adapter:

```typescript
// BEFORE (violation)
await supabase.from('unified_picks').insert(pick);

// AFTER (compliant)
import { lifecycleInsert } from '../lib/lifecycle';
await lifecycleInsert(supabase, pick, { writerRole: '<role>' });
```

### 3. Writer Role Selection

| Operation           | Role              | Adapter                             |
| ------------------- | ----------------- | ----------------------------------- |
| New pick submission | submitter         | lifecycleInsert                     |
| Promotion/grading   | promoter          | lifecycleInsert/Update              |
| Discord posting     | poster            | atomicClaimForPost, lifecycleUpdate |
| Settlement          | settler           | lifecycleSettle                     |
| Emergency fix       | operator_override | lifecycleUpdate                     |

### 4. Re-audit

After fix, re-run audit to confirm clean.

## Zero Tolerance

- **No bypasses** without operator_override
- **No allowlist entries** in production code
- **All PRs blocked** until gate passes
