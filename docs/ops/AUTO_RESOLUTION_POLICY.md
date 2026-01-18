# Auto-Resolution Policy

**Version**: 1.0.0 **Status**: Phase A (Additive) **Effective**: 2026-01-18

## Purpose

This policy defines the rules, boundaries, and escalation procedures for
automated CI/CD failure resolution in the Unit Talk platform. It ensures safe
automation while preserving human oversight for critical decisions.

## Scope

Applies to all automated systems that interact with:

- GitHub Actions workflows
- Pull request lifecycle
- Branch protection rules
- Database migrations
- Production deployments

## Core Principles

### 1. Safety Over Speed

Automated resolution must never compromise system integrity. When in doubt,
escalate to human review.

### 2. Evidence Preservation

All automated actions must produce auditable artifacts:

- Logs saved to `/out/ci/{run_id}/`
- PR summaries with failure classification
- Incident reports for escalated issues

### 3. Non-Disruption

Automation operates in phased rollout. Current progress is never disrupted by
new automation features.

---

## Allowed Automation Actions

| Action                       | Allowed | Conditions                                     |
| ---------------------------- | ------- | ---------------------------------------------- |
| Open auto-fix PR             | YES     | Safe fixes only (see Classification)           |
| Add labels to PRs            | YES     | Based on failure type                          |
| Route to CODEOWNERS          | YES     | Based on affected paths                        |
| Comment on PRs               | YES     | Failure summaries, suggestions                 |
| Create incident issues       | YES     | For escalated failures                         |
| Retry flaky tests            | YES     | Max 2 retries, then escalate                   |
| Generate revert PR           | YES     | Feature-flagged, never auto-merged             |
| Update runtime_config        | YES     | Autopilot freeze state only                    |
| **Auto-merge PRs**           | **NO**  | **FORBIDDEN** - Human approval always required |
| **Push to protected branch** | **NO**  | **FORBIDDEN** - Always via PR                  |
| **Disable required checks**  | **NO**  | **FORBIDDEN** - Escalate instead               |
| **Edit applied migrations**  | **NO**  | **FORBIDDEN** - Add corrective migration only  |

---

## Resolution Workflow

```
CI Failure Detected
       │
       ▼
┌──────────────────┐
│ Classify Failure │ ──► See CI_FAILURE_CLASSIFICATION.md
└────────┬─────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────┐
│                    Action Matrix                           │
├────────────────┬───────────────────────────────────────────┤
│ Flake          │ Retry (max 2) → Label → Escalate         │
│ Regression     │ Generate revert PR → Escalate            │
│ Config         │ Open auto-fix PR → Human review          │
│ Migration      │ Escalate immediately → No auto-fix       │
│ Security       │ Escalate + Alert → Freeze autopilot      │
│ Policy         │ Escalate → Block deployment              │
└────────────────┴───────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Human Review     │ ──► Approve/Reject/Modify
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Resolution Done  │ ──► Green main + Prevention + Evidence
└──────────────────┘
```

---

## Definition of Done

A CI failure is considered **resolved** when ALL of the following are true:

1. **Green Main**: The `main` branch passes all required checks
2. **Prevention**: Root cause identified and fix prevents recurrence
3. **Evidence**: Artifacts preserved in `/out/ci/` or PR comments
4. **Documentation**: Incident report filed if severity >= P2

---

## Escalation Rules

### Immediate Escalation Required

- Security vulnerabilities detected
- Database migration failures
- Production data integrity risks
- Policy violations (see FORBIDDEN_ACTIONS.md)
- 3+ consecutive failures of same type

### Escalation Channels

| Severity | Channel                   | Response SLA |
| -------- | ------------------------- | ------------ |
| P0       | PagerDuty + Slack #alerts | 15 minutes   |
| P1       | Slack #engineering        | 1 hour       |
| P2       | GitHub Issue + PR comment | 4 hours      |
| P3       | Weekly triage             | 1 week       |

---

## Feature Flags

The following features are gated behind runtime flags:

| Feature                 | Flag                             | Default | Phase |
| ----------------------- | -------------------------------- | ------- | ----- |
| Auto-revert PR creation | `AUTO_REVERT_ENABLED`            | false   | C     |
| Autopilot freeze        | `AUTOPILOT_FREEZE_ENABLED`       | false   | C     |
| Auto-fix PR creation    | `AUTO_FIX_PR_ENABLED`            | true    | A     |
| Failure classification  | `FAILURE_CLASSIFICATION_ENABLED` | true    | A     |

Flags are stored in `runtime_config/ci_automation.json`.

---

## Rollout Phases

### Phase A: Additive (Current)

- Add policy documentation
- Add failure classification
- Add PR templates and labeling
- **No new required checks**
- **No disruption to existing workflows**

### Phase B: Gradual Enforcement

- Enable auto-fix PR creation
- Add optional status checks
- Monitor false positive rate
- Tune classification rules

### Phase C: Auto-Revert + Freeze

- Enable auto-revert PR generation (feature-flagged)
- Enable autopilot freeze triggers (feature-flagged)
- Still no auto-merge

### Phase D: Full Automation

- All features enabled
- Continuous improvement based on metrics
- Human oversight remains for all merges

---

## Canonical Architecture Reference

This policy operates within Unit Talk's canonical architecture:

- **`unified_picks`**: Authoritative pick table (never modify via automation)
- **`pick_publish`**: Publish outbox for Discord delivery
- **Idempotent Workers**: All automated jobs must be idempotent
- **No "Final Picks" table**: Legacy concept, do not reference

Automation must never directly modify production data tables. All changes flow
through the standard PR → Review → Merge → Deploy pipeline.

---

## Related Documents

- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md)
- [FORBIDDEN_ACTIONS.md](./FORBIDDEN_ACTIONS.md)
- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md)
- [PR_FAILURE_TEMPLATE.md](./PR_FAILURE_TEMPLATE.md)
- [PRODUCTION_CHARTER.md](../PRODUCTION_CHARTER.md)

---

**Owner**: Platform Engineering **Review Cycle**: Quarterly **Last Updated**:
2026-01-18
