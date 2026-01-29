# Phase B: UI Bug List

**Date**: 2026-01-28
**Scope**: `apps/smart-form/app/submit-ticket/`
**Method**: Static code analysis (no live testing)

---

## Critical Bugs (Launch Blocking)

### BUG-001: Form-to-API Data Contract Mismatch
| Attribute | Value |
|-----------|-------|
| **Step** | 4 (Submit) |
| **Severity** | CRITICAL |
| **File** | `SmartTicketForm.tsx:239` vs `route.ts:30` |
| **Expected** | Form sends `capper_id` (UUID) matching API schema |
| **Actual** | Form sends `capper` (name string), API expects `capper_id` (UUID) |
| **Impact** | Submission will ALWAYS fail with validation error |

**Evidence**:
- Form: `capper: formState.data.capper!` (line 239)
- API Schema: `capper_id: z.string().uuid('Capper ID must be a valid UUID')` (line 30)

---

### BUG-002: Form Payload Schema Mismatch
| Attribute | Value |
|-----------|-------|
| **Step** | 4 (Submit) |
| **Severity** | CRITICAL |
| **File** | `SmartTicketForm.tsx:237-257` vs `route.ts:29-37` |
| **Expected** | Form payload matches SubmitTicketSchema |
| **Actual** | Multiple field mismatches prevent successful submission |
| **Impact** | Submission will fail validation |

**Mismatch Table**:
| Form Field | API Expected | Status |
|------------|--------------|--------|
| `capper` (name) | `capper_id` (UUID) | MISMATCH |
| `legs[]` | `selections[]` | MISMATCH (different schema) |
| `unit_size` | `total_units` | MISMATCH (different name) |
| `game_selections[]` | `selections[]` | MISMATCH (different structure) |
| `game_date` | Not expected | EXTRA |
| `odds_format` | Not expected | EXTRA |
| `confidence_level` | Not expected (per-selection only) | EXTRA |

---

## High Severity Bugs

### BUG-003: Capper Selection Stores Name Instead of ID
| Attribute | Value |
|-----------|-------|
| **Step** | 1 |
| **Severity** | HIGH |
| **File** | `Step1Essentials.tsx:481-483` |
| **Expected** | Store capper ID for API submission |
| **Actual** | Stores capper name: `onUpdate({ capper: selectedCapper?.name || capperId })` |
| **Impact** | Contributes to BUG-001 |

---

## Medium Severity Bugs

### BUG-004: Local State Duplication in Step 2
| Attribute | Value |
|-----------|-------|
| **Step** | 2 |
| **Severity** | MEDIUM |
| **File** | `Step2Configuration.tsx:53-54` |
| **Expected** | Single source of truth for form data |
| **Actual** | Local state duplicates parent state |
| **Impact** | Potential state sync issues, especially on back navigation |

**Evidence**:
```typescript
const [unitSize, setUnitSize] = useState([data.unit_size || 2.0]);
const [confidence, setConfidence] = useState(data.confidence_level || 7);
```

---

### BUG-005: useEffect Missing Dependency
| Attribute | Value |
|-----------|-------|
| **Step** | 1 |
| **Severity** | MEDIUM |
| **File** | `Step1Essentials.tsx:421-439` |
| **Expected** | useEffect dependencies include `onUpdate` |
| **Actual** | Empty dependency array `[]` with `onUpdate` called inside |
| **Impact** | Stale closure risk, potential missed state updates |

---

### BUG-006: No State Reset on Sport Change
| Attribute | Value |
|-----------|-------|
| **Step** | 1 → 4 |
| **Severity** | MEDIUM |
| **File** | `Step1Essentials.tsx:490-492` |
| **Expected** | Changing sport clears game_selections from Step 4 |
| **Actual** | Sport change only updates sport field, leaves stale selections |
| **Impact** | User could submit NFL game selections tagged as NBA |

---

### BUG-007: Fragile Validation Check
| Attribute | Value |
|-----------|-------|
| **Step** | 2 |
| **Severity** | MEDIUM |
| **File** | `Step2Configuration.tsx:107` |
| **Expected** | Robust validation for odds_format |
| **Actual** | Uses `data.odds_format !== undefined` which passes for empty string |
| **Impact** | Could allow progression with invalid data |

---

## Low Severity / UX Issues

### BUG-008: Console.log in Production Code
| Attribute | Value |
|-----------|-------|
| **Step** | 1, 4 |
| **Severity** | LOW |
| **Files** | Multiple |
| **Expected** | No debug statements in production |
| **Actual** | Multiple console.log statements present |
| **Impact** | Unprofessional, potential data exposure in browser console |

**Locations**:
- `Step1Essentials.tsx:467-469` - "Loading games for sport..."
- `Step1Essentials.tsx:504-511` - "Step1 Validation Debug"
- `SmartTicketForm.tsx:317` - "Submission error"

---

### BUG-009: DatePicker Allows Past Dates
| Attribute | Value |
|-----------|-------|
| **Step** | 1 |
| **Severity** | LOW (UX) |
| **File** | `Step1Essentials.tsx:692-698` |
| **Expected** | DatePicker restricts to current/future dates |
| **Actual** | No `minDate` prop, validation error only on Next click |
| **Impact** | Poor UX - user can select invalid date then get error |

---

### BUG-010: Auto-Default to MLB Without Indication
| Attribute | Value |
|-----------|-------|
| **Step** | 1 |
| **Severity** | LOW (UX) |
| **File** | `Step1Essentials.tsx:424-425` |
| **Expected** | User explicitly selects sport or clear indication of default |
| **Actual** | Silently defaults to 'MLB' on mount |
| **Impact** | User might not notice and proceed with wrong sport |

---

### BUG-011: Market Types Mismatch
| Attribute | Value |
|-----------|-------|
| **Step** | 3 |
| **Severity** | LOW |
| **Files** | `types.ts:43-50` vs `Step3BetDetails.tsx:81-100` |
| **Expected** | MARKET_TYPE_CONFIG matches MARKET_TYPES constant |
| **Actual** | MARKET_TYPES has 6 values, MARKET_TYPE_CONFIG only has 3 |
| **Impact** | UI shows subset of available market types |

**types.ts MARKET_TYPES**: `pre_game, live, player_prop, team_prop, game_prop, futures`
**Step3 MARKET_TYPE_CONFIG**: `pre_game, live, futures` only

---

### BUG-012: Completed Steps Not Invalidated on Back-Edit
| Attribute | Value |
|-----------|-------|
| **Step** | All |
| **Severity** | LOW |
| **File** | `SmartTicketForm.tsx:170-185` |
| **Expected** | Editing completed step invalidates subsequent steps |
| **Actual** | Completed steps remain marked complete even if data changes |
| **Impact** | Stale data could be submitted if user goes back and changes values |

---

## Bug Summary

| Severity | Count | Launch Blocking |
|----------|-------|-----------------|
| CRITICAL | 2 | YES |
| HIGH | 1 | YES |
| MEDIUM | 4 | NO (but should fix before production) |
| LOW/UX | 5 | NO |
| **TOTAL** | **12** | **3 BLOCKERS** |

---

**Generated**: 2026-01-28
**Auditor**: Claude Code (Static Analysis)
