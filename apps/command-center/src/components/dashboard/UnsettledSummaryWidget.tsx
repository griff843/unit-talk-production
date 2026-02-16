'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Scale, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnsettledPick {
  id: string;
  sport: string;
  created_at: string;
}

interface AgeBucket {
  label: string;
  count: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  const minutes = Math.floor(ms / 60_000);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

function buildBuckets(picks: UnsettledPick[]): AgeBucket[] {
  const now = Date.now();
  const DAY = 86_400_000;
  return [
    {
      label: '< 24h',
      count: picks.filter(p => now - new Date(p.created_at).getTime() < DAY).length,
      color: 'bg-emerald-500',
    },
    {
      label: '24-72h',
      count: picks.filter(p => {
        const a = now - new Date(p.created_at).getTime();
        return a >= DAY && a < 3 * DAY;
      }).length,
      color: 'bg-yellow-500',
    },
    {
      label: '> 72h',
      count: picks.filter(p => now - new Date(p.created_at).getTime() >= 3 * DAY).length,
      color: 'bg-red-500',
    },
  ];
}

function buildSportCounts(picks: UnsettledPick[]): [string, number][] {
  const map: Record<string, number> = {};
  for (const p of picks) {
    const k = p.sport || 'Unknown';
    map[k] = (map[k] || 0) + 1;
  }
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useUnsettledQueue() {
  return useQuery({
    queryKey: ['settlement', 'unsettled'],
    queryFn: async (): Promise<UnsettledPick[]> => {
      const res = await fetch('/api/settlement?limit=200');
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const json = await res.json();
      return json.picks ?? [];
    },
    refetchInterval: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export default function UnsettledSummaryWidget() {
  const { data: picks = [], isLoading, isError, error, refetch } = useUnsettledQueue();

  const buckets = useMemo(() => buildBuckets(picks), [picks]);
  const sports = useMemo(() => buildSportCounts(picks), [picks]);
  const oldest = useMemo(
    () =>
      picks.length > 0
        ? Math.max(...picks.map(p => Date.now() - new Date(p.created_at).getTime()))
        : 0,
    [picks]
  );

  if (isError) {
    return <ErrorCard error={(error as Error)?.message || 'Unknown'} onRetry={() => refetch()} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Scale className="w-4 h-4 mr-2" />
          Unsettled Queue
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {picks.length} unsettled
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <SummaryBody picks={picks} oldest={oldest} sports={sports} buckets={buckets} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryBody({
  picks,
  oldest,
  sports,
  buckets,
}: {
  picks: UnsettledPick[];
  oldest: number;
  sports: [string, number][];
  buckets: AgeBucket[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{picks.length}</p>
          <p className="text-xs text-muted-foreground">Total unsettled</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold">{picks.length > 0 ? formatAge(oldest) : '-'}</p>
          <p className="text-xs text-muted-foreground">Oldest pick</p>
        </div>
      </div>
      {sports.length > 0 && <SportBadges sports={sports} />}
      <AgingBar buckets={buckets} />
    </div>
  );
}

function SportBadges({ sports }: { sports: [string, number][] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">By Sport</p>
      <div className="flex flex-wrap gap-2">
        {sports.map(([s, c]) => (
          <Badge key={s} variant="secondary" className="text-xs">
            {s}: {c}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function AgingBar({ buckets }: { buckets: AgeBucket[] }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Aging SLA</p>
      <div className="flex items-center gap-4">
        {buckets.map(b => (
          <div key={b.label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${b.color}`} />
            <span className="text-xs">
              {b.label}: <span className="font-semibold">{b.count}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
          Unsettled Queue
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-400">Queue unavailable: {error}</p>
      </CardContent>
    </Card>
  );
}
