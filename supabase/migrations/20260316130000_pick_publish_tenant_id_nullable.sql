-- Migration: Make pick_publish.tenant_id nullable
-- Sprint: SPRINT-062-FULL-LIFECYCLE-E2E-TRUTH-AUDIT
-- Context: publishOutbox.ts passes null when no tenantId is provided.
--          The NOT NULL constraint blocks all outbox inserts without explicit tenant.
-- Rollback:
--   ALTER TABLE pick_publish ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE pick_publish ALTER COLUMN tenant_id DROP NOT NULL;
