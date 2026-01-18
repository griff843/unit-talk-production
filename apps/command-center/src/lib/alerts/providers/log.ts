/**
 * Log Alert Provider - Phase 3
 *
 * Writes alerts to console logs.
 * Useful for local development and as fallback.
 */

import type { Alert } from '../../slo/types';

function formatAlertForLog(alert: Alert): string {
  const timestamp = new Date(alert.created_at).toISOString();
  const severityPrefix = alert.severity.toUpperCase().padEnd(8);

  const lines = [
    `========================================`,
    `[${timestamp}] ${severityPrefix} ${alert.title}`,
    `----------------------------------------`,
    `SLO:           ${alert.slo_name}`,
    `Current Value: ${alert.current_value !== null ? alert.current_value : 'N/A'}`,
    `Threshold:     ${alert.threshold}`,
    `Data Source:   ${alert.data_source}`,
    `Message:       ${alert.message}`,
  ];

  if (alert.metadata && Object.keys(alert.metadata).length > 0) {
    lines.push(`Metadata:      ${JSON.stringify(alert.metadata, null, 2)}`);
  }

  lines.push(`========================================`);

  return lines.join('\n');
}

export async function logAlert(alert: Alert): Promise<void> {
  const formatted = formatAlertForLog(alert);

  if (alert.severity === 'critical') {
    console.error(formatted);
  } else if (alert.severity === 'warning') {
    console.warn(formatted);
  } else {
    console.info(formatted);
  }

  console.log(`[Log] Alert logged: ${alert.title}`);
}
