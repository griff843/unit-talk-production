'use client';

/**
 * Platform Health Dashboard
 * Sprint: SPRINT-058-LAYER3-PHASE10-CC-HEALTH-DASHBOARD
 * Layer: Layer 3 / Phase 10 — Command Center UX
 *
 * Surfaces platform health summary and SLO attainment from Phase 7 backend APIs:
 *   - GET /api/health/summary  → HEALTHY | DEGRADED | CRITICAL + subsystem status
 *   - GET /api/slo/status      → 4 SLOs, 7-day rolling window
 */

import { Activity, AlertTriangle, CheckCircle2, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlatformStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
type SloStatus = 'OK' | 'WARN' | 'BREACH';

interface SubsystemEntry {
  name: string;
  status: 'UP' | 'DEGRADED' | 'DOWN';
  notes?: string;
}

interface HealthSummary {
  platform_status: PlatformStatus;
  computed_at: string;
  subsystems: SubsystemEntry[];
  slo_breaches: number;
  slo_warns: number;
  alert_count: number;
  high_alert_count: number;
  autopilot_mode: string;
  error?: string;
}

interface SloEntry {
  id: string;
  name: string;
  target: number;
  attainment: number;
  status: SloStatus;
  numerator?: number;
  denominator?: number;
  unit: string;
}

interface SloData {
  window_days: number;
  computed_at: string;
  slos: SloEntry[];
}

interface SloResponse {
  success: boolean;
  data?: SloData;
  error?: string;
  message?: string;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const PLATFORM_META: Record<
  PlatformStatus,
  { label: string; color: string; Icon: React.ElementType }
> = {
  HEALTHY: {
    label: 'Healthy',
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Icon: CheckCircle2,
  },
  DEGRADED: {
    label: 'Degraded',
    color: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    Icon: AlertTriangle,
  },
  CRITICAL: {
    label: 'Critical',
    color: 'text-red-700 bg-red-50 border-red-200',
    Icon: XCircle,
  },
};

const SLO_STATUS_COLOR: Record<SloStatus, string> = {
  OK: 'text-emerald-700 bg-emerald-50',
  WARN: 'text-yellow-700 bg-yellow-50',
  BREACH: 'text-red-700 bg-red-50',
};

// ─── Subcomponents ────────────────────────────────────────────────────────────

function LoadingSkeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg border border-border bg-card ${className}`} />;
}

function UnavailableCard({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformHealthPage() {
  const [health, setHealth] = useState<HealthSummary | null>(null);
  const [sloResponse, setSloResponse] = useState<SloResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [healthResult, sloResult] = await Promise.allSettled([
        fetch('/api/health/summary').then(r => r.json() as Promise<HealthSummary>),
        fetch('/api/slo/status').then(r => r.json() as Promise<SloResponse>),
      ]);

      if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      if (sloResult.status === 'fulfilled') setSloResponse(sloResult.value);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const platformStatus: PlatformStatus = health?.platform_status ?? 'CRITICAL';
  const { label, color, Icon } = PLATFORM_META[platformStatus];
  const slos = sloResponse?.data?.slos ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Platform Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            SLO attainment and platform status — 7-day rolling window
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border border-border bg-card hover:bg-accent/50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {lastUpdated && (
        <p className="text-xs text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Platform Status Card */}
      {loading && !health ? (
        <LoadingSkeleton className="h-28" />
      ) : health?.error && !health.platform_status ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Platform health unavailable — check API connection
        </div>
      ) : (
        <div className={`rounded-lg border p-5 ${color}`}>
          <div className="flex items-center gap-3">
            <Icon className="h-6 w-6" />
            <div>
              <p className="text-lg font-semibold">{label}</p>
              <p className="text-xs opacity-75 mt-0.5">
                Autopilot: {health?.autopilot_mode ?? '—'}&nbsp;·&nbsp; Breaches:{' '}
                {health?.slo_breaches ?? 0}&nbsp;·&nbsp; Warnings: {health?.slo_warns ?? 0}
                &nbsp;·&nbsp; Alerts: {health?.alert_count ?? 0} ({health?.high_alert_count ?? 0}{' '}
                HIGH)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SLO Attainment Grid */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          SLO Attainment
        </h2>
        {loading && slos.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <LoadingSkeleton key={i} className="h-24" />
            ))}
          </div>
        ) : slos.length === 0 ? (
          <UnavailableCard message="SLO data unavailable — check API connection" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {slos.map(slo => {
              const isLatency = slo.unit === 'seconds';
              const displayTarget = isLatency
                ? `≤ ${slo.target}s`
                : `≥ ${(slo.target * 100).toFixed(1)}%`;
              const displayAttainment = isLatency
                ? `${slo.attainment}s`
                : `${(slo.attainment * 100).toFixed(2)}%`;

              return (
                <div key={slo.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground leading-tight">
                    {slo.name}
                  </p>
                  <p className="text-xl font-bold text-foreground">{displayAttainment}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Target {displayTarget}</p>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${SLO_STATUS_COLOR[slo.status]}`}
                    >
                      {slo.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Window note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>
          Data reflects live API state.{' '}
          {sloResponse?.data?.window_days
            ? `${sloResponse.data.window_days}-day rolling window.`
            : ''}
        </span>
      </div>
    </div>
  );
}
