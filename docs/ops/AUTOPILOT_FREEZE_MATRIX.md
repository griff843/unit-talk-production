# Autopilot Freeze Matrix

**Version**: 1.1.0 **Status**: Phase D (Implemented, Feature-Flagged) **Flag**:
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
  "incident_id": null,
  "frozen_lanes": [],
  "_comment": "Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md"
}
```

### Freeze Example (Global)

```json
{
  "frozen": true,
  "scope": "DEPLOYMENTS",
  "reason": "Main branch red > 30 minutes (run #12345)",
  "triggered_at": "2026-01-18T10:00:00Z",
  "triggered_by": "ci-failure-resolver",
  "auto_unfreeze_at": "2026-01-18T14:00:00Z",
  "incident_id": "ci-12345",
  "frozen_lanes": [],
  "_comment": "Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md"
}
```

### Freeze Example (Lane-Specific)

```json
{
  "frozen": true,
  "scope": "AFFECTED_FLOW",
  "reason": "Scoring tests failed in CI run #67890",
  "triggered_at": "2026-01-18T10:00:00Z",
  "triggered_by": "ci-failure-resolver",
  "auto_unfreeze_at": "2026-01-18T14:00:00Z",
  "incident_id": "ci-67890",
  "frozen_lanes": ["ScoringAgent"],
  "_comment": "Managed by CI automation. See docs/ops/AUTOPILOT_FREEZE_MATRIX.md"
}
```

### Available Agent Lanes

| Lane              | Description                  | Freeze Impact              |
| ----------------- | ---------------------------- | -------------------------- |
| `ScoringAgent`    | Pick scoring operations      | No new scoring runs        |
| `SettlementAgent` | Settlement/payout operations | No settlement processing   |
| `GradingAgent`    | Pick grading workflows       | No grading runs            |
| `PublishingAgent` | Discord publishing           | No Discord publish actions |

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
# Option 1: Use the set-autopilot-mode script
npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL

# Option 2: Manually edit the state file
# Edit runtime_config/autopilot_state.json and set "frozen": false

# After unfreezing, commit and push if on a branch
git add runtime_config/autopilot_state.json
git commit -m "ci: unfreeze autopilot (manual) - Issue resolved"
git push
```

---

## Rollback / Unfreeze Procedure

### Quick Unfreeze (Emergency)

If you need to immediately unfreeze autopilot:

```bash
# 1. Check current status
npx tsx scripts/ops/set-autopilot-mode.ts --status

# 2. Unfreeze
npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL

# 3. Commit and push the change
git add runtime_config/autopilot_state.json
git commit -m "ci: emergency unfreeze autopilot - [Your reason]"
git push origin main
```

### Standard Unfreeze (Post-Resolution)

After resolving the underlying issue:

1. **Verify the fix**: Ensure the CI failure has been resolved
2. **Run verification**: `npm run test` and `npm run type-check` pass
3. **Unfreeze**:
   ```bash
   npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL
   ```
4. **Commit with evidence**:
   ```bash
   git add runtime_config/autopilot_state.json
   git commit -m "ci: unfreeze autopilot - Issue #123 resolved

   Fix verified: PR #456 merged
   Tests passing: CI run #789
   "
   git push origin main
   ```
5. **Close the freeze issue**: Update the GitHub issue created by the freeze

### Checking Freeze Status

```bash
# View current freeze state
npx tsx scripts/ops/set-autopilot-mode.ts --status

# Or read the state file directly
cat runtime_config/autopilot_state.json | jq '.'
```

### Auto-Unfreeze

Some freezes have an auto-unfreeze time set. The freeze will automatically be
considered expired after this time. Agents should check `auto_unfreeze_at` and
treat expired freezes as unfrozen.

**Note**: Auto-unfreeze does NOT modify the state file. The file still shows
`frozen: true` but agents check the `auto_unfreeze_at` timestamp.

To permanently unfreeze after auto-unfreeze expires:

```bash
npx tsx scripts/ops/set-autopilot-mode.ts --mode=NORMAL
git add runtime_config/autopilot_state.json
git commit -m "ci: clear expired freeze state"
git push
```

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

### Phase A

- Flag: `AUTOPILOT_FREEZE_ENABLED=false`
- Freeze state file exists but not enforced
- Logging only - no actual freezing

### Phase B

- Flag: `AUTOPILOT_FREEZE_ENABLED=true` for non-production
- Test freeze mechanics in staging
- Monitor false positive rate

### Phase C

- Flag: `AUTOPILOT_FREEZE_ENABLED=true` for production (auto-revert)
- Auto-revert PR generation implemented
- Human approval still required for all merges

### Phase D (Current - Implemented)

- Flag: `AUTOPILOT_FREEZE_ENABLED=false` (default)
- Full autopilot freeze integration implemented
- CI Failure Resolver triggers freeze on high-risk failures
- Lane-specific freeze support (ScoringAgent, SettlementAgent, etc.)
- 4-hour auto-unfreeze default
- GitHub issue created for freeze incidents

**To Enable Autopilot Freeze**:

Edit `runtime_config/ci_automation.json`:

```json
{
  "features": {
    "AUTOPILOT_FREEZE_ENABLED": true
  }
}
```

---

## Agent Integration

Agents can check freeze state using the shared library:

```typescript
import {
  isAutopilotFrozen,
  shouldAgentOperate,
  isLaneFrozen,
} from '@shared-utils/autopilot-freeze';

// Global freeze check
if (isAutopilotFrozen()) {
  logger.info('Autopilot frozen, skipping operation');
  return;
}

// Lane-specific check
if (!shouldAgentOperate('ScoringAgent')) {
  logger.info('ScoringAgent lane frozen');
  return;
}

// Check specific lane
if (isLaneFrozen('SettlementAgent')) {
  logger.info('Settlement operations paused');
  return;
}
```

See `packages/shared-utils/src/autopilot-freeze.ts` for full API.

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md)
- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md)
- [CI_FAILURE_RESOLVER_GUIDE.md](./CI_FAILURE_RESOLVER_GUIDE.md)
- [FORBIDDEN_ACTIONS.md](./FORBIDDEN_ACTIONS.md)
- [incident_response_playbook.md](./incident_response_playbook.md)

## Related Scripts

- `scripts/ops/set-autopilot-mode.ts` - Set/unset freeze state
- `scripts/ops/bootstrap-github-labels.ts` - Bootstrap GitHub labels

---

**Owner**: Platform Engineering **Last Updated**: 2026-01-18
