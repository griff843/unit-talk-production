# Sprint Plan — Selection Rules

Decision authority for choosing the next sprint. Apply these rules in order.
First rule that fires wins; do not evaluate further rules.

---

## Rule Evaluation Order

```
1. Status doc staleness check         (gate — blocks all selection)
2. Proof completeness check           (gate — blocks all selection)
3. Critical drift override            (may override queue)
4. Dependency blocker check           (may defer Sprint 1)
5. Truth/audit sprint trigger         (may insert audit sprint)
6. Queue selection                    (default path)
7. Override or backlog selection      (--force / --audit)
```

---

## §1 — Status Doc Staleness Gate

**Check**: When was `CURRENT_SYSTEM_STATUS.md` last updated?

- If the Last Updated date is **before the most recent merged sprint**: STOP —
  status docs are stale. Output: "Run `/status-sync <LAST-SPRINT>` first."

- If the Last Updated date is current (matches or follows last sprint): PASS —
  continue to §2.

**Rationale**: Sprint selection from stale docs produces incorrect priorities.
The two minutes it takes to run `/status-sync` is always cheaper than planning
the wrong sprint.

---

## §2 — Proof Completeness Gate

**Check**: Does the most recent merged sprint have a proof bundle?

```bash
ls out/sprints/<LAST-SPRINT>/*/SPRINT_CLOSEOUT_REPORT.md
```

- If closeout report is missing: STOP — the previous sprint is not properly
  closed. Output: "Complete the previous sprint closeout before planning."

- If closeout report exists: PASS — continue to §3.

**Exception**: If `--force` is provided, skip this gate and warn instead.

---

## §3 — Critical Drift Override

**Check**: Count CRITICAL items in `DRIFT_REPORT.md`.

### 0 CRITICAL items

No override needed. Continue to §4.

### 1–2 CRITICAL items

Check if Sprint 1 in `NEXT_5_SPRINTS.md` directly addresses the CRITICAL item:

- If YES: No override. Continue to §4.
- If NO: Insert the CRITICAL-fixing sprint as the recommendation. Explain
  override.

### 3+ CRITICAL items

The system is in accumulated technical debt. Recommend a **truth/audit sprint**
or the most impactful single CRITICAL fix sprint before any feature work.

**Override output format:**

```
⚠️ CRITICAL DRIFT OVERRIDE
Reason: <DRIFT-ID> — <description> — not addressed by current Sprint 1
Recommended: <SPRINT-NAME-NNN> (fixes DRIFT-<ID>)
Overriding: <Sprint 1 from queue>
```

### Known CRITICAL items and their resolution sprints (as of 2026-03-09)

| DRIFT-ID | Item                  | Resolution Sprint               |
| -------- | --------------------- | ------------------------------- |
| DRIFT-C1 | Test suite broken     | SPRINT-TEST-INFRA-RECOVERY      |
| DRIFT-C2 | TypeScript errors     | SPRINT-TEST-INFRA-RECOVERY      |
| DRIFT-C3 | Single-writer overdue | SPRINT-SINGLE-WRITER-COMPLETION |

---

## §4 — Dependency Blocker Check

**Check**: Does Sprint 1's `Depends On` field reference an incomplete sprint?

```bash
# Verify dependency tag on remote
git ls-remote origin refs/tags/<DEPENDENCY-SPRINT>
```

- If dependency tag **exists**: Sprint 1 is unblocked. Continue to §5.
- If dependency tag **missing**: Sprint 1 is blocked. Recommend the dependency
  sprint instead. Explain the chain.

**Dependency chains** (as of 2026-03-09):

```
SPRINT-TEST-INFRA-RECOVERY          → (no dependency)
SPRINT-SINGLE-WRITER-COMPLETION     → depends on TEST-INFRA-RECOVERY
SPRINT-PROMOTION-ACTIVATION         → depends on SINGLE-WRITER-COMPLETION
SPRINT-MULTI-BOOK-CONSENSUS         → depends on SINGLE-WRITER-COMPLETION
SPRINT-OPERATIONAL-OBSERVABILITY    → depends on SINGLE-WRITER-COMPLETION
```

---

## §5 — Truth/Audit Sprint Trigger

**Recommend an audit sprint if ANY of the following are true:**

| Condition                                                       | Threshold         |
| --------------------------------------------------------------- | ----------------- |
| DRIFT_REPORT has not been updated in > 30 days                  | → recommend audit |
| CRITICAL drift count grew since last audit                      | → recommend audit |
| 2+ consecutive feature sprints with no status doc update        | → recommend audit |
| Major architecture change just merged (affects many subsystems) | → recommend audit |
| Operator uses `--audit` flag                                    | → force audit     |

**Standard truth/audit sprint format:**

```
SPRINT-SYSTEM-TRUTH-AUDIT-<NNN>
Goal: Re-verify all docs/status/ docs against current codebase.
Type: Audit
Model: Opus (cross-system reasoning required)
```

---

## §6 — Queue Selection (Default Path)

When no override fires, the recommendation is **Sprint 1 from
`NEXT_5_SPRINTS.md`** — but ONLY after passing the canonical classification gate
below.

### §6.1 — Canonical Layer/Phase Classification Gate

Before accepting Sprint 1, classify it against the canonical model:

1. Read the active canonical position from `docs/06_status/current_phase.md`.
2. Classify the Sprint 1 work against
   `docs/04_roadmap/layer_phase_execution_model.md §4`.
3. Apply sequencing rules:
   - **Lower layers must be functionally complete** before upper-layer work is
     claimed complete.
   - If Sprint 1 targets Layer N+1 or higher while Layer N has open gaps → **do
     not recommend Sprint 1**; recommend the Layer N gap sprint instead, with a
     sequencing violation explanation.
   - If Sprint 1 correctly targets the canonical active Layer/Phase → PASS;
     include `Layer/Phase: Layer N / Phase M — <Name>` in the recommendation.

**Record in output**: `Active canonical position: Layer N / Phase M — <Name>`

### §6.2 — Queue Accept

After §6.1 passes: recommend Sprint 1. Never skip Sprint 1 without an override
reason documented in the output. Never select Sprint 3, 4, or 5 without
completing 1 and 2 first (unless `--force` or a dependency analysis explicitly
unlocks out-of-order execution).

---

## §7 — Override and Backlog Selection

### --force <SPRINT-NAME>

Accept the named sprint. Still run Steps 1–2 (staleness and proof gates). Warn
if the named sprint is not in `NEXT_5_SPRINTS.md` and not in
`docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`.

### Backlog Selection

If `NEXT_5_SPRINTS.md` is empty (all 5 sprints complete):

1. Read `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md`
2. Find the first unlocked sprint (dependencies met, not yet tagged)
3. Recommend it, noting the backlog source

---

## Sprint Type Classification

> **Model routing**: Each sprint type maps to a default model. The `Model:` and
> `Routing:` fields in every sprint prompt must reflect this mapping. Canonical
> authority: `docs/02_architecture/claude_os_ceiling_blueprint.md §6`

| Type             | Indicators                                                           | Default Model                       |
| ---------------- | -------------------------------------------------------------------- | ----------------------------------- |
| **Fix**          | "Restore", "fix broken", "recover", CRITICAL drift source            | Sonnet                              |
| **Migration**    | "Migrate X to Y", "move", "eliminate violations", mechanical changes | Sonnet                              |
| **Feature**      | New capability, UNI-N feature issue, "implement", "add"              | Sonnet (clear spec) / Opus (vague)  |
| **Architecture** | "Redesign", "restructure", affects 3+ services, new contracts        | Opus                                |
| **Audit/Truth**  | "Audit", "reconcile", "verify", "truth", output is docs not code     | Opus                                |
| **Activation**   | "Enable", "wire", "activate", code exists but disabled               | Sonnet                              |
| **Governance**   | Blueprint, rule update, doc canonicalization, no code changes        | Sonnet (mechanical) / Opus (design) |
| **Status-Only**  | Read and report state; no code, no doc update, no implementation     | Haiku                               |

---

## When to Recommend Running a Different Skill First

| Situation                             | Recommend                                  |
| ------------------------------------- | ------------------------------------------ |
| Last sprint not synced to status docs | `/status-sync <SPRINT>`                    |
| Last sprint proof bundle missing      | `/sprint-proof-bundle <SPRINT>`            |
| Gate failing on current branch        | `/sprint-verify`                           |
| Drift items unclear                   | `/single-writer-audit` or re-read closeout |
