/* eslint-disable no-console */
/**
 * Quarantine Metrics API Endpoint (READ-ONLY)
 * Sprint: QUARANTINE-GOVERNANCE-ENFORCEMENT-006
 *
 * Provides visibility into quarantine governance state.
 * Reads from governance/quality/QUARANTINE_MANIFEST.json.
 *
 * GET /api/ops/quarantine-metrics
 */

import fs from 'fs';
import path from 'path';

import { NextResponse } from 'next/server';

interface QuarantineEntry {
  file_path: string;
  reason: string;
  date_quarantined: string;
  owner: string;
  restoration_deadline: string;
  related_issue?: string;
  category?: string;
}

interface TemporaryWaiver {
  active: boolean;
  reason: string;
  baseline_percentage: number;
  baseline_count: number;
  issued_date: string;
  expiration_date: string;
  approved_by: string;
}

interface GovernanceManifest {
  version: string;
  max_percentage: number;
  max_days: number;
  tests: QuarantineEntry[];
  temporary_waiver?: TemporaryWaiver;
}

export async function GET() {
  const correlationId = `quarantine-${Date.now()}`;

  try {
    // Resolve manifest path (command-center is at apps/command-center/)
    const candidates = [
      path.resolve(process.cwd(), '../../governance/quality/QUARANTINE_MANIFEST.json'),
      path.resolve(process.cwd(), 'governance/quality/QUARANTINE_MANIFEST.json'),
    ];

    let manifestContent: string | null = null;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          manifestContent = fs.readFileSync(p, 'utf-8');
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (!manifestContent) {
      return NextResponse.json(
        { error: 'Governance manifest not found', correlation_id: correlationId },
        { status: 404 }
      );
    }

    const manifest: GovernanceManifest = JSON.parse(manifestContent);
    const now = new Date();

    // Compute aggregates
    const byReason: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const slaViolations: { file_path: string; age_days: number; deadline: string }[] = [];
    let oldestDays = 0;

    for (const entry of manifest.tests) {
      byReason[entry.reason] = (byReason[entry.reason] || 0) + 1;
      if (entry.category) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
      }

      const ageDays = Math.floor(
        (now.getTime() - new Date(entry.date_quarantined).getTime()) / 86400000
      );
      if (ageDays > oldestDays) oldestDays = ageDays;
      if (ageDays > manifest.max_days) {
        slaViolations.push({
          file_path: entry.file_path,
          age_days: ageDays,
          deadline: entry.restoration_deadline,
        });
      }
    }

    const waiverActive =
      manifest.temporary_waiver?.active &&
      new Date(manifest.temporary_waiver.expiration_date) > now;

    return NextResponse.json(
      {
        timestamp: now.toISOString(),
        summary: {
          quarantined_count: manifest.tests.length,
          max_percentage: manifest.max_percentage,
          max_days: manifest.max_days,
          oldest_entry_days: oldestDays,
          waiver_active: !!waiverActive,
          ...(waiverActive && {
            waiver_expires: manifest.temporary_waiver!.expiration_date,
          }),
        },
        by_reason: byReason,
        by_category: byCategory,
        sla_violations: slaViolations,
        entries: manifest.tests,
        correlation_id: correlationId,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Correlation-ID': correlationId,
        },
      }
    );
  } catch (error) {
    console.error(`GET /api/ops/quarantine-metrics error [${correlationId}]:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch quarantine metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        correlation_id: correlationId,
      },
      { status: 500 }
    );
  }
}
