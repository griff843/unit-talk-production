# Huly-Git Integration Plan

**Based on:** HULY_CAPABILITY_AUDIT.md, HULY_UNIT_TALK_OPERATING_MODEL.md
**Date:** 2026-03-03 **Constraint:** No webhooks available in Huly self-hosted.
All integration is push/pull via TX API and GitHub API.

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                     GitHub                                │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Branches │  │  PRs    │  │ CI Runs  │  │  Issues   │ │
│  └────┬─────┘  └────┬────┘  └────┬─────┘  └─────┬─────┘ │
│       │             │            │               │       │
└───────┼─────────────┼────────────┼───────────────┼───────┘
        │             │            │               │
        ▼             ▼            ▼               ▼
┌──────────────────────────────────────────────────────────┐
│              huly-os daemon (pull-based)                  │
│                                                          │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │ GitHub     │  │ Drift Rules  │  │ Report Generator  │ │
│  │ Adapter    │→ │ Engine       │→ │ + LLM Summarizer  │ │
│  └────────────┘  └──────────────┘  └────────┬─────────┘ │
│                                              │           │
│  ┌────────────┐  ┌──────────────┐            │           │
│  │ Huly       │← │ Publish      │←───────────┘           │
│  │ Adapter    │  │ Orchestrator │                         │
│  └────────────┘  └──────────────┘                         │
│                                                          │
│  ┌────────────────────────────┐  ┌────────────────────┐  │
│  │ Event Bus (Redis Streams)  │  │ Operator Scheduler  │  │
│  └────────────────────────────┘  └────────────────────┘  │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│                     Huly (TX API)                         │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────┐ │
│  │ Issues  │  │ Documents│  │ Comments  │  │ Projects│ │
│  └─────────┘  └──────────┘  └───────────┘  └─────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Deterministic Mapping: Sprint ↔ Branch ↔ PR ↔ CI ↔ Proof

### The Linkage Chain

```
Sprint ID: SPRINT-EVENT-BUS-011
    │
    ├── Huly Issue: [SPRINT] SPRINT-EVENT-BUS-011
    │   └── Status: Todo → In Progress → Done
    │   └── Description contains: proof_url: out/sprints/SPRINT-EVENT-BUS-011/...
    │
    ├── Git Branch: sprint/event-bus-011
    │   └── Naming rule: lowercase(sprint-id), replace SPRINT- prefix
    │
    ├── GitHub PRs: title/body/branch contains "UT-<N>" refs
    │   └── PR branch matches sprint pattern
    │   └── Drift rule: PR_WITHOUT_ISSUE catches unlinked PRs
    │
    ├── CI Runs: triggered by push to sprint branch
    │   └── CI passes → proof artifacts generated
    │   └── CI fails → event:emit ci.workflow_failed (via event bus)
    │
    └── Proof Bundle: out/sprints/SPRINT-EVENT-BUS-011/<DATE>/
        └── Contains: proof_tests.txt, proof_typecheck.txt, proof_gate.txt
        └── SPRINT_CLOSEOUT_REPORT.md references all artifacts
```

### Mapping Table

| Sprint ID      | Git Branch     | Huly Issue              | PR Pattern      | Proof Path                  | Git Tag                 |
| -------------- | -------------- | ----------------------- | --------------- | --------------------------- | ----------------------- |
| `SPRINT-X-###` | `sprint/x-###` | `[SPRINT] SPRINT-X-###` | `UT-*` in title | `out/sprints/SPRINT-X-###/` | `SPRINT-X-###-COMPLETE` |

### Lookup Functions

```typescript
// Sprint ID → Branch name
function sprintToBranch(sprintId: string): string {
  return `sprint/${sprintId.replace(/^SPRINT-/, '').toLowerCase()}`;
}

// Branch name → Sprint ID (reverse)
function branchToSprint(branch: string): string | null {
  const m = branch.match(/^sprint\/(.+)$/);
  return m ? `SPRINT-${m[1].toUpperCase()}` : null;
}

// Sprint ID → Huly issue title
function sprintToIssueTitle(sprintId: string): string {
  return `[SPRINT] ${sprintId}`;
}

// Sprint ID → Proof path
function sprintToProofPath(sprintId: string, date: string): string {
  return `out/sprints/${sprintId}/${date}`;
}

// Sprint ID → Git tag
function sprintToTag(sprintId: string): string {
  return `${sprintId}-COMPLETE`;
}
```

---

## 3. Idempotency Design

### Principle

Every daemon operation must be safe to retry. Same input = same outcome = no
side effects.

### Idempotency Keys by Operation

| Operation            | Key                                  | Storage              | Check Method                                   |
| -------------------- | ------------------------------------ | -------------------- | ---------------------------------------------- |
| Create sprint issue  | Title match: `[SPRINT] SPRINT-X-###` | Huly find-all        | Search issues by title before creating         |
| Create epic issue    | Title match: `[EPIC] PHASE N — ...`  | Huly find-all        | Search issues by title before creating         |
| Create task (GitHub) | SHA256 fingerprint in body           | GitHub issue search  | `findIssueByFingerprint()`                     |
| Publish doc          | Document title match                 | Huly fulltext search | `findDocByTitle()` → upsert                    |
| Event dedup          | `{stream}:dedupe:{dedupeKey}`        | Redis SET NX EX      | TTL-based (300s default)                       |
| Auto PR              | Branch ref existence                 | GitHub API           | Check ref before creating                      |
| Status transition    | Current status check                 | Huly find-all        | Only transition if not already in target state |

### Implementation: Idempotent Issue Upsert

```typescript
async function upsertSprintIssue(
  session: HulySession,
  sprintId: string,
  description: string
): Promise<{ id: string; created: boolean }> {
  const title = `[SPRINT] ${sprintId}`;
  const issues = await listIssues(session); // find-all
  const existing = issues.find(i => i.title === title);

  if (existing) {
    // Update description only (idempotent)
    await updateIssueDescription(
      session,
      existing._id,
      description,
      existing.space
    );
    return { id: existing._id, created: false };
  }

  const id = await createIssue(session, projectSpace, title, description);
  return { id, created: true };
}
```

---

## 4. Failure Handling

### Failure Modes and Recovery

| Failure                    | Impact                               | Recovery                                      | Fail Mode                              |
| -------------------------- | ------------------------------------ | --------------------------------------------- | -------------------------------------- |
| Huly unreachable           | Cannot publish reports/update issues | Retry on next cycle; artifacts saved locally  | **Fail-open** (report still generated) |
| GitHub unreachable         | Cannot fetch PRs/issues              | Hard fail — no report without GitHub data     | **Fail-closed**                        |
| Redis unreachable          | Event bus consumer cannot start      | Consumer exits with error; operator continues | **Fail-open** for operator             |
| TX API returns non-200     | Individual write failed              | Log error, continue with remaining operations | **Fail-open** per operation            |
| LLM provider unreachable   | No AI summary                        | Deterministic fallback generates summary      | **Fail-open**                          |
| Status transition conflict | Issue already in target state        | Skip silently (idempotent)                    | **Fail-open**                          |
| Proof artifacts missing    | Cannot close sprint                  | Block sprint closure                          | **Fail-closed**                        |

### Retry Strategy

```
Operator scheduler:     retry = next cycle (OPERATOR_INTERVAL_MINUTES)
Event bus consumer:     retry = 5s delay on connection error, 1s on other errors
Individual TX:          no retry — logged and skipped
GitHub API:             Octokit built-in retry (3 attempts)
LLM calls:             no retry — fallback to deterministic
```

### Dead Letter Pattern

Events that fail processing are still ACKed (to prevent infinite redelivery) but
logged with full context to
`out/operator-events/{date}/event-{id}-{timestamp}.json`. Manual investigation
required.

---

## 5. Minimal Required Fields

### For Issue Creation (Huly)

| Field                 | Required | Notes                                      |
| --------------------- | -------- | ------------------------------------------ |
| `title`               | Yes      | Must follow prefix convention              |
| `description`         | Yes      | Contains proof_url when done               |
| `space` (objectSpace) | Yes      | Project ID: `project-1772590741040-fmqcuy` |
| `priority`            | No       | Defaults to 0 (no priority)                |
| `status`              | No       | Defaults to project's `defaultIssueStatus` |
| `assignee`            | No       | Auto-assigned by project default           |

### For Issue Status Update (Huly)

| Field               | Required | Notes                                          |
| ------------------- | -------- | ---------------------------------------------- |
| `objectId`          | Yes      | Issue `_id`                                    |
| `objectSpace`       | Yes      | Issue's `space` field                          |
| `operations.status` | Yes      | Target status ID (e.g., `tracker:status:Done`) |

### For PR-to-Issue Linking (GitHub)

| Field            | Required    | Notes                                |
| ---------------- | ----------- | ------------------------------------ |
| PR title or body | Yes         | Must contain `UT-<N>` pattern        |
| PR branch        | Recommended | Should match `sprint/<name>` pattern |

### For Proof Validity

| Field                             | Required | Notes                          |
| --------------------------------- | -------- | ------------------------------ |
| `proof_url:` in issue description | Yes      | Path to closeout report        |
| Closeout report file              | Yes      | Must exist at referenced path  |
| All proof\_\*.txt files           | Yes      | gate, tests, typecheck minimum |

---

## 6. GitHub Actions Integration

### Current State

The repo has CI workflows at `.github/workflows/`. The daemon does not directly
integrate with CI — it reads CI results via GitHub API.

### Recommended: Post-CI Event Emission

Add a step to the CI workflow that emits an event to Redis Stream when CI fails:

```yaml
# .github/workflows/ci.yml (addition to existing)
notify-failure:
  if: failure()
  runs-on: ubuntu-latest
  needs: [build, test, lint]
  steps:
    - name: Emit CI failure event
      # Only if Redis is reachable (self-hosted runner or VPN)
      run: |
        # Option A: Direct Redis CLI
        redis-cli -u $EVENTBUS_REDIS_URL XADD ut:events '*' \
          data '{"id":"${{ github.run_id }}","type":"ci.workflow_failed","ts":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","source":"ci","payload":{"workflow":"${{ github.workflow }}","branch":"${{ github.ref_name }}","sha":"${{ github.sha }}","run_url":"${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}}'

        # Option B: Use the daemon's emit CLI (if self-hosted runner has node)
        # cd tools/huly-os && npx tsx daemon/event-bus/emit-cli.ts \
        #   --type ci.workflow_failed \
        #   --source ci \
        #   --payload '{"workflow":"...", "sha":"..."}'
      env:
        EVENTBUS_REDIS_URL: ${{ secrets.EVENTBUS_REDIS_URL }}
```

**Constraint:** This only works if CI runners can reach the Redis instance. For
GitHub-hosted runners, Redis must be publicly reachable or behind a VPN. **Not
recommended for production.** Better alternative: use GitHub Actions webhook →
intermediary service → Redis.

### Alternative: GitHub API Polling

The daemon already queries GitHub for PRs and repo summary. Extend to also query
workflow runs:

```typescript
// New method in github-adapter.ts
async function getRecentWorkflowRuns(
  owner: string,
  repo: string,
  branch?: string,
  status?: 'completed' | 'failure'
): Promise<WorkflowRun[]> {
  const { data } = await octokit.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    branch,
    status,
    per_page: 10,
  });
  return data.workflow_runs;
}
```

**This is the recommended approach.** No infrastructure changes needed. The
daemon polls GitHub on each cycle and detects failures.

---

## 7. Daemon Changes Required

### Priority 1: Bidirectional Status Sync

**File:** `tools/huly-os/daemon/adapters/huly-adapter.ts`

Add methods:

```typescript
// Update issue status
async updateIssueStatus(issueId: string, statusId: string, space: string): Promise<void>

// Find issue by title (exact match)
async findIssueByTitle(projectId: string, title: string): Promise<HulyIssue | null>

// Upsert issue (idempotent by title)
async upsertIssue(
  projectId: string,
  title: string,
  description: string,
  extra?: Record<string, unknown>
): Promise<{ id: string; created: boolean }>
```

### Priority 2: Sprint Lifecycle Integration

**File:** `tools/huly-os/daemon/report-runner.ts`

After generating the report, add a step:

```typescript
// After publish, sync sprint status in Huly
if (!dryRun && hulyAdapter) {
  await syncSprintStatus(hulyAdapter, config, report);
}
```

`syncSprintStatus` would:

1. Detect the current sprint from git branch name
2. Find the matching `[SPRINT]` issue in Huly
3. If sprint branch has merged PRs → status = InProgress
4. If sprint tag exists → status = Done + add proof_url

### Priority 3: CI Run Awareness

**File:** `tools/huly-os/daemon/adapters/github-adapter.ts`

Add workflow run querying:

```typescript
async getFailedWorkflowRuns(days: number): Promise<WorkflowRun[]>
```

**File:** `tools/huly-os/daemon/drift-rules.ts`

Add rule:

```typescript
// CI_FAILURE_ON_SPRINT_BRANCH: Sprint branch has failing CI
{
  ruleId: 'CI_FAILURE_ON_SPRINT_BRANCH',
  severity: 'error',
  entityType: 'pr',
  message: 'Sprint branch has failing CI — cannot close sprint',
}
```

### Priority 4: Backfill Existing PRs

Create a one-time script:

**File:** `tools/huly-os/daemon/backfill-linkages.ts`

```typescript
// For each merged PR:
//   1. Extract UT-* refs from title/body/branch
//   2. Find matching Huly issues
//   3. Add comment: "Linked to PR #{number}: {title}"
//   4. If PR is merged and issue is not Done, flag as drift
```

---

## 8. Huly Adapter Method Inventory (Current + Proposed)

### Current Methods (confirmed working)

| Method                                 | Purpose                              |
| -------------------------------------- | ------------------------------------ |
| `connect()`                            | Authenticate and get workspace token |
| `ping()`                               | Health check                         |
| `listIssues(project)`                  | List all issues in project           |
| `createIssue(project, title, body)`    | Create new issue                     |
| `updateIssue(id, body)`                | Update issue description             |
| `addComment(id, body)`                 | Add comment to issue                 |
| `upsertDoc(teamspace, title, content)` | Create or update document            |
| `findDocByTitle(title)`                | Search for document by title         |

### Proposed Additions

| Method                                   | Purpose                        | Sprint |
| ---------------------------------------- | ------------------------------ | ------ |
| `updateIssueStatus(id, statusId, space)` | Change issue status            | Next   |
| `findIssueByTitle(project, title)`       | Find issue by exact title      | Next   |
| `upsertIssue(project, title, desc)`      | Idempotent issue create/update | Next   |
| `getIssueById(id)`                       | Fetch single issue by ID       | Next   |

---

## 9. Backfill Plan for Existing PRs

### Scope

All merged PRs in `griff843/unit-talk-production` since the project started.

### Steps

1. **Fetch all merged PRs** via `listRecentlyMergedPRs(90)` (last 90 days)
2. **Extract issue refs** from each PR (regex: `UT-\d+`, `SPRINT-*`)
3. **Match to Huly issues** by searching issue titles
4. **For matched pairs:**
   - Add comment to Huly issue: `Linked to PR #N: {title} (merged {date})`
   - If issue status is not Done and PR is merged: flag as drift violation
5. **For unmatched PRs:**
   - Log as `PR_WITHOUT_ISSUE` drift violation
6. **Output:** backfill report saved to `out/ops/backfill/`

### Idempotency

Comments are not idempotent by default (Huly has no comment dedup). To prevent
duplicate comments on re-run:

- Include a fingerprint line in the comment: `<!-- backfill:PR#{number} -->`
- Before adding comment, search existing comments (if API supports it) or track
  in a local state file

**Limitation:** Huly find-all for `chunter:class:ChatMessage` returned 0 in our
audit — comments may not be queryable via the REST API. Fallback: maintain a
local `backfill-state.json` file tracking which PRs have been linked.

---

## 10. Implementation Sprint Proposal

### SPRINT-HULY-GIT-SYNC-012

**Objective:** Implement bidirectional Huly-Git status sync and PR linkage.

**Tasks:**

| #   | Task                                                                            | Priority | Estimate |
| --- | ------------------------------------------------------------------------------- | -------- | -------- |
| 1   | Add `updateIssueStatus()`, `findIssueByTitle()`, `upsertIssue()` to HulyAdapter | P1       | Small    |
| 2   | Add `getFailedWorkflowRuns()` to GitHubAdapter                                  | P2       | Small    |
| 3   | Add sprint status sync step to report-runner.ts                                 | P1       | Medium   |
| 4   | Add `CI_FAILURE_ON_SPRINT_BRANCH` drift rule                                    | P2       | Small    |
| 5   | Create backfill-linkages.ts script                                              | P3       | Medium   |
| 6   | Add `huly:backfill` script to package.json                                      | P3       | Trivial  |
| 7   | Update huly-ops.ts with idempotent upsert                                       | P1       | Small    |
| 8   | Verify: type-check, lint, functional test                                       | Gate     | Required |

**Sprint branch:** `sprint/huly-git-sync-012` **Sprint tag:**
`SPRINT-HULY-GIT-SYNC-012-COMPLETE`

### Definition of Done

- [ ] All new adapter methods pass functional test
- [ ] Sprint status sync runs in daemon --run mode
- [ ] Drift rule catches CI failures on sprint branches
- [ ] Backfill script links at least 1 existing PR
- [ ] Type-check passes
- [ ] Lint passes
- [ ] Proof artifacts generated

---

## 11. Future Enhancements (Not in Scope)

| Enhancement                  | Dependency                                | Notes                                   |
| ---------------------------- | ----------------------------------------- | --------------------------------------- |
| Huly webhook receiver        | Huly version upgrade with webhook support | Would enable push-based sync            |
| GitHub App webhook           | Public endpoint or tunnel                 | Would eliminate polling for PR events   |
| Native sprint objects        | Huly API for `tracker:class:Sprint`       | Currently 0 objects; may need UI config |
| Tag/label assignment         | `tags:class:TagReference` creation        | Not confirmed working via TX API        |
| Issue parent/child relations | `tracker:class:IssueRelation`             | Not confirmed working via TX API        |
| Real-time WebSocket          | Huly WebSocket API                        | Would enable live dashboard updates     |
