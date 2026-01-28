# Smart Form UI Fix - Root Cause Analysis
## Date: 2026-01-28

---

## Issue 1: Cappers Dropdown Never Loads (BLOCKER)

**Evidence**: `ISSUE-02-cappers-still-loading.png`, `ISSUE-03-full-page-step1.png`

**Component**: `apps/smart-form/app/submit-ticket/components/Step1Essentials.tsx`

**Root Cause**:
The capper loading useEffect (lines 441-460) has no timeout or error recovery mechanism:

```typescript
useEffect(() => {
  const loadCappers = async () => {
    try {
      setIsLoadingCappers(true);
      const cappersData = await fetchCappers();
      setCappers(cappersData);
    } catch (error) {
      console.error('Error loading cappers:', error);
      setCappers([]);
    } finally {
      setIsLoadingCappers(false);  // Never reached if fetch hangs
    }
  };
  loadCappers();
}, []);
```

If the fetch request hangs (network issues, slow response, ERR_CONNECTION_RESET as seen in console), the `finally` block never executes, leaving `isLoadingCappers = true` forever. The Select component is `disabled={isLoadingCappers}`, so users see a permanently disabled dropdown.

**Console Evidence**:
```
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ main-app.js
```

**Fix Strategy**: Add a timeout mechanism and defensive error handling to ensure `isLoadingCappers` becomes `false` even if the fetch fails or hangs.

---

## Issue 2: Sidebar (Bet Summary) Does Not Sync

**Evidence**: `ISSUE-04-sport-selected-but-sidebar-not-updated.png`

**Components**:
- `apps/smart-form/app/submit-ticket/components/SmartTicketForm.tsx` (sidebar at lines 449-484)
- `apps/smart-form/app/submit-ticket/components/Step1Essentials.tsx` (handlers)

**Root Cause**:
The sidebar in SmartTicketForm.tsx displays values from `formState.data`:

```typescript
{ label: 'Type', value: formState.data.ticket_type || 'Not set' },
{ label: 'Sport', value: formState.data.sport || 'Not set' },
```

The Step1Essentials component has a useEffect with an **empty dependency array** that sets defaults:

```typescript
useEffect(() => {
  const updates: any = {};
  if (!data.sport) {
    updates.sport = 'MLB';
  }
  if (!data.game_date) {
    updates.game_date = `${year}-${month}-${day}`;
  }
  if (Object.keys(updates).length > 0) {
    onUpdate(updates);
  }
}, []); // Empty dependency - uses stale props/closure
```

The empty `[]` causes a stale closure issue where:
1. The initial `data` prop values are captured
2. `onUpdate` is called with defaults
3. Subsequent user selections may conflict with React's batched state updates
4. The sidebar reads from parent state which doesn't reflect the visual button state

**Fix Strategy**: Remove the defaults useEffect and handle defaults in the parent component during initialization, ensuring single source of truth.

---

## Issue 3: Selecting Ticket Type Deselects Sport (Mutual Exclusion Bug)

**Evidence**: `ISSUE-05-ticket-type-deselects-sport.png`

**Component**: `apps/smart-form/app/submit-ticket/components/Step1Essentials.tsx`

**Root Cause**:
This is a state synchronization bug caused by the same stale closure issue as Issue 2.

The button handlers are correct:
```typescript
const handleTicketTypeSelect = (type: TicketType) => {
  onUpdate({ ticket_type: type });  // Only updates ticket_type
};

const handleSportSelect = (sport: Sport) => {
  onUpdate({ sport });  // Only updates sport
};
```

However, the useEffect with empty dependency array can interfere with state updates. When React batches multiple state updates, the stale closure in the useEffect may cause unexpected state resets.

The button styling shows the correct visual state (`data.ticket_type === type`) but the underlying `formState.data` in the parent is inconsistent.

**Fix Strategy**:
1. Move defaults initialization to parent component (SmartTicketForm.tsx)
2. Remove the problematic useEffect from Step1Essentials
3. Ensure single source of truth for form state

---

## Summary of Changes Required

| File | Change |
|------|--------|
| `Step1Essentials.tsx` | Remove defaults useEffect, add capper loading timeout |
| `SmartTicketForm.tsx` | Initialize defaults in formState, no structural changes |

**Scope**: Only Step1Essentials.tsx needs modification. SmartTicketForm.tsx defaults are already correct.

**Risk Assessment**: LOW - Changes are isolated to Step1 component initialization logic.
