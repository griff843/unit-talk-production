# Paperclip Heartbeat Model

Version: 1.0
Status: Canonical
Authority: PM Layer
Last Updated: 2026-05-03
Issue: UNI-260 (parent: UNI-255)

This document defines the ideal heartbeat schedule, responsibilities, and model
cost policy for every agent in the Unit Talk operating system.

A heartbeat is one execution window — the agent wakes, does work, and exits.
Frequency determines how often the agent wakes unprompted (aside from
assignment-triggered wakes, which fire immediately).

---

## 1. PM Heartbeat

**Frequency**
- Active sprint: every 15 minutes.
- Otherwise: hourly.

**Model**
- Default: cheap/fast model (Claude Haiku or equivalent fast-mini).
- Escalate to standard model for T1 exception packet generation only.
- Never use strongest model for routine sweeps.

**Responsibilities**

1. Sweep all issues in `todo`, `in_progress`, `blocked`, `in_review`:
   - Confirm each has an owner, a next action, and correct metadata.
   - Fix wrong status, assignee, or metadata without escalating.
   - Escalate only what cannot be resolved at the PM layer.
2. Create Paperclip issues from Fibery gaps when work needs an agent.
   - Every Fibery item that requires agent execution must have a Paperclip
     issue with `parentId`, `goalId`, Fibery reference, and the four metadata
     fields (Execution Owner, PM Owner, Verification Required, Needs CEO
     Decision).
3. Comment on every issue acted on.
   - Status line + what was done + what is next.
   - Never silently change assignee or status.
4. Detect and route verification-required close requests to VerificationLead.
5. Detect and route T1/PM_REQUIRED decisions to the correct authority.
6. Escalate only strategic, material, or irreversible decisions to CEO.

**Exit Condition**

Exit cleanly when: no issue has a wrong status, every issue in active lanes has
a clear next action and owner, and no new Fibery gaps exist without a
Paperclip issue.

---

## 2. CTO Heartbeat

**Frequency**
- Active sprint: every 30–60 minutes.
- Otherwise: event-triggered (assignment, comment mention).

**Model**
- Default: standard reasoning model (Claude Sonnet or equivalent).
- Escalate to stronger model for architecture review or T1 sequencing only.
- Never use strongest model for routine dispatch.

**Responsibilities**

1. Identify critical path issues and unblock them.
2. Dispatch technical work to Codex or other implementation agents.
3. Classify new issues by tier (T1/T2/T3) and risk level.
4. Detect dependency conflicts and surface them to PM.
5. Route VL-required items to VerificationLead after implementation.
6. Avoid duplicate work: check for open lanes before creating new ones.
7. Flag T1/risky scope to ClaudeGovernance.

**What CTO Does Not Do**

- Does not manage board state (PM owns queue hygiene).
- Does not self-close VL-required work.
- Does not generate PM_VERDICT or approve PM_REQUIRED actions.

---

## 3. Release Clerk Heartbeat

**Frequency**
- Active merge windows: every 10–15 minutes.
- Otherwise: hourly.

**Model**
- Default: cheap/fast model (Haiku or equivalent fast-mini).
- No deep reasoning needed — mechanics only.
- Never escalate to stronger model for Release Clerk tasks.

**Responsibilities**

1. PR link hygiene: every open PR is linked to its issue.
2. Missing label detection: label PRs per policy.
3. Missing PM_VERDICT detection: flag PRs missing verdict comments.
4. Sync metadata failures: detect issues where PR/Linear/Paperclip state is
   out of sync.
5. Superseded PR closure: close per `auto-close-superseded` rule.
6. Release notes: draft release notes from merged PR list.
7. Status movement per approved status-move table.
8. Generate `gh` CLI batch commands for PM verdict output.

**PM_VERDICT Generation Rules**

- Release Clerk may generate `PM_VERDICT: APPROVED` only for AUTO_APPROVE
  categories.
- For APPROVE_WITH_GUARDRAILS: generate the command but annotate with
  guardrail conditions that must be confirmed by PM before posting.
- Never generate `PM_VERDICT: APPROVED` for PM_REQUIRED or NOT_APPROVED
  categories.
- If Release Clerk cannot post as CODEOWNERS, output the exact `gh` command
  batch for PM to run.
- If a PR maps to multiple issues, generate one verdict per required issue
  unless the merge-gate spec says otherwise.

**`gh` Batch Format**

```bash
gh pr comment <PR_NUMBER> --body $'PM_VERDICT: APPROVED\nschema: pm-verdict/v1\nIssue: <ISSUE_ID>'
```

---

## 4. VerificationLead Heartbeat

**Frequency**
- On assignment: immediate wake.
- While assigned: every 30 minutes until PASS/BLOCK issued.
- Otherwise: idle (no proactive sweeps).

**Model**
- Default: standard reasoning model (Claude Sonnet or equivalent).
- T1 gate proofs: use stronger reasoning model.
- Never use cheapest model for evidence evaluation — proof review requires
  genuine reasoning.

**Responsibilities**

1. Evaluate proof artifacts attached to the issue.
2. Confirm acceptance criteria are met by the evidence.
3. Audit CI gate context: is the CI run post-fix and unbroken?
4. Check for regressions against prior baselines.
5. Issue one of:
   - **PASS**: evidence meets all acceptance criteria.
   - **CONDITIONAL PASS**: evidence sufficient with named caveats.
   - **BLOCK**: evidence insufficient, missing, stale, or synthetic — cite
     exact failing criteria.
6. Never rubber-stamp.
7. Escalate proof gaps to CTO (if fix needed) or PM (if process/policy issue).

**Evidence Freshness Rule**

Evidence must post-date the fix. Evidence from before the fix was applied does
not count as proof of the fix's correctness. VerificationLead must reject
stale evidence regardless of its apparent quality.

---

## 5. ClaudeGovernance Heartbeat

**Frequency**
- On T1/T2 spec or PR review assignment: immediate wake.
- Active sprint: every 30–60 minutes to spot-check open T2 lanes.
- T3 spot checks: cheaper model; no scheduled frequency — event-triggered.

**Model**
- T1 review: strongest reasoning model (Claude Sonnet/Opus or equivalent
  Thinking model).
- T2 bounded review: standard model.
- T3 spot checks: cheap/fast model.

**Responsibilities**

1. Spec readiness: is the issue spec complete (tier, allowed_files,
   forbidden_files, proof commands, rollback criteria)?
2. Scope review: does the PR change exactly what the issue specifies?
3. Architecture truth: does the change respect architecture contracts and
   authority boundaries?
4. Forbidden files/imports: are forbidden files or imports present?
5. PM_REQUIRED classification: surface any action that needs PM authority.
6. Reject unsafe authority changes (repo settings, gate manipulation,
   lifecycle/settlement mutations not already PM-approved).

**What ClaudeGovernance Does Not Do**

- Does not replace VerificationLead proof review.
- Does not evaluate evidence sufficiency.
- Does not make PM authority calls.
- Does not approve PM_REQUIRED or NOT_APPROVED actions.

---

## 6. Codex Heartbeat

**Frequency**
- Not periodic. Task-triggered only.
- Wakes when assigned an issue.
- Does not sweep or poll.

**Model by Tier**

| Tier | Model | Reasoning |
|---|---|---|
| T3 narrow | Cheap/fast (Haiku or equivalent) | Mechanical implementation; no deep reasoning needed |
| T2 bounded | Standard (Sonnet or equivalent) | Needs enough reasoning to stay within lane boundaries |
| T1 (exception only) | Strongest available | Only when PM + CTO + Governance have explicitly approved; rare |

**Responsibilities**

1. Implement approved, scoped, assigned work within lane boundaries.
2. Respect `allowed_files`, `forbidden_files`, `proof_commands`, and
   `rollback_criteria` from the lane spec.
3. Run proof commands and attach artifacts before marking done.
4. Create a PR and link it to the issue.
5. Escalate immediately if scope is ambiguous or the lane boundary is unclear.
6. Never merge, never self-certify done without proof, never start T1 work
   without the full exception approval chain.

---

## 7. Model Cost Policy

### Use Cheap/Fast Models For

- Release Clerk mechanics (PR links, labels, comment detection).
- PM status sweeps and queue hygiene.
- PR label and comment detection.
- Linear/Paperclip status cleanup.
- Release note drafting.
- Metadata validation.
- T3 Codex implementation.
- Any action where reasoning depth does not affect correctness.

**Recommended:** Claude Haiku 4.5, GPT-mini equivalent.

---

### Use Standard Reasoning Models For

- CTO sequencing and dispatch.
- VerificationLead proof review (non-T1).
- ClaudeGovernance T2 scope/spec review.
- Exception packet generation.
- T2 Codex bounded implementation.
- PM T1 exception packet authoring.

**Recommended:** Claude Sonnet 4.6, GPT-5.5 standard equivalent.

---

### Use Strongest Reasoning Models Only For

- T1 production readiness gates.
- Migration or cutover decisions.
- DB, settlement, lifecycle, or promotion authority decisions.
- Queue mutation decisions (PM_REQUIRED class).
- Scoring or promotion policy changes.
- Interpreting ambiguous or conflicting proof.
- ClaudeGovernance T1 review.
- VerificationLead T1 gate proof evaluation.

**Recommended:** Claude Opus 4.7, GPT-5.5 Thinking, or equivalent strongest
available model.

---

### Never Use Strongest Models For

- Repetitive PR comments.
- Status changes.
- Release notes.
- Label cleanup.
- Sync metadata detection.
- Routine PM queue sweeps.
- T3 Codex implementation.

Overusing strongest models on mechanical tasks consumes budget without
providing quality benefit. Budget spent on mechanics is budget not available
for T1 decisions that actually need deep reasoning.

---

## 8. Heartbeat Summary Table

| Agent | Active Frequency | Otherwise | Default Model | Strongest Model Trigger |
|---|---|---|---|---|
| PM | 15 min | Hourly | Haiku/fast | T1 exception packets only |
| CTO | 30–60 min | Event-triggered | Sonnet/standard | Architecture/T1 sequencing |
| Release Clerk | 10–15 min (merge windows) | Hourly | Haiku/fast | Never |
| VerificationLead | On assignment + 30 min | Idle | Sonnet/standard | T1 gate proof |
| ClaudeGovernance | On T1/T2 assignment + 30–60 min | Event-triggered | Sonnet/standard | T1 review |
| Codex | Task-triggered | Idle | Haiku/fast (T3) | T1 (exception only) |
