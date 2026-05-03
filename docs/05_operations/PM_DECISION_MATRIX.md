# PM Decision Matrix

Version: 1.0
Status: Canonical
Authority: PM Layer
Last Updated: 2026-05-03
Issue: UNI-260 (parent: UNI-255)

This document is the single source of truth for classifying every PR, issue,
and action into an approved decision lane. All agents — PM, CTO,
VerificationLead, ClaudeGovernance, Release Clerk, and Codex — consume this
matrix. The machine-readable rules in `pm-decision-rules.json` are generated
from this document.

---

## 1. Decision Classes

| Class | Short Code | Meaning |
|---|---|---|
| AUTO_APPROVE | `AUTO` | Safe to proceed without PM review. Release Clerk may execute directly. |
| APPROVE_WITH_GUARDRAILS | `GUARDRAILS` | May proceed if stated guardrail conditions are met and proof is logged. |
| PM_REQUIRED | `PM` | Must have PM packet or explicit PM approval before execution. |
| VERIFICATION_REQUIRED | `VL` | Must route to VerificationLead before closing or shipping. |
| GOVERNANCE_REQUIRED | `GOV` | Must route to ClaudeGovernance before closing or shipping. |
| BLOCKED | `BLOCKED` | Cannot proceed; blocker owner and action must be named. |
| NOT_APPROVED | `NOT_APPROVED` | Never auto-approve. Attempt is a policy violation. |

---

## 2. Classification Table

### AUTO_APPROVE

All applicable conditions in the rule set must pass for auto-approval.

| Action Type | Rule ID | Conditions |
|---|---|---|
| T3 docs-only PR (no runtime changes) | `auto-docs-t3` | No code changes, no env/config mutations, passes lint |
| T3 test-only PR | `auto-tests-t3` | No production code paths changed, CI green |
| T3 tooling/script — no runtime authority | `auto-tooling-t3` | Script does not mutate DB, API, secrets, or production state |
| Non-runtime metadata fix | `auto-metadata` | title, description, label, comment — no functional change |
| PR comment generation for a previously approved PM verdict | `auto-verdict-comment` | PM_VERDICT already exists for parent issue; comment only restates it |
| Closing superseded PR when supersedence is explicit | `auto-close-superseded` | Superseding PR is merged; old PR has no open review threads |
| Moving stale board status to next-owner state (no risk decision) | `auto-status-move` | Transition is in the approved status-move table (Section 5); no business decision implied |

### APPROVE_WITH_GUARDRAILS

| Action Type | Rule ID | Guardrail Conditions |
|---|---|---|
| T2 read-only proof/reporting script | `guardrails-t2-proof-script` | Script has no write path; proof artifact is attached before close |
| T2 CI/workflow improvement — no production mutation | `guardrails-t2-ci` | CI change scoped to build/test; no deploy or migration triggers |
| T2 QA reporting automation | `guardrails-t2-qa-report` | Report is read-only; does not drive any approval or gate state |
| T1 docs/proof/runbook lane — no production mutation | `guardrails-t1-docs` | PM authorization exists on parent issue; lane has no mutation commands |

### PM_REQUIRED

| Action Type | Rule ID |
|---|---|
| Any T1 lane not covered by an approved GUARDRAILS rule | `pm-t1-general` |
| Production cutover | `pm-cutover` |
| Server purchase or provisioning | `pm-server-purchase` |
| Repo branch protection / ruleset change | `pm-branch-protection` |
| Credential or secrets rotation; new production secret | `pm-secrets` |
| Production DB mutation | `pm-db-mutation` |
| Destructive cleanup (bulk delete, DROP TABLE, archive purge) | `pm-destructive` |
| Bulk pick approval | `pm-bulk-pick` |
| Queue drain (any queue) | `pm-queue-drain` |
| Scoring or promotion policy change | `pm-scoring-policy` |
| Settlement or lifecycle authority change | `pm-settlement` |
| Discord distribution expansion | `pm-discord-expand` |
| Marking a production-readiness gate as passed | `pm-gate-passed` |
| Bypassing proof coverage | `pm-bypass-proof` |
| PM_VERDICT on a risky PR | `pm-verdict-risky` |

### VERIFICATION_REQUIRED

| Action Type | Rule ID |
|---|---|
| Any T1 work | `vl-t1` |
| Truth-check infrastructure change | `vl-truth-check` |
| CI or gate configuration change | `vl-ci-gate` |
| Proof-of-readiness work | `vl-readiness` |
| R-level enforcement change | `vl-r-level` |
| Production-readiness gate claim | `vl-gate-claim` |
| Any claim based on evidence, test, or proof artifacts | `vl-evidence-claim` |

### GOVERNANCE_REQUIRED

| Action Type | Rule ID |
|---|---|
| T1/T2 scope review | `gov-scope-review` |
| DB, settlement, lifecycle, promotion, provider contract, or distribution change | `gov-authority-boundary` |
| Architecture authority boundary enforcement | `gov-architecture` |
| Forbidden file or import risk | `gov-forbidden-files` |
| Mismatch between issue tier and actual changed files | `gov-tier-mismatch` |
| Proof gate interpretation risk | `gov-gate-interpretation` |
| Issue missing allowed_files, forbidden_files, proof commands, or rollback criteria | `gov-missing-lane-spec` |

### NOT_APPROVED

| Action Type | Rule ID | Reason |
|---|---|---|
| Queue drain to pass a readiness gate | `gate-corruption-queue-drain` | Manufactures gate evidence; does not fix the underlying issue |
| Bulk `awaiting_approval` pick approval to produce settlement or CLV proof | `gate-corruption-bulk-pick` | Synthetic approval chain does not constitute valid proof |
| Synthetic or backfill-only evidence used to mark a production gate passed | `gate-corruption-synthetic-evidence` | Evidence must be from a fresh, governed pipeline run post-fix |
| Production mutation hidden inside a proof lane | `not-approved-hidden-mutation` | Proof lanes are read-only by definition |
| Closing verification-required work without VerificationLead PASS | `not-approved-bypass-vl` | VerificationLead sign-off is non-negotiable on VL-required work |
| Marking gate passed without fresh post-fix governed pipeline evidence | `not-approved-stale-gate` | Gate evidence must post-date the fix and be unbroken |
| Repo settings changes by an implementation agent | `not-approved-agent-settings` | Repo settings are human/PM-only authority |
| Server purchase without human PM or CEO decision | `not-approved-server-purchase` | Material cost decision; requires human sign-off |
| Production cutover without all child gates green | `not-approved-cutover-gates` | Cutover requires complete gate evidence |

---

## 3. UTV2-433 Regression Case (Canonical)

**Rule:** `gate-corruption-queue-drain`
**Decision:** NOT_APPROVED

This case is a canonical regression test for the decision matrix. Any
classification engine must reproduce this output given these inputs.

### Input

- MLB CLV gate is blocked
- 503 MLB picks stuck in `awaiting_approval`
- Proposed unblock: approve the queued picks so settlements and CLV can compute

### Expected Agent Outputs

| Agent | Output |
|---|---|
| VerificationLead | PROOF_INCOMPLETE |
| ClaudeGovernance | PM_REQUIRED / HIGH_RISK |
| Decision Matrix | NOT_APPROVED (rule: `gate-corruption-queue-drain`) |
| Release Clerk | No PM_VERDICT APPROVED generated |
| PM | Escalation packet; propose separate T1 queue-remediation lane |

### Why NOT_APPROVED

The proposed action mutates the production pick lifecycle and drains the
approval backlog to manufacture gate evidence. The gate is blocked because the
underlying data is not ready — approving the queue does not fix that; it hides
it.

### Allowed Alternative

Create a separate T1 queue-remediation issue with:
- sample/scope criteria
- operator review plan
- lifecycle impact analysis
- proof artifacts from a fresh post-fix pipeline run

---

## 4. Canonical Status Model

Retire the following ambiguous statuses immediately:

| Retired Status | Replace With |
|---|---|
| In Review | In PM Review / In Proof / In Claude / In Codex / Ready to Close / Blocked Internal |
| In Progress | In Claude / In Codex / In Proof / Blocked Internal |
| Blocked (generic) | Blocked Internal or Blocked External (with named blocker) |
| Ready (generic) | Ready for Claude / Ready for Codex / Ready to Close |

### Canonical Next-Owner States

| Status | Meaning |
|---|---|
| Backlog | Parked; not yet scheduled |
| PM Triage | Needs PM classification before work can begin |
| Needs PM Decision | Work is ready; waiting for explicit PM approval |
| Needs Standard | Work spec incomplete; needs standards/governance input |
| Ready for Claude | Approved, specced, assigned to a Claude agent |
| Ready for Codex | Approved, specced, assigned to a Codex agent |
| In Claude | Claude agent is actively working |
| In Codex | Codex agent is actively implementing |
| In Proof | VerificationLead is reviewing evidence |
| In PM Review | PM is reviewing for merge/close decision |
| Blocked Internal | Blocked by another internal issue (blockedByIssueId required) |
| Blocked External | Blocked by an external dependency (blocker named in comment) |
| Ready to Close | All gates green; waiting for final close action |
| Done | Work complete, no follow-up required |
| Canceled | Intentionally abandoned |
| Duplicate | Superseded by another issue |
| Deferred | Intentionally postponed; has a reopen condition |

### Status Transition Rules

These transitions must be enforced by PM sweep or Release Clerk automation:

| Trigger | Transition |
|---|---|
| In Review → classify | → In PM Review / In Proof / In Claude / In Codex / Ready to Close / Blocked Internal |
| In Progress → classify | → In Claude / In Codex / In Proof / Blocked Internal |
| Needs Standard → resolved | → Ready for Claude / Ready for Codex / Blocked External |
| Ready to Close + merged + proof complete | → Done |
| Verification Required + no VerificationLead PASS | → never Done |
| Blocked without named blocker | → add blocker comment; remain Blocked |

---

## 5. Approved Status-Move Table (AUTO_APPROVE eligible)

The following status transitions are safe for Release Clerk to execute without
PM review, provided the stated conditions are met:

| From | To | Condition | Done Authority |
|---|---|---|---|
| In Review | In PM Review | PR is open; PM comment is missing | — |
| In Review | Ready to Close | PR is merged; proof is attached | — |
| Needs Standard | Ready for Claude | Standard exists and is linked | — |
| Needs Standard | Ready for Codex | Standard exists and is linked | — |
| Ready to Close | Done | PR merged; VerificationLead PASS exists (if VL required) | **yes** |
| In Claude | In Proof | Claude agent has commented task complete | — |
| In Codex | In PM Review | Codex PR is open and CI green | — |

Any transition NOT in this table requires PM classification (PM_REQUIRED) or
agent confirmation before automation may move the status.

Only rows marked **Done Authority = yes** permit Release Clerk to set issue
status to `done`. All other done transitions require PM action. See Section 6.

---

## 6. Release Clerk Done-Authority Rule

**Rule ID:** `release-clerk-status-authority`

This rule governs the boundary between Release Clerk mechanical automation and
PM issue-state authority.

### Policy

1. Release Clerk **may** execute any status move listed as `AUTO_APPROVE` in
   Section 5 and in `pm-decision-rules.json`.
2. Release Clerk **may NOT** set issue status to `done` unless the matching
   rule entry carries `"done-authority": true`.
3. All done transitions not explicitly delegated in this document require PM
   action.

### Rationale

PM is issue-state truth. Allowing RC to set `done` without explicit delegation
would silently transfer PM authority to a mechanical agent, creating a bypass
path that neither PM nor Governance can track.

### Rules carrying done-authority: true

| Rule ID | Permitted Done Transition | Conditions |
|---|---|---|
| `auto-status-move` (Ready to Close → Done row only) | Issue → done | PR merged; VerificationLead PASS exists (if required) |

Any new AUTO_APPROVE rule that involves a done transition must explicitly set
`"done-authority": true` in `pm-decision-rules.json` and document it in this
table before Release Clerk may execute it.

### Default

`done-authority` defaults to `false`. Absence of the field means RC must not
set done, even if the transition is otherwise AUTO_APPROVE.

**Cross-references:** [UNI-263](/UNI/issues/UNI-263) (Release Clerk) consumes
these delegated rules.
