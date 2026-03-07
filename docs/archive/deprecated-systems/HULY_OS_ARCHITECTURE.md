# HULY-OS v1 Architecture

**Version:** 1.0 **Date:** 2026-03-03 **Status:** Active

---

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Branches │  │   PRs    │  │ CI Runs  │  │ GitHub Issues  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬────────┘  │
└───────┼──────────────┼─────────────┼────────────────┼───────────┘
        │              │             │                │
        ▼              ▼             ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    huly-os Daemon                                │
│                                                                  │
│  ┌───────────────────────┐     ┌────────────────────────────┐   │
│  │   Adapters            │     │   Intelligence             │   │
│  │  ┌─────────────────┐  │     │  ┌──────────────────────┐  │   │
│  │  │ GitHubAdapter   │  │     │  │ LLM Summarizer      │  │   │
│  │  │ • listOpenPRs   │  │     │  │ • OpenAI / Anthropic │  │   │
│  │  │ • mergedPRs     │  │     │  │ • Deterministic FB   │  │   │
│  │  │ • repoSummary   │  │     │  └──────────────────────┘  │   │
│  │  │ • workflowRuns  │  │     │  ┌──────────────────────┐  │   │
│  │  └─────────────────┘  │     │  │ Task Generator       │  │   │
│  │  ┌─────────────────┐  │     │  │ • Fingerprint dedup  │  │   │
│  │  │ HulyAdapter     │  │     │  └──────────────────────┘  │   │
│  │  │ • listIssues    │  │     │  ┌──────────────────────┐  │   │
│  │  │ • upsertIssue   │  │     │  │ Auto PR Generator    │  │   │
│  │  │ • updateStatus  │  │     │  │ • Path allowlist     │  │   │
│  │  │ • linkIssueToPR │  │     │  └──────────────────────┘  │   │
│  │  │ • addComment    │  │     └────────────────────────────┘   │
│  │  │ • upsertDoc     │  │                                      │
│  │  └─────────────────┘  │     ┌────────────────────────────┐   │
│  └───────────────────────┘     │   Engine                    │   │
│                                │  ┌──────────────────────┐  │   │
│  ┌───────────────────────┐     │  │ Drift Rules          │  │   │
│  │   Orchestration       │     │  │ • PR_WITHOUT_ISSUE   │  │   │
│  │  ┌─────────────────┐  │     │  │ • DONE_NO_PROOF      │  │   │
│  │  │ Sprint Manager  │  │     │  │ • CI_FAILURE         │  │   │
│  │  │ • State Machine │  │     │  │ • PROOF_MISSING      │  │   │
│  │  │ • PR Linking    │  │     │  │ • ORPHAN_PR          │  │   │
│  │  │ • CI Tracking   │  │     │  └──────────────────────┘  │   │
│  │  │ • Proof Valid.  │  │     │  ┌──────────────────────┐  │   │
│  │  └─────────────────┘  │     │  │ Report Builder       │  │   │
│  │  ┌─────────────────┐  │     │  │ • JSON + Markdown    │  │   │
│  │  │ Report Runner   │  │     │  └──────────────────────┘  │   │
│  │  │ • Full pipeline │  │     └────────────────────────────┘   │
│  │  └─────────────────┘  │                                      │
│  │  ┌─────────────────┐  │     ┌────────────────────────────┐   │
│  │  │ Publish Orch.   │  │     │   Infrastructure           │   │
│  │  │ • doc→issue→cmt │  │     │  ┌──────────────────────┐  │   │
│  │  └─────────────────┘  │     │  │ Operator Scheduler   │  │   │
│  │  ┌─────────────────┐  │     │  │ • Interval timer     │  │   │
│  │  │ Operator Sched. │  │     │  │ • Deep run at 3am    │  │   │
│  │  └─────────────────┘  │     │  └──────────────────────┘  │   │
│  │  ┌─────────────────┐  │     │  ┌──────────────────────┐  │   │
│  │  │ Event Bus       │  │     │  │ Redis Streams        │  │   │
│  │  │ • Consumer      │  │     │  │ • XADD / XREADGROUP  │  │   │
│  │  │ • Producer      │  │     │  │ • Dedupe (SET NX EX) │  │   │
│  │  └─────────────────┘  │     │  └──────────────────────┘  │   │
│  └───────────────────────┘     └────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Huly (TX API)                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Issues  │  │   Docs   │  │ Comments │  │   Projects     │  │
│  │ tracker: │  │document: │  │ chunter: │  │  tracker:      │  │
│  │ class:   │  │ class:   │  │ class:   │  │  class:        │  │
│  │ Issue    │  │ Document │  │ ChatMsg  │  │  Project       │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Sprint State Machine

```
                  ┌──────────┐
                  │ Planning │
                  └────┬─────┘
                       │ open PR or manual start
                       ▼
                  ┌──────────────┐
           ┌─────│ In Progress  │◄────────┐
           │     └──────┬───────┘         │
           │            │                 │
      CI fail      all PRs merged    fix applied
           │      + proof exists          │
           ▼            │                 │
     ┌──────────┐       ▼           ┌─────┘
     │ Blocked  │─────► ┌────────────────────┐
     └──────────┘  fix  │Ready for Closeout  │
                        └─────────┬──────────┘
                                  │ merge + tag + push
                                  ▼
                            ┌──────────┐
                            │  Closed  │
                            └──────────┘
```

## Idempotency Map

| Operation       | Key                     | Storage              | Method                                  |
| --------------- | ----------------------- | -------------------- | --------------------------------------- |
| Upsert issue    | Title match             | Huly find-all        | `findIssueByTitle()` → create or update |
| Upsert doc      | Title match             | Huly fulltext search | `findDocByTitle()` → create or update   |
| GitHub task     | SHA256 fingerprint      | GitHub issue body    | `findIssueByFingerprint()`              |
| Event dedup     | `{stream}:dedupe:{key}` | Redis SET NX EX      | TTL-based (300s)                        |
| Auto PR         | Branch ref              | GitHub API           | Check ref existence                     |
| PR link comment | `<!-- pr-link:N -->`    | Comment body         | Marker-based dedup                      |

## Drift Rules

| Rule                           | Severity | Trigger                              |
| ------------------------------ | -------- | ------------------------------------ |
| `PR_WITHOUT_ISSUE`             | warning  | Open PR with no UT-\* ref            |
| `ISSUE_IN_PROGRESS_WITHOUT_PR` | warning  | In Progress issue with no PR         |
| `DONE_WITHOUT_PROOF_URL`       | error    | Done issue missing proof_url         |
| `PR_MERGED_ISSUE_NOT_DONE`     | warning  | Merged PR but issue not Done         |
| `CI_FAILURE_ON_SPRINT_BRANCH`  | error    | CI failure on sprint/\* branch       |
| `PROOF_BUNDLE_MISSING`         | error    | Done [SPRINT] issue but no proof dir |
| `ORPHAN_PR`                    | warning  | Merged sprint PR with no Huly match  |

## API Surface

### Huly TX API

| Endpoint                                   | Method | Purpose                          |
| ------------------------------------------ | ------ | -------------------------------- |
| `/_accounts/`                              | POST   | JSON-RPC: login, selectWorkspace |
| `/_transactor/api/v1/find-all/{ws}`        | GET    | Query objects by class           |
| `/_transactor/api/v1/search-fulltext/{ws}` | GET    | Fulltext search                  |
| `/_transactor/api/v1/tx/{ws}`              | POST   | Create/Update via TX envelope    |

### GitHub API (via Octokit)

| Operation     | Octokit Method                      |
| ------------- | ----------------------------------- |
| List PRs      | `pulls.list()`                      |
| Get repo      | `repos.get()`                       |
| List commits  | `repos.listCommits()`               |
| Workflow runs | `actions.listWorkflowRunsForRepo()` |
| Create issue  | `issues.create()`                   |
| Create PR     | `pulls.create()`                    |

## CLI Entry Points

```bash
# Reports
npx tsx daemon/index.ts --dry-run     # GitHub-only report
npx tsx daemon/index.ts --run         # Full report + publish

# Huly Operations
npx tsx daemon/huly-ops.ts list       # List issues
npx tsx daemon/huly-ops.ts rebuild    # Create project structure
npx tsx daemon/huly-ops.ts full       # List + purge + rebuild

# Automation
npx tsx daemon/index.ts --operator    # Scheduled report cycles
npx tsx daemon/index.ts --bus         # Event bus consumer

# Backfill & Publish
npx tsx scripts/backfill-huly-issues.ts   # Link PRs to Huly
npx tsx scripts/publish-os-docs.ts        # Publish OS documents
```
