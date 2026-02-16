# PROOF_PICK_PLAN.md
Generated: 2026-02-16

## Consolidation Strategy: MERGE-THEN-CHERRY-PICK

### Rationale
- `feat/posting-authority-implement-001` is the authoritative branch containing:
  - All scoring tranches (2-10)
  - Settlement work (SETTLEMENT-GUARD-SEAL-PATCH-010)
  - Posting authority (POSTING-AUTHORITY-001)
  - Command Center UX overhaul
  - Parlay presentation and grouping
  - Recap agent
  - BridgeWorker fixes

- `main` has 4 recent commits NOT in posting-authority:
  - DX_OPS_PACK_002
  - SMARTFORM-ODDS-FIELD-INTEGRITY-007
  - CLAUDE contracts alignment
  - PHASE-2-PRODUCTION-READINESS-019

- `feat/alert-agent-v2-clean` has 1 unique commit:
  - d454f874: AlertAgent V2 comprehensive implementation (2012 lines, 41 tests)

### Execution Plan

**Step 1: Create consolidation branch from main**
```bash
git checkout main
git pull origin main
git checkout -b chore/main-consolidation-2026-02-16
```

**Step 2: Merge posting-authority branch (no squash)**
```bash
git merge origin/feat/posting-authority-implement-001 --no-ff -m "merge: consolidate feat/posting-authority-implement-001 into main

Includes:
- Scoring tranches 2-10 (CLV, TierScale, devig EV, canary routing)
- SETTLEMENT-GUARD-SEAL-PATCH-010
- POSTING-AUTHORITY-001 origin-gated posting
- PARLAY-DISCORD-GROUPING-001, PARLAY-PRESENTATION-REFINE-001
- Command Center enterprise UX overhaul
- Recap Agent v1
- BridgeWorker + publish.ts column alignment

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 3: Cherry-pick AlertAgent V2**
```bash
git cherry-pick d454f874 --no-commit
# Resolve any conflicts
git commit -m "feat(alert-agent): AlertAgent V2 — idempotent + cooldown + elite embeds (flag-gated)

Cherry-picked from feat/alert-agent-v2-clean (d454f874)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

**Step 4: Build verification**
```bash
# After each major step:
pnpm install
docker compose build api smart-form command-center
docker compose exec api npm run type-check
docker compose exec api npm run build
```

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| Merge conflicts between main and posting-authority | Main's 4 commits are small, isolated. Likely minimal conflicts. |
| AlertAgent V2 cherry-pick conflict | posting-authority already has c0839457 (idempotency). V2 is additive. |
| TypeScript errors | Both branches are known to have pre-existing TS errors in smart-form/command-center. Will verify api builds. |
| Runtime failures | Full Docker gauntlet validates before merge to main. |

### Order of Operations
1. `main` → `chore/main-consolidation-2026-02-16`
2. Merge `feat/posting-authority-implement-001`
3. Cherry-pick `d454f874`
4. Docker build + typecheck
5. Runtime gauntlet
6. If pass → merge to main + tag

### Commits to Consolidate (28 total)

**From feat/posting-authority-implement-001 (27):**
1. 3eb1fc6c scoring(tranche-2): canonical TierScale + devig EV
2. 295d6de4 scoring(tranche-3): feature registry + unified V2 pipeline
3. 60487d67 scoring(tranche-4): fix validateWeights double-counting
4. 0d38c48f fix(tests): remove `import type` syntax for Babel/Jest
5. 0b15392b Promotion Agent Tranche 1: deterministic + idempotent
6. c0839457 AlertAgent: claim-first idempotency
7. cc68bb62 Promotion: shadow mode, replay proof
8. 37e6cd59 scoring(tranche-6): canary routing + shadow drift
9. 84c15194 scoring(tranche-7): promotion policy bands
10. 9443a0e9 Tranche 4: normalize scoring, SettlementAgent activation
11. 1b92774f scoring(tranche-8): prod shadow monitoring
12. 8940d00a scoring(tranche-9): first-launch cutover
13. bc5906b6 scoring(tranche-10): enable HARD-only promotion
14. 640d0f33 scoring(tranche-7-recal): V2 gate recalibration
15. 79aa473f scoring(tranche-7-recal): settlement scripts
16. 6bdcb652 scoring(tranche-10): posting governance
17. 2acc6b9a recap(v1): operator-grade daily/weekly recap
18. d99cd353 smart-form(checkpoint): pre-UX-overhaul snapshot
19. 96deee29 cc(ux-overhaul): enterprise-grade Command Center
20. a27c7649 fix(command-center): graceful fallback states
21. c3e044ef fix(workspace): resolve TypeScript errors
22. 394c980d fix(grading): BridgeWorker simulation real execution
23. 3658a71b fix(worker): align BridgeWorker columns
24. 888bd6ec feat(posting-authority): POSTING-AUTHORITY-001
25. 1ab430f2 fix(discord): PARLAY-DISCORD-GROUPING-001
26. 9fd0cc56 feat(presentation): PARLAY-PRESENTATION-REFINE-001
27. 74067dcf fix(settlement): SETTLEMENT-GUARD-SEAL-PATCH-010

**From feat/alert-agent-v2-clean (1):**
28. d454f874 feat(alert-agent): AlertAgent V2
