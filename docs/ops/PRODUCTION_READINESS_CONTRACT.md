# Production Readiness Contract

**Version**: 1.1 **Status**: RATIFIED **Ratified**: 2026-03-18
(SPRINT-PRODUCTION-READINESS-CONTRACT-RATIFICATION) **Authority**: Canonical —
supersedes all prior drafts and readiness discussions **Last Updated**:
2026-03-18 **Owner**: Engineering / Operations **Purpose**: Define exactly what
Unit Talk must satisfy to be considered production ready, define what a
"production day" is, and establish the acceptance standard against which all
future simulation audits and launch decisions are judged.

> This contract is intentionally strict. It defines the minimum acceptable
> truth, not the most convenient truth. Layers and phases being marked complete
> does not satisfy this contract. Audit evidence does.

---

## 1. Why This Exists

The roadmap defines what Unit Talk is building and in what order. This contract
defines what must be true before Unit Talk can be called production ready.

These are not the same thing.

- The **roadmap** governs sequencing and construction.
- The **Production Readiness Contract** governs operational acceptance.

Without this contract:

- production readiness is judged by guesswork or wishful inference,
- audits run against no fixed standard,
- "works in repo" is confused with "works in production,"
- launch decisions become undisciplined.

This contract exists so that every readiness claim is falsifiable and every
launch decision is explicit.

---

## 2. Readiness Tiers

### Tier A — Elite Production Ready

Unit Talk is **Elite Production Ready** only when all of the following are true:

- The full pick lifecycle works correctly and end-to-end for both
  **system-generated picks** and **capper-submitted picks**.
- All critical workflows are automated or intentionally fail-closed with
  documented escalation.
- Operator approval flow is correctly enforced and accessible.
- Canary direct-post testing mode functions correctly.
- Pick posting, settlement (automatic and manual), recap, downstream
  performance/stat updates, and Command Center truth are all correct.
- Output quality is premium: embeds are complete, all assets are present
  (headshots required, logos required), formatting is consistent across all
  flows.
- Required platform and product alerts are active and truthful.
- Operational failures surface immediately, visibly, and with correct
  escalation.
- All four platform SLOs are currently attaining their targets over the 7-day
  rolling window.
- Elite product surfaces are operational:
  - **Injury alerts**: active for Out, Doubtful, GTD, and Questionable (where
    tied to an active or queued pick)
  - **Steam / line movement alerts**: active with defined thresholds (see
    Section 8)
  - **Game Day Live**: meets both experience and latency standards (see Section
    6.4)
  - **Onboarding**: production-grade flow with correct role routing (see Section
    6.4)
  - **Black Label / portfolio**: premium curated surfaces are production-grade
    (see Section 6.4)

This is the target standard. Unit Talk is not Elite Production Ready unless
every bullet is satisfied.

### Tier B — Guarded Launch Ready

Unit Talk is **Guarded Launch Ready** only when:

- The full core pick lifecycle works truthfully and reliably for both pick
  types.
- Operator approval is the enforced default for system-generated picks.
- Canary posting path is available for testing.
- Critical lifecycle failures do not occur silently — all failures escalate
  visibly.
- Settlement (automatic and manual), recap, and downstream performance
  accounting are correct.
- Command Center shows accurate, real operational data.
- The core four SLOs are not in BREACH.
- The launch can be controlled safely with active operator oversight.
- All Discord embed logos are present (logos are required at Tier B; absence is
  a hard-fail — see Section 6.1).

This tier may tolerate the absence of elite-only product surfaces (Game Day
Live, injury/steam alerts, Black Label/portfolio, onboarding beyond minimal
access routing). It may **never** tolerate broken core truth, silent failure,
fabricated success, or missing logos.

### What No Tier Tolerates

No tier, including Guarded Launch, tolerates:

- picks posting incorrectly,
- picks settling incorrectly,
- lifecycle adapters being bypassed,
- mock data substituted on production paths,
- silent failure without escalation,
- Command Center showing materially false state,
- Discord embeds missing logos.

---

## 3. Production Day Definition

A **Production Day** is a full end-to-end operational cycle in which Unit Talk
handles the complete daily pick machine lifecycle using its real intended
runtime paths.

For audit purposes, a production day must include all of the following stages,
with each stage completing truthfully:

### Stage 1 — Pick Intake

- **System-generated picks**: picks produced by the scoring/grading pipeline
  flow through the bridge or direct ingestion path correctly.
- **Capper-submitted picks**: picks submitted via `apps/smart-form` flow through
  `bridge_outbox` and are ingested correctly with proper capper attribution
  preserved.

Both paths must be exercised. A production day that only tests one path is
incomplete.

### Stage 2 — Scoring / Grading / Evaluation

- All required scoring occurs: feature vector computation, tier assignment,
  promotion band assignment.
- Downstream data enrichment (CLV computation, risk gate evaluation, promotion
  policy check) occurs correctly.
- CONSTITUTIONAL gates 7 and 8 (featureSnapshotId / featureVectorHash) are
  satisfied — picks are not silently blocked by missing metadata.
- GradingAgent processes picks without silent failure.

### Stage 3 — Approval Routing

Both approval paths must work correctly in the same production day:

| Mode        | Behavior                                                    | Required |
| ----------- | ----------------------------------------------------------- | -------- |
| Launch mode | Operator approval required before subscriber-facing posting | Yes      |
| Canary mode | Direct post to canary channel, no approval wait             | Yes      |

Neither mode may silently bypass the other. Approval gates may not be hardcoded
to pass. Canary channel routing must use the correct channel, not the subscriber
channel.

### Stage 4 — Posting

- Discord picks post correctly.
- Embeds are complete (see Section 6 for exact requirements).
- Posts route to the correct channel (subscriber channel vs canary test
  channel).
- `pick_publish` outbox transitions `pending → posted` successfully.
- No embed renders with missing critical fields.
- Posting latency: `pick_publish` rows reach `posted` status within 15 minutes
  of insertion (SLO 2 definition).

### Stage 5 — Settlement

Both settlement paths must work:

| Path                                  | Description                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Automatic settlement                  | Settlement agent processes outcomes without operator intervention; `SETTLEMENT_AGENT_ENABLED=true` in production mode |
| Manual settlement / operator override | Operator can settle any pick manually via control plane                                                               |

Settlement must propagate correctly to:

- `unified_picks.settlement_status` and `lifecycle_stage`
- `prop_settlements` where applicable
- capper performance records
- platform-level performance records
- recap input data

Settlement is verified correct only when all downstream records reflect the
correct outcome. A settled pick with wrong downstream state is a settlement
failure.

### Stage 6 — Downstream Updates

After settlement:

- Capper win/loss/ROI records update correctly.
- Unit Talk overall platform performance updates correctly.
- Database state in `unified_picks` reflects the final lifecycle stage
  (`SETTLED`).
- Any performance rollup tables used by Command Center or recaps are correct.

### Stage 7 — Recaps

- Recap generation completes and is presentation-ready.
- Recap content is correct relative to settled outcomes.
- Recap embeds (if Discord-posted) meet the same quality bar as pick embeds.

### Stage 8 — Operator Visibility

- Command Center surfaces (picks, agents, health, cappers, workflows, alerts,
  settlement) show accurate, real data throughout the production day.
- No dashboard shows stale, mocked, or fabricated state.
- Operator can identify pick status, settlement state, and any active failures
  at any point in the day.

### Stage 9 — Workflow Scheduling and Escalation

- Scheduled analysis workflows run as configured (SLO verification every 30
  minutes, grading status every 15 minutes).
- Any workflow failure triggers operator-visible escalation via Discord operator
  webhook within the expected window.
- No workflow failures result only in stdout logging with no operator
  notification.

A production day is not successful unless **all nine stages complete
truthfully**. Partial success in eight stages does not constitute a production
day.

---

## 4. Required Production Surfaces

### Required for Both Tiers

| Surface                     | Purpose                                                   |
| --------------------------- | --------------------------------------------------------- |
| `apps/api`                  | Canonical backend — all business logic, lifecycle, agents |
| `apps/smart-form`           | Capper pick submission (bridge_outbox write path)         |
| `apps/command-center`       | Operator visibility and workflow control                  |
| `apps/discord-bot`          | Discord channel interaction and slash command surface     |
| Lifecycle adapters          | Single-writer enforcement for `unified_picks`             |
| Settlement flows            | Automatic and manual settlement                           |
| Recap flows                 | Daily/weekly recap generation                             |
| Workflow scheduling         | Temporal scheduled analysis workflows                     |
| Workflow failure escalation | Discord operator webhook alerts on failure                |
| Operator alerts             | Workflow failures, lifecycle failures, SLO breaches       |

### Required Command Center Pages (for Guarded Launch)

The following pages must render real data without mock substitution:

- `/dashboard` — platform overview
- `/dashboard/picks` — PicksHQ with lifecycle state
- `/dashboard/cappers` — capper performance
- `/dashboard/health` — platform health (HEALTHY/DEGRADED/CRITICAL) and SLO
  attainment
- `/dashboard/alerts` — active alert list by severity
- `/dashboard/workflows` — WorkflowRegistry status
- `/dashboard/settlement` — settlement management
- `/dashboard/agents` — agent health
- `/dashboard/audit` — audit trail

### Additional Required for Elite Tier

- `/dashboard/analytics` — analytics surfaces
- `/dashboard/capper-command-center` — Capper Command Center
- `/dashboard/risk` — risk engine state (exposure, drawdown, correlation,
  market-type)
- Elite product surfaces as defined in Section 6.4

### Not Required for Either Tier

- User-facing subscriber dashboard (`apps/dashboard` or equivalent)

This surface may be required later but is not a launch readiness criterion at
this time.

---

## 5. Required Operational Paths

### 5.1 System-Generated Picks

System picks must support both operational modes:

**A. Launch Mode (operator approval required)**

- Pick is scored and promoted to the approval queue.
- Operator reviews and approves in Command Center.
- Only after operator approval does the pick post to subscriber Discord
  channels.
- This is the default mode at launch. `AUTOPILOT_MODE` = `log_only` or `canary`
  (not `prod`) unless explicitly enabled.

**B. Canary Test Mode**

- Pick posts directly to the designated canary channel without operator approval
  hold.
- Canary channel is separate from subscriber channels.
- `AUTOPILOT_MODE` = `canary` with `PROMOTION_CANARY_PERCENT > 0`.
- Posts must route to the canary channel only — not to subscriber channels.

Both modes must work correctly. Neither mode may silently route to the wrong
channel.

### 5.2 Capper-Submitted Picks

Capper picks must:

1. Submit via `apps/smart-form` → `bridge_outbox` only (never directly to
   `unified_picks`)
2. Ingest via BridgeWorker from `bridge_outbox` → `unified_picks` with correct
   capper attribution
3. Flow through scoring, approval, and posting lifecycle correctly
4. Settle correctly with capper attribution preserved
5. Update capper performance records accurately
6. Appear correctly attributed in Command Center

Capper attribution must never be lost, overwritten, or anonymized through any
lifecycle transition.

### 5.3 Settlement

Settlement is a hard requirement at both tiers. Both paths must be operational
and verified in audit:

| Path                       | Requirement                                                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic settlement       | `SettlementAgent` processes game outcomes; `SETTLEMENT_AGENT_ENABLED=true` must be set in the intended production mode and verified passing in the audit. A disabled agent with manual-only fallback does **not** satisfy this requirement. |
| Manual / operator override | Operator settles any pick via control plane; always available regardless of auto-settlement state                                                                                                                                           |

If `SETTLEMENT_AGENT_ENABLED` is `false` at audit time, the automatic settlement
requirement is not met and the audit result is NOT PRODUCTION READY unless this
is explicitly classified as a Guarded Launch with a documented remediation plan
and timeline.

Manual settlement capability is always required. Its absence is a hard-fail at
all tiers.

Settlement truth must propagate within one settlement cycle to:

- `unified_picks` lifecycle fields
- `prop_settlements`
- capper performance records
- platform performance records
- recap input state

### 5.4 Autopilot Modes

The following autopilot modes must work correctly:

| Mode       | Behavior                                                       |
| ---------- | -------------------------------------------------------------- |
| `log_only` | No picks promoted or posted; only logging                      |
| `canary`   | Picks post to canary channel up to `PROMOTION_CANARY_PERCENT`  |
| `prod`     | Full production posting; requires explicit operator enablement |

Mode switching via `PUT /ops/autopilot` must take effect immediately without
container restart.

**Canary channel requirement**: Before any canary-mode audit gate can be
evaluated, the designated canary Discord channel(s) must be explicitly
documented with their channel ID(s) in `docs/ops/CANARY_CHANNEL_CONFIG.md`. An
audit cannot verify correct channel routing without a documented
expected-channel reference. This file must exist and contain at least one
confirmed canary channel ID before the canary-mode audit is run.

---

## 6. Required Output Quality Standard

Output quality is a first-class production readiness requirement, not a
nice-to-have.

### 6.1 Discord Embed Requirements

#### Required for Elite Production Ready (Tier A)

All Discord pick embeds must include the following fields without exception:

| Field                 | Requirement                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Matchup               | Present and correct (Team A vs Team B, or event description)                                           |
| Pick / play           | Present and correct — exact prop, line, or side                                                        |
| Odds                  | Present (American format minimum)                                                                      |
| Tier                  | Present (S, A, B, C tier displayed)                                                                    |
| Promotion band        | Present where relevant (HARD, SOFT)                                                                    |
| Date / time context   | Present where applicable                                                                               |
| Capper attribution    | Present for capper-submitted picks                                                                     |
| Headshot              | **Required** — real player or capper headshot, not placeholder. Missing headshot = hard-fail at Elite. |
| Team/player logo      | **Required** — real logo asset, not placeholder or missing. Missing logo = hard-fail at Elite.         |
| Consistent formatting | Aligned with all other embed types; no layout regressions                                              |

For system-generated and capper-submitted picks, the embed quality bar is the
same. There is no lower standard for capper picks.

#### Required for Guarded Launch (Tier B)

All required data fields must be present:

| Field              | Tier B Requirement                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Matchup            | Required — hard-fail if missing                                                                                                                                                                                                      |
| Pick / play        | Required — hard-fail if missing                                                                                                                                                                                                      |
| Odds               | Required — hard-fail if missing                                                                                                                                                                                                      |
| Tier               | Required — hard-fail if missing                                                                                                                                                                                                      |
| Capper attribution | Required for capper picks — hard-fail if missing                                                                                                                                                                                     |
| Team/player logo   | **Required** — hard-fail if missing. Logos are mandatory at Tier B.                                                                                                                                                                  |
| Headshot           | **Preferred but not a Tier B blocker.** Absence downgrades readiness assessment but does not force a NOT PRODUCTION READY verdict, provided all other Tier B criteria are met and embeds are otherwise professional in presentation. |

Guarded Launch does not permit embeds that look broken, incomplete, or obviously
"beta." Missing logos are a hard-fail at Tier B. Missing headshots at Tier B are
a quality gap that must be documented in the audit and remediated before Elite
readiness is claimed.

### 6.2 Recap Quality

Recaps must:

- be complete (cover all settled picks for the recap window),
- accurately reflect settled outcomes (wins, losses, pushes, voids),
- be correctly formatted for the target channel,
- meet the same content-quality bar as pick embeds.

### 6.3 Capper vs System Parity

Pick output quality must be consistent across pick origin. There must be no
visible quality regression for capper picks vs system picks in terms of embed
completeness, asset presence, or formatting.

### 6.4 Elite Product Surface Standards

The following surfaces are required only for Elite Production Ready (Tier A).
They are not required for Guarded Launch (Tier B).

#### Game Day Live

Game Day Live must meet **both** of the following standards:

1. **Experience standard**: The Game Day Live surface must be premium in
   presentation — correct formatting, complete information, no broken or
   placeholder content visible to subscribers or operators.
2. **Latency standard**: Updates must be timely enough to be operationally
   useful. Picks, scores, and status changes must surface within a window that
   supports real-time decision-making and subscriber confidence. Stale Game Day
   Live state is a failure.

Both standards must be satisfied simultaneously. Meeting one and not the other
does not satisfy the Elite requirement.

#### Onboarding Quality

Production-ready onboarding means all of the following are true:

- Role-based routing works correctly (correct access level granted per role at
  login or invite).
- Welcome flow completes without broken steps, dead links, or confusing
  transitions.
- Access controls are correct — roles receive only the permissions they should.
- Key commands, surfaces, and reference information are surfaced at the right
  point in the flow.
- No broken, dead-end, or confusing steps exist for any supported role.

Onboarding is evaluated for all supported operator and subscriber roles. A role
path that is broken for any role is an Elite readiness failure.

#### Black Label / Portfolio

Black Label and portfolio readiness means:

- Premium curated subscriber/operator portfolio surfaces exist and are
  production-grade.
- Visibility into pick history, performance, and portfolio composition is
  correct and not mocked.
- Polish meets a premium subscriber standard — no rough edges, placeholder
  state, or "internal tool" presentation.

Black Label / portfolio surfaces are not required for Guarded Launch. They are
required for Elite. Their absence is not a Guarded Launch blocker; it is an
Elite blocker.

---

## 7. Automation Requirement

Production readiness requires that the core pick machine is automated. Manual
operator intervention is not a substitute for working automation.

### What Must Not Require Manual Intervention

The following processes must run without hidden manual intervention:

- Routine workflow scheduling (SLO verification, grading status checks, analysis
  workflows)
- Feed ingestion where API providers are the intended source
- Scoring and grading pipeline processing
- Discord posting (after approval gate where applicable)
- Workflow failure escalation
- SLO monitoring and alert generation

### Where Manual Intervention is Acceptable

Manual intervention is acceptable only when it is:

- an explicit operator control (e.g., manual approval, manual settlement),
- a documented fail-closed fallback with escalation,
- part of the official operator approval workflow,
- or an explicit override path for exceptional circumstances.

### What is Not Acceptable

- Operators manually running scripts to substitute for broken automation.
- Hidden daily maintenance steps not documented in the production runbook.
- Any critical lifecycle stage that would silently fail without manual kick.

---

## 8. Required Alerts

### Required for Guarded Launch

| Alert                      | Trigger                                                 | Delivery                                     |
| -------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Workflow failure           | Any scheduled analysis workflow fails                   | Discord operator webhook (critical severity) |
| Critical lifecycle failure | Pick stuck, posting failed, settlement agent error      | Discord operator webhook                     |
| SLO breach                 | Any of 4 SLOs enters BREACH state                       | Discord operator webhook                     |
| Platform CRITICAL          | `GET /api/health/summary` → `platform_status: CRITICAL` | Discord operator webhook                     |
| Drawdown freeze            | `risk_engine_config.drawdown_freeze_threshold` breached | Discord operator webhook                     |

### Required for Elite Production Ready

In addition to the above:

| Alert                      | Trigger                                                                                                                                                                                                                            | Delivery                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Injury impact**          | Player on an active or queued pick is designated as: **Out**, **Doubtful**, **GTD (Game-Time Decision)**, or **Questionable** (Questionable only when the player's prop or position is directly tied to an active or queued pick). | Discord operator channel; subscriber-facing alert where relevant |
| **Steam / line movement**  | **≥ 10 cents odds movement** on a moneyline for an active pick, **or ≥ 0.5 point line shift** on a spread/total for an active pick. Both thresholds are configurable; these are the minimum defaults.                              | Discord operator channel                                         |
| Agent health degraded      | Any agent enters unhealthy state for > 10 minutes                                                                                                                                                                                  | Discord operator webhook                                         |
| SLO WARN (not just BREACH) | Any SLO below target before entering BREACH                                                                                                                                                                                        | Discord operator channel                                         |

**Injury alert scope clarification**: The injury alert must fire on Out,
Doubtful, and GTD unconditionally for picks on affected players. For
Questionable designations, the alert fires only when the designation is tied
directly to a player on an active or queued pick. Questionable alerts for
players unrelated to current picks are not required.

**Steam alert clarification**: Thresholds apply to picks that have already been
approved and are either posted or in the posting queue. Pre-approval line
movement does not trigger this alert.

If a pick is materially affected by an injury event within the defined scope and
no alert fires, Elite Production Ready status is not satisfied.

### Alert Delivery Standard

All alerts must:

- route to the correct Discord channel (operator vs subscriber channel),
- include sufficient context to diagnose the event without additional tools,
- not be silently swallowed by catch blocks,
- reach the operator webhook within 5 minutes of trigger (for critical-severity
  alerts).

---

## 9. Command Center Truth Requirements

Command Center is the operator's primary source of operational truth. It must
reflect real system state at all times.

### Required Truth Properties

For all relevant surfaces, Command Center must show:

| Data                 | Standard                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| Pick lifecycle state | Current, accurate (`submitted`, `grading`, `approved`, `posted`, `settling`, `settled`, `void`) |
| Capper attribution   | Present and correct on all capper picks                                                         |
| Pick metadata        | Matchup, play, odds, tier, date visible                                                         |
| Settlement state     | Reflects actual settlement outcome                                                              |
| Agent health         | Reflects real agent heartbeat and status                                                        |
| SLO attainment       | Live from `GET /api/slo/status`                                                                 |
| Platform health      | Live HEALTHY / DEGRADED / CRITICAL from `GET /api/health/summary`                               |
| Active alerts        | All current alerts visible by severity                                                          |
| Workflow status      | WorkflowRegistry state visible                                                                  |
| Audit trail          | All operator actions logged and queryable                                                       |

### Command Center Prohibitions

Command Center may not:

- serve mock data on any production data path (the `DEMO_MODE` constant must be
  `false` in production),
- present stale data as current (data freshness must be visibly indicated where
  relevant),
- show success state for operations that silently failed,
- omit required fields from pick tables with no explanation,
- show a healthy status when the underlying system is degraded.

If real data is unavailable, the UI must:

- display a truthful degraded or error state, or
- surface a clear "data unavailable" indicator.

Fake success is a hard-fail condition.

---

## 10. Hard-Fail Conditions

If any of the following occur, Unit Talk is **not production ready** at any
tier:

### Pick Lifecycle Failures

- A pick posts to the wrong channel (subscriber channel in canary mode, or vice
  versa).
- A pick posts with incorrect or missing critical embed fields.
- A pick posts without a logo (logos are required at both tiers).
- A pick fails to post and no operator alert fires.
- Approval gate is bypassed when it should be enforced.
- A capper pick loses its capper attribution through the lifecycle.
- Lifecycle adapters are bypassed for any write to `unified_picks`.

### Settlement Failures

- A pick settles with the wrong outcome.
- Settlement does not propagate to downstream capper or platform performance
  records.
- Manual settlement is unavailable or inaccessible.
- Automatic settlement is not operational with `SETTLEMENT_AGENT_ENABLED=true`
  in the intended production environment (unless explicitly classified as
  Guarded Launch with documented remediation).

### Truth and Integrity Failures

- Command Center shows mock or fabricated data on any production path.
- Any required data field is missing from Command Center pick views.
- An agent operates on stale or incorrect data without operator visibility.
- `clv_results`, scoring outputs, or promotion decisions are materially
  incorrect due to pipeline failure.

### Automation Failures

- A scheduled workflow fails without operator escalation.
- Any core pipeline stage requires hidden manual intervention.
- Failure escalation routes to stdout only, not to operator Discord webhook.

### Recap and Downstream Failures

- Recap is materially incomplete or inaccurate relative to settled outcomes.
- Platform or capper performance stats are materially wrong.

### Elite-Specific Hard-Fail Conditions

The following are hard-fail conditions **at Elite tier only**:

- Required headshots are missing from Discord embeds.
- Injury alerts do not fire within the defined scope (Out, Doubtful, GTD
  unconditionally; Questionable when pick-relevant).
- Steam/line movement alerts are not operational with the defined thresholds.
- Game Day Live does not meet the experience or latency standard.
- Onboarding has broken steps for any supported role.
- Black Label / portfolio surfaces are not production-grade.

---

## 11. Allowed Fail-Closed Limitations

Fail-closed behavior is acceptable as a production-readiness position when it
is:

1. **Explicit** — the limitation is documented,
2. **Visible** — operators can see the fail-closed state,
3. **Non-fabricating** — no fake success is presented,
4. **Non-blocking of core truth** — required downstream outcomes can still
   occur,
5. **Escalating** — operator is notified when fail-closed state is active.

### Acceptable Examples

| Limitation                                           | Reason                                             |
| ---------------------------------------------------- | -------------------------------------------------- |
| `ENABLE_RECAP_SCHEDULES=false`                       | Explicit env gate; manual recap trigger available  |
| No post occurs because approval was not granted      | Correct behavior — fail-closed on unapproved picks |
| No post occurs because webhook URL is not configured | Explicit fail-closed; operator sees error          |
| Workflow execution fails and operator is notified    | Escalation fires; fail-closed is acceptable        |

### Not Acceptable

| Pattern                                                                              | Reason                              |
| ------------------------------------------------------------------------------------ | ----------------------------------- |
| `SETTLEMENT_AGENT_ENABLED=false` at audit time without Guarded Launch classification | Auto-settlement requirement not met |
| Silent failure with no escalation                                                    | Violates alert requirement          |
| Mock data returned because real data unavailable                                     | Fabricates success                  |
| Partial settlement with no indicator of incompleteness                               | Corrupts truth                      |
| Operator assumes automation ran when it silently did not                             | Hidden manual dependency            |

---

## 12. Production Day Audit Verdicts

A production-day audit must return exactly one of the following verdicts.

No partial verdicts. No "mostly ready." No verdicts granted without evidence.

### A. ELITE PRODUCTION READY

All elite criteria are satisfied:

- Full 9-stage production day completed truthfully.
- All four SLOs attaining targets over the 7-day rolling window.
- All embed assets present (headshots required, logos required).
- All required elite-tier alerts active and verified (injury scope, steam
  thresholds, agent health, SLO WARN).
- All Command Center required pages (Guarded Launch set + Elite additions)
  showing real data.
- All elite product surfaces operational (Game Day Live, onboarding, Black Label
  / portfolio).
- Automatic settlement operational with `SETTLEMENT_AGENT_ENABLED=true`
  verified.
- No hard-fail conditions present.

### B. GUARDED LAUNCH READY

Core machine is truthful, stable, and launchable with operator controls:

- Full 9-stage production day completed truthfully.
- No SLO in BREACH state.
- All Guarded Launch Command Center pages showing real data.
- All Discord embed logos present (logos required at Tier B).
- Automatic settlement operational with `SETTLEMENT_AGENT_ENABLED=true`
  verified, **or** explicitly classified as Guarded Launch with documented
  remediation timeline.
- No hard-fail conditions (core or Guarded Launch tier) present.
- Elite-only surfaces (headshots beyond logos, injury/steam alerts, Game Day
  Live, onboarding, Black Label/portfolio) may be absent.

### C. NOT PRODUCTION READY

One or more hard-fail conditions exist. Launch is not authorized.

Every hard-fail condition must be documented by the audit with:

- what failed,
- which production day stage it occurred in,
- what evidence was captured,
- what remediation sprint is required.

### D. INSUFFICIENT EVIDENCE

The audit could not determine readiness because:

- required runtime environments were missing,
- required end-to-end scenarios were not exercised,
- evidence artifacts were not captured, or
- production-day coverage was incomplete.

An `INSUFFICIENT EVIDENCE` verdict is not a pass. A new audit is required.

---

## 13. Required Evidence for Readiness

No readiness verdict may be granted without a complete evidence package.
Evidence must be captured during the production-day simulation, not
reconstructed after.

### Required Evidence Artifacts

| Evidence                                    | What It Proves                                                       | Required Tier |
| ------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| `proof_pick_post.txt` + Discord screenshot  | Pick posted correctly to correct channel                             | Both          |
| `proof_logos_present.txt` or screenshot     | Logos present in embed                                               | Both          |
| `proof_approval_gate.txt`                   | Operator approval enforced in launch mode                            | Both          |
| `proof_canary_post.txt` + screenshot        | Canary mode post to correct channel                                  | Both          |
| `proof_auto_settlement.txt`                 | `SETTLEMENT_AGENT_ENABLED=true` verified; outcome settled correctly  | Both          |
| `proof_manual_settlement.txt`               | Manual settlement available and functional                           | Both          |
| `proof_downstream_stats.txt`                | Capper + platform performance updated correctly                      | Both          |
| `proof_recap.txt` or screenshot             | Recap complete and correct                                           | Both          |
| `proof_command_center.txt` + screenshots    | All required CC pages showing real data                              | Both          |
| `proof_workflow_escalation.txt`             | Workflow failure alert posted to operator webhook                    | Both          |
| `proof_slo_attainment.txt`                  | `GET /api/slo/status` showing all SLOs attaining                     | Both          |
| `proof_health_summary.txt`                  | `GET /api/health/summary` showing HEALTHY                            | Both          |
| `proof_capper_submission.txt`               | Capper pick submitted and attributed correctly                       | Both          |
| `proof_canary_channel_config.txt`           | `docs/ops/CANARY_CHANNEL_CONFIG.md` exists with confirmed channel ID | Both          |
| `proof_headshots_present.txt` or screenshot | Real headshots present in embed                                      | Elite only    |
| `proof_injury_alert.txt`                    | Injury alert fired within defined scope                              | Elite only    |
| `proof_steam_alert.txt`                     | Steam/line movement alert fired at defined threshold                 | Elite only    |
| `proof_game_day_live.txt`                   | Game Day Live meets experience and latency standard                  | Elite only    |
| `proof_onboarding.txt`                      | All role onboarding paths complete without broken steps              | Elite only    |
| `proof_black_label.txt`                     | Black Label / portfolio surfaces are production-grade                | Elite only    |

All proof artifacts must be stored at:
`out/production-day-audits/<AUDIT-DATE>/proofs/`

---

## 14. Relationship to Roadmap

This contract governs operational acceptance. The roadmap governs sequencing and
construction. Both must be satisfied.

**The roadmap does not satisfy this contract.** Marking a phase COMPLETE means
the construction requirement was met. It does not mean the operational
acceptance standard is met.

Now that this contract is ratified:

1. Roadmap phases should be reviewed for alignment with these requirements.
2. All future "production ready" claims must reference this contract and cite
   audit evidence.
3. Layer 4 (Syndicate Intelligence) phases 12–14 are relevant to Elite readiness
   (edge intelligence, market resistance, CLV analytics) but are not required
   for Guarded Launch.
4. Any sprint that claims to advance production readiness must be audited
   against the relevant tier of this contract.

**The relationship to layer completion**:

| Completion status                                                    | Readiness implication                           |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| Layers 1–3 COMPLETE                                                  | Necessary but not sufficient for Guarded Launch |
| Layers 1–3 COMPLETE + production-day audit PASS (Tier B criteria)    | Required for Guarded Launch verdict             |
| Layers 1–4 COMPLETE + production-day audit PASS (all Elite criteria) | Required for Elite verdict                      |

---

## 15. Immediate Next Steps

Now that this contract is ratified, the next steps are:

1. **Create `docs/ops/CANARY_CHANNEL_CONFIG.md`** — document the designated
   canary Discord channel ID(s) before any canary-mode audit gate is run.
2. **Run roadmap alignment pass** — audit Layers 1–3 completion against each
   section of this contract; identify gaps between what is built and what this
   contract requires.
3. **Run full production-day simulation** — exercise all 9 stages against a real
   or staging environment; capture all required evidence artifacts.
4. **Determine current readiness tier** — Elite, Guarded Launch, Not Ready, or
   Insufficient Evidence.
5. **Produce remediation sprint list** — for each hard-fail condition identified
   in the simulation audit, define the remediation sprint required.

---

## 16. Resolved Operator Decisions

The following decisions were open during the RATIFICATION CANDIDATE phase and
are now resolved as of 2026-03-18
(SPRINT-PRODUCTION-READINESS-CONTRACT-RATIFICATION). Each resolved decision is
incorporated into the relevant contract sections above.

| #   | Decision                                     | Resolved Default                                                                                                                                                                                                                                                                                                                                  | Incorporated In      |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | **Steam / line movement alert threshold**    | ≥ 10 cents odds movement (moneyline) **or** ≥ 0.5 point line shift (spread/total) for active picks. Both thresholds are configurable minimums.                                                                                                                                                                                                    | Section 8            |
| 2   | **Injury alert scope**                       | Out and Doubtful: always. GTD: always. Questionable: only when directly tied to an active or queued pick.                                                                                                                                                                                                                                         | Section 8            |
| 3   | **Guarded Launch embed standard for assets** | Logos required at both tiers (Tier B hard-fail if missing). Headshots preferred at Tier B but not a Tier B blocker; absence must be documented and remediated before Elite. Headshots required at Elite (hard-fail).                                                                                                                              | Sections 2, 6.1, 10  |
| 4   | **Black Label / portfolio definition**       | Premium curated subscriber/operator portfolio surfaces with production-grade visibility and polish. Not required for Guarded Launch. Required for Elite.                                                                                                                                                                                          | Section 6.4          |
| 5   | **Game Day Live quality bar**                | Both experience standard (premium, complete, no broken content) and latency standard (timely enough for real-time utility) are required for Elite. Both must be satisfied simultaneously.                                                                                                                                                         | Section 6.4          |
| 6   | **Onboarding quality standard**              | Role-based routing works; welcome flow completes without broken steps; access is correct per role; key commands/info surfaced at right point; no broken or dead-end steps for any supported role. Elite requirement only.                                                                                                                         | Section 6.4          |
| 7   | **Canary channel configuration**             | Canary channel(s) must be documented with explicit channel ID(s) in `docs/ops/CANARY_CHANNEL_CONFIG.md` before any canary-mode audit gate is evaluated. This file is a prerequisite for the canary audit.                                                                                                                                         | Sections 5.4, 13, 15 |
| 8   | **Settlement agent go-live timing**          | Both automatic and manual settlement are required for readiness. Automatic settlement counts as production-ready only when `SETTLEMENT_AGENT_ENABLED=true` is set in the intended production environment and verified passing in audit. A Guarded Launch may document auto-settlement as a remediation item with timeline, but it is still a gap. | Sections 5.3, 11, 12 |

---

## 17. Current Working Principle

Until proven otherwise by a complete production-day audit producing a full
evidence package:

**Unit Talk is not production ready merely because layers and phases are marked
complete.**

Unit Talk is production ready only when the full production-day contract is
satisfied truthfully, with evidence, against the criteria in this document.

This principle does not change based on sprint count, code coverage, or roadmap
position. It changes only when a verified production-day audit returns a GUARDED
LAUNCH READY or ELITE PRODUCTION READY verdict.
