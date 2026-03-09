# Huly Unit Talk Operating Model

**Based on:** HULY_CAPABILITY_AUDIT.md (2026-03-03) **Principle:** Use only what
the API confirms. No UI-dependent features. Fail-closed.

---

## 1. Project Structure

### Single Project: UT (Truth & Automation)

All Unit Talk work lives in one tracker project. No separate projects for
apps/packages — that creates tracking overhead without value at our scale.

**Project ID:** `project-1772590741040-fmqcuy` **Identifier:** `UT`

### Issue Taxonomy (Convention-Based)

Since Huly's API does not expose native epics, sprints, milestones, or
components, we use **title prefix conventions** enforced by the daemon:

| Prefix     | Purpose                                         | Example                                         |
| ---------- | ----------------------------------------------- | ----------------------------------------------- |
| `[EPIC]`   | Multi-sprint initiative                         | `[EPIC] PHASE 1 — Structural Dominance`         |
| `[SPRINT]` | Sprint tracking issue                           | `[SPRINT] SPRINT-CI-MAIN-GREEN-003`             |
| `[TASK]`   | Sprint work item (optional — bare title = task) | `Wire event bus consumer`                       |
| `[BUG]`    | Defect                                          | `[BUG] Bridge worker drops events on reconnect` |
| `[PROOF]`  | Proof bundle issue (auto-generated)             | `[PROOF] SPRINT-EVENT-BUS-011 closeout`         |

**Enforcement:** The daemon's drift rules validate prefix consistency. Issues
with `[SPRINT]` prefix must contain a `SPRINT-*` ID in the title.

### Priority Mapping

| Priority | Huly Value | Meaning           |
| -------- | ---------- | ----------------- |
| Urgent   | 1          | Blocks other work |
| High     | 2          | Current sprint    |
| Medium   | 3          | Next sprint       |
| Low      | 4          | Backlog           |

---

## 2. Status Workflow

### Linear Flow (5 states)

```
Backlog → Todo → In Progress → Done
                               ↘ Canceled
```

| Status          | ID                          | When                               |
| --------------- | --------------------------- | ---------------------------------- |
| **Backlog**     | `tracker:status:Backlog`    | Ideas, unplanned work, parking lot |
| **Todo**        | `tracker:status:Todo`       | Planned for a sprint, not started  |
| **In Progress** | `tracker:status:InProgress` | Active development                 |
| **Done**        | `tracker:status:Done`       | Verified complete with proof       |
| **Canceled**    | `tracker:status:Canceled`   | Abandoned or superseded            |

### Governance Rules

1. **Done requires proof.** The daemon drift rule `DONE_WITHOUT_PROOF_URL` flags
   any issue marked Done without `proof_url:` in the description. This is a hard
   error.
2. **In Progress requires a PR or branch.** The drift rule
   `ISSUE_IN_PROGRESS_WITHOUT_PR` flags issues in "In Progress" with no
   associated PR.
3. **Canceled requires a comment.** Convention: add a comment explaining why
   before canceling.

---

## 3. Sprint Execution Model

### Sprint Lifecycle

```
1. PLAN     → Create [SPRINT] issue in Huly (status: Todo)
               Create branch: sprint/<sprint-id>
2. EXECUTE  → Move [SPRINT] to In Progress
               Open PRs referencing UT-* issues
3. VERIFY   → Run gates (type-check, lint, tests, single-writer)
               Generate proof artifacts
4. CLOSE    → Add proof_url to [SPRINT] description
               Move [SPRINT] to Done
               Merge branch to main
               Tag: SPRINT-<ID>-COMPLETE
5. REPORT   → Daemon publishes reality report
```

### Sprint-to-Git Mapping

| Huly Entity                   | Git Entity                                   | Link                              |
| ----------------------------- | -------------------------------------------- | --------------------------------- |
| `[SPRINT] SPRINT-X-###` issue | Branch `sprint/x-###`                        | Branch name matches sprint ID     |
| `[TASK]` issues under sprint  | PRs on sprint branch                         | PR title/body contains `UT-<N>`   |
| `[PROOF]` issue               | Tag `SPRINT-X-###-COMPLETE`                  | Tag name matches sprint ID        |
| Sprint issue description      | `out/sprints/<ID>/SPRINT_CLOSEOUT_REPORT.md` | `proof_url:` field in description |

### Idempotency Keys

| Entity              | Idempotency Key                     | Mechanism                     |
| ------------------- | ----------------------------------- | ----------------------------- |
| Sprint issue        | Sprint ID in title (`SPRINT-X-###`) | Search by title before create |
| Task issue (GitHub) | SHA256 fingerprint in body          | `task_fingerprint` code block |
| Proof doc (Huly)    | Document title                      | `findDocByTitle()` → upsert   |
| Event bus event     | `dedupeKey` field                   | Redis SET NX EX               |
| Auto PR             | Branch name                         | GitHub ref existence check    |

---

## 4. Document Publishing Strategy

### Layered Fallback (existing)

```
Surface 1: Upsert Doc in Teamspace → success? done
Surface 2: Create Issue in Project  → success? done
Surface 3: Comment on Fallback Issue → success? done
All fail → throw error
```

### Document Types

| Document        | Teamspace  | Purpose                               |
| --------------- | ---------- | ------------------------------------- |
| Reality Reports | Operations | Daemon-generated drift/health reports |
| Sprint Closeout | Operations | Sprint completion documentation       |
| Proof Bundles   | Operations | CI/test/gate output summaries         |

### Recommended Teamspace Setup

Create an "Operations" teamspace via `huly-ops.ts` or Huly UI:

- **Purpose:** All daemon-published documents
- **Access:** All project members (auto-join)
- **Naming convention:** `{SprintID} — {ReportType}`

---

## 5. Communication Model

### Issue Comments

Comments are the primary communication channel between daemon and humans:

- **Daemon posts:** Status updates, proof links, drift warnings
- **Humans post:** Approvals, questions, overrides

### Channels

| Channel       | Purpose                                |
| ------------- | -------------------------------------- |
| `#general`    | Team announcements (via Huly UI only)  |
| `#random`     | Informal (via Huly UI only)            |
| Issue threads | Per-issue discussion (daemon + humans) |

**Note:** Channel posting via API is possible (`chunter:class:ChatMessage` with
channel ID as `objectSpace`) but not currently implemented in the daemon.

---

## 6. Daemon Operating Modes

### Mode 1: Manual Sprint (current default)

```
Developer → runs huly-ops.ts → creates sprint structure
Developer → codes → opens PRs
Developer → runs daemon --dry-run → gets drift report
Developer → fixes drift → runs daemon --run → publishes to Huly
```

### Mode 2: Scheduled Operator

```
Operator scheduler → runs every OPERATOR_INTERVAL_MINUTES
  Normal cycle: --dry-run (no Huly writes)
  Deep cycle (OPERATOR_DEEP_RUN_HOUR): --run (publishes)
```

### Mode 3: Event-Driven

```
External system → publishes to Redis Stream
Event bus consumer → reads events → triggers report cycle
  repo.push / repo.pr_opened → dry-run
  ci.workflow_failed → deep run (publishes)
```

### Recommended: Mode 1 + Mode 2

- Run operator scheduler for background monitoring
- Deep run at 3am UTC publishes daily reality report
- Developers use `huly-ops.ts` for sprint management
- Event bus reserved for future CI integration

---

## 7. Proof Requirements

### Every "Done" Issue Must Have

```
proof_url: out/sprints/SPRINT-X-###/2026-03-03/SPRINT_CLOSEOUT_REPORT.md
```

This URL is embedded in the issue description. The daemon drift rule
`DONE_WITHOUT_PROOF_URL` enforces this.

### Proof Bundle Contents

```
out/sprints/<SPRINT>/<DATE>/
  proofs/
    proof_git_status.txt
    proof_tests.txt
    proof_typecheck.txt
    proof_build.txt
    proof_gate.txt
  diffs/
    *.diff
  SPRINT_CLOSEOUT_REPORT.md
```

---

## 8. What We Do NOT Use

These Huly features are installed but not part of our operating model:

| Feature        | Reason                                                 |
| -------------- | ------------------------------------------------------ |
| Board (Kanban) | Issue tracker is sufficient; board adds visual clutter |
| HR / Employee  | Not relevant to platform ops                           |
| Training       | Could be used for runbooks later; not now              |
| Lead / CRM     | Not relevant                                           |
| Calendar       | Sprints are tracked via issues, not calendar events    |
| Drive          | File artifacts live in git, not Huly                   |
| Automations    | Not API-accessible; all automation is daemon-driven    |
| Surveys        | Not relevant                                           |

---

## 9. Access Model

### Current Users

| SocialID                               | Role                   | Notes               |
| -------------------------------------- | ---------------------- | ------------------- |
| `1154988849726455809`                  | Daemon service account | ops@unit-talk.local |
| `1eafa958-6c8d-408f-86ec-fda69d01e43a` | Human admin            | Workspace owner     |

### Principle of Least Privilege

- Daemon account: Create/Update issues, Create comments, Upsert docs. No delete.
- Human admin: Full access via UI for manual overrides.
- No additional accounts needed at current scale.

---

## 10. Naming Conventions Summary

| Entity         | Pattern                       | Example                                                                 |
| -------------- | ----------------------------- | ----------------------------------------------------------------------- |
| Sprint ID      | `SPRINT-<NAME>-###`           | `SPRINT-EVENT-BUS-011`                                                  |
| Sprint branch  | `sprint/<name>-###`           | `sprint/event-bus-011`                                                  |
| Sprint tag     | `SPRINT-<NAME>-###-COMPLETE`  | `SPRINT-EVENT-BUS-011-COMPLETE`                                         |
| Epic issue     | `[EPIC] PHASE N — Title`      | `[EPIC] PHASE 1 — Structural Dominance`                                 |
| Sprint issue   | `[SPRINT] SPRINT-<NAME>-###`  | `[SPRINT] SPRINT-SFACTORY-V1-000`                                       |
| PR title       | Contains `UT-<N>`             | `fix(UT-42): resolve bridge timeout`                                    |
| Proof URL      | `out/sprints/<ID>/<DATE>/...` | `out/sprints/SPRINT-EVENT-BUS-011/2026-03-03/SPRINT_CLOSEOUT_REPORT.md` |
| Huly doc title | `{SprintID} — Reality Report` | `SPRINT-EVENT-BUS-011 — Reality Report`                                 |
