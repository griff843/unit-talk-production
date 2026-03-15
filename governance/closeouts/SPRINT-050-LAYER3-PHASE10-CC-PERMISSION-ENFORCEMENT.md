# Sprint Closeout: SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT

**Sprint**: SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT **Phase**: Layer
3 / Phase 10 — Command Center UX **Status**: COMPLETE **Date**: 2026-03-15
**PR**: #224 **Linear**: UNI-85 (Done)

## Objective

Enforce RBAC permissions on selected high-value Command Center surfaces using
the auth/RBAC foundation from SPRINT-049.

## Deliverables

- `enforcePermission()` helper and `PermissionGate` component created
- 4 API routes protected: `agents/control` POST+GET, `lifecycle/retry` POST,
  `ops/submit` POST
- 3 CC components gated: AgentControlPanel, ops-submit, StuckPicksPanel
- `agents/control` migrated from custom cookie RBAC to canonical
  `enforcePermission()`
- 47 Command Center vitest tests (29/29 auth + 18/18 permission)

## Verification

- Type-check: PASS (0 errors)
- Tests: 978/978 vitest (apps/api), 29/29 vitest (apps/command-center)
- Single-writer gate: PASS (0 violations)
- Build: PASS

## Commit

190c26cf feat(command-center): RBAC permission enforcement — SPRINT-050 (#224)
