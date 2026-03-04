// HULY-OS v1: Publish operating system documents to Huly
// Publishes core governance docs as Huly documents via the upsertDoc API.
// Usage: npx tsx scripts/publish-os-docs.ts [--dry-run]

import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

import { HulyAdapter } from '../daemon/adapters/huly-adapter.js';
import { AuditLogger } from '../daemon/audit-log.js';
import { loadConfig } from '../daemon/config.js';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

interface OsDoc {
  title: string;
  content: string;
}

const OS_DOCS: OsDoc[] = [
  {
    title: 'Engineering OS',
    content: `# Engineering OS — Unit Talk

## Purpose
Central governance document for Unit Talk platform engineering operations.

## Principles
1. **Fail-closed** — Unknown states default to safe/blocked
2. **Proof required** — No status claim without artifacts
3. **Single writer** — Each table has one canonical writer
4. **Idempotent** — Same input produces same output, no side effects on replay
5. **Deterministic** — State transitions follow defined rules

## Stack
- **Platform:** Supabase (PostgreSQL + Auth + Realtime)
- **Apps:** API, Command Center, Dashboard, Discord Bot, Smart Form
- **Ops:** huly-os daemon, Huly tracker, GitHub Actions CI/CD
- **Infra:** Docker Compose (local), Supabase Cloud (prod)

## Governance
- Sprint protocol: SPRINT-<NAME>-### naming
- All changes require proof bundles in out/sprints/
- Lifecycle adapters enforce single-writer discipline
- Drift rules detect deviations automatically
`,
  },
  {
    title: 'Sprint Execution Protocol',
    content: `# Sprint Execution Protocol

## Sprint Lifecycle

\`\`\`
Planning → In Progress → Blocked → Ready for Closeout → Closed
\`\`\`

## Phase 0: Context
- Read relevant code and documentation
- Understand scope and dependencies
- Check for blocking issues

## Phase 1: Plan
- Create [SPRINT] issue in Huly
- Create sprint branch: sprint/<sprint-id>
- Document approach (NO code changes)

## Phase 2: Implement
- Write code on sprint branch
- Open PRs referencing UT-* issues
- Keep changes minimal and focused

## Phase 3: Verify
- Run type-check, lint, tests
- Run lifecycle gates
- Generate proof artifacts

## Phase 4: Proof
- Capture all verification output
- Write SPRINT_CLOSEOUT_REPORT.md
- Generate proof bundle in out/sprints/

## Phase 5: Commit + Tag
- Commit with sprint reference
- Create tag: SPRINT-<NAME>-###-COMPLETE
- Merge to main

## Phase 6: Closeout
- Add proof_url to sprint issue description
- Move sprint issue to Done
- Push tags to remote

## Gates
All must pass before closeout:
- [ ] Type check (tsc --noEmit)
- [ ] Lint (eslint)
- [ ] Tests (vitest)
- [ ] Lifecycle gate (single-writer)
- [ ] Clean git status
- [ ] Proof artifacts generated
`,
  },
  {
    title: 'Incident Response',
    content: `# Incident Response Protocol

## Detection
Incidents are detected by:
1. CI failure on sprint branch → auto-creates [INCIDENT] issue
2. Drift rule violations (error severity)
3. Manual reporting

## Classification
- **P1 (Critical):** Production down, data loss risk
- **P2 (High):** Feature broken, CI blocked
- **P3 (Medium):** Degraded performance, non-blocking
- **P4 (Low):** Cosmetic, documentation

## Response Flow
1. [INCIDENT] issue created in Huly (auto or manual)
2. Sprint marked as Blocked
3. Fix implemented on sprint branch
4. CI re-run confirms fix
5. Sprint unblocked → resumes
6. [INCIDENT] issue closed with resolution comment

## Escalation
- P1: Immediate (break current sprint)
- P2: Within current sprint
- P3: Next sprint backlog
- P4: Backlog (optional)
`,
  },
  {
    title: 'Operator Playbooks',
    content: `# Operator Playbooks

## Daily Operations

### Check System Health
\`\`\`bash
cd tools/huly-os
npx tsx daemon/index.ts --dry-run
\`\`\`

### Run Full Report (publishes to Huly)
\`\`\`bash
npx tsx daemon/index.ts --run
\`\`\`

### Start Automated Operator
\`\`\`bash
OPERATOR_ENABLED=true npx tsx daemon/index.ts --operator
\`\`\`

### Start Event Bus Consumer
\`\`\`bash
EVENTBUS_ENABLED=true EVENTBUS_REDIS_URL=redis://localhost:6379 npx tsx daemon/index.ts --bus
\`\`\`

## Sprint Operations

### Create Sprint Structure
\`\`\`bash
npx tsx daemon/huly-ops.ts rebuild
\`\`\`

### List All Issues
\`\`\`bash
npx tsx daemon/huly-ops.ts list
\`\`\`

### Backfill PR Linkages
\`\`\`bash
npx tsx scripts/backfill-huly-issues.ts --dry-run
npx tsx scripts/backfill-huly-issues.ts
\`\`\`

## Troubleshooting

### Huly Connection Failed
1. Check Docker: \`docker ps | grep huly\`
2. Check URL: \`curl http://localhost:8087\`
3. Check credentials in .env

### GitHub Rate Limit
1. Check: \`gh api rate_limit\`
2. Wait for reset or use GitHub App auth

### Redis Connection (Event Bus)
1. Check: \`redis-cli -u $EVENTBUS_REDIS_URL ping\`
2. Verify EVENTBUS_REDIS_URL in .env
`,
  },
  {
    title: 'System Architecture',
    content: `# System Architecture — Unit Talk

## High-Level Architecture

\`\`\`
GitHub (Source of Truth)
  ├── Branches / PRs / CI Runs
  └── GitHub Actions Workflows
          │
          ▼
huly-os Daemon (Integration Layer)
  ├── GitHub Adapter (read PRs, CI, repo)
  ├── Huly Adapter (read/write issues, docs)
  ├── Drift Rules Engine (detect deviations)
  ├── Sprint Manager (state machine)
  ├── Report Generator + LLM Summarizer
  ├── Publish Orchestrator (doc → issue → comment)
  ├── Operator Scheduler (automated cycles)
  └── Event Bus Consumer (Redis Streams)
          │
          ▼
Huly (Project Management)
  ├── Tracker (issues, epics, sprints)
  ├── Documents (reports, playbooks)
  └── Chat (comments, notifications)
\`\`\`

## Data Flow

1. **Pull:** Daemon queries GitHub API for PRs, commits, CI runs
2. **Analyze:** Drift rules detect violations, sprint manager evaluates state
3. **Report:** Generate reality report with optional LLM summary
4. **Push:** Publish to Huly via TX API (doc → issue → comment fallback)
5. **Track:** Sprint state transitions, incident creation, PR linkage

## Key Constraints
- Huly self-hosted v0.7: No webhooks, pull-based only
- All writes via TX API with envelope: _id, space, modifiedBy, modifiedOn
- Idempotent operations: title-based dedup for issues, SET NX for events
- Fail-closed: unknown states block progress rather than auto-advance
`,
  },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  console.log(`\nHULY-OS: Publishing ${OS_DOCS.length} operating system documents`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE'}\n`);

  const config = loadConfig();
  const audit = new AuditLogger();
  const huly = new HulyAdapter(config, audit);

  await huly.connect();
  console.log('Connected to Huly.\n');

  let published = 0;
  let updated = 0;

  for (const doc of OS_DOCS) {
    console.log(`  Publishing: "${doc.title}"...`);
    if (!dryRun) {
      try {
        const result = await huly.upsertDoc(config.HULY_TEAMSPACE, doc.title, doc.content);
        if (result.created) {
          console.log(`    ✓ Created: ${result.id}`);
          published++;
        } else {
          console.log(`    ✓ Updated: ${result.id}`);
          updated++;
        }
      } catch (err) {
        console.log(`    ✗ Failed: ${(err as Error).message}`);
      }
    } else {
      console.log(`    (dry-run) Would publish`);
      published++;
    }
  }

  console.log(`\nDone: ${published} published, ${updated} updated.`);
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
