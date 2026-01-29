# Phase D: Validation & Error Handling Audit

**Date**: 2026-01-28
**Scope**: `apps/smart-form/app/submit-ticket/`

---

## Validation Architecture Overview

### Current Implementation Pattern
- **Validation Library**: None (manual validation, NOT React Hook Form)
- **Validation Timing**: On-demand (Next/Submit click only)
- **Error Display**: Per-step, shown after validation failure
- **Schema**: Zod schemas exist in `types.ts` but NOT integrated with form

---

## Step-by-Step Validation Analysis

### Step 1: Ticket Essentials

**File**: `SmartTicketForm.tsx:69-96`

| Field | Validation Rule | Timing | Gap |
|-------|----------------|--------|-----|
| `capper` | `!data.capper` | On Next | No inline feedback |
| `ticket_type` | `!data.ticket_type` | On Next | No inline feedback |
| `sport` | `!data.sport` | On Next | No inline feedback |
| `game_date` | Required + not past | On Next | DatePicker allows past selection |

**Code Evidence**:
```typescript
case 1:
  if (!data.capper) {
    errors.capper = 'Capper selection is required';
    isValid = false;
  }
  if (!data.ticket_type) {
    errors.ticket_type = 'Ticket type is required';
    isValid = false;
  }
  // Date validation:
  if (selectedDate < today) {
    errors.game_date = 'Cannot select past dates';
  }
```

**Gaps**:
1. No inline validation (errors only show after Next click)
2. DatePicker component doesn't prevent past date selection
3. Empty string capper would pass `!data.capper` but fail later

---

### Step 2: Betting Configuration

**File**: `SmartTicketForm.tsx:98-111`

| Field | Validation Rule | Timing | Gap |
|-------|----------------|--------|-----|
| `unit_size` | 0.5 ≤ x ≤ 5 | On Next | No 0.5 increment check |
| `odds_format` | `!data.odds_format` | On Next | Could be empty string |
| `confidence_level` | 1 ≤ x ≤ 10, integer | On Next | No integer check in validation |

**Code Evidence**:
```typescript
case 2:
  if (!data.unit_size || data.unit_size < 0.5 || data.unit_size > 5) {
    errors.unit_size = 'Unit size must be between 0.5 and 5';
    // Missing: % 0.5 === 0 check per Zod schema
  }
```

**Gaps**:
1. Zod schema requires 0.5 increments, form validation doesn't check
2. Zod schema requires integer for confidence, form uses `< 1 || > 10`
3. `odds_format !== undefined` is fragile

---

### Step 3: Bet Type & Market

**File**: `SmartTicketForm.tsx:113-122`

| Field | Validation Rule | Timing | Gap |
|-------|----------------|--------|-----|
| `bet_type` | `!data.bet_type` | On Next | No enum validation |
| `market_type` | `!data.market_type` | On Next | No enum validation |

**Gaps**:
1. No validation against allowed enum values
2. No cross-field validation (e.g., futures bet_type should require futures market)

---

### Step 4: Game & Pick Details

**File**: `SmartTicketForm.tsx:124-129`

| Field | Validation Rule | Timing | Gap |
|-------|----------------|--------|-----|
| `game_selections` | `length > 0` | On Submit | No max limit |

**Gaps**:
1. No maximum selection limit
2. No validation that selections match selected sport
3. No validation that `single` ticket has exactly 1 selection

---

## Error Message Quality Audit

| Step | Field | Current Error Message | Issue |
|------|-------|----------------------|-------|
| 1 | capper | "Capper selection is required" | OK |
| 1 | ticket_type | "Ticket type is required" | OK |
| 1 | sport | "Sport selection is required" | OK |
| 1 | game_date | "Cannot select past dates" | Should also show for empty |
| 2 | unit_size | "Unit size must be between 0.5 and 5" | Doesn't mention increments |
| 2 | odds_format | "Odds format is required" | OK |
| 2 | confidence_level | "Confidence level must be between 1 and 10" | OK |
| 3 | bet_type | "Bet type is required" | OK |
| 3 | market_type | "Market type is required" | OK |
| 4 | game_selections | "At least one selection is required" | Should mention max for single |

---

## API Validation vs Form Validation Comparison

### Form Validation (SmartTicketForm.tsx)
```typescript
// Step 1
!data.capper                    // Truthy check
!data.ticket_type               // Truthy check
!data.sport                     // Truthy check
!data.game_date                 // Truthy check + date comparison

// Step 2
data.unit_size < 0.5 || > 5     // Range check
!data.odds_format               // Truthy check
data.confidence_level < 1 || > 10  // Range check

// Step 3
!data.bet_type                  // Truthy check
!data.market_type               // Truthy check

// Step 4
game_selections.length === 0    // Array length
```

### API Validation (route.ts:29-37)
```typescript
capper_id: z.string().uuid()    // UUID format REQUIRED
sport: z.enum([...])            // Enum validation
ticket_type: z.enum([...])      // Enum validation
selections: z.array(...).min(1) // Array with item schema
total_units: z.number().min(0.5).max(10)  // Different field name!
```

### Mismatch Summary
| Aspect | Form | API | Match? |
|--------|------|-----|--------|
| Capper field | `capper` (name) | `capper_id` (UUID) | NO |
| Unit field | `unit_size` | `total_units` | NO |
| Selections | `game_selections` + `legs` | `selections` | NO |
| Selection schema | Ad-hoc | GameSelectionSchema | NO |

---

## Error Handling Patterns

### Toast Notifications

**Usage Locations**:
1. `SmartTicketForm.tsx:149-154` - Validation error on step navigation
2. `SmartTicketForm.tsx:187-192` - Validation error on next
3. `SmartTicketForm.tsx:214-219` - Validation error on submit
4. `SmartTicketForm.tsx:274-278` - Success toast
5. `SmartTicketForm.tsx:318-322` - Error toast

**Pattern Analysis**:
- All errors use `variant: 'destructive'`
- Generic "Please complete all required fields" for multiple scenarios
- Success toast includes ticket ID

**Gaps**:
1. No field-specific error toasts
2. No retry button for submission errors
3. No persistence of form data on error

---

### API Error Handling

**File**: `SmartTicketForm.tsx:306-326`

```typescript
} catch (error: any) {
  console.error('Submission error:', error);
  toast({
    title: 'Submission Error',
    description: error.message || 'Failed to submit ticket. Please try again.',
    variant: 'destructive',
  });
} finally {
  setFormState(prev => ({ ...prev, isSubmitting: false }));
}
```

**Gaps**:
1. Network errors not distinguished from validation errors
2. No offline detection
3. No retry logic
4. Form resets on success even if user wants to submit another similar ticket

---

## Validation Timing Issues

### Current Flow
```
User fills Step 1 → Clicks Next → Validation runs → Errors shown (if any)
```

### Problems
1. **No inline validation**: User can type invalid data without feedback
2. **No debounced validation**: Potential for lag on complex checks
3. **No async validation**: Capper existence not checked until submit
4. **Stale validation**: Going back doesn't re-validate forward steps

---

## Zod Schema vs Runtime Validation Gap

**types.ts defines**:
```typescript
export const smartTicketFormSchema = z.object({
  capper: z.string().min(1).refine(val => val !== 'Select a capper'),
  unit_size: z.number().min(0.5).max(5).refine(val => val % 0.5 === 0),
  confidence_level: z.number().min(1).max(10).int(),
  // ... more
});
```

**But form validation uses**:
```typescript
if (!data.unit_size || data.unit_size < 0.5 || data.unit_size > 5) {
  // No 0.5 increment check
}
```

**Gap**: Zod schema is MORE strict than runtime validation.

---

## Recommendations

### Critical
1. **VAL-001**: Align form field names with API schema
2. **VAL-002**: Use Zod schemas for runtime validation (parse, don't validate manually)
3. **VAL-003**: Add capper existence check before submit

### High
4. **VAL-004**: Add inline validation with debouncing
5. **VAL-005**: Prevent DatePicker from selecting past dates via `minDate` prop
6. **VAL-006**: Validate selection count matches ticket_type

### Medium
7. **VAL-007**: Add network error vs validation error distinction
8. **VAL-008**: Re-validate downstream steps when upstream data changes
9. **VAL-009**: Add 0.5 increment check for unit_size

### Low
10. **VAL-010**: Improve error messages with specific guidance

---

**Generated**: 2026-01-28
**Auditor**: Claude Code (Static Analysis)
