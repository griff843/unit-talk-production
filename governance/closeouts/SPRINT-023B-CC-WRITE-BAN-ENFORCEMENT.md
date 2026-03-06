# SPRINT CLOSEOUT: SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT

**Objective**: Eliminate all Command Center direct writes to canonical tables
and flip the CC write ban gate to fail-closed.

**Date**: 2026-03-04 **Status**: COMPLETE (code verified, gate passing, all
violations eliminated)

---

## What Was Built

### Task 1 — Fix All 12 CC Write Violations

Replaced all direct `.from('unified_picks').insert/update()` calls in Command
Center with API endpoint proxy calls.

**Files fixed:** | File | Violations Fixed | Replacement |
|------|-----------------|-------------| | `hooks/usePicks.ts` | 2 |
`fetch('/api/ops/picks/:id/approve\|reject')` | |
`app/api/exposure/snapshot/route.ts` | 2 |
`fetch('${apiUrl}/ops/picks/:id/reduce-units\|demote')` | |
`app/api/grading/picks/route.ts` | 4 |
`fetch('${apiUrl}/ops/picks/:id/workflow')` | | `lib/supabase.ts` | 4 |
`fetch('${apiUrl}/ops/picks/:id/approve\|reject\|settle-result')` +
`fetch('${apiUrl}/ops/submit')` |

### Task 2 — New API Endpoints

Added 4 new narrow, explicit operator endpoints to `apps/api/src/routes/ops.ts`:

| Endpoint                            | RBAC                     | Purpose                                                     |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `POST /ops/picks/:id/reduce-units`  | admin, analyst, operator | Unit reduction for exposure management                      |
| `POST /ops/picks/:id/demote`        | admin, analyst, operator | Demote pick back to draft                                   |
| `POST /ops/picks/:id/workflow`      | admin, analyst, operator | Workflow stage transitions (regrade/approve/reject/publish) |
| `POST /ops/picks/:id/settle-result` | admin, operator          | Manual settlement result                                    |

All endpoints include:

- JWT authentication via operatorAuth middleware
- Role-based access control via requireOperatorRole
- Full before/after audit_log writes
- Immutable field protection
- Correlation IDs for tracing

### Task 3 — CC Proxy Route

Created `apps/command-center/src/app/api/ops/picks/[id]/[action]/route.ts`:

- Catch-all Next.js API route that proxies pick actions to API service
- Validates action against whitelist
- Forwards Authorization header
- CC remains purely read-only

### Task 4 — Gate Flipped to Fail-Closed

Updated `scripts/gates/cc-write-ban.ts`:

- Removed `--strict` flag and non-blocking mode
- Gate now always exits 1 on any violation (fail-closed)
- Mode displays as "FAIL-CLOSED"

---

## Verification Results

### CC Write Ban Gate

```
COMMAND CENTER WRITE BAN GATE
   Mode: FAIL-CLOSED
   Files scanned: 214
   Violations found: 0

GATE PASSED
```

### Typecheck

- API: clean (0 errors)
- Command Center: clean (0 errors)

### Tests

- 85/85 API tests pass

---

## Invariants Preserved

| Invariant                           | Status                                            |
| ----------------------------------- | ------------------------------------------------- |
| CC is read-only for business tables | Enforced — 0 violations, gate fail-closed         |
| All mutations go through API        | Enforced — 7 operator endpoints with RBAC + audit |
| Audit trail for operator actions    | Enforced — all endpoints write audit_log          |
| RBAC on all write endpoints         | Enforced — operatorAuth + requireOperatorRole     |
| Typecheck                           | All workspaces pass                               |
| Tests                               | 85/85 pass (no regressions)                       |

---

## Files Changed

| File                                                               | Change                              |
| ------------------------------------------------------------------ | ----------------------------------- |
| `apps/api/src/routes/ops.ts`                                       | MODIFIED — 4 new operator endpoints |
| `apps/command-center/src/hooks/usePicks.ts`                        | MODIFIED — DB writes → API calls    |
| `apps/command-center/src/app/api/exposure/snapshot/route.ts`       | MODIFIED — DB writes → API calls    |
| `apps/command-center/src/app/api/grading/picks/route.ts`           | MODIFIED — DB writes → API calls    |
| `apps/command-center/src/lib/supabase.ts`                          | MODIFIED — DB writes → API calls    |
| `apps/command-center/src/app/api/ops/picks/[id]/[action]/route.ts` | NEW — proxy route                   |
| `scripts/gates/cc-write-ban.ts`                                    | MODIFIED — fail-closed              |

---

## Proof Artifacts

```
out/sprints/SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT/2026-03-04/
├── proofs/
│   ├── proof_typecheck.txt
│   ├── proof_tests.txt
│   ├── proof_gate.txt
│   └── proof_git_status.txt
├── CC_WRITE_BAN_BEFORE.md (12 violations)
├── CC_WRITE_BAN_AFTER.md (0 violations)
└── API_CALL_REPLACEMENTS.md (mapping)
```

---

**Governance Owner**: Engineering Team
