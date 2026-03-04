# HULY-OS v1 Runbook

**Version:** 1.0 **Date:** 2026-03-03

---

## Prerequisites

```bash
# Required
node -v          # v22+
pnpm -v          # v10+
docker --version # 29+

# Huly must be running
curl -s http://localhost:8087 | head -c 100

# .env configured
cat tools/huly-os/.env
```

## Daily Operations

### 1. Health Check (Dry Run)

```bash
cd tools/huly-os
npx tsx daemon/index.ts --dry-run
```

**Expected output:**

- GitHub data fetched (PRs, commits)
- Huly connected (or warned if unavailable)
- Drift rules evaluated
- Report written to `out/ops/reality/<date>/`

**If it fails:**

- `FATAL: GITHUB_TOKEN is required` → check .env
- `Huly unreachable` → check Docker: `docker ps | grep huly`

### 2. Full Report (Live Publish)

```bash
npx tsx daemon/index.ts --run
```

This publishes the report to Huly as a document (or issue/comment fallback).

### 3. List Huly Issues

```bash
npx tsx daemon/huly-ops.ts list
```

### 4. Start Operator Scheduler

```bash
OPERATOR_ENABLED=true npx tsx daemon/index.ts --operator
```

Runs hourly. Deep run (live publish) at 3am UTC.

Stop: `Ctrl+C` (graceful SIGINT handling).

## Sprint Operations

### Create New Sprint

```bash
# 1. Create branch
git checkout -b sprint/<name>

# 2. Create [SPRINT] issue in Huly
npx tsx daemon/huly-ops.ts rebuild
# Or manually:
# Add [SPRINT] SPRINT-<NAME>-### issue via huly-ops

# 3. Start work
git push -u origin sprint/<name>
```

### Check Sprint Status

The sprint manager evaluates state based on:

- PR activity on sprint branch
- CI run results
- Proof bundle existence

Run a dry-run report to see sprint state in the drift section.

### Close Sprint

```bash
# 1. Verify all gates pass
cd tools/huly-os && npx tsc --noEmit
npx eslint . --ext .ts

# 2. Generate proof bundle
mkdir -p out/sprints/SPRINT-<NAME>-###/$(date +%Y-%m-%d)/proofs

# 3. Capture proofs
npx tsc --noEmit > out/sprints/SPRINT-<NAME>-###/$(date +%Y-%m-%d)/proofs/proof_typecheck.txt 2>&1

# 4. Commit, tag, merge
git add -A
git commit -m "feat(huly-os): <description>"
git tag SPRINT-<NAME>-###-COMPLETE
git checkout main && git merge sprint/<name>
git push origin main --tags
```

## Backfill Operations

### Link Existing PRs to Huly Issues

```bash
# Dry run first
npx tsx scripts/backfill-huly-issues.ts --dry-run

# Live
npx tsx scripts/backfill-huly-issues.ts
```

### Publish Operating System Documents

```bash
# Dry run
npx tsx scripts/publish-os-docs.ts --dry-run

# Live
npx tsx scripts/publish-os-docs.ts
```

## Event Bus Operations

### Start Consumer

```bash
EVENTBUS_ENABLED=true \
EVENTBUS_REDIS_URL=redis://localhost:6379 \
npx tsx daemon/index.ts --bus
```

### Emit Test Event

```bash
EVENTBUS_ENABLED=true \
EVENTBUS_REDIS_URL=redis://localhost:6379 \
npx tsx daemon/event-bus/emit-cli.ts \
  --type operator.tick \
  --source manual \
  --severity low
```

## Troubleshooting

### Huly TX API Errors

| Error      | Cause                 | Fix                                  |
| ---------- | --------------------- | ------------------------------------ |
| `HTTP 401` | Token expired         | Re-run (adapter auto-reconnects)     |
| `HTTP 404` | Wrong workspace ID    | Check HULY_WORKSPACE in .env         |
| `HTTP 400` | Malformed TX envelope | Check \_id, space, modifiedBy fields |

### Duplicate Issues

The adapter uses title-based dedup (`findIssueByTitle`). If duplicates appear:

1. Check if title has trailing whitespace
2. Verify the project identifier matches

### CI Integration Not Working

The daemon polls GitHub for workflow runs. If runs aren't appearing:

1. Check `GITHUB_TOKEN` has `actions:read` scope
2. Verify branch name starts with `sprint/`

### Drift Rules False Positives

- `DONE_WITHOUT_PROOF_URL`: Add `proof_url: <path>` to issue description
- `PR_WITHOUT_ISSUE`: Add `UT-<N>` to PR title or body
- `ORPHAN_PR`: Link PR to a Huly issue via backfill script

## Configuration Reference

| Variable                    | Required | Default               | Purpose                      |
| --------------------------- | -------- | --------------------- | ---------------------------- |
| `GITHUB_TOKEN`              | Yes      | —                     | GitHub API access            |
| `GITHUB_OWNER`              | Yes      | your-org              | Repo owner                   |
| `GITHUB_REPO`               | Yes      | unit-talk-production  | Repo name                    |
| `HULY_URL`                  | No       | http://localhost:8087 | Huly instance URL            |
| `HULY_EMAIL`                | No       | user1@example.com     | Huly login email             |
| `HULY_PASSWORD`             | No       | 1234                  | Huly login password          |
| `HULY_WORKSPACE`            | No       | ws1                   | Huly workspace name          |
| `HULY_PROJECT`              | No       | UT                    | Huly project identifier      |
| `HULY_TEAMSPACE`            | No       | Operations            | Huly teamspace for docs      |
| `OUTPUT_DIR`                | No       | out/ops/reality       | Report output directory      |
| `OPERATOR_ENABLED`          | No       | false                 | Enable operator scheduler    |
| `OPERATOR_INTERVAL_MINUTES` | No       | 60                    | Cycle interval               |
| `EVENTBUS_ENABLED`          | No       | false                 | Enable event bus             |
| `EVENTBUS_REDIS_URL`        | Cond.    | —                     | Required if EVENTBUS_ENABLED |
| `AUTO_PR_ENABLED`           | No       | false                 | Enable auto PR generation    |
| `LLM_PROVIDER`              | No       | —                     | openai or anthropic          |

## File Index

```
tools/huly-os/
├── daemon/
│   ├── adapters/
│   │   ├── github-adapter.ts    # GitHub API (PRs, CI, repo)
│   │   ├── github-auth.ts       # 3-tier auth (App → PAT → GH_TOKEN)
│   │   ├── github-issues.ts     # GitHub issues (fingerprint dedup)
│   │   ├── github-pr.ts         # Auto PR creation (path allowlist)
│   │   ├── huly-adapter.ts      # Huly TX API (issues, docs, comments)
│   │   └── types.ts             # Shared interfaces
│   ├── event-bus/
│   │   ├── consumer.ts          # Redis Stream consumer
│   │   ├── emit-cli.ts          # CLI event emitter
│   │   ├── event-types.ts       # Event schemas (Zod)
│   │   ├── producer.ts          # Programmatic emitter
│   │   └── redis-stream.ts      # XADD/XREADGROUP wrapper
│   ├── formatters/
│   │   ├── json-report.ts       # JSON report builder
│   │   └── markdown-report.ts   # Markdown renderer
│   ├── llm/
│   │   ├── auto-pr-orchestrator.ts  # Batch PR creation
│   │   ├── llm-client.ts        # OpenAI/Anthropic client
│   │   ├── llm-summarizer.ts    # Summary with fallback
│   │   ├── patch-generator.ts   # LLM patch generation
│   │   ├── render-summary.ts    # Summary markdown
│   │   ├── summary-schema.ts    # Zod schema
│   │   └── task-generator.ts    # GitHub issue generator
│   ├── audit-log.ts             # JSONL audit logger
│   ├── config.ts                # Zod config (fail-closed)
│   ├── drift-rules.ts           # 7 drift detection rules
│   ├── huly-ops.ts              # Huly CRUD operations CLI
│   ├── index.ts                 # CLI entry (5 modes)
│   ├── operator-scheduler.ts    # Interval scheduler
│   ├── publish-orchestrator.ts  # Layered publish (doc→issue→comment)
│   ├── report-runner.ts         # Full pipeline orchestrator
│   └── sprint-manager.ts        # Sprint state machine
├── scripts/
│   ├── backfill-huly-issues.ts  # PR→Huly linkage backfill
│   ├── huly-setup.sh            # Docker setup
│   └── publish-os-docs.ts       # OS doc publisher
├── .env                         # Configuration
├── .env.example                 # Config template
├── package.json                 # Scripts and dependencies
└── tsconfig.json                # TypeScript config
```
