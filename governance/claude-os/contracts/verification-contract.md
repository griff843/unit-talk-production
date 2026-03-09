# CLAUDE OS — Verification Contract

**Version**: 1.0.0 **Purpose**: Defines what "verified" means across all sprint
types. Establishes verification tiers, evidence standards, and failure
classification.

---

## 1. Verification Tiers

Verification is not binary. Different sprint types require different levels of
evidence. The sprint contract declares which tier applies.

| Tier   | Name                   | When Used                                                 | Evidence Required                                              |
| ------ | ---------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| **T1** | Build-Time Only        | Docs, types, refactors with no behavior change            | TypeScript compilation + lint + unit tests                     |
| **T2** | Build + Test           | New features, bug fixes affecting tested paths            | T1 + integration tests + build artifacts                       |
| **T3** | Build + Test + Runtime | Changes to runtime behavior (agents, data flow, delivery) | T2 + runtime evidence (API responses, DB state, logs)          |
| **T4** | Full Stack             | E2E lifecycle changes, settlement, Discord delivery       | T3 + Discord canary + lifecycle gate + settlement verification |

### Tier Selection Rules

- If the sprint changes **only documentation or governance files**: T1.
- If the sprint changes **TypeScript code but not runtime behavior** (types,
  refactors, dead code removal): T1.
- If the sprint changes **code that is covered by existing tests**: T2.
- If the sprint changes **agent behavior, data pipelines, or delivery**: T3.
- If the sprint touches **settlement, lifecycle state machine, or Discord
  posting flow**: T4.

When uncertain, use the higher tier. Oververification is preferable to
underverification.

---

## 2. When TypeScript Type Check Is Enough

TypeScript compilation (`npm run type-check`) is sufficient evidence ONLY when:

- No runtime behavior changes.
- No new database queries or writes.
- No new API endpoints.
- No changes to data pipeline flow.
- The sprint is exclusively about types, documentation, or governance files.

**TypeScript type check is NEVER sufficient alone for**:

- Any change that affects what data reaches Discord.
- Any change to lifecycle adapter behavior.
- Any change to settlement logic.
- Any change to ingestion paths.
- Any change to agent scheduling or selection logic.

---

## 3. When Runtime Proof Is Mandatory

Runtime proof is mandatory when the sprint changes any of:

| Change Category                                           | Runtime Proof Required                               |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Agent behavior (FeedAgent, GradingAgent, SettlementAgent) | Database state showing correct agent output          |
| Lifecycle adapter logic                                   | Before/after lifecycle state transitions in database |
| Settlement logic                                          | Settlement records with correct outcomes             |
| Discord embed format or routing                           | Screenshot or API capture of Discord delivery        |
| Ingestion pipeline                                        | `provider_offers` rows showing correct data landing  |
| API endpoint behavior                                     | HTTP response captures                               |
| Schema migration with data transformation                 | Database state showing correct transformation        |

### What Constitutes Runtime Proof

| Evidence Type    | Acceptable Format                                      |
| ---------------- | ------------------------------------------------------ |
| Database state   | SQL query output saved to proof file                   |
| API response     | curl/httpie output saved to proof file                 |
| Discord delivery | Screenshot in proofs directory or Discord API response |
| Log output       | Relevant log lines saved to proof file                 |
| Agent health     | `agent_health` table query output                      |

### What Does NOT Constitute Runtime Proof

| Non-Evidence                             | Why                                  |
| ---------------------------------------- | ------------------------------------ |
| "I verified it works"                    | Assertion without capture            |
| "The tests pass" without proof_tests.txt | Unverifiable claim                   |
| "Build succeeds" without proof_build.txt | Unverifiable claim                   |
| Mock/stub results only                   | Does not prove real runtime behavior |
| Local development server only            | May not match production behavior    |

---

## 4. Targeted Tests vs Full Suite

### When Targeted Tests Are Sufficient

- Sprint scope is narrow (1-3 files changed).
- Changed files have existing dedicated test coverage.
- No shared package modifications.
- No lifecycle adapter changes.

In this case: Run targeted tests + type check. Document which tests were run and
why full suite was not required.

### When Full Suite Is Required

- Sprint modifies shared packages (`packages/*`).
- Sprint modifies lifecycle adapters.
- Sprint modifies database schema.
- Sprint modifies more than 5 files across multiple directories.
- Sprint is a T3 or T4 verification tier.

In this case: Run full test suite. Capture all output.

---

## 5. Build Verification

Build verification confirms that all applications compile and bundle correctly.

| Build Target              | Command                                         | When Required                               |
| ------------------------- | ----------------------------------------------- | ------------------------------------------- |
| Full workspace type check | `npm run type-check`                            | Always                                      |
| API build                 | `npm run build --workspace=apps/api`            | When API code changes                       |
| Command Center build      | `npm run build --workspace=apps/command-center` | When command-center code changes            |
| Smart Form build          | `npm run build --workspace=apps/smart-form`     | When smart-form code changes                |
| Full build                | `npm run build`                                 | T3+ sprints, or when shared packages change |

---

## 6. UI/Runtime Verification Expectations

For UI-touching sprints (command-center, dashboard, smart-form):

| Check                    | Evidence                                     |
| ------------------------ | -------------------------------------------- |
| Build succeeds           | proof_build.txt                              |
| No new TypeScript errors | proof_typecheck.txt                          |
| Visual render check      | Screenshot in proofs/ (if behavioral change) |
| Form submission flow     | API response capture (if smart-form changes) |

For runtime-touching sprints (API, agents, settlement):

| Check                              | Evidence                              |
| ---------------------------------- | ------------------------------------- |
| All build checks above             | proof files                           |
| Agent produces correct output      | Database query showing expected state |
| Data flows through correct path    | Runtime log or database trail         |
| Settlement produces correct result | Settlement record query               |
| Discord delivery correct           | Embed screenshot or API capture       |

---

## 7. Prohibited Weak Evidence

The following are explicitly prohibited as standalone evidence of verification:

| Prohibited Evidence                        | Why                                     |
| ------------------------------------------ | --------------------------------------- |
| "Tests pass" without captured output       | Cannot be reviewed or audited           |
| "Build succeeds" without captured output   | Cannot be reviewed or audited           |
| "I checked and it looks right"             | Subjective assertion                    |
| "Same pattern as before, should work"      | Assumption, not evidence                |
| Coverage percentage alone                  | Coverage does not equal correctness     |
| "No errors in console" without log capture | Transient observation                   |
| Passing CI badge without accessible logs   | Badge may be stale or from wrong commit |

**Rule**: If you cannot show it to a reviewer as a file in the proof bundle, it
is not evidence.

---

## 8. Verification Failure Classification

| Severity          | Definition                                                                | Action                                                                        |
| ----------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **BLOCKING**      | Core verification fails (type check, required tests, lifecycle gate)      | Sprint cannot proceed. Fix before continuing.                                 |
| **DEGRADED**      | Non-core verification fails (optional tests, lint warnings)               | Sprint may proceed with limitation documented. Must be noted in proof bundle. |
| **INFORMATIONAL** | Non-blocking observation (deprecated pattern detected, coverage decrease) | Document in audit report. No sprint block.                                    |

### Escalation Rules

- **BLOCKING** failure: Execution halts. No workaround. Fix the root cause.
- Two or more **DEGRADED** failures: Treat as BLOCKING. Too many limitations
  indicate systemic issues.
- **INFORMATIONAL** items accumulating across sprints: Flag for human review at
  next governance check.

---

## 9. Verification Recipe Reference

Machine-readable verification recipes are defined in
`governance/claude-os/recipes/verification-recipes.json`. Each recipe specifies:

- When it is required.
- What evidence it produces.
- What failure severity it carries.

Sprint contracts reference recipe IDs to declare their verification
requirements.
