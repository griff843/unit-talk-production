# Governance Closeout — SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD

**Sprint**: SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD **Date**: 2026-03-15
**Branch**: sprint/058-cc-health-dashboard **Commit**: 575c1d34 **Status**: ✅
COMPLETE

---

## Objective

Add a Platform Health dashboard to Command Center that surfaces platform health
summary and SLO attainment from the Phase 7 backend APIs, and update the sidebar
to include both Replay and Platform Health navigation entries.

---

## Deliverables

- [x] `GET /api/health/summary` CC proxy route — `requireOperatorIdentity` gate,
      stable 503 fallback
- [x] `GET /api/slo/status` CC proxy route — `requireOperatorIdentity` gate +
      `ADMIN_TOKEN` forwarding, empty-slos 503 fallback
- [x] `/dashboard/health` page — platform status card
      (HEALTHY/DEGRADED/CRITICAL), SLO attainment grid (4 SLOs), refresh button,
      loading/error states
- [x] Sidebar updated — Replay (Operations section) + Platform Health
      (Monitoring section) nav entries
- [x] 12 vitest tests covering auth (401), proxy success (all status codes),
      upstream failures, and Authorization token forwarding

---

## Verification Gates

| Gate                                     | Result                        |
| ---------------------------------------- | ----------------------------- |
| `npx vitest run` (apps/command-center)   | ✅ 73/73 passing (+12 new)    |
| `npx tsc --noEmit` (apps/command-center) | ✅ 0 errors                   |
| `npx next build` (apps/command-center)   | ✅ Clean — λ routes confirmed |
| Pre-commit hooks (prettier, eslint, tsc) | ✅ All passed                 |

---

## Files Changed

| File                                                      | Change                                  |
| --------------------------------------------------------- | --------------------------------------- |
| `apps/command-center/src/app/api/health/summary/route.ts` | NEW — GET proxy                         |
| `apps/command-center/src/app/api/slo/status/route.ts`     | NEW — GET proxy                         |
| `apps/command-center/src/app/dashboard/health/page.tsx`   | NEW — operator health dashboard         |
| `apps/command-center/src/components/layout/sidebar.tsx`   | MODIFIED — Replay + Platform Health nav |
| `apps/command-center/src/__tests__/health-routes.test.ts` | NEW — 12 vitest tests                   |

---

## Layer / Phase

Layer: **Layer 3** / Phase: **Phase 10 — Command Center UX**

---

## Invariants Confirmed

- Command Center remains READ-ONLY (no business table writes)
- Proxy routes use canonical pattern:
  `INTERNAL_API_URL || API_SERVICE_URL || 'http://localhost:3010'`
- Auth gate: `requireOperatorIdentity` on both routes regardless of upstream
  auth requirements
- No polling, no charting, no long-lived state added
