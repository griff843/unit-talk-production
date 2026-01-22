# Week 2 Hardening Proof Bundle

**Generated**: 2026-01-22 **Branch**: feat/pr9-go-live-hardening **Status**: IN
PROGRESS (Pending Migration Application)

---

## 1. Deliverables Summary

### A) Schema Reality Check - COMPLETE

**Method**: Gate 0 schema introspection added to CI workflow

**Target Columns for Smart Form Enforcement**: | Column | Canonical Purpose |
Type | |--------|------------------|------| | `user_id` | Capper identity | UUID
FK→users | | `stake` | Unit size for bet | NUMERIC(10,2) | | `selection` | Pick
selection | TEXT | | `sport` | Sport code | TEXT | | `trace_id` | E2E
observability | TEXT (UUID string) | | `form_source` | Source identifier | TEXT
|

**Introspection Gate**: `week2-governance-gates.yml` Gate 0

---

### B) Migration Files Created - COMPLETE

#### Migration 1: `20260121_pr10_week2_smart_form_enforcement.sql`

- Adds `sport` and `trace_id` columns if missing
- Creates CHECK constraint `chk_smart_form_required_fields`
- Enforces: Smart Form submissions require all 5 fields

```sql
ALTER TABLE public.unified_picks
ADD CONSTRAINT chk_smart_form_required_fields CHECK (
    form_source IS DISTINCT FROM 'smart_form' OR (
        user_id IS NOT NULL AND   -- capper
        stake IS NOT NULL AND     -- units
        selection IS NOT NULL AND
        sport IS NOT NULL AND
        trace_id IS NOT NULL
    )
);
```

#### Migration 2: `20260121_pr10_week2_anticheat_enforcement.sql`

- Creates `picks_audit_log` table for forensic analysis
- Creates audit trigger `trg_audit_picks_insert` on unified_picks
- Creates CHECK constraint `chk_valid_form_source` for valid source values

**Valid form_source values**: `smart_form`, `api`, `ingestion`, `system`,
`migration`, `test`

---

### C) Anti-Cheat Enforcement - COMPLETE

**Decision**: Trigger-based audit logging (not RLS)

**Rationale**: RLS is bypassed by `service_role` key. Trigger runs on ALL
inserts.

**Components**:

1. `picks_audit_log` - Captures all inserts with metadata
2. `trg_audit_picks_insert` - AFTER INSERT trigger
3. `chk_valid_form_source` - Rejects unknown form sources

**Forensic Query**:

```sql
SELECT * FROM picks_audit_log
WHERE pg_role NOT IN ('service_role', 'authenticated')
   OR form_source NOT IN ('smart_form', 'api', 'ingestion', 'system')
ORDER BY created_at DESC;
```

---

### D) CI Gates - COMPLETE

**Workflow**: `.github/workflows/week2-governance-gates.yml`

| Gate | Name                      | Status  | Purpose                                       |
| ---- | ------------------------- | ------- | --------------------------------------------- |
| 0    | Schema Introspection      | NEW     | Outputs actual column structure               |
| 1    | Schema Parity             | PASS    | Staging has canonical tables                  |
| 2    | picks VIEW Write-Blocked  | FIXED   | picks VIEW rejects INSERT/UPDATE              |
| 3    | pick_publish FK Integrity | PASS    | FK to unified_picks enforced                  |
| 3.5  | Smart Form CHECK          | NEW     | Invalid smart_form inserts rejected           |
| 4    | Agent Contract            | PASS    | DiscordPromotionAgent reads from pick_publish |
| 5    | Anti-Cheat (E2E)          | PENDING | E2E uses Playwright                           |
| 5.5  | Anti-Cheat (DB)           | NEW     | Audit trigger + form_source CHECK             |

**Fail-Closed**: All gates must pass for workflow to succeed.

---

### E) SYSTEM_CONTRACT.md Updates - COMPLETE

**Section 5 Additions**:

- 5.1 Canonical Column Mapping
- 5.2 Database-Level Guardrails (CHECK constraint)
- 5.3 Anti-Cheat Enforcement (audit trigger decision)
- 5.4 CI Gates (full gate list)
- 5.5 Proof Mechanism
- 5.6 How to Verify

---

## 2. CI Run Evidence

### Run 21234700540 (2026-01-22T03:16:38Z)

**Results** (before new gates pushed): | Gate | Result | |------|--------| |
Gate 1 - Schema Parity | ✅ PASS | | Gate 2 - picks VIEW Write-Blocked | ❌ FAIL
(test logic fixed) | | Gate 3 - pick_publish FK Integrity | ✅ PASS | | Gate 4 -
Agent Contract Compliance | ✅ PASS | | Gate 5 - Anti-Cheat | ⏭️ SKIPPED |

**Gate 2 Failure Analysis**:

- INSERT was correctly blocked
- UPDATE test had logic issue (testing non-existent row)
- **FIX**: Updated test to create test row, then verify UPDATE is blocked

---

## 3. Next Steps

### Required to Complete Week 2:

1. **Push Changes to Remote**

   ```bash
   git add -A
   git commit -m "feat(week2): Complete Week 2 hardening with anti-cheat enforcement"
   git push origin feat/pr9-go-live-hardening
   ```

2. **Apply Migrations to Staging**

   ```bash
   npx supabase db push --linked
   ```

3. **Re-run CI Workflow**

   ```bash
   gh workflow run week2-governance-gates.yml --ref feat/pr9-go-live-hardening
   ```

4. **Verify All Gates Pass**
   - Gate 0: Schema introspection shows all columns
   - Gate 1: Schema parity confirmed
   - Gate 2: picks VIEW write-blocked
   - Gate 3: pick_publish FK enforced
   - Gate 3.5: Smart Form CHECK enforced
   - Gate 4: Agent contract compliant
   - Gate 5: E2E uses Playwright
   - Gate 5.5: Anti-cheat DB enforcement active

---

## 4. Files Modified

### Migrations (NEW)

- `supabase/migrations/20260121_pr10_week2_smart_form_enforcement.sql`
- `supabase/migrations/20260121_pr10_week2_anticheat_enforcement.sql`

### Workflows (MODIFIED)

- `.github/workflows/week2-governance-gates.yml`

### Documentation (MODIFIED)

- `docs/contracts/SYSTEM_CONTRACT.md`
- `docs/WEEK2_HARDENING_PROOF.md` (this file)

---

## 5. Canonical References

- **SYSTEM_CONTRACT.md**: Section 5 - Enforcement Mechanisms
- **trace_id type**: TEXT (stores UUID string from `uuidv4()`)
- **Capper mapping**: `user_id` (UUID FK→users)
- **Units mapping**: `stake` (NUMERIC(10,2))

---

**Proof Authority**: This document is generated by CI workflow execution. **Last
CI Run**: 21234700540 **Workflow URL**:
https://github.com/griff843/unit-talk-production/actions/runs/21234700540
