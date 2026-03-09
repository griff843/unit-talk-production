# CLAUDE OS BLUEPRINT V1

**Version**: 1.0.0 **Status**: Design — Not Yet Implemented **Authority**: This
document defines the design intent for Claude OS. It does not supersede
`CLAUDE_EXECUTION_CONTRACT.md` or `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md`, which
remain the active governing contracts until Claude OS is ratified.

---

## 1. Purpose

Claude OS is the governed execution layer for Claude-driven sprint work on the
Unit Talk platform. It transforms Claude from an ad-hoc assistant into a
deterministic, auditable, fail-closed execution system that can:

1. Ingest a sprint definition from governed sources.
2. Load the correct truth context for that sprint.
3. Plan implementation within explicit file and contract boundaries.
4. Implement the smallest correct change set.
5. Verify against defined acceptance criteria using real evidence.
6. Bundle proof artifacts with runtime receipts where required.
7. Fail closed when truth is missing, ambiguous, or conflicting.

Claude OS does not replace human judgment. It enforces a discipline layer that
ensures Claude operates within governed boundaries, produces auditable output,
and never claims success without proof.

---

## 2. Scope

### In Scope

- Governance contracts that define Claude's execution boundaries.
- Context loading manifests that specify what truth Claude must read before
  acting.
- Sprint contract templates that constrain what Claude can change per sprint.
- Verification and proof contracts that define what "done" means.
- Agent role definitions that separate planning, implementation, verification,
  and audit.
- Fail-closed rules that halt execution when preconditions are unmet.
- Machine-readable recipes for verification and proof generation.
- Templates for plans, proof bundles, and verdicts.

### Out of Scope (v1)

- Runtime TypeScript tooling (deferred to implementation sprint).
- Automated Linear-to-sprint-contract ingestion (deferred).
- CI/CD pipeline integration (deferred).
- Multi-agent orchestration runtime (deferred).
- Automated PR creation from proof bundles (deferred).

---

## 3. Non-Goals

| Non-Goal                                          | Rationale                                                         |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| Replace human architectural decisions             | Claude OS executes within boundaries; it does not set them.       |
| Automate merge to main without human review       | Human ratification is a system law.                               |
| Become the source of truth for sprint definitions | Repo governance docs are truth; Linear is workflow.               |
| Handle production incident response               | Incident response requires human judgment and authority.          |
| Generate governance docs autonomously             | Governance is authored by humans, enforced by Claude OS.          |
| Optimize for speed over correctness               | Fail-closed correctness is always preferred over fast completion. |

---

## 4. Truth Hierarchy

Claude OS operates on a strict truth hierarchy. When sources conflict, the
higher-ranked source wins. Conflicts between sources at the same tier require
human resolution.

| Priority | Source                                | Role                                        | Mutable By                                  |
| -------- | ------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 1        | `CLAUDE_EXECUTION_CONTRACT.md`        | Hard law — non-negotiable invariants        | Human only, via PR                          |
| 2        | `docs/SYSTEM_INVARIANTS.md`           | System-level fail-open/fail-closed rules    | Human only, via PR                          |
| 3        | `governance/claude-os/SYSTEM_LAWS.md` | Claude OS execution laws                    | Human only, via PR                          |
| 4        | `docs/contracts/*.md`                 | Domain contracts (lifecycle, Discord, etc.) | Human only, via PR                          |
| 5        | `docs/system/current/*.md`            | Canonical system documentation              | Human or Claude via governed sprint         |
| 6        | `CLAUDE.md` + `.claude/rules/*.md`    | Session-level operating rules               | Human or Claude via governed sprint         |
| 7        | Sprint contract (per-sprint)          | Sprint-scoped constraints                   | Created per sprint, immutable once ratified |
| 8        | Linear issues / cycles                | Workflow visibility and planning            | Linear UI or API                            |

**Critical rule**: Linear is never truth. If a Linear issue conflicts with a
repo governance doc, the repo doc wins. Linear reflects intent; the repo
reflects ratified state.

---

## 5. Operating Model

### 5.1 Execution Flow

```
Linear Issue (intent)
    |
Sprint Contract (governed scope)
    |
Context Load (truth verification)
    |
Plan (architect agent)
    |
Implement (implementer agent, within file boundaries)
    |
Verify (verifier agent, evidence-based)
    |
Proof Bundle (proof agent, artifact completeness)
    |
Audit (audit agent, drift/contract check)
    |
Human Ratification (PR review + merge via gh)
    |
Closeout (tag, push, Linear update)
```

### 5.2 Fail-Closed Principle

At every stage transition, Claude OS checks preconditions. If any precondition
is unmet, execution halts and reports the specific failure. There is no
fallback, no retry-with-weaker-criteria, no silent degradation.

### 5.3 Session Initialization

Every Claude OS session begins with:

1. Load `CLAUDE_EXECUTION_CONTRACT.md` (hard law).
2. Load `governance/claude-os/SYSTEM_LAWS.md` (execution laws).
3. Load `governance/claude-os/context/context-manifest.json` (context pack).
4. Load sprint contract for current sprint (if active).
5. Verify truth sources exist and are readable.
6. Fail closed if any required truth source is missing.

---

## 6. Role of Linear

Linear serves as:

- **Planning surface**: Sprint scoping, issue tracking, cycle management.
- **Visibility layer**: Progress tracking, team coordination.
- **Workflow orchestration**: Issue state transitions (Backlog -> Todo -> In
  Progress -> Done).
- **Communication bridge**: Comments, assignments, priority signals.

Linear does NOT serve as:

- Source of truth for system architecture.
- Source of truth for contract definitions.
- Authority for what code can or cannot change.
- Proof repository (proofs live in `out/sprints/`).
- Governance authority (governance lives in repo docs).

**Sync rule**: When a sprint completes, its Linear issue is updated to reflect
the ratified state. The repo is always ahead of or equal to Linear, never
behind.

---

## 7. Role of GitHub / gh

GitHub is the ratification and merge layer:

- **PR creation**: Via `gh pr create` with governed title/body format.
- **Code review**: Human review of sprint changes.
- **Merge**: Fast-forward preferred; squash acceptable for cleanup sprints.
- **Tags**: Sprint completion tags (`SPRINT-<NAME>-###-COMPLETE`).
- **Branch protection**: Main branch requires PR review (when configured).

`gh` CLI is the preferred interface for all GitHub operations within Claude OS.
Direct GitHub UI usage is acceptable for human review but not for
Claude-initiated operations.

---

## 8. Role of Claude OS

Claude OS is the execution layer:

- **Contract enforcement**: Ensures sprints operate within defined boundaries.
- **Context management**: Loads and verifies truth sources before execution.
- **Agent coordination**: Routes work through architect -> implementer ->
  verifier -> proof -> audit.
- **Fail-closed gating**: Halts on missing truth, failed verification, or
  contract violation.
- **Proof generation**: Produces auditable artifacts that demonstrate what was
  done and why.
- **Drift detection**: Identifies when runtime state diverges from governed
  expectations.

Claude OS does NOT:

- Make architectural decisions.
- Override human governance.
- Merge code without human approval.
- Claim completion without evidence.
- Continue past a fail-closed gate.

---

## 9. Sprint Lifecycle Under Claude OS

| Phase        | Agent          | Gate                                            | Output               |
| ------------ | -------------- | ----------------------------------------------- | -------------------- |
| 0: Context   | System         | Truth sources exist and load                    | Context confirmation |
| 1: Plan      | Architect      | Sprint contract populated, truth confirmed      | Sprint plan          |
| 2: Implement | Implementer    | Plan approved, file boundaries set              | Code changes         |
| 3: Verify    | Verifier       | All verification recipes executed with evidence | Verification report  |
| 4: Proof     | Proof Bundler  | All required artifacts collected                | Proof bundle         |
| 5: Audit     | Audit Sentinel | No drift, no violations, no deprecated paths    | Audit report         |
| 6: Ratify    | Human          | PR approved, merged, tagged                     | Ratified sprint      |
| 7: Close     | System         | Tag pushed, Linear updated, tree clean          | Sprint closed        |

Each phase gate is fail-closed. Phase N+1 cannot begin until Phase N's gate
passes.

---

## 10. Agent Role Definitions

| Agent              | Mission                                             | Constraint                                                           |
| ------------------ | --------------------------------------------------- | -------------------------------------------------------------------- |
| **Architect**      | Plan sprint execution within governed scope         | Cannot write code; cannot approve own plan                           |
| **Implementer**    | Execute the plan within file boundaries             | Cannot change files not in sprint contract; cannot skip verification |
| **Verifier**       | Validate implementation against acceptance criteria | Must produce evidence, not assertions; cannot modify code            |
| **Proof Bundler**  | Collect and organize proof artifacts                | Cannot fabricate evidence; must report gaps honestly                 |
| **Audit Sentinel** | Detect drift, deprecated paths, boundary violations | Cannot fix issues; must report them as fail-closed gates             |

See `governance/claude-os/agents/` for full role specifications.

---

## 11. Fail-Closed Principles

1. **Missing truth -> STOP.** If a required truth source file does not exist or
   cannot be loaded, halt execution.
2. **Conflicting truth -> STOP.** If two truth sources at the same priority
   disagree, halt and escalate to human.
3. **No acceptance criteria -> STOP.** If a sprint has no defined acceptance
   criteria, it cannot be verified and therefore cannot proceed.
4. **Verification failure -> STOP.** If any required verification step fails,
   the sprint is not complete.
5. **Missing proof -> STOP.** If a required proof artifact cannot be generated,
   the sprint cannot be ratified.
6. **Boundary violation -> STOP.** If implementation touches files outside the
   sprint contract, halt immediately.
7. **Deprecated path usage -> STOP.** If implementation writes to or depends on
   a deprecated path (e.g., `raw_props` as target), halt and report.
8. **Silent fallback -> STOP.** If any system would silently degrade rather than
   fail visibly, that is itself a violation.

---

## 12. Verification Philosophy

Verification is evidence-based, not assertion-based.

- **Weak evidence** (not acceptable alone): "Tests pass" without captured
  output. "Build succeeds" without log. "Looks correct" without runtime proof.
- **Strong evidence** (acceptable): Captured command output in proof files.
  Runtime receipts from actual execution. Database state snapshots showing
  expected values. Screenshot or API response demonstrating behavior.

Verification tiers are defined in
`governance/claude-os/contracts/verification-contract.md`.

---

## 13. Proof Bundle Philosophy

A proof bundle is not documentation. It is a forensic record that allows any
reviewer to independently verify what was done, what evidence was collected, and
whether the sprint met its acceptance criteria.

Proof bundles must be:

- **Complete**: All required artifacts present.
- **Honest**: Gaps and limitations explicitly stated.
- **Reproducible**: Commands and conditions documented so evidence could be
  re-collected.
- **Located**: Always at `out/sprints/<SPRINT>/<YYYY-MM-DD>/`.

See `governance/claude-os/contracts/artifact-contract.md` for the full contract.

---

## 14. Build-Time vs Runtime Separation

| Category                      | Build-Time | Runtime |
| ----------------------------- | ---------- | ------- |
| TypeScript compilation        | Yes        | No      |
| Lint / format checks          | Yes        | No      |
| Unit tests                    | Yes        | No      |
| Integration tests             | Either     | Either  |
| Schema validation             | Yes        | No      |
| API smoke tests               | No         | Yes     |
| Discord delivery verification | No         | Yes     |
| Database state verification   | No         | Yes     |
| Lifecycle state transitions   | No         | Yes     |

**Rules**:

1. Build-time verification is necessary but not sufficient for runtime sprints.
2. A sprint that changes runtime behavior MUST include runtime evidence in its
   proof bundle.
3. Build-time-only sprints (docs, types, refactors with no behavior change) may
   use build-time verification exclusively.
4. The sprint contract MUST declare whether runtime proof is required.

---

## 15. Integration with Existing Sprint Governance

Claude OS does not replace the existing sprint governance system. It layers on
top:

| Existing                                | Claude OS Addition                                        |
| --------------------------------------- | --------------------------------------------------------- |
| `CLAUDE.md` operating rules             | Context manifest + system laws                            |
| `.claude/rules/*.md` session rules      | Fail-closed rules + verification contracts                |
| `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` | Sprint contract template with explicit boundaries         |
| Sprint naming `SPRINT-<NAME>-###`       | Machine-readable sprint contract with acceptance criteria |
| Proof bundles in `out/sprints/`         | Structured proof recipes + artifact contract              |
| Manual verification                     | Verification recipes with evidence requirements           |

The existing contracts remain authoritative. Claude OS contracts extend them
with machine-enforceable precision.

---

## 16. Implementation Phases

### Phase A: Design (Current)

- Populate all governance files in `governance/claude-os/`.
- No runtime tooling. No code changes outside governance.
- Output: Complete governance framework.

### Phase B: Context Loader

- Build TypeScript tooling to read `context-manifest.json` and load truth packs.
- Integrate with session baseline (`pnpm session:baseline`).
- Output: Automated context loading with fail-closed verification.

### Phase C: Sprint Contract Engine

- Build tooling to parse sprint contracts and enforce file boundaries.
- Integrate with verification recipes.
- Output: Automated sprint boundary enforcement.

### Phase D: Verification Automation

- Wire verification recipes to actual commands.
- Build proof collection automation.
- Output: One-command verification + proof bundling.

### Phase E: Agent Orchestration

- Implement agent role separation in Claude session management.
- Build phase gate enforcement.
- Output: Full Claude OS execution loop.

---

## 17. Acceptance Criteria for Claude OS v1

Claude OS v1 is ratified when:

- [ ] All 21 governance files are populated and internally consistent.
- [ ] Truth hierarchy is unambiguous and testable.
- [ ] Sprint contract template can express any Unit Talk sprint's boundaries.
- [ ] Verification contract covers all sprint types (docs, runtime, build-fix,
      e2e, UI, schema).
- [ ] Fail-closed rules are enumerable and enforceable.
- [ ] Agent roles are defined with clear boundaries and handoff requirements.
- [ ] Proof bundle contract is complete enough to evaluate any sprint's
      evidence.
- [ ] All JSON files are valid and parseable.
- [ ] No conflicts with existing `CLAUDE_EXECUTION_CONTRACT.md` or
      `SYSTEM_INVARIANTS.md`.
- [ ] Human review and ratification via PR.

---

## 18. Kill Conditions / Anti-Patterns

### Kill Conditions (Abandon If)

| Condition                                                          | Action                                                      |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Claude OS governance conflicts with `CLAUDE_EXECUTION_CONTRACT.md` | Resolve conflict, do not ship conflicting governance        |
| Framework becomes so complex it slows sprint execution             | Simplify ruthlessly; governance must accelerate, not impede |
| Proof bundles become ceremonial rather than forensic               | Strip ceremony, restore evidence focus                      |
| Agent roles create handoff overhead without quality improvement    | Collapse roles back to simpler model                        |
| Context loading adds >30s to session initialization                | Optimize or defer non-critical context                      |

### Anti-Patterns

| Anti-Pattern                                   | Why It's Dangerous                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| Treating Linear as truth                       | Linear is workflow; repo is truth. Sync goes repo -> Linear, never reverse. |
| Silent fallback on missing truth               | Produces work based on wrong assumptions. Must fail closed.                 |
| Proof-by-assertion ("tests pass")              | No captured output = no proof. Assertions are not evidence.                 |
| Speculative implementation beyond sprint scope | Scope creep introduces unverified changes.                                  |
| Amending sprints after ratification            | Ratified sprints are immutable. New sprint for corrections.                 |
| Deprecated paths as implementation targets     | `raw_props` is compatibility only. `provider_offers` is canonical.          |
| Build-time-only proof for runtime changes      | Build passing does not prove runtime correctness.                           |

---

## 19. Deferred Additions

The following items are recommended but not included in v1. They should be
evaluated for v2:

| Item                                                        | Rationale                                                             | Priority |
| ----------------------------------------------------------- | --------------------------------------------------------------------- | -------- |
| `governance/claude-os/context/deprecated-paths.json`        | Machine-readable list of deprecated tables/paths to flag during audit | High     |
| `governance/claude-os/contracts/rollback-contract.md`       | Formal rollback procedures per sprint type                            | Medium   |
| `governance/claude-os/recipes/context-load-recipes.json`    | Automated context loading recipes per sprint type                     | High     |
| `governance/claude-os/templates/linear-sync-template.md`    | Standard format for Linear issue updates from Claude OS               | Low      |
| `governance/claude-os/agents/orchestrator-agent.md`         | Meta-agent that coordinates phase transitions                         | Medium   |
| `governance/claude-os/metrics/sprint-quality-metrics.json`  | Standard quality metrics collected per sprint                         | Low      |
| Runtime TypeScript implementation of context loader         | Required for Phase B; design only in v1                               | High     |
| Runtime TypeScript implementation of sprint contract parser | Required for Phase C; design only in v1                               | High     |
| CI/CD integration hooks for fail-closed gates               | Required for Phase D; design only in v1                               | Medium   |

---

## 20. Document Cross-References

| Document                 | Purpose                   | Location                                                     |
| ------------------------ | ------------------------- | ------------------------------------------------------------ |
| System Laws              | Inviolable execution laws | `governance/claude-os/SYSTEM_LAWS.md`                        |
| Context Manifest         | What truth to load        | `governance/claude-os/context/context-manifest.json`         |
| Sprint Contract Template | Per-sprint boundaries     | `governance/claude-os/contracts/sprint-contract-template.md` |
| Verification Contract    | What "verified" means     | `governance/claude-os/contracts/verification-contract.md`    |
| Artifact Contract        | Proof bundle requirements | `governance/claude-os/contracts/artifact-contract.md`        |
| Fail-Closed Rules        | Stop conditions           | `governance/claude-os/contracts/fail-closed-rules.md`        |
| Agent Definitions        | Role specs                | `governance/claude-os/agents/*.md`                           |
| Verification Recipes     | How to verify             | `governance/claude-os/recipes/verification-recipes.json`     |
| Proof Recipes            | What to prove             | `governance/claude-os/recipes/proof-recipes.json`            |
| Templates                | Standard formats          | `governance/claude-os/templates/*.md`                        |
