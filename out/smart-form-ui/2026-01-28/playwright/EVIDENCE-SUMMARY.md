# Smart Form UI Audit - Playwright Evidence Summary
## Date: 2026-01-28

## Screenshots Captured

| File | Description | Bug Evidence |
|------|-------------|--------------|
| ISSUE-01-initial-state.png | Initial form state on page load | Form header visible |
| ISSUE-02-cappers-still-loading.png | Capper dropdown stuck loading | **BUG: Cappers never load** |
| ISSUE-03-full-page-step1.png | Full page view of Step 1 | Shows "Loading cappers...", no sport selected, sidebar shows "Not set" |
| ISSUE-04-sport-selected-but-sidebar-not-updated.png | NBA selected but sidebar unchanged | **BUG: Sport selection doesn't update sidebar** |
| ISSUE-05-ticket-type-deselects-sport.png | After clicking Single ticket type | **BUG: Selecting ticket type deselects sport** |
| ISSUE-06-sport-change-mid-flow.png | NFL selected after switching from NBA | Sport change works but state sync still broken |

## Critical Bugs Identified

### BUG-A: Cappers Never Load
- **Evidence**: ISSUE-02, ISSUE-03
- **Description**: Capper dropdown shows "Loading cappers..." indefinitely
- **Impact**: BLOCKER - User cannot proceed with form submission
- **Console**: ERR_CONNECTION_RESET errors for Next.js chunks

### BUG-B: Sidebar State Not Syncing
- **Evidence**: ISSUE-04, ISSUE-05, ISSUE-06
- **Description**: Selecting sport/ticket type does not update Bet Summary sidebar
- **Impact**: HIGH - User has no feedback on their selections
- **Observed**: Sport "Not set", Type "Not set" even after selection

### BUG-C: Mutual Exclusion Bug
- **Evidence**: ISSUE-05
- **Description**: Clicking ticket type button DESELECTS the sport button
- **Impact**: HIGH - User cannot have both selections active simultaneously
- **Steps to Reproduce**:
  1. Select NBA sport (becomes active)
  2. Select Single ticket type
  3. NBA is deselected, only Single remains active

## Console Errors

```
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ main-app.js
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ page.css
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ page.js
[ERROR] Failed to load resource: net::ERR_CONNECTION_RESET @ webpack.js
```

## Testing Coverage

| Required Flow | Tested | Evidence |
|---------------|--------|----------|
| Change sport mid-flow | YES | ISSUE-06 |
| Select player before sport | BLOCKED | Cappers never loaded |
| Switch player props ↔ game lines | BLOCKED | Cannot reach Step 3 |
| Clear selections | PARTIAL | State resets observed |
| Submit with incomplete fields | BLOCKED | Cannot proceed past Step 1 |

## Compliance Note

**NO CODE CHANGES** were made to the application during this audit.
- Test file created during audit was deleted before closeout
- Git diff shows only pre-existing changes (6 files)
- All evidence is observational via Playwright screenshots

## Audit Artifacts Location

```
out/smart-form-ui/2026-01-28/
├── 00-baseline/
│   ├── git-status-before.txt
│   ├── git-status-after.txt
│   ├── git-diff-after.txt
│   ├── docker-compose-ps.txt
│   ├── smart-form-logs-tail.txt
│   ├── curl-root.txt
│   ├── curl-health.txt
│   ├── curl-cappers.txt
│   ├── env-note.txt
│   ├── playwright-version.txt
│   └── playwright-config-snapshot.txt
└── playwright/
    ├── screens/
    │   ├── ISSUE-01-initial-state.png
    │   ├── ISSUE-02-cappers-still-loading.png
    │   ├── ISSUE-03-full-page-step1.png
    │   ├── ISSUE-04-sport-selected-but-sidebar-not-updated.png
    │   ├── ISSUE-05-ticket-type-deselects-sport.png
    │   └── ISSUE-06-sport-change-mid-flow.png
    ├── logs/
    │   └── console-errors.txt
    └── EVIDENCE-SUMMARY.md
```
