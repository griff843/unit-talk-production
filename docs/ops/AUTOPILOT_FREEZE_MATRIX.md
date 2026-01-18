# Autopilot Freeze Matrix

**Version**: 1.0.0 **Status**: Phase A (Feature-Flagged) **Flag**:
`AUTOPILOT_FREEZE_ENABLED=false`

## Purpose

Defines conditions under which automated operations (autopilot) should be frozen
to prevent cascading failures or unsafe actions during incidents.

---

## Freeze Triggers

### Automatic Triggers (When Feature-Flagged Enabled)

| Trigger                       | Freeze Scope    | Duration       | Auto-Unfreeze |
| ----------------------------- | --------------- | -------------- | ------------- |
| Security vulnerability (P0)   | ALL             | Until resolved | No            |
| Migration failure             | DEPLOYMENTS     | Until resolved | No            |
| Main branch red > 30 min      | DEPLOYMENTS     | Until green    | Yes           |
| 3+ consecutive workflow fails | AFFECTED_FLOW   | 2 hours        | Yes           |
| Production incident (P0/P1)   | ALL             | Until resolved | No            |
| Secret exposure detected      | ALL             | Until resolved | No            |
| Data integrity alert          | DATA_OPERATIONS | Until resolved | No            |

### Manual Triggers

| Trigger                 | Freeze Scope | Duration       | Auto-Unfreeze |
| ----------------------- | ------------ | -------------- | ------------- |
| Operator freeze command | SPECIFIED    | Until unfrozen | No            |
| Maintenance window      | ALL          | Scheduled      | Yes           |
| Release freeze          | DEPLOYMENTS  | Until unfrozen | No            |

---

## Freeze Scopes

### ALL

Complete freeze of all automated operations:

- No auto-fix PRs created
- No revert PRs generated
- No deployments
- No data operations
- Only monitoring and alerting active

### DEPLOYMENTS

Freeze deployment-related automation:

- No production deploys
- No staging deploys
- PR automation continues
- Monitoring continues

### AFFECTED_FLOW

Freeze only the affected workflow:

- Specific workflow paused
- Other workflows continue
- Requires manual intervention to resume

### DATA_OPERATIONS

Freeze data-touching automation:

- No automated data migrations
- No bulk operations
- No sync jobs
- Read-only operations continue

---

## Freeze State Management

### State File

Freeze state is stored in `runtime_config/autopilot_state.json`:

```json
{
  "frozen": false,
  "scope": null,
  "reason": null,
  "triggered_at": null,
  "triggered_by": null,
  "auto_unfreeze_at": null,
  "incident_id": null
}
```

### Freeze Example

```json
{
  "frozen": true,
  "scope": "DEPLOYMENTS",
  "reason": "Main branch red > 30 minutes (run #12345)",
  "triggered_at": "2026-01-18T10:00:00Z",
  "triggered_by": "ci-resolver-bot",
  "auto_unfreeze_at": null,
  "incident_id": "INC-2026-0118-001"
}
```

---

## Freeze/Unfreeze Workflow

### Automatic Freeze

```
Trigger Condition Detected
         │
         ▼
┌──────────────────────┐
│ Check Feature Flag   │
│ AUTOPILOT_FREEZE_    │
│ ENABLED              │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     │  Enabled? │
     └─────┬─────┘
       Yes │ No
         │ │
         ▼ ▼
┌────────────┐  ┌───────────────┐
│ Write      │  │ Log warning,  │
│ freeze     │  │ continue ops  │
│ state      │  └───────────────┘
└─────┬──────┘
      │
      ▼
┌──────────────────────┐
│ Notify via:          │
│ - Slack #alerts      │
│ - GitHub Issue       │
│ - PR comment         │
└──────────────────────┘
```

### Manual Unfreeze

```bash
# Operator command to unfreeze
./scripts/ops/autopilot-control.sh unfreeze --reason "Issue resolved" --operator "username"
```

Required fields:

- `--reason`: Why freeze is being lifted
- `--operator`: Who is authorizing unfreeze

---

## Integration Points

### CI Resolver Workflow

Before creating any auto-fix PR:

```yaml
- name: Check autopilot freeze state
  id: check-freeze
  run: |
    STATE=$(cat runtime_config/autopilot_state.json)
    FROZEN=$(echo $STATE | jq -r '.frozen')
    if [ "$FROZEN" = "true" ]; then
      echo "frozen=true" >> $GITHUB_OUTPUT
      echo "::warning::Autopilot is frozen: $(echo $STATE | jq -r '.reason')"
    else
      echo "frozen=false" >> $GITHUB_OUTPUT
    fi

- name: Skip if frozen
  if: steps.check-freeze.outputs.frozen == 'true'
  run: |
    echo "Autopilot frozen - skipping auto-fix PR creation"
    exit 0
```

### Deployment Workflows

Before any deployment:

```yaml
- name: Check deployment freeze
  run: |
    STATE=$(cat runtime_config/autopilot_state.json)
    FROZEN=$(echo $STATE | jq -r '.frozen')
    SCOPE=$(echo $STATE | jq -r '.scope')

    if [ "$FROZEN" = "true" ]; then
      if [ "$SCOPE" = "ALL" ] || [ "$SCOPE" = "DEPLOYMENTS" ]; then
        echo "::error::Deployment blocked: Autopilot frozen ($SCOPE)"
        exit 1
      fi
    fi
```

---

## Canonical Architecture Considerations

When autopilot is frozen, the following are protected:

| Component          | Freeze Behavior                        |
| ------------------ | -------------------------------------- |
| `unified_picks`    | No automated writes                    |
| `pick_publish`     | Outbox processing pauses               |
| Idempotent workers | Continue but skip new operations       |
| Discord publishing | Pauses during ALL freeze               |
| Data ingestion     | Continues read-only during DATA freeze |

**Note**: There is no "Final Picks" table. All pick operations flow through
`unified_picks` → `pick_publish` → Discord.

---

## Monitoring Dashboard

Freeze status should be visible in:

1. **Command Center**: Banner when frozen
2. **Slack**: Pinned message in #engineering
3. **GitHub**: Status check on PRs
4. **Grafana**: Freeze duration metric

---

## Escalation During Freeze

| Freeze Duration | Action Required                |
| --------------- | ------------------------------ |
| < 30 minutes    | Monitor, await auto-resolution |
| 30-60 minutes   | Notify team lead               |
| 1-2 hours       | Escalate to senior engineer    |
| > 2 hours       | Incident commander required    |

---

## Feature Flag Rollout

### Phase A (Current)

- Flag: `AUTOPILOT_FREEZE_ENABLED=false`
- Freeze state file exists but not enforced
- Logging only - no actual freezing

### Phase B

- Flag: `AUTOPILOT_FREEZE_ENABLED=true` for non-production
- Test freeze mechanics in staging
- Monitor false positive rate

### Phase C

- Flag: `AUTOPILOT_FREEZE_ENABLED=true` for production
- Full enforcement
- Auto-unfreeze for recoverable conditions

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md)
- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md)
- [FORBIDDEN_ACTIONS.md](./FORBIDDEN_ACTIONS.md)
- [incident_response_playbook.md](./incident_response_playbook.md)

---

**Owner**: Platform Engineering **Last Updated**: 2026-01-18
