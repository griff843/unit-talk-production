# Phase E: Fix Classification Table

**Date**: 2026-01-28
**Scope**: `apps/smart-form/app/submit-ticket/`

---

## Classification Categories

| Category | Code | Description | Launch Status |
|----------|------|-------------|---------------|
| **UI-BUG** | BUG | Functional defect preventing normal operation | BLOCKER |
| **UX-CLARITY** | UX | Confusing behavior that could mislead users | SHOULD FIX |
| **UI-INTEL** | INTEL | Missing smart behavior/reactivity | DEFER OK |
| **NICE-TO-HAVE** | NTH | Enhancements that improve experience | POST-LAUNCH |

---

## Master Classification Table

| ID | Title | Category | Launch Blocking | File(s) | Estimated Complexity |
|----|-------|----------|-----------------|---------|---------------------|
| BUG-001 | Form sends `capper` name, API expects `capper_id` UUID | **UI-BUG** | **YES** | SmartTicketForm.tsx, Step1Essentials.tsx | MEDIUM |
| BUG-002 | Form payload schema mismatches API schema | **UI-BUG** | **YES** | SmartTicketForm.tsx, route.ts | HIGH |
| BUG-003 | Capper selection stores name instead of ID | **UI-BUG** | **YES** | Step1Essentials.tsx:481-483 | LOW |
| BUG-004 | Local state duplication in Step 2 | **UI-BUG** | NO | Step2Configuration.tsx:53-54 | LOW |
| BUG-005 | useEffect missing onUpdate dependency | **UI-BUG** | NO | Step1Essentials.tsx:439 | LOW |
| BUG-006 | Sport change doesn't reset selections | **UI-BUG** | NO | Step1Essentials.tsx:490 | LOW |
| BUG-007 | Fragile validation check for odds_format | **UI-BUG** | NO | Step2Configuration.tsx:107 | LOW |
| BUG-008 | Console.log in production code | **UI-BUG** | NO | Multiple files | LOW |
| BUG-009 | DatePicker allows past date selection | **UX-CLARITY** | NO | Step1Essentials.tsx:692-698 | LOW |
| BUG-010 | Auto-default to MLB without indication | **UX-CLARITY** | NO | Step1Essentials.tsx:424-425 | LOW |
| BUG-011 | Market types mismatch (3 shown, 6 defined) | **UX-CLARITY** | NO | Step3BetDetails.tsx:81-100 | LOW |
| BUG-012 | Completed steps not invalidated on back-edit | **UX-CLARITY** | NO | SmartTicketForm.tsx:196-204 | MEDIUM |
| INTEL-001 | Sport change should cascade reset | **UI-INTEL** | NO | Step1Essentials.tsx | MEDIUM |
| INTEL-002 | Ticket type should limit selection count | **UI-INTEL** | NO | SmartTicketForm.tsx | MEDIUM |
| INTEL-003 | No loading indicator for game refresh | **UI-INTEL** | NO | Step1Essentials.tsx | LOW |
| INTEL-004 | Bet type should filter market types | **UI-INTEL** | NO | Step3BetDetails.tsx | LOW |
| INTEL-005 | Confidence should inform unit recommendation | **UI-INTEL** | NO | Step2Configuration.tsx | LOW |
| INTEL-006 | No warning when editing completed steps | **UI-INTEL** | NO | SmartTicketForm.tsx | MEDIUM |
| INTEL-007 | Prop types not filtered by sport | **UI-INTEL** | NO | Step3BetDetails.tsx | LOW |
| INTEL-008 | No parlay odds auto-calculation | **UI-INTEL** | NO | Step4GameSelection.tsx | MEDIUM |
| INTEL-009 | No live status indicator for live bets | **UI-INTEL** | NO | Step3BetDetails.tsx | MEDIUM |
| INTEL-010 | Zero games doesn't block progression | **UI-INTEL** | NO | Step1Essentials.tsx | LOW |
| VAL-001 | Form fields don't match API fields | **UI-BUG** | **YES** | SmartTicketForm.tsx | HIGH |
| VAL-002 | Zod schema not used for runtime validation | **UX-CLARITY** | NO | types.ts, SmartTicketForm.tsx | MEDIUM |
| VAL-003 | No capper existence check before submit | **UI-BUG** | **YES** | SmartTicketForm.tsx | LOW |
| VAL-004 | No inline validation (only on Next) | **UX-CLARITY** | NO | All Step components | MEDIUM |
| VAL-005 | DatePicker minDate not set | **UX-CLARITY** | NO | Step1Essentials.tsx | LOW |
| VAL-006 | Selection count not validated vs ticket_type | **UI-BUG** | NO | SmartTicketForm.tsx | LOW |
| VAL-007 | No network vs validation error distinction | **NTH** | NO | SmartTicketForm.tsx | MEDIUM |
| VAL-008 | Downstream steps not re-validated on change | **UX-CLARITY** | NO | SmartTicketForm.tsx | MEDIUM |
| VAL-009 | Unit size 0.5 increment not validated | **UX-CLARITY** | NO | SmartTicketForm.tsx | LOW |
| VAL-010 | Error messages lack specific guidance | **NTH** | NO | SmartTicketForm.tsx | LOW |

---

## Summary by Category

### UI-BUG (Functional Defects)
| Launch Blocking | Count |
|-----------------|-------|
| YES | 5 |
| NO | 6 |
| **Total** | **11** |

### UX-CLARITY (Confusing Behavior)
| Count |
|-------|
| 8 |

### UI-INTEL (Missing Smart Behavior)
| Count |
|-------|
| 10 |

### NICE-TO-HAVE (Enhancements)
| Count |
|-------|
| 2 |

---

## Launch Blocking Items Summary

The following **5 items** MUST be fixed before production launch:

| ID | Issue | Root Cause |
|----|-------|------------|
| BUG-001 | `capper` name sent, `capper_id` UUID expected | handleCapperSelect stores name |
| BUG-002 | Form payload structure incompatible with API | ticketData object misaligned |
| BUG-003 | Capper ID not stored | onUpdate uses .name |
| VAL-001 | Field names mismatch | Independent form vs API development |
| VAL-003 | No capper validation | Missing pre-submit check |

**Common Root Cause**: Form implementation was built independently from API schema. The form uses legacy field names while API expects v3 canonical schema.

---

## Recommended Fix Order

### Phase 1: Launch Blockers (Must Fix)
1. **BUG-003** → Store capper ID instead of name (5 min)
2. **BUG-001** → Update form submission to use capper_id field (10 min)
3. **BUG-002** → Restructure ticketData to match SubmitTicketSchema (30 min)
4. **VAL-001** → Rename fields: unit_size→total_units, game_selections→selections (15 min)
5. **VAL-003** → Add capper existence validation before submit (10 min)

### Phase 2: Pre-Production Polish (Should Fix)
6. BUG-006 → Cascade sport change to clear selections
7. BUG-009 → Add minDate to DatePicker
8. BUG-012 → Invalidate completed steps on data change
9. VAL-004 → Add inline validation
10. INTEL-001 → Sport change cascade

### Phase 3: Post-Launch Enhancement (Defer OK)
11. All remaining UI-INTEL items
12. All NTH items
13. Remaining UX-CLARITY items

---

## Effort Estimate

| Phase | Items | Estimated Hours |
|-------|-------|-----------------|
| Launch Blockers | 5 | 2-3 hours |
| Pre-Production Polish | 5 | 4-6 hours |
| Post-Launch | 21 | 8-12 hours |

**Total Audit Items**: 31

---

**Generated**: 2026-01-28
**Auditor**: Claude Code (Static Analysis)
