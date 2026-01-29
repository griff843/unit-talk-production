# Phase C: Intelligence Gaps Analysis

**Date**: 2026-01-28
**Scope**: `apps/smart-form/app/submit-ticket/`
**Definition**: Places where the UI SHOULD react intelligently but DOES NOT

---

## Intelligence Gap Categories

| Category | Description |
|----------|-------------|
| **DATA CASCADE** | Changing a parent field should update/reset dependent child fields |
| **CONTEXTUAL VALIDATION** | Validation rules should adapt to selected context |
| **PROGRESSIVE DISCLOSURE** | UI should show/hide options based on prior selections |
| **SMART DEFAULTS** | Defaults should be context-aware, not static |
| **USER GUIDANCE** | UI should guide user when they make potentially problematic choices |

---

## INTEL-001: Sport Change Does Not Cascade to Selections

| Attribute | Value |
|-----------|-------|
| **Category** | DATA CASCADE |
| **Step** | 1 → 4 |
| **Current Behavior** | Sport change only updates `sport` field |
| **Expected Intelligence** | Clear `game_selections`, `bet_type`, `market_type` when sport changes |
| **Impact** | User can submit NFL selections tagged as NBA |
| **Priority** | HIGH |

**Evidence (Step1Essentials.tsx:490-492)**:
```typescript
const handleSportSelect = (sport: Sport) => {
  onUpdate({ sport });  // Only updates sport, nothing else
};
```

**Should Be**:
```typescript
const handleSportSelect = (sport: Sport) => {
  onUpdate({
    sport,
    bet_type: undefined,      // Reset
    game_selections: [],      // Clear
    // Possibly market_type too
  });
};
```

---

## INTEL-002: Ticket Type Does Not Adjust Selection Limits

| Attribute | Value |
|-----------|-------|
| **Category** | CONTEXTUAL VALIDATION |
| **Step** | 1 → 4 |
| **Current Behavior** | `single` ticket_type allows multiple selections |
| **Expected Intelligence** | Enforce 1 selection for `single`, 2+ for `parlay` |
| **Impact** | User can add multiple selections to a "single" bet |
| **Priority** | MEDIUM |

**Evidence (SmartTicketForm.tsx:124-129)**:
```typescript
case 4:
  if (!data.game_selections || data.game_selections.length === 0) {
    errors.game_selections = 'At least one selection is required';
    // NO CHECK for ticket_type === 'single' && length > 1
  }
```

---

## INTEL-003: Date Change Does Not Refresh Available Games Indicator

| Attribute | Value |
|-----------|-------|
| **Category** | PROGRESSIVE DISCLOSURE |
| **Step** | 1 |
| **Current Behavior** | Games count fetches but no loading state visible |
| **Expected Intelligence** | Show loading spinner while fetching games for new date |
| **Impact** | User doesn't know if date change is being processed |
| **Priority** | LOW |

**Evidence (Step1Essentials.tsx:462-479)**:
```typescript
useEffect(() => {
  const loadAvailableGames = async () => {
    // No setIsLoading(true) before fetch
    const games = await fetchGames(data.sport, data.game_date, data.game_date);
    setAvailableGames(games?.length || 0);
    // No loading indicator during this
  };
  loadAvailableGames();
}, [data.sport, data.game_date]);
```

---

## INTEL-004: Bet Type Should Filter Market Types

| Attribute | Value |
|-----------|-------|
| **Category** | PROGRESSIVE DISCLOSURE |
| **Step** | 3 |
| **Current Behavior** | All 3 market types shown regardless of bet type |
| **Expected Intelligence** | `futures` bet_type should only show `futures` market |
| **Impact** | User can select illogical combination (e.g., futures + live) |
| **Priority** | MEDIUM |

**Evidence (Step3BetDetails.tsx:231-258)**:
```typescript
// All market types always shown
{(Object.keys(MARKET_TYPE_CONFIG) as Array<keyof typeof MARKET_TYPE_CONFIG>).map(
  marketType => {
    // No filtering based on data.bet_type
```

---

## INTEL-005: Confidence Level Should Inform Unit Size Recommendation

| Attribute | Value |
|-----------|-------|
| **Category** | SMART DEFAULTS |
| **Step** | 2 |
| **Current Behavior** | Unit recommendation based only on ticket_type |
| **Expected Intelligence** | Low confidence should suggest lower units |
| **Impact** | User might overbet on low confidence picks |
| **Priority** | LOW (UX Enhancement) |

**Evidence (Step2Configuration.tsx:57-70)**:
```typescript
const getUnitRecommendation = () => {
  switch (data.ticket_type) {  // Only checks ticket_type
    case 'single': return 'Recommended: 1.0-2.5 units';
    // Should also factor in confidence_level
```

---

## INTEL-006: No Warning When Changing Completed Step Data

| Attribute | Value |
|-----------|-------|
| **Category** | USER GUIDANCE |
| **Step** | All |
| **Current Behavior** | User can silently change Step 1 data after completing Step 4 |
| **Expected Intelligence** | Warn user that changing early data may invalidate later selections |
| **Impact** | User unknowingly invalidates their carefully built selections |
| **Priority** | MEDIUM |

**Evidence (SmartTicketForm.tsx:196-204)**:
```typescript
const handleBack = () => {
  if (formState.currentStep > 1) {
    setFormState(prev => ({
      ...prev,
      currentStep: prev.currentStep - 1,
      // No warning dialog, no invalidation
    }));
  }
};
```

---

## INTEL-007: Prop Type Not Filtered by Sport

| Attribute | Value |
|-----------|-------|
| **Category** | PROGRESSIVE DISCLOSURE |
| **Step** | 3 |
| **Current Behavior** | SPORT_PROP_TYPES defined but not used to filter bet types |
| **Expected Intelligence** | Show only sport-relevant props (e.g., no "passing_yards" for NBA) |
| **Impact** | Incorrect props could appear for wrong sport |
| **Priority** | LOW |

**Evidence (types.ts:65-164)**:
```typescript
export const SPORT_PROP_TYPES = {
  NBA: ['points', 'rebounds', 'assists', ...],
  NFL: ['passing_yards', 'rushing_yards', ...],
  // Defined but Step3 uses generic BET_TYPE_CONFIG
```

---

## INTEL-008: No Auto-Calculate for Parlay Odds

| Attribute | Value |
|-----------|-------|
| **Category** | SMART DEFAULTS |
| **Step** | 4 |
| **Current Behavior** | No parlay odds calculation shown |
| **Expected Intelligence** | Auto-calculate combined parlay odds from selections |
| **Impact** | User cannot see potential payout until after submission |
| **Priority** | MEDIUM |

**Evidence (SmartTicketForm.tsx:223-235)**:
```typescript
const legs = formState.data.game_selections?.map(selection => ({
  // Creates legs but no parlay_odds calculation
  odds: selection.odds,
  // Missing: total parlay odds display
}));
```

---

## INTEL-009: No Live Status Indicator for Live Bets

| Attribute | Value |
|-----------|-------|
| **Category** | USER GUIDANCE |
| **Step** | 3 → 4 |
| **Current Behavior** | Selecting "Live Betting" market doesn't change Step 4 behavior |
| **Expected Intelligence** | Live market should show countdown, game status, or warning |
| **Impact** | User might not realize they're making a time-sensitive live bet |
| **Priority** | LOW |

---

## INTEL-010: Empty State Not Handled for Zero Games

| Attribute | Value |
|-----------|-------|
| **Category** | USER GUIDANCE |
| **Step** | 1 |
| **Current Behavior** | Shows "0 games available" text only |
| **Expected Intelligence** | Block progression or suggest different date when no games |
| **Impact** | User proceeds to Step 4 with no games to select |
| **Priority** | MEDIUM |

**Evidence (Step1Essentials.tsx:701-713)**:
```typescript
{data.sport && data.game_date && (
  <div className="text-sm text-green-700 ...">
    {availableGames} {data.sport} games available
    // Shows 0 with no guidance
  </div>
)}
```

---

## Intelligence Gap Summary

| Category | Gap Count | Priority Distribution |
|----------|-----------|----------------------|
| DATA CASCADE | 1 | HIGH: 1 |
| CONTEXTUAL VALIDATION | 1 | MEDIUM: 1 |
| PROGRESSIVE DISCLOSURE | 3 | LOW: 2, MEDIUM: 1 |
| SMART DEFAULTS | 2 | LOW: 1, MEDIUM: 1 |
| USER GUIDANCE | 3 | LOW: 1, MEDIUM: 2 |
| **TOTAL** | **10** | HIGH: 1, MEDIUM: 5, LOW: 4 |

---

## Recommended Implementation Order

1. **INTEL-001** - Sport change cascade (HIGH, data integrity)
2. **INTEL-010** - Zero games handling (MEDIUM, blocks invalid flow)
3. **INTEL-002** - Selection limits by ticket type (MEDIUM, data integrity)
4. **INTEL-006** - Back navigation warning (MEDIUM, user guidance)
5. **INTEL-004** - Bet type filters market type (MEDIUM, logical consistency)
6. **INTEL-008** - Parlay odds calculation (MEDIUM, user value)
7. Remaining LOW priority items

---

**Generated**: 2026-01-28
**Auditor**: Claude Code (Static Analysis)
