'use client';

/**
 * Risk Engine Dashboard
 * Sprint: RISK-ENGINE-FOUNDATION-001
 *
 * Displays real-time risk state:
 * - Exposure card (total kelly, breach status, per-event breakdown)
 * - Drift card (brier score, calibration gap, sample size)
 * - Risk events timeline
 * - Engine config
 */

import {
  RefreshCw,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  BarChart3,
  Link2,
  TrendingDown,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// TYPES
// ============================================================================

interface ExposureState {
  total_kelly_exposure: number;
  total_pending_legs: number;
  total_pending_events: number;
  exposure_by_event: Record<string, number>;
  max_single_event: { event_id: string; exposure: number } | null;
  herfindahl_index: number;
  breaches: {
    dimension: string;
    key: string;
    current: number;
    limit: number;
    severity: string;
  }[];
  computed_at: string;
}

interface DriftState {
  global_brier: number | null;
  calibration_gap: number | null;
  win_rate_actual: number | null;
  win_rate_predicted: number | null;
  sample_size: number;
  blocked: boolean;
  computed_at: string;
}

interface RiskEvent {
  id: string;
  event_type: string;
  severity: string;
  pick_id: string | null;
  decision: string;
  reason_codes: string[];
  trace_id: string | null;
  created_at: string;
}

interface CorrelationCluster {
  type: 'same_event' | 'same_participant';
  key: string;
  count: number;
  limit: number;
}

interface CorrelationState {
  clusters: CorrelationCluster[];
  blocked: boolean;
  blocked_reasons: string[];
  computed_at: string;
}

interface DrawdownState {
  realized_pnl: number;
  settled_count: number;
  wins: number;
  losses: number;
  pushes: number;
  drawdown_fraction: number;
  frozen: boolean;
  freeze_reason: string | null;
  lookback_days: number;
  computed_at: string;
}

interface RiskDashboardData {
  exposure: ExposureState | null;
  drift: DriftState | null;
  config: Record<string, { value: number; description: string | null }>;
  events: RiskEvent[];
  eventCounts: Record<string, number>;
  lastUpdated: string | null;
}

interface RiskLiveStatus {
  exposure: ExposureState | null;
  drift: DriftState | null;
  correlation: CorrelationState | null;
  drawdown: DrawdownState | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function severityColor(severity: string): string {
  switch (severity) {
    case 'emergency':
      return 'bg-red-600 text-white';
    case 'critical':
      return 'bg-red-500 text-white';
    case 'warning':
      return 'bg-yellow-500 text-black';
    case 'info':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
}

function decisionBadge(decision: string) {
  if (decision === 'ALLOW') {
    return <Badge className="bg-emerald-600 text-white">ALLOW</Badge>;
  }
  if (decision === 'BLOCK') {
    return <Badge className="bg-red-600 text-white">BLOCK</Badge>;
  }
  return <Badge variant="outline">{decision}</Badge>;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RiskDashboardPage() {
  const [data, setData] = useState<RiskDashboardData | null>(null);
  const [liveStatus, setLiveStatus] = useState<RiskLiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [dashRes, liveRes] = await Promise.allSettled([
        fetch('/api/risk/dashboard'),
        fetch('/api/risk/status'),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
        const json = await dashRes.value.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.message || 'Failed to load risk snapshot data');
        }
      }

      if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
        const json = await liveRes.value.json();
        if (json.success) {
          setLiveStatus(json.data as RiskLiveStatus);
        }
      }

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Risk Engine</h1>
            <p className="text-sm text-muted-foreground">
              Exposure enforcement, drift throttle, promotion blocking
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Last: {formatTime(data.lastUpdated)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-400">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Top Cards — snapshot data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ExposureCard exposure={liveStatus?.exposure ?? data?.exposure ?? null} />
        <DriftCard drift={liveStatus?.drift ?? data?.drift ?? null} />
        <EngineStatusCard config={data?.config ?? {}} eventCounts={data?.eventCounts ?? {}} />
      </div>

      {/* Live Risk Cards — correlation + drawdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CorrelationPanel correlation={liveStatus?.correlation ?? null} />
        <DrawdownPanel drawdown={liveStatus?.drawdown ?? null} />
      </div>

      {/* Events Timeline */}
      <EventsTimeline events={data?.events ?? []} />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function ExposureCard({ exposure }: { exposure: ExposureState | null }) {
  const hasBreaches = (exposure?.breaches?.length ?? 0) > 0;
  const borderClass = hasBreaches ? 'border-red-500/50' : 'border-emerald-500/30';

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Exposure
          </CardTitle>
          {hasBreaches ? (
            <Badge className="bg-red-600 text-white">BREACH</Badge>
          ) : (
            <Badge className="bg-emerald-600 text-white">OK</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!exposure ? (
          <p className="text-sm text-muted-foreground">No exposure data yet</p>
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold">{exposure.total_kelly_exposure.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">Total Kelly Exposure</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Pending Legs:</span>{' '}
                <span className="font-medium">{exposure.total_pending_legs}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Events:</span>{' '}
                <span className="font-medium">{exposure.total_pending_events}</span>
              </div>
              <div>
                <span className="text-muted-foreground">HHI:</span>{' '}
                <span className="font-medium">{exposure.herfindahl_index.toFixed(3)}</span>
              </div>
              {exposure.max_single_event && (
                <div>
                  <span className="text-muted-foreground">Max Event:</span>{' '}
                  <span className="font-medium">
                    {exposure.max_single_event.exposure.toFixed(4)}
                  </span>
                </div>
              )}
            </div>
            {hasBreaches && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-400">Breaches:</p>
                {exposure.breaches.map((b, i) => (
                  <div key={i} className="text-xs text-red-300">
                    {b.dimension}:{b.key} = {b.current.toFixed(4)} &gt; {b.limit}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DriftCard({ drift }: { drift: DriftState | null }) {
  const isBlocked = drift?.blocked ?? false;
  const borderClass = isBlocked ? 'border-orange-500/50' : 'border-emerald-500/30';

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Model Drift
          </CardTitle>
          {isBlocked ? (
            <Badge className="bg-orange-600 text-white">THROTTLED</Badge>
          ) : drift ? (
            <Badge className="bg-emerald-600 text-white">OK</Badge>
          ) : (
            <Badge variant="outline">NO DATA</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!drift ? (
          <p className="text-sm text-muted-foreground">No drift data yet</p>
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold">{drift.global_brier?.toFixed(4) ?? 'N/A'}</div>
              <p className="text-xs text-muted-foreground">Brier Score</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Cal. Gap:</span>{' '}
                <span className="font-medium">{drift.calibration_gap?.toFixed(4) ?? 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Sample:</span>{' '}
                <span className="font-medium">{drift.sample_size}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Win (Pred):</span>{' '}
                <span className="font-medium">{drift.win_rate_predicted?.toFixed(3) ?? '?'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Win (Actual):</span>{' '}
                <span className="font-medium">{drift.win_rate_actual?.toFixed(3) ?? '?'}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EngineStatusCard({
  config,
  eventCounts,
}: {
  config: Record<string, { value: number; description: string | null }>;
  eventCounts: Record<string, number>;
}) {
  const isEnabled = (config.engine_enabled?.value ?? 1) === 1;
  const blocked = eventCounts['PROMOTION_BLOCKED'] ?? 0;
  const allowed = eventCounts['PROMOTION_ALLOWED'] ?? 0;
  const errors = eventCounts['ENGINE_ERROR'] ?? 0;

  return (
    <Card className={isEnabled ? 'border-emerald-500/30' : 'border-yellow-500/50'}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Engine Status
          </CardTitle>
          {isEnabled ? (
            <Badge className="bg-emerald-600 text-white">ACTIVE</Badge>
          ) : (
            <Badge className="bg-yellow-600 text-black">DISABLED</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-bold text-emerald-400">{allowed}</div>
            <p className="text-[10px] text-muted-foreground">Allowed</p>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">{blocked}</div>
            <p className="text-[10px] text-muted-foreground">Blocked</p>
          </div>
          <div>
            <div className="text-lg font-bold text-orange-400">{errors}</div>
            <p className="text-[10px] text-muted-foreground">Errors</p>
          </div>
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-medium text-muted-foreground">Thresholds:</p>
          <div className="grid grid-cols-2 gap-1">
            <span>Kelly High: {config.total_kelly_high?.value ?? '?'}</span>
            <span>Kelly Crit: {config.total_kelly_critical?.value ?? '?'}</span>
            <span>Event Lim: {config.event_kelly_limit?.value ?? '?'}</span>
            <span>Drift Block: {config.drift_brier_block?.value ?? '?'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CorrelationPanel({ correlation }: { correlation: CorrelationState | null }) {
  const isBlocked = correlation?.blocked ?? false;
  const clusterCount = correlation?.clusters?.length ?? 0;
  const borderClass = isBlocked ? 'border-red-500/50' : 'border-emerald-500/30';

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Correlation
          </CardTitle>
          {isBlocked ? (
            <Badge className="bg-red-600 text-white">BLOCKED</Badge>
          ) : correlation ? (
            <Badge className="bg-emerald-600 text-white">OK</Badge>
          ) : (
            <Badge variant="outline">NO DATA</Badge>
          )}
        </div>
        <CardDescription>Same-event and same-participant clustering</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!correlation ? (
          <p className="text-sm text-muted-foreground">Live data unavailable (API offline)</p>
        ) : clusterCount === 0 ? (
          <p className="text-sm text-muted-foreground">No correlation clusters detected</p>
        ) : (
          <div className="space-y-2">
            {correlation.clusters.map((cluster, i) => (
              <div key={i} className="text-xs rounded-md bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {cluster.type === 'same_event' ? 'Same Event' : 'Same Participant'}
                  </span>
                  <span
                    className={
                      cluster.count > cluster.limit ? 'text-red-400' : 'text-muted-foreground'
                    }
                  >
                    {cluster.count} / {cluster.limit}
                  </span>
                </div>
                <p className="text-muted-foreground mt-0.5 truncate">{cluster.key}</p>
              </div>
            ))}
            {isBlocked && (
              <div className="space-y-1 mt-2">
                <p className="text-xs font-medium text-red-400">Block reasons:</p>
                {correlation.blocked_reasons.map((r, i) => (
                  <p key={i} className="text-xs text-red-300 truncate">
                    {r}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DrawdownPanel({ drawdown }: { drawdown: DrawdownState | null }) {
  const isFrozen = drawdown?.frozen ?? false;
  const drawdownPct = ((drawdown?.drawdown_fraction ?? 0) * 100).toFixed(1);
  const borderClass = isFrozen ? 'border-red-500/50' : 'border-emerald-500/30';

  return (
    <Card className={borderClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Drawdown
          </CardTitle>
          {isFrozen ? (
            <Badge className="bg-red-600 text-white">FROZEN</Badge>
          ) : drawdown ? (
            <Badge className="bg-emerald-600 text-white">OK</Badge>
          ) : (
            <Badge variant="outline">NO DATA</Badge>
          )}
        </div>
        <CardDescription>
          Realized P&amp;L over last {drawdown?.lookback_days ?? 1} day(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!drawdown ? (
          <p className="text-sm text-muted-foreground">Live data unavailable (API offline)</p>
        ) : (
          <>
            <div>
              <div className="text-2xl font-bold">{drawdownPct}%</div>
              <p className="text-xs text-muted-foreground">Drawdown fraction</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="font-bold text-emerald-400">{drawdown.wins}</div>
                <p className="text-[10px] text-muted-foreground">Wins</p>
              </div>
              <div>
                <div className="font-bold text-red-400">{drawdown.losses}</div>
                <p className="text-[10px] text-muted-foreground">Losses</p>
              </div>
              <div>
                <div className="font-bold text-yellow-400">{drawdown.pushes}</div>
                <p className="text-[10px] text-muted-foreground">Pushes</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Realized P&amp;L:{' '}
              <span className={drawdown.realized_pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {drawdown.realized_pnl >= 0 ? '+' : ''}
                {drawdown.realized_pnl.toFixed(4)} units
              </span>
            </div>
            {isFrozen && drawdown.freeze_reason && (
              <p className="text-xs text-red-400">{drawdown.freeze_reason}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EventsTimeline({ events }: { events: RiskEvent[] }) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Risk Events</CardTitle>
          <CardDescription>No risk events recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Risk Events
        </CardTitle>
        <CardDescription>Recent promotion decisions and risk alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {events.map(event => (
            <div
              key={event.id}
              className="flex items-center gap-3 p-2 rounded-md bg-muted/30 text-sm"
            >
              <div className="flex-shrink-0">
                {event.decision === 'ALLOW' ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : event.decision === 'BLOCK' ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{event.event_type.replace(/_/g, ' ')}</span>
                  {decisionBadge(event.decision)}
                  <Badge className={severityColor(event.severity)} variant="outline">
                    {event.severity}
                  </Badge>
                </div>
                {event.reason_codes?.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {event.reason_codes.join(', ')}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 text-xs text-muted-foreground">
                {formatTime(event.created_at)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
