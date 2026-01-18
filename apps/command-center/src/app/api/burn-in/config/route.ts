/**
 * GET /api/burn-in/config
 * Returns the burn-in configuration contract
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // Return the burn-in configuration from burn-in.yaml
  // (hardcoded to avoid yaml parser dependency)
  const config = {
    mode: 'log_only',
    duration_hours: 72,
    intervals: {
      ingestion_minutes: 5,
      autopilot_minutes: 15,
      slo_minutes: 5,
    },
    alerts: {
      enabled: true,
      channel: 'db',
      min_severity: 'warning',
    },
    discord: {
      enabled: false,
    },
    safety: {
      preflight_checks: true,
      validate_env: true,
      validate_tables: true,
      require_doctor_pass: false,
    },
    logging: {
      log_file: 'apps/command-center/phase5-evidence/scheduler-log.jsonl',
      config_snapshot: 'apps/command-center/phase5-evidence/burn-in-config.resolved.json',
      level: 'info',
    },
  };

  return NextResponse.json(config, { status: 200 });
}
