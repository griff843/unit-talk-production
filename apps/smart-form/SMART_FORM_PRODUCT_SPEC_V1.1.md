# SMART_FORM_PRODUCT_SPEC_V1.1

**Enterprise / Fortune-100 / Syndicate-Grade**

| Field | Value |
|-------|-------|
| Product | Unit Talk Smart Form |
| Owner | Griff |
| Status | **Governing Contract** |
| Supersedes | V1.0 |
| Scope | UI + Data + Lifecycle + DB + Posting + Scoring Compatibility |

---

## 0️⃣ The Definition of "Smart"

**Smart Form is not a static form.**

It is a **live trading interface** that:

- Understands sport hierarchies
- Pulls from `unified_picks`-compatible data
- Mirrors sportsbook ticket dependency logic
- Enforces lifecycle validity at input
- Prevents downstream corruption

> If a sportsbook filters **teams → players → props** based on league selection,
> Smart Form **must do the same** using your DB.

---

## 1️⃣ End-to-End Lifecycle Awareness

Smart Form must produce a record that is **immediately**:

- ✅ Valid for `unified_picks`
- ✅ Valid for `ScoringAgent`
- ✅ Valid for `AlertAgent`
- ✅ Valid for `DiscordPromotionAgent`
- ✅ Valid for `SettlementAgent`
- ✅ Valid for CLV tracking

**Smart Form is the first enforcement layer of the entire pipeline.**

> If Smart Form allows invalid structure,
> the entire system degrades.

---

## 2️⃣ Canonical Data Source Contract

Smart Form **must never**:

- ❌ Use mock team lists
- ❌ Use hardcoded players
- ❌ Use static prop types
- ❌ Use fallback sport enums

**All data must originate from:**

- Canonical DB tables
- Smart Form views (`view_props_for_form` / `mv_props_for_form`)
- League/team/player registry tables
- Same relational logic used by pick ingestion

> If the DB doesn't know it,
> Smart Form shouldn't pretend it does.

---

## 3️⃣ Hierarchical Filtering Contract (Non-Negotiable)

**This defines what makes it "Smart".**

### 3.1 Sport → League → Game → Team → Player → Prop

Every upstream selection **must filter** downstream selections.

### 3.2 Example Dependency Chain

**When user selects: `NBA`**

System filters:
- League: NBA only
- Games: NBA games only
- Teams: NBA teams only
- Players: NBA players only
- Props: NBA stat types only (PTS, REB, AST, etc.)

**When User Selects: `Lakers`**

System filters:
- Games: Only games Lakers are in
- Players: Only Lakers players
- Props: Only NBA prop types

**When User Selects: `LeBron James`**

System auto:
- Team: Lakers
- Sport: NBA
- Filters props to NBA prop types only
- Filters games to Lakers games

**When User Selects Game: `Lakers @ Warriors`**

System auto:
- Teams: Lakers + Warriors
- Players: Lakers + Warriors players
- Sport: NBA
- Props: NBA prop types

---

## 4️⃣ Auto-Normalization Contract

Manual input must still be intelligent.

If user types:
- "Celtics"
- "Boston"
- "BOS"

System must normalize to: **Boston Celtics**

Same for:
- Player nicknames
- Abbreviations
- Partial names

---

## 5️⃣ Manual Mode V1.1 (Fully Smart)

**Manual mode does NOT mean free chaos.**

Manual Mode must still:
- Pull sport registry
- Validate team belongs to sport
- Validate player belongs to team
- Validate prop belongs to sport

> Manual mode simply **bypasses game selection**,
> NOT relational validation.

---

## 6️⃣ Player ↔ Team ↔ Game Enforcement

Player prop must require:
- ✅ Valid team
- ✅ Valid sport
- ✅ Team must match player
- ✅ Player must match sport

**Cannot submit:**
- ❌ `Jaylen Brown – NFL`

**Cannot submit:**
- ❌ `LeBron James – Warriors`

System must **reject mismatches**.

---

## 7️⃣ Prop Type Enforcement by Sport

Stat types must be filtered by sport.

### NBA:
- PTS
- REB
- AST
- PRA
- 3PM

### NFL:
- Passing Yards
- Rushing Yards
- Receptions
- Anytime TD

### MLB:
- Total Bases
- Strikeouts
- Hits
- HR

> Smart Form **must not allow**:
> NBA player with Passing Yards.

---

## 8️⃣ Ticket-Level Intelligence

### 8.1 Parlay Validation

- All legs must share compatible sport rules
- `leg_index` enforced
- Duplicate leg detection
- Combined odds preview
- `ticket_type = parlay` auto-set

### 8.2 Auto-Combined Odds

If odds available for legs:
- Combined odds must compute live

If unavailable:
- Show "Combined Odds Pending"

---

## 9️⃣ Smart Autofill Rules

When selecting:

| Selection | Auto-Filled |
|-----------|-------------|
| Player | Team, Sport |
| Team | Sport |
| Game | Teams, Sport |
| Sport | Filters leagues |
| League | Filters games |

**No downstream stale values allowed.**

---

## 🔟 Real-Time DB Sync Contract

Smart Form must:
- Pull fresh data on mount
- Cache intelligently
- Revalidate on submission
- Never rely solely on client state

Submission must cross-check:
- ✅ Player exists
- ✅ Team exists
- ✅ Sport valid
- ✅ `bet_type` valid
- ✅ `stat_type` valid

---

## 1️⃣1️⃣ Lifecycle Field Completeness

Submission must include:

| Field | Required |
|-------|----------|
| `bet_type` | ✅ |
| `ticket_type` | ✅ |
| `sport` | ✅ |
| `league` | ✅ |
| `team` | ✅ |
| `opponent` | (if applicable) |
| `player_name` | (if prop) |
| `stat_type` | (if prop) |
| `direction` | (if required) |
| `line` | ✅ |
| `odds` | ✅ |
| `units` | ✅ |
| `source` | (api/manual) |
| `leg_index` | ✅ |

**Missing any required field = hard reject.**

---

## 1️⃣2️⃣ Performance Standards

**Enterprise requirement:**

| Metric | Target |
|--------|--------|
| Autocomplete | < 200ms |
| Cascading filters | Instant |
| Dropdown lag | None |
| Stale API calls | None |

- `AbortController` used
- Cached registry loaded once

---

## 1️⃣3️⃣ UX Contract (Fortune-100 Level)

Form must:
- Be visually clean
- Clearly separate legs
- Clearly separate ticket-level controls
- Show live preview
- Show validation inline
- Support keyboard-only use
- Allow quick multi-leg building

**No scroll chaos.**
**No hidden required fields.**

---

## 1️⃣4️⃣ Full Lifecycle Compatibility

Smart Form must produce data compatible with:

### ScoringAgent
- Must receive correct `bet_type`
- Must receive correct `stat_type`
- Must receive correct `team`

### AlertAgent
- Must have correct player/team/sport

### DiscordPromotionAgent
- Must not fallback to wrong embed type

### SettlementAgent
- Must match `game_id` and `stat_type`

---

## 1️⃣5️⃣ Build & Version Integrity

Smart Form must:
- ✅ Display build SHA
- ✅ Match API SHA
- ✅ Refuse submission if mismatch
- ✅ Warn if API unavailable

---

## 1️⃣6️⃣ Regression Guardrails

**The following must be impossible:**

| Anti-Pattern | Status |
|--------------|--------|
| Defaulting `bet_type` to moneyline | ❌ BLOCKED |
| `player_name` null on player_prop | ❌ BLOCKED |
| `team` null on spread | ❌ BLOCKED |
| `stat_type` null on prop | ❌ BLOCKED |
| Wrong sport on prop | ❌ BLOCKED |
| Multiple posting paths | ❌ BLOCKED |
| Stale container versions | ❌ BLOCKED |

---

## 1️⃣7️⃣ Acceptance Criteria (V1.1)

**Smart Form V1.1 is complete ONLY if:**

- [ ] All filtering cascades work
- [ ] Manual mode enforces relational validation
- [ ] All bet types work
- [ ] Parlay works
- [ ] Combined odds compute
- [ ] No silent defaults
- [ ] Version mismatch detection works
- [ ] Lifecycle compatibility verified
- [ ] No embed corruption
- [ ] No posting race possible
- [ ] Full E2E submission test passes

---

## 1️⃣8️⃣ Governance Clause

> If any behavior exists in UI **not defined here**:
> **It must be removed.**

> If any code allows **bypass of this contract**:
> **It must be blocked.**

> If Smart Form behavior deviates from **sportsbook-style dependency filtering**:
> **It must be rewritten.**

---

## This Is Now The Standard.

**Document Version:** V1.1
**Effective Date:** 2026-02-18
**Owner:** Griff
**Enforcement:** Mandatory for all Smart Form development
