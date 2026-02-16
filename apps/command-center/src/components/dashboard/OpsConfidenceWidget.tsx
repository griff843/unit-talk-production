'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck, Clock, Database, Scale } from 'lucide-react';

import type { ComponentType } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OpsConfidenceData {
  success: boolean;
  confidence: 'high' | 'medium' | 'low';
  last_settle: string | null;
  hours_since_settle: number | null;
  unsettled_count: number;
  settled_today: number;
  total_settled: number;
  mv_latest_day: string | null;
  days_since_mv_refresh: number | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const CONF_STYLES: Record<string, { label: string; color: string; dot: string }> = {
  high: {
    label: 'HIGH',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  medium: {
    label: 'MEDIUM',
    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    dot: 'bg-yellow-500',
  },
  low: { label: 'LOW', color: 'bg-red-500/15 text-red-400 border-red-500/25', dot: 'bg-red-500' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHours(h: number | null): string {
  if (h === null) return '--';
  if (h < 1) return `${Math.round(h * 60)}m ago`;
  if (h < 24) return `${h.toFixed(1)}h ago`;
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h ago`;
}

function formatTs(ts: string | null): string {
  if (!ts) return 'Never';
  return new Date(ts).toLocaleString();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/30">
      <div className="flex items-center mb-1">
        <Icon className="w-3 h-3 mr-1 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground truncate">{detail}</div>
    </div>
  );
}

function OpsErrorCard({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2 text-red-400" />
          Ops Confidence
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-400">Unavailable: {error?.message}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export default function OpsConfidenceWidget() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ops-confidence'],
    queryFn: async (): Promise<OpsConfidenceData> => {
      const res = await fetch('/api/ops-confidence');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 30_000,
  });

  if (isError && !data) {
    return <OpsErrorCard error={error as Error} onRetry={() => refetch()} />;
  }

  const conf = CONF_STYLES[data?.confidence ?? 'low'];

  return (
    <Card data-testid="ops-confidence-widget">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <ShieldCheck className="w-4 h-4 mr-2" />
          Ops Confidence
        </CardTitle>
        <div className="flex items-center gap-2">
          {data && (
            <Badge className={conf.color}>
              <div className={`w-2 h-2 rounded-full ${conf.dot} mr-1.5`} />
              {conf.label}
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data && (
          <div className="flex items-center justify-center h-20">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {data && <ConfidenceMetrics data={data} />}
      </CardContent>
    </Card>
  );
}

function ConfidenceMetrics({ data }: { data: OpsConfidenceData }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricTile
          icon={Clock}
          label="Last Settle"
          value={formatHours(data.hours_since_settle)}
          detail={formatTs(data.last_settle)}
        />
        <MetricTile
          icon={Scale}
          label="Unsettled"
          value={String(data.unsettled_count)}
          detail="Awaiting settlement"
        />
        <MetricTile
          icon={ShieldCheck}
          label="Settled Today"
          value={String(data.settled_today)}
          detail={`of ${data.total_settled} total`}
        />
        <MetricTile
          icon={Database}
          label="MV Freshness"
          value={mvLabel(data)}
          detail={data.mv_latest_day || 'No data'}
        />
      </div>
      <div className="text-[10px] text-muted-foreground text-right">
        Updated: {new Date(data.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

function mvLabel(d: OpsConfidenceData): string {
  if (d.days_since_mv_refresh === null) return '--';
  return d.days_since_mv_refresh === 0 ? 'Today' : `${d.days_since_mv_refresh}d old`;
}
