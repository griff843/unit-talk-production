# Sprint Closeout: SPRINT-056-OBSERVABILITY-SKILLS

**Date**: 2026-03-15 **Sprint**: SPRINT-056-OBSERVABILITY-SKILLS **Branch**:
sprint/056-observability-skills **Merge Commit**: f89c5614 **PR**: #243
**Status**: ✅ COMPLETE

## Objective

Implement the first operator observability skill set powered by the verified MCP
layer. Four skills that give Claude direct diagnostic capability over the Unit
Talk platform without any database or API credentials beyond what the MCP
servers already hold.

## Deliverables

### pipeline-health.md ✅

- **File**: `.claude/skills/pipeline-health.md`
- **MCP tools**: `get_pipeline_status` + `get_platform_health` +
  `get_slo_status`
- **Purpose**: One-screen triage for pick pipeline — agents, outbox, platform
  status, SLO attainment
- **Includes**: Alert thresholds, decision tree, verdict format

### pick-trace.md ✅

- **File**: `.claude/skills/pick-trace.md`
- **MCP tools**: `get_pick` + `get_lifecycle_stage` + `get_settlement_records`
- **Purpose**: Full lifecycle trace for a single pick UUID — stage derivation
  table, timeline, settlement history, diagnosis
- **Includes**: Canonical stage table (exact parity with deriveLifecycleStage),
  common diagnoses, escalation paths

### slo-report.md ✅

- **File**: `.claude/skills/slo-report.md`
- **MCP tools**: `get_slo_status` + `get_platform_health`
- **Purpose**: SLO attainment report with gap analysis and breach triage
- **Includes**: Canonical 4 SLOs from SLO_DEFINITIONS.md, remediation
  references, subsystem correlation (--context mode)

### edge-check.md ✅

- **File**: `.claude/skills/edge-check.md`
- **MCP tools**: `compute_clv` + `compute_calibration`
- **Purpose**: Directional CLV edge check and model calibration audit
- **Includes**: Math drift warning (documented 2% vig approximation), CLV
  interpretation thresholds, CALIBRATED/DRIFT/MISCALIBRATED decision logic,
  escalation to shadow divergence check

## Verification

- No MCP tool changes required
- All 4 skills consume verified interfaces from SPRINT-055 only
- Skill format matches existing `.claude/skills/` convention
- All field names verified against mcp-ops/mcp-state/mcp-intelligence schemas
- Stage derivation table in pick-trace.md matches canonical
  `deriveLifecycleStage` exactly

## MCP Tool Coverage

| Skill           | MCP Tools Used                                           | Server                 |
| --------------- | -------------------------------------------------------- | ---------------------- |
| pipeline-health | get_pipeline_status, get_platform_health, get_slo_status | unit-talk-ops          |
| pick-trace      | get_pick, get_lifecycle_stage, get_settlement_records    | unit-talk-state        |
| slo-report      | get_slo_status, get_platform_health                      | unit-talk-ops          |
| edge-check      | compute_clv, compute_calibration                         | unit-talk-intelligence |

## Sign-off

- [x] All 4 skill files created and merged (PR #243, f89c5614)
- [x] No MCP tool changes introduced
- [x] All verified MCP interfaces consumed correctly
- [x] Governance closeout filed
