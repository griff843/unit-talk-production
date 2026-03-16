'use client';

/**
 * Alerts Dashboard Page
 * Sprint: SPRINT-061-LAYER3-PHASE10-CC-ALERT-DASHBOARD
 * Layer: Layer 3 / Phase 10 — Command Center UX
 *
 * Surfaces active platform alerts from EnhancedAlertManager via:
 *   GET /api/alerts → proxy → GET /ops/alerts (API service)
 *
 * Read-only. No acknowledgement or resolution UI in this sprint.
 */

import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertStatus = 'active' | 'resolved' | 'acknowledged';

interface Alert {
  id: string;
  ruleId: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  value: number;
  threshold: number;
  status: AlertStatus;
  channels: string[];
  tags: string[];
  metadata: Record<string, unknown>;
}

interface AlertsResponse {
  alerts: Alert[];
  meta?: {
    total: number;
    bySeverity: { info: number; warning: number; critical: number };
  };
  success?: boolean;
  error?: string;
}

// ─── Severity config ──────────────────────────────────────────────────────────

const SEVERITY_META: Record<
  AlertSeverity,
  { label: string; badgeClass: string; Icon: React.ElementType; borderClass: string }
> = {
  critical: {
    label: 'Critical',
    badgeClass: 'text-red-700 bg-red-50',
    borderClass: 'border-red-200',
    Icon: AlertCircle,
  },
  warning: {
    label: 'Warning',
    badgeClass: 'text-yellow-700 bg-yellow-50',
    borderClass: 'border-yellow-200',
    Icon: AlertTriangle,
  },
  info: {
    label: 'Info',
    badgeClass: 'text-blue-700 bg-blue-50',
    borderClass: 'border-blue-200',
    Icon: Info,
  },
};

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'warning', 'info'];

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

function AlertCard({ alert }: { alert: Alert }) {
  const { label, badgeClass, borderClass, Icon } = SEVERITY_META[alert.severity];
  const ts = new Date(alert.timestamp).toLocaleTimeString();

  return (
    <div className={`rounded-lg border ${borderClass} bg-card p-4 space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground leading-tight">{alert.title}</p>
        </div>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${badgeClass}`}>
          {label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{alert.description}</p>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Value: <span className="font-medium text-foreground">{alert.value}</span> / Threshold:{' '}
          <span className="font-medium text-foreground">{alert.threshold}</span>
        </span>
        <span>{ts}</span>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [response, setResponse] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/alerts').then(r => r.json() as Promise<AlertsResponse>);
      setResponse(result);
      setLastUpdated(new Date());
    } catch {
      setResponse({ alerts: [], error: 'Failed to fetch alerts' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const alerts = response?.alerts ?? [];
  const meta = response?.meta;

  const alertsBySeverity = SEVERITY_ORDER.reduce<Record<AlertSeverity, Alert[]>>(
    (acc, sev) => {
      acc[sev] = alerts.filter(a => a.severity === sev);
      return acc;
    },
    { critical: [], warning: [], info: [] }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Active Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live alert feed from EnhancedAlertManager
            {meta ? ` — ${meta.total} total` : ''}
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

      {/* Severity summary row */}
      {meta && (
        <div className="grid grid-cols-3 gap-4">
          {SEVERITY_ORDER.map(sev => {
            const { label, badgeClass } = SEVERITY_META[sev];
            return (
              <div key={sev} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badgeClass}`}>
                  {label}
                </span>
                <p className="text-2xl font-bold text-foreground">{meta.bySeverity[sev]}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Alert groups */}
      {loading && alerts.length === 0 ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <LoadingSkeleton key={i} className="h-20" />
          ))}
        </div>
      ) : response?.error && alerts.length === 0 ? (
        <UnavailableCard message="Alert data unavailable — check API connection" />
      ) : alerts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-foreground">No active alerts</p>
            <p className="text-xs text-muted-foreground mt-1">All systems operating normally</p>
          </div>
        </div>
      ) : (
        SEVERITY_ORDER.map(sev => {
          const group = alertsBySeverity[sev];
          if (group.length === 0) return null;
          const { label } = SEVERITY_META[sev];
          return (
            <div key={sev} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {label} ({group.length})
              </h2>
              {group.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          );
        })
      )}

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" />
        <span>Data reflects live API state. Active alerts only — resolved alerts not shown.</span>
      </div>
    </div>
  );
}
