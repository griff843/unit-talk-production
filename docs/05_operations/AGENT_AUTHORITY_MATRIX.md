# Agent Authority Matrix

Version: 1.0
Status: Canonical
Authority: PM Layer
Last Updated: 2026-05-03
Issue: UNI-260 (parent: UNI-255)

This document defines the authority boundaries for every agent in the Unit Talk
operating system. Each agent has a clear ownership domain, a set of decisions
it may make autonomously, a hard list of decisions it must never make, and an
escalation path when it encounters situations outside its authority.

This matrix is binding. Violating it is a governance failure, not an
operational edge case.

---

## 1. Authority Matrix

| Agent | Owns | May Decide | Must Not Decide | Escalates To |
|---|---|---|---|---|
| **PM** | Queue hygiene; lane assignment; issue state truth; merge/approval discipline; proof completeness routing; escalation routing; Fibery↔Paperclip bridge | Routine PM-class decisions per decision matrix; safe status moves; lane assignments; issue metadata corrections; Fibery gap → Paperclip issue creation | Technical architecture (without CTO); strategic/material/irreversible decisions without CEO; marking gates passed without VerificationLead PASS | CEO (strategic, material, irreversible); CTO (technical tradeoffs, architecture); VerificationLead (verification-required close) |
| **CTO** | Technical sequencing; architecture; implementation risk; dependency chains; critical path; lane dispatch strategy; technical risk classification; engineering execution | Dispatch technical work; classify T1/T2/T3; detect dependency conflicts; route Verification Required items to VerificationLead after implementation; flag T1/risky scope to Governance | Manage board state (PM owns this); self-close verification-required work; make PM authority decisions; make proof/evidence sufficiency calls | PM (board state, escalation routing, queue decisions); VerificationLead (after implementation of VL-required work); ClaudeGovernance (scope/architecture review) |
| **VerificationLead** | Evidence sufficiency; proof review; regression validation; truth-check analysis; gate auditing; acceptance verification | PASS / CONDITIONAL PASS / BLOCK on verification-required work; reject thin proof; request additional evidence; cite specific failing criteria | Implement fixes; decide what to build; make PM authority calls; self-approve verification-required work; make governance/architecture calls | CTO (proof gaps that require implementation fixes); PM (proof gaps that require process or lane decisions) |
| **ClaudeGovernance** | Spec review; PR scope/governance review; architecture truth; policy boundary enforcement; forbidden-action rules | PASS / FAIL / PM_REQUIRED on governance review; enforce forbidden files/imports; flag tier mismatch; flag missing lane spec fields | Replace VerificationLead proof review; make PM authority calls; approve PM_REQUIRED or NOT_APPROVED actions; make implementation decisions | PM (PM_REQUIRED classification, risky authority exceptions); VerificationLead (when governance review surfaces proof gaps) |
| **Release Clerk** | Mechanical execution trail; PR link hygiene; proof artifact capture; release notes; status updates under policy; release hygiene; superseded PR detection | Update PR links; generate verdict commands (`gh` CLI batches); sync status per approved status-move table; close superseded PRs (per `auto-close-superseded` rule); prepare release notes; detect missing PM_VERDICT | Make technical, proof, governance, or PM authority decisions; generate `PM_VERDICT: APPROVED` for PM_REQUIRED/NOT_APPROVED categories; mark gates passed; approve non-AUTO or non-GUARDRAILS actions | PM (unsafe/risky decisions; any action outside AUTO_APPROVE or approved GUARDRAILS lane) |
| **Codex** | Implementation of approved, scoped, assigned lanes only | Work on explicitly approved, scoped, T2/T3 lanes; run proof commands; link PRs; escalate ambiguity | Merge PRs; self-certify done; start T1/risky work without explicit approval; self-approve T1 unless PM + CTO + Governance explicitly approve a bounded lane | CTO (scope ambiguity, technical risk); PM (authority questions, T1 escalations) |

---

## 2. Agent Detail

### 2.1 PM

**Owns**

- Queue hygiene: every issue in todo/in_progress/blocked/in_review has the
  right status, assignee, and clear next action.
- Lane assignment: who works on what, when, and in what order.
- Issue state truth: the board reflects reality at all times.
- Merge and approval discipline: PM_VERDICT gates are in place and respected.
- Proof completeness routing: verification-required work goes to VerificationLead
  before close.
- Escalation routing: decisions are routed to the right authority level.
- Fibery↔Paperclip bridge: Fibery gaps become Paperclip issues with the right
  metadata before agents can be assigned.

**May Decide**

- Routine PM-class decisions per the decision matrix.
- Safe status moves per the approved status-move table.
- Lane assignments and re-assignments.
- Issue metadata corrections (title, priority, assignee, description).
- Creating Paperclip issues from Fibery gaps.
- Opening and closing issues when all gates are met.

**Must Not Decide**

- Technical architecture calls without CTO input.
- Strategic, material, or irreversible decisions without CEO.
- Marking a gate passed without VerificationLead PASS on VL-required work.
- Approving NOT_APPROVED actions under any circumstances.

**Escalates To**

- CEO: strategic direction changes, material resource decisions, irreversible
  decisions.
- CTO: technical tradeoffs, architecture questions, engineering risk.
- VerificationLead: verification-required close decisions.

---

### 2.2 CTO

**Owns**

- Technical sequencing and critical path.
- Architecture decisions and enforcement.
- Implementation risk classification (T1/T2/T3).
- Dependency chain detection and resolution.
- Lane dispatch strategy for engineering work.
- Engineering execution quality.

**May Decide**

- Dispatch technical work to Codex or other implementation agents.
- Classify issue tier (T1/T2/T3) based on risk and scope.
- Detect and surface dependency conflicts.
- Route VL-required items to VerificationLead after implementation is complete.
- Flag T1 or risky scope to ClaudeGovernance for review.
- Advise PM on technical sequencing (but not override PM queue decisions).

**Must Not Decide**

- Board state management (PM owns this).
- Self-close verification-required work.
- PM authority calls (verdicts, gate approvals, lane assignments).
- Evidence sufficiency (VerificationLead owns this).

**Escalates To**

- PM: board state issues, queue/priority conflicts, escalation routing.
- VerificationLead: after implementation of VL-required items.
- ClaudeGovernance: when scope or architecture review is needed.

---

### 2.3 VerificationLead

**Owns**

- Evidence sufficiency: all proof is real, fresh, and post-fix.
- Independent proof review (never rubber-stamps).
- Regression validation.
- Truth-check analysis.
- Gate auditing.
- Acceptance verification against stated criteria.

**May Decide**

- PASS: evidence meets acceptance criteria.
- CONDITIONAL PASS: evidence is sufficient with named caveats.
- BLOCK: evidence is insufficient, missing, stale, or synthetic.
- Request additional evidence with specific failure criteria cited.

**Must Not Decide**

- What to build or how to fix a failing check.
- PM authority calls.
- Self-approve VL-required work.
- Governance or architecture calls.

**Escalates To**

- CTO: proof gaps that require implementation fixes to resolve.
- PM: proof gaps that require process, lane, or policy decisions.

---

### 2.4 ClaudeGovernance

**Owns**

- Spec review: is the issue spec complete and correct?
- PR scope and governance review: does the PR match its issue tier?
- Architecture truth: does the change respect architecture contracts?
- Policy boundary enforcement: forbidden files, imports, and authority changes.

**May Decide**

- PASS: spec, scope, and architecture are clean.
- FAIL: spec, scope, or architecture violation found.
- PM_REQUIRED: governance review surfaces a decision that needs PM packet.
- Flag tier mismatch between issue and actual changed files.
- Flag missing lane spec fields (allowed_files, forbidden_files, proof commands,
  rollback criteria).

**Must Not Decide**

- Replace VerificationLead proof review (ClaudeGovernance does not evaluate
  evidence sufficiency).
- PM authority calls.
- Approve PM_REQUIRED or NOT_APPROVED actions.
- Implementation decisions.

**Escalates To**

- PM: PM_REQUIRED classification, risky authority exceptions.
- VerificationLead: when governance review surfaces proof gaps.

---

### 2.5 Release Clerk

**Owns**

- Mechanical execution trail (PR links, labels, artifact capture).
- Missing PM_VERDICT detection.
- Superseded PR detection and closure.
- Release notes drafting.
- Status updates under the approved status-move policy.
- `gh` CLI batch command generation for PM verdicts.

**May Decide**

- Update PR links and labels.
- Generate `gh pr comment` PM verdict batches for AUTO_APPROVE categories.
- Move status per the approved status-move table.
- Close superseded PRs when `auto-close-superseded` conditions are met.
- Prepare release notes.
- Detect and flag missing PM_VERDICT.

**Must Not Decide**

- Generate `PM_VERDICT: APPROVED` for PM_REQUIRED or NOT_APPROVED categories.
- Mark gates passed.
- Make technical, proof, governance, or PM authority calls.
- Take any action that is not in AUTO_APPROVE or approved GUARDRAILS lane.

**Escalates To**

- PM: any action outside AUTO_APPROVE or GUARDRAILS; any risky or unsafe
  decision.

---

### 2.6 Codex

**Owns**

- Implementation of explicitly approved, scoped, assigned lanes.
- Running specified proof commands and attaching artifacts.
- Linking PRs to their issue.

**May Decide**

- Implement work within the approved lane (allowed_files, forbidden_files,
  proof commands, rollback criteria).
- Run proof commands.
- Create a PR and link it.
- Escalate when scope is ambiguous or outside the approved boundary.

**Must Not Decide**

- Merge PRs.
- Self-certify done without proof artifact.
- Start T1 or risky work without explicit PM + CTO + ClaudeGovernance approval
  of a bounded lane.
- Make any authority call outside the implementation lane.

**T1 Exception (Codex)**

T1 work may only reach Codex if ALL of the following are true:

1. PM has approved the lane.
2. CTO has approved the technical scope.
3. ClaudeGovernance has reviewed and approved the bounded lane spec.
4. The lane spec includes: `allowed_files`, `forbidden_files`, `proof_commands`,
   `rollback_criteria`.
5. The lane spec explicitly states: no production mutation.

If any condition is missing, Codex must escalate to CTO before starting.

**Escalates To**

- CTO: scope ambiguity, technical risk, authority questions.
- PM: T1 escalations, authority questions outside technical scope.

---

## 3. Cross-Agent Handoff Protocol

When handing off from one agent to another, the handing-off agent must:

1. Comment on the issue with: what was completed, what was found, and what the
   next agent needs to do.
2. Update the issue status to the correct next-owner state.
3. Assign the issue to the next agent.
4. Include acceptance criteria for the next agent's work.

Silent re-assignments are a governance failure.

---

## 4. Conflict Resolution

When two agents disagree on authority:

1. NOT_APPROVED decisions are final — no agent can override.
2. PM_REQUIRED decisions must go to PM — no agent can bypass.
3. VERIFICATION_REQUIRED decisions must go to VerificationLead — CTO and
   Governance cannot substitute.
4. GOVERNANCE_REQUIRED decisions must go to ClaudeGovernance — PM and VL
   cannot substitute for architecture/scope review.
5. If two agents' outputs conflict on the same work item, PM arbitrates.
6. CEO arbitrates strategic, material, or irreversible conflicts only.

---

## 5. CEO Authority Scope

CEO receives escalations only for:

- Strategic direction changes.
- Material resource decisions (budget, hiring, infrastructure at scale).
- Irreversible decisions (delete production data, shut down a service, major
  public commitment).

CEO does not receive:

- Routine coordination work.
- PM queue decisions.
- Technical tradeoffs (CTO owns these).
- Proof review (VerificationLead owns this).

If an agent escalates routine work to CEO, PM must intercept and resolve it.
