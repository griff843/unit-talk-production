-- Migration: Create operator_audit_log table
-- Sprint: SPRINT-046-OPERATOR-AUDIT-TRAIL
-- Layer/Phase: Layer 2 / Security — Immutable operator audit trail
--
-- Rollback:
--   DROP TRIGGER IF EXISTS guard_audit_log_immutability ON operator_audit_log;
--   DROP FUNCTION IF EXISTS reject_audit_log_mutation();
--   DROP TABLE IF EXISTS operator_audit_log;

CREATE TABLE IF NOT EXISTS operator_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  operator_id TEXT NOT NULL,
  operator_email TEXT,
  action TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body JSONB,
  response_status INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  duration_ms INTEGER,
  meta JSONB
);

-- Indexes for common query patterns
CREATE INDEX idx_audit_log_created_at ON operator_audit_log (created_at DESC);
CREATE INDEX idx_audit_log_operator ON operator_audit_log (operator_id, created_at DESC);

-- Immutability trigger: audit log entries are append-only
CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'operator_audit_log is immutable: UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER guard_audit_log_immutability
BEFORE UPDATE OR DELETE ON operator_audit_log
FOR EACH ROW
EXECUTE FUNCTION reject_audit_log_mutation();
