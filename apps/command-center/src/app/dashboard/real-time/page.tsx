'use client';

/**
 * Real-time Dashboard Page
 * Sprint: SPRINT-081-LAYER3-PHASE10-CC-REALTIME-DASHBOARD
 * Layer: Layer 3 / Phase 10 — Command Center UX
 *
 * Live pick pipeline stage counts + agent health pulse.
 * Fetched from GET /api/realtime-edge. Auto-refreshes every 30s.
 *
 * Read-only. No writes.
 */

import { Activity, Bot, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PipelineCounts {
  submitted: number;
  graded: number;
  promoted: number;
  posted: number;
  settled: number;
  void: number;
  other: number;
  total: number;
}

interface AgentSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  stale: number;
}

interface RealtimeEdgeResponse {
  success: boolean;
  pipeline?: PipelineCounts;
  agents?: AgentSummary;
  refreshedAt?: string;
  error?: string;
}

// ─── Stage config ─────────────────────────────────────────────────────────────

type StageKey = 'submitted' | 'graded' | 'promoted' | 'posted' | 'settled' | 'void' | 'other';

const STAGE_META: Record<StageKey, { label: string; colorClass: string }> = {
  submitted: { label: 'Submitted', colorClass: 'text-blue-700 bg-blue-50 border-blue-200' },
  graded: { label: 'Graded', colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  promoted: { label: 'Promoted', colorClass: 'text-violet-700 bg-violet-50 border-violet-200' },
  posted: { label: 'Posted', colorClass: 'text-green-700 bg-green-50 border-green-200' },
  settled: { label: 'Settled', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  void: { label: 'Void', colorClass: 'text-gray-600 bg-gray-50 border-gray-200' },
  other: { label: 'Other', colorClass: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
};

const STAGE_ORDER: StageKey[] = [
  'submitted',
  'graded',
  'promoted',
  'posted',
  'settled',
  'void',
  'other',
];

// ─── Agent pulse config ────────────────────────────────────────────────────────

const AGENT_COUNTERS: Array<{ key: keyof AgentSummary; label: string; colorClass: string }> = [
  { key: 'total', label: 'Total', colorClass: 'text-foreground' },
  { key: 'healthy', label: 'Healthy', colorClass: 'text-emerald-700' },
  { key: 'warning', label: 'Warning', colorClass: 'text-yellow-700' },
  { key: 'error', label: 'Error', colorClass: 'text-red-700' },
  { key: 'stale', label: 'Stale', colorClass: 'text-gray-500' },
];

// ─── Subcomponents ────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="animate-pulse rounded-lg border border-border bg-card h-20" />
      ))}
    </div>
  );
}

function StageCard({ stageKey, count }: { stageKey: StageKey; count: number }) {
  const { label, colorClass } = STAGE_META[stageKey];
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${colorClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold">{count}</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RealtimeDashboardPage() {
  const [response, setResponse] = useState<RealtimeEdgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetch('/api/realtime-edge').then(
        r => r.json() as Promise<RealtimeEdgeResponse>
      );
      setResponse(result);
      setLastUpdated(new Date());
    } catch {
      setResponse({ success: false, error: 'Failed to fetch real-time data' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const pipeline = response?.pipeline;
  const agents = response?.agents;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Real-time Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live pick pipeline and agent health — auto-refreshes every 30s
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

      {/* Error state */}
      {response?.error && !pipeline && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          Real-time data unavailable — check API connection
        </div>
      )}

      {/* Pick Pipeline section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pick Pipeline
          </h2>
          {pipeline && (
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {pipeline.total} total
            </span>
          )}
        </div>

        {loading && !pipeline ? (
          <LoadingSkeleton />
        ) : pipeline ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {STAGE_ORDER.map(key => (
              <StageCard key={key} stageKey={key} count={pipeline[key] ?? 0} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Agent Pulse section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Agent Pulse
        </h2>

        {loading && !agents ? (
          <div className="animate-pulse rounded-lg border border-border bg-card h-16" />
        ) : agents ? (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap gap-6">
              {AGENT_COUNTERS.map(({ key, label, colorClass }) => (
                <div key={key} className="text-center">
                  <p className={`text-2xl font-bold ${colorClass}`}>{agents[key]}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>
          Data reflects live Supabase state. Pipeline counts all non-null lifecycle stages.
        </span>
      </div>
    </div>
  );
}
