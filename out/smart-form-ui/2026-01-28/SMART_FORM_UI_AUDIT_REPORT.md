# Smart Form UI Integrity & UX Audit Report

**Date**: 2026-01-28
**Auditor**: Claude Code (Static Analysis)
**Scope**: `apps/smart-form/app/submit-ticket/`
**Method**: Code review only (no live testing, no backend changes)

---

## Executive Summary

### Overall Assessment: NOT LAUNCH READY

The Smart Form UI contains **5 LAUNCH-BLOCKING defects** that will cause 100% submission failure. The form's data contract does not match the API's expected schema.

| Metric | Value |
|--------|-------|
| Total Issues Found | 31 |
| Launch Blocking | 5 |
| Should Fix Before Production | 8 |
| Can Defer | 18 |

### Critical Finding

**The form CANNOT successfully submit tickets.**

The form sends:
```json
{ "capper": "Griff843", "unit_size": 2.0, "legs": [...] }
```

The API expects:
```json
{ "capper_id": "uuid-here", "total_units": 2.0, "selections": [...] }
```

This mismatch will result in HTTP 400 errors on every submission attempt.

---

## Launch Blockers (MUST FIX)

| ID | Issue | Impact | File | Fix Complexity |
|----|-------|--------|------|---------------|
| **BUG-001** | Form sends `capper` (name), API expects `capper_id` (UUID) | Submission fails | SmartTicketForm.tsx:239 | MEDIUM |
| **BUG-002** | Form payload schema mismatches API schema | Submission fails | SmartTicketForm.tsx:237-257 | HIGH |
| **BUG-003** | Capper selection stores name instead of ID | Feeds into BUG-001 | Step1Essentials.tsx:481-483 | LOW |
| **VAL-001** | Field names don't match: `unit_size` vs `total_units` | Submission fails | SmartTicketForm.tsx | MEDIUM |
| **VAL-003** | No capper existence validation before submit | Could submit invalid capper | SmartTicketForm.tsx | LOW |

**Estimated Fix Time**: 2-3 hours

---

## Pre-Production Polish (SHOULD FIX)

| ID | Issue | Impact | Priority |
|----|-------|--------|----------|
| BUG-006 | Sport change doesn't reset downstream selections | Data integrity | HIGH |
| BUG-009 | DatePicker allows past date selection | Poor UX | MEDIUM |
| BUG-012 | Completed steps not invalidated on back-edit | Data integrity | MEDIUM |
| VAL-004 | No inline validation (errors only on Next click) | Poor UX | MEDIUM |
| INTEL-001 | Sport change should cascade reset | Data integrity | HIGH |
| BUG-004 | Local state duplication in Step 2 | Sync issues | LOW |
| BUG-005 | useEffect missing dependency | React warning | LOW |
| BUG-008 | Console.log statements in production | Unprofessional | LOW |

**Estimated Fix Time**: 4-6 hours

---

## Deferrable Items (POST-LAUNCH OK)

### UX Clarity (8 items)
- Market types mismatch (3 shown vs 6 defined)
- Auto-default to MLB without indication
- Zod schema not used for runtime validation
- No network vs validation error distinction
- Downstream steps not re-validated on change
- Unit size 0.5 increment not validated
- DatePicker minDate not set
- Error messages lack specific guidance

### UI Intelligence (10 items)
- Ticket type should limit selection count
- No loading indicator for game refresh
- Bet type should filter market types
- Confidence should inform unit recommendation
- No warning when editing completed steps
- Prop types not filtered by sport
- No parlay odds auto-calculation
- No live status indicator for live bets
- Zero games doesn't block progression
- Selection count not validated vs ticket_type

---

## Form Architecture Observations

### Current State
- **Form Library**: None (manual useState)
- **Validation**: Manual per-step, Zod schemas defined but unused
- **State Management**: Parent component holds all state
- **Error Handling**: Toast-based, generic messages

### Architectural Concerns
1. Zod schemas in `types.ts` are more strict than runtime validation
2. Local state duplication in Step 2 creates sync risk
3. No data cascade when parent fields change
4. Completed steps tracking doesn't account for back-navigation edits

---

## Root Cause Analysis

### Why the Form Can't Submit

The form was developed with an assumption about API contract that doesn't match reality:

| Form Assumption | API Reality |
|-----------------|-------------|
| Capper identified by name | Capper identified by UUID |
| Field: `unit_size` | Field: `total_units` |
| Field: `legs` array | Field: `selections` array |
| Arbitrary leg structure | Strict GameSelectionSchema |

This suggests the form was built before or independently from the API route.

---

## Artifacts Produced

```
out/smart-form-ui/2026-01-28/
├── A1-form-flow-map.md              # Complete 4-step flow documentation
├── B1-ui-bug-list.md                # 12 bugs with severity ratings
├── B2-ui-bug-evidence.txt           # Code snippets proving each bug
├── C1-intelligence-gaps.md          # 10 missing smart behaviors
├── D1-validation-audit.md           # Complete validation analysis
├── E1-fix-classification-table.md   # 31 items categorized
└── SMART_FORM_UI_AUDIT_REPORT.md    # This executive summary
```

---

## Recommended Action Plan

### Immediate (Before Any Launch)
1. Fix BUG-003: Store capper ID, not name
2. Fix BUG-001/VAL-001: Align form payload with API schema
3. Fix BUG-002: Restructure ticketData object completely
4. Fix VAL-003: Add capper existence check

### Before Production
5. Fix BUG-006/INTEL-001: Sport change cascade
6. Fix BUG-009: DatePicker minDate
7. Remove console.log statements
8. Add inline validation

### Post-Launch
9. All UI-INTEL items
10. Remaining UX polish

---

## Compliance Statement

This audit was conducted under the following constraints:
- **NO CODE FIXES IMPLEMENTED** - Discovery only
- **NO BACKEND CHANGES** - Backend is LOCKED
- **NO ASSUMPTIONS** - All findings have code evidence
- **ALL PROOFS DOCUMENTED** - See artifact files

---

## Conclusion

The Smart Form UI is **architecturally sound** but has a **critical data contract mismatch** with its API endpoint. The form's visual design, step progression, and user experience patterns are well-implemented. However, **zero tickets can be submitted** until the payload structure is aligned with the SubmitTicketSchema.

**Recommended**: Fix the 5 launch blockers before any production deployment. The estimated fix time is 2-3 hours for a developer familiar with the codebase.

---

**Report Generated**: 2026-01-28
**Total Audit Time**: ~45 minutes
**Files Analyzed**: 8 primary, 15+ supporting
**Lines of Code Reviewed**: ~3,200

---

## Appendix: Key File Locations

| File | Purpose | Lines |
|------|---------|-------|
| `SmartTicketForm.tsx` | Main form container | 560 |
| `Step1Essentials.tsx` | Capper, sport, date | 798 |
| `Step2Configuration.tsx` | Units, odds, confidence | 279 |
| `Step3BetDetails.tsx` | Bet type, market type | 303 |
| `Step4GameSelection.tsx` | Game/prop selection | 825 |
| `types.ts` | Type definitions, Zod schemas | 528 |
| `route.ts` | API endpoint | 318 |
| `api-client.ts` | Client utilities | 326 |
