## USP Gating: Mapping Checks to Marketing Bullets

Expose only the bullets validated by ops checks. The gate report is written to `out/ops/usp-gate-report.json` by `npm run ops:tier`.

Checks -> Bullets
- feature_store_matview_present -> steam_detection, clv_prediction
- approvals_view_present -> approval workflow claims
- promoter_single_writer_guard -> single_writer_promoter
- alerts_cooldown_dedupe_enabled -> cooldown_dedupe
- recap_agent_uses_matview -> recap uses matview
- provider_quota_backoff_enabled -> provider quota backoff

CI Gate
- Acceptance gates read `usp-gate-report.json` and require `ok=true`
- Only true bullets should be displayed in copy; false bullets must be suppressed

