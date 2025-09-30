## Database Tiering: HOT / WARM / COLD

This document outlines the policy, retention, and refresh cadence for database tiering.

- HOT (operational):
  - Tables/Views: unified_picks (recent), view_postable_unified_picks, view_pending_approvals
  - Retention: last 7 days (rolling)
  - Refresh: real-time; materialized_feature_store refreshed per batch

- WARM (analytics):
  - Tables: raw_props (last 30–90 days), alerts_log, approvals_log
  - Retention: 90 days
  - Refresh: hourly/day-parted; vacuum/analyze nightly

- COLD (archive):
  - Tables: historical results, old raw props
  - Retention: > 90 days
  - Refresh: none; cold storage or separate schema

- Operational Notes:
  - Matview: materialized_feature_store acts as boundary between HOT scoring/recap and WARM ingestion
  - Recap: RecapAgent reads via matview only
  - Promotions: view_postable_unified_picks must be empty unless approvals produced postables

Verification (CI-safe):
- scripts/ops/view-exists-audit.ts: ensures required view/matview files exist
- scripts/ops/matview-refresh.ts: emits refresh acknowledgment

