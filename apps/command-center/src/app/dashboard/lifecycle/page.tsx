'use client';

/**
 * Pick Lifecycle Monitor
 * Sprint: SPRINT-078-LAYER3-PHASE10-CC-LIFECYCLE-MONITOR
 * Layer: Layer 3 / Phase 10 — Command Center UX
 *
 * Surfaces the live pick lifecycle pipeline via:
 *   GET /api/lifecycle/picks
 *   GET /api/lifecycle/picks/[id]/timeline
 *
 * Read-only. Shows stage distribution, stuck picks, all picks table,
 * and per-pick timeline drawer.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { STAGE_COLORS, STAGE_LABELS, type LifecycleStage } from '@/lib/lifecycleDisplay';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LifecyclePick {
  id: string;
  lifecycle_stage: LifecycleStage;
  blocked_reason?: string;
  failed_reason?: string;
  stuck_minutes?: number;
  needs_attention: boolean;
  capper: string;
  sport: string;
  selection: string;
  odds: number;
  tier: string;
  confidence: number;
  created_at: string;
}

interface LifecycleSummary {
  total: number;
  byStage: Record<string, number>;
  stuckCount: number;
  needsAttentionCount: number;
}

interface LifecycleResponse {
  picks: LifecyclePick[];
  summary: LifecycleSummary;
  thresholds: { SUBMITTED: number; QUEUED: number; POSTED: number };
  error?: string;
}

interface TimelineEvent {
  stage: LifecycleStage;
  timestamp: string;
  label: string;
  reason?: string;
}

interface TimelineResponse {
  pickId: string;
  currentStage: LifecycleStage;
  events: TimelineEvent[];
  blockedReason?: string;
  failedReason?: string;
  error?: string;
}

// ─── Stage display config ────────────────────────────────────────────────────

const ACTIVE_STAGES: LifecycleStage[] = ['SUBMITTED', 'QUEUED', 'POSTED', 'SETTLING'];
const TERMINAL_STAGES: LifecycleStage[] = ['SETTLED', 'VOID', 'CANCELLED'];
const PROBLEM_STAGES: LifecycleStage[] = ['BLOCKED', 'FAILED', 'DISPUTED'];

const STAGE_CARD_ORDER: LifecycleStage[] = [
  'SUBMITTED',
  'QUEUED',
  'POSTED',
  'SETTLING',
  'SETTLED',
  'BLOCKED',
  'FAILED',
];

function stageBadgeClass(stage: LifecycleStage): string {
  if (PROBLEM_STAGES.includes(stage)) return 'bg-red-100 text-red-800';
  if (ACTIVE_STAGES.includes(stage)) return 'bg-blue-100 text-blue-800';
  if (TERMINAL_STAGES.includes(stage)) return 'bg-green-100 text-green-800';
  return 'bg-gray-100 text-gray-700';
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Stage summary cards ──────────────────────────────────────────────────────

function StageSummaryCards({ summary }: { summary: LifecycleSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {STAGE_CARD_ORDER.map(stage => {
        const count = summary.byStage[stage] ?? 0;
        const isProblem = PROBLEM_STAGES.includes(stage);
        return (
          <Card key={stage} className={isProblem && count > 0 ? 'border-red-300' : ''}>
            <CardContent className="p-3">
              <div className="text-2xl font-bold">{count}</div>
              <div
                className={`mt-1 text-xs font-medium ${isProblem ? 'text-red-600' : 'text-muted-foreground'}`}
              >
                {STAGE_LABELS[stage]}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Timeline drawer ──────────────────────────────────────────────────────────

function TimelineDrawer({ pickId, onClose }: { pickId: string; onClose: () => void }) {
  const [data, setData] = useState<TimelineResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/lifecycle/picks/${pickId}/timeline`)
      .then(r => r.json())
      .then((json: TimelineResponse) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [pickId]);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold">Pick Timeline</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading timeline…</p>}

        {!loading && !data && <p className="text-sm text-destructive">Failed to load timeline.</p>}

        {!loading && data && !data.error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Current stage:</span>
              <span
                className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClass(data.currentStage)}`}
              >
                {STAGE_LABELS[data.currentStage]}
              </span>
            </div>

            {data.blockedReason && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong>Blocked:</strong> {data.blockedReason}
              </div>
            )}
            {data.failedReason && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <strong>Failed:</strong> {data.failedReason}
              </div>
            )}

            <ol className="relative border-l border-border pl-6 space-y-4">
              {data.events.map((ev, i) => (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[1.15rem] flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] ${STAGE_COLORS[ev.stage]}`}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-medium">{ev.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(ev.timestamp).toLocaleString()}
                  </p>
                  {ev.reason && <p className="mt-0.5 text-xs text-red-600">{ev.reason}</p>}
                </li>
              ))}
            </ol>

            <p className="text-xs text-muted-foreground">Pick ID: {pickId}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LifecycleMonitorPage() {
  const [data, setData] = useState<LifecycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [selectedPickId, setSelectedPickId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/lifecycle/picks?limit=200');
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const json: LifecycleResponse = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 30s auto-refresh
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const picks = data?.picks ?? [];
  const summary = data?.summary;

  // Apply stage filter
  const filteredPicks =
    stageFilter === 'all'
      ? picks
      : stageFilter === 'attention'
        ? picks.filter(p => p.needs_attention)
        : picks.filter(p => p.lifecycle_stage === stageFilter);

  const stuckPicks = picks.filter(p => p.stuck_minutes !== undefined);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pick Lifecycle Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Live pick pipeline status — refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Last refresh: {lastRefresh.toLocaleTimeString()}
          </span>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Failed to load lifecycle data: {error}</span>
        </div>
      )}

      {/* Summary banner */}
      {summary && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Activity className="h-4 w-4" />
            {summary.total} picks total
          </span>
          {summary.stuckCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-700">
              <Clock className="h-4 w-4" />
              {summary.stuckCount} stuck
            </span>
          )}
          {summary.needsAttentionCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-700">
              <AlertTriangle className="h-4 w-4" />
              {summary.needsAttentionCount} need attention
            </span>
          )}
          {summary.needsAttentionCount === 0 && (
            <span className="flex items-center gap-1.5 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              No issues
            </span>
          )}
        </div>
      )}

      {/* Stage cards */}
      {summary && <StageSummaryCards summary={summary} />}

      {/* Stuck picks */}
      {stuckPicks.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700">
              <Clock className="h-4 w-4" />
              Stuck Picks ({stuckPicks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Selection</th>
                    <th className="px-4 py-2 text-left font-medium">Sport</th>
                    <th className="px-4 py-2 text-left font-medium">Stage</th>
                    <th className="px-4 py-2 text-left font-medium">Stuck For</th>
                    <th className="px-4 py-2 text-left font-medium">Reason</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {stuckPicks.map(p => (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedPickId(p.id)}
                    >
                      <td className="px-4 py-2 font-medium">{p.selection || '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.sport}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClass(p.lifecycle_stage)}`}
                        >
                          {STAGE_LABELS[p.lifecycle_stage]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-amber-700">{p.stuck_minutes}m</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {p.blocked_reason || p.failed_reason || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All picks table */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">All Picks</CardTitle>
            <select
              value={stageFilter}
              onChange={e => setStageFilter(e.target.value)}
              className="rounded border bg-background px-2 py-1 text-xs"
            >
              <option value="all">All stages</option>
              <option value="attention">Needs attention</option>
              {STAGE_CARD_ORDER.map(s => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && picks.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          )}
          {!loading && filteredPicks.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No picks match the selected filter.
            </p>
          )}
          {filteredPicks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                    <th className="px-4 py-2 text-left font-medium">Selection</th>
                    <th className="px-4 py-2 text-left font-medium">Sport</th>
                    <th className="px-4 py-2 text-left font-medium">Tier</th>
                    <th className="px-4 py-2 text-left font-medium">Stage</th>
                    <th className="px-4 py-2 text-left font-medium">Created</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPicks.map(p => (
                    <tr
                      key={p.id}
                      className="cursor-pointer border-b transition-colors hover:bg-muted/40"
                      onClick={() => setSelectedPickId(p.id)}
                    >
                      <td className="px-4 py-2 font-medium">{p.selection || '—'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.sport}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className="text-xs">
                          {p.tier}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${stageBadgeClass(p.lifecycle_stage)}`}
                        >
                          {STAGE_LABELS[p.lifecycle_stage]}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {formatRelative(p.created_at)}
                      </td>
                      <td className="px-4 py-2">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline drawer */}
      {selectedPickId && (
        <TimelineDrawer pickId={selectedPickId} onClose={() => setSelectedPickId(null)} />
      )}
    </div>
  );
}
