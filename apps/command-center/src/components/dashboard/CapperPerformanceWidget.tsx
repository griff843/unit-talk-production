'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { useState, useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CapperStats {
  capper_id: string;
  username: string;
  tier: string | null;
  capper_tier: string | null;
  active: boolean;
  stats: {
    picks: number;
    wins: number;
    losses: number;
    pushes: number;
    units_wagered: number;
    units_profit: number;
    win_rate: number;
    roi: number;
  };
  streak: { type: string; length: number } | null;
}

interface PerfResponse {
  success: boolean;
  window: number;
  cappers: CapperStats[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useCapperPerformance(window: number, capperId: string) {
  const params = new URLSearchParams({ window: String(window) });
  if (capperId && capperId !== 'all') params.set('capper_id', capperId);

  return useQuery({
    queryKey: ['capper-performance', window, capperId],
    queryFn: async (): Promise<PerfResponse> => {
      const res = await fetch(`/api/capper-performance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Toolbar({
  window,
  setWindow,
  capperId,
  setCapperId,
  cappers,
}: {
  window: number;
  setWindow: (v: number) => void;
  capperId: string;
  setCapperId: (v: string) => void;
  cappers: CapperStats[];
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Select value={String(window)} onValueChange={v => setWindow(Number(v))}>
        <SelectTrigger className="w-[100px] h-8 text-xs" aria-label="Rolling window">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[7, 10, 14, 30].map(d => (
            <SelectItem key={d} value={String(d)}>
              {d}-day
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={capperId} onValueChange={setCapperId}>
        <SelectTrigger className="w-[140px] h-8 text-xs" aria-label="Capper filter">
          <SelectValue placeholder="All Cappers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cappers</SelectItem>
          {cappers.map(c => (
            <SelectItem key={c.capper_id} value={c.capper_id}>
              {c.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StreakBadge({ streak }: { streak: { type: string; length: number } | null }) {
  if (!streak || streak.length === 0) return <span className="text-muted-foreground">--</span>;
  const isWin = streak.type === 'W';
  return (
    <Badge
      className={
        isWin
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
          : 'bg-red-500/15 text-red-400 border-red-500/25'
      }
    >
      {streak.type}
      {streak.length}
    </Badge>
  );
}

function CapperTable({ cappers }: { cappers: CapperStats[] }) {
  if (cappers.length === 0) {
    return <p className="text-center py-6 text-sm text-muted-foreground">No capper data</p>;
  }
  return (
    <div className="max-h-[320px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Capper</TableHead>
            <TableHead className="text-right">Picks</TableHead>
            <TableHead className="text-right">W-L</TableHead>
            <TableHead className="text-right">Win%</TableHead>
            <TableHead className="text-right">ROI</TableHead>
            <TableHead className="text-right">Units</TableHead>
            <TableHead className="text-center">Streak</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cappers.map(c => (
            <TableRow key={c.capper_id}>
              <TableCell className="font-medium text-xs">{c.username}</TableCell>
              <TableCell className="text-right text-xs">{c.stats.picks}</TableCell>
              <TableCell className="text-right text-xs">
                {c.stats.wins}-{c.stats.losses}
              </TableCell>
              <TableCell className="text-right text-xs">{c.stats.win_rate}%</TableCell>
              <TableCell className="text-right text-xs">
                <span className={c.stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {c.stats.roi > 0 ? '+' : ''}
                  {c.stats.roi}%
                </span>
              </TableCell>
              <TableCell className="text-right text-xs">
                <span className={c.stats.units_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {c.stats.units_profit > 0 ? '+' : ''}
                  {c.stats.units_profit}u
                </span>
              </TableCell>
              <TableCell className="text-center">
                <StreakBadge streak={c.streak} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PerfErrorCard({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <Card className="border-red-500/30 bg-red-500/5">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2 text-red-400" />
          Capper Performance
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-red-400">{error?.message}</p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------

export default function CapperPerformanceWidget() {
  const [window, setWindow] = useState(10);
  const [capperId, setCapperId] = useState('all');
  const { data, isLoading, isError, error, refetch } = useCapperPerformance(window, capperId);

  const allCappers = useMemo(() => data?.cappers ?? [], [data]);

  if (isError) {
    return <PerfErrorCard error={error as Error} onRetry={() => refetch()} />;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-medium flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Capper Performance
          </CardTitle>
          <CardDescription className="text-xs">{window}-day rolling window</CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent>
        <Toolbar
          window={window}
          setWindow={setWindow}
          capperId={capperId}
          setCapperId={setCapperId}
          cappers={allCappers}
        />
        {isLoading && allCappers.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <CapperTable cappers={allCappers} />
        )}
      </CardContent>
    </Card>
  );
}
