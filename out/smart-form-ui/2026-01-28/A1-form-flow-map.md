# Phase A: Smart Form UI Flow Map

**Date**: 2026-01-28
**Scope**: `apps/smart-form/app/submit-ticket/`

---

## Form Overview

- **Entry Point**: `/submit-ticket` → `SmartTicketForm.tsx`
- **Total Steps**: 4
- **Architecture**: Multi-step wizard with state managed in parent component
- **Validation**: Manual validation per step (not React Hook Form)

---

## Step Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SmartTicketForm.tsx                         │
│                    (State Container + Renderer)                     │
└─────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│    Step 1     │  ──Next─▶ │    Step 2     │  ──Next─▶ │    Step 3     │
│  Essentials   │           │ Configuration │           │  Bet Details  │
└───────────────┘           └───────────────┘           └───────────────┘
        │                           │                           │
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ - Capper      │           │ - Unit Size   │           │ - Bet Type    │
│ - Ticket Type │           │ - Odds Format │           │ - Market Type │
│ - Sport       │           │ - Auto Parlay │           │               │
│ - Game Date   │           │ - Confidence  │           │               │
└───────────────┘           └───────────────┘           └───────────────┘
                                                                │
                                                                ▼
                                                        ┌───────────────┐
                                                        │    Step 4     │
                                                        │   Selections  │
                                                        └───────────────┘
                                                                │
                                                                ▼
                                                        ┌───────────────┐
                                                        │ - Game Select │
                                                        │ - Props/Picks │
                                                        │ - Notes       │
                                                        │ - SUBMIT      │
                                                        └───────────────┘
```

---

## Step 1: Ticket Essentials
**File**: `Step1Essentials.tsx` (798 lines)

### Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `capper` | Select (fetched from API) | **YES** | `undefined` | Must be selected, not "Select a capper" |
| `ticket_type` | Button group | **YES** | `undefined` | Must be one of: single, parlay, teaser, round_robin |
| `sport` | Button group | **YES** | `'MLB'` (auto-set on mount) | Must be one of 14 supported sports |
| `game_date` | DatePicker | **YES** | Today's date (auto-set on mount) | Cannot be past date |
| `user_tier` | Display only | NO | `'vip_plus'` (hardcoded) | N/A - not editable |

### Dependencies
- Fetches cappers from `/api/cappers` on mount
- Fetches available games count when sport + date change
- Auto-sets sport to MLB and date to today on mount

### Navigation
- Continue button enabled when: `capper && ticket_type && sport && game_date`

---

## Step 2: Betting Configuration
**File**: `Step2Configuration.tsx` (279 lines)

### Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `unit_size` | Range slider (0.5-5.0) | **YES** | `2.0` (local state) | 0.5 ≤ x ≤ 5, 0.5 increments |
| `odds_format` | Button group | **YES** | `'AMERICAN'` (from parent) | Must be one of: AMERICAN, DECIMAL, FRACTIONAL |
| `auto_parlay` | Switch | NO | `false` | Boolean |
| `confidence_level` | Star rating (1-10) | **YES** | `7` (local state) | 1 ≤ x ≤ 10, integer |

### Dependencies
- Shows unit recommendations based on `ticket_type` from Step 1
- Shows "historical accuracy" based on confidence (simulated data)

### Navigation
- Back button: Returns to Step 1
- Continue button enabled when: `unit_size && odds_format && confidence_level`

---

## Step 3: Bet Type & Market
**File**: `Step3BetDetails.tsx` (303 lines)

### Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `bet_type` | Button group | **YES** | `undefined` | Must be one of available bet types |
| `market_type` | Button group | **YES** | `undefined` | Must be one of: pre_game, live, futures |

### Dependencies
- Available bet types filtered by `sport` from Step 1
  - Basic (all sports): spread, total, moneyline
  - Major leagues: + player_prop, team_prop
  - Pro leagues: + futures
- Shows sport-specific suggestions

### Navigation
- Back button: Returns to Step 2
- Continue button enabled when: `bet_type && market_type`

---

## Step 4: Game & Pick Details
**File**: `Step4GameSelection.tsx` (825 lines)

### Fields

| Field | Type | Required | Default | Validation |
|-------|------|----------|---------|------------|
| `game_selections` | Array of selections | **YES** | `[]` | At least one selection required |
| `notes` | Textarea | NO | `''` | No validation |

### Sub-workflows

#### 4A. Standard Bet Selection (spread, moneyline, total)
1. Select game from list
2. Choose selection (home/away, over/under)
3. Auto-populated odds from game data
4. Click "Add Selection"

#### 4B. Player Props Selection
1. Select game from list
2. Props fetched from `/api/props?game_id=...&sport=...`
3. If props found: show prop cards with over/under buttons
4. If no props: show "Create Custom Prop" button → ManualPropCreator
5. Select prop option (over/under)
6. Click "Add Selection"

### Dependencies
- Games fetched from `/api/games` based on `sport` + `game_date`
- Props fetched from `/api/props` when bet_type is `player_prop`
- Selection options depend on `bet_type` from Step 3

### Navigation
- Back button: Returns to Step 3
- Submit button enabled when: `game_selections.length > 0 && !isSubmitting`

---

## Data Flow

```typescript
// Parent state in SmartTicketForm
const [formState, setFormState] = useState<FormState>({
  currentStep: 1,
  completedSteps: [],
  data: {
    // Step 1
    capper: undefined,
    ticket_type: undefined,
    sport: undefined,           // Auto-set to 'MLB' on mount
    game_date: undefined,       // Auto-set to today on mount

    // Step 2
    unit_size: undefined,
    confidence_level: undefined,

    // Step 3
    bet_type: undefined,
    market_type: undefined,

    // Auto-set
    user_tier: 'vip_plus',
    odds_format: 'AMERICAN',
    timestamp: new Date().toISOString(),
    timezone: getTimezoneOffset(),
    status: 'pending',
    current_step: 1,
    completed_steps: [],
    legs: [],
    game_selections: [],
  },
  validation: {},
  isSubmitting: false,
});
```

---

## API Endpoints Used

| Endpoint | Step | Purpose |
|----------|------|---------|
| `GET /api/cappers` | 1 | Fetch available cappers |
| `GET /api/games?sport=X&date=Y` | 1, 4 | Fetch available games |
| `GET /api/props?game_id=X&sport=Y` | 4 | Fetch player props |
| `POST /api/submit-ticket` | 4 | Submit final ticket |

---

## Submission Flow

1. User clicks "Submit Ticket"
2. `validateStep(4, data)` runs
3. `game_selections` converted to `legs` format
4. POST to `/api/submit-ticket` with full ticket data
5. On success: Toast shown, form reset to initial state
6. On error: Toast shown with error message

---

## Key Observations

1. **No form library**: Manual state management, no React Hook Form
2. **Validation timing**: Only on Next/Submit click, not inline
3. **Auto-defaults**: Sport (MLB) and date (today) auto-set on mount
4. **Local state duplication**: Step 2 has local state for unit_size and confidence that syncs to parent
5. **Step completion tracking**: `completedSteps` array tracks progress
6. **StepProgress component**: Shows clickable step indicators, validates before allowing jump forward
