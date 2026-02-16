'use client';

import { RefreshCw, FileBarChart, AlertTriangle, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecapResult {
  success: boolean;
  mode: string;
  date_range?: { start: string; end: string };
  summary?: {
    headline?: { total_settled: number; wins: number; losses: number; win_rate: number };
    decision?: { decision: string; reasons: string[] };
  };
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DECISION_STYLES: Record<string, string> = {
  PROMOTE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  HOLD: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  DEMOTE: 'bg-red-500/15 text-red-400 border-red-500/25',
};

function decisionStyle(d: string | undefined): string {
  return DECISION_STYLES[d ?? ''] ?? 'bg-muted text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RecapBody({ result }: { result: RecapResult }) {
  const headline = result.summary?.headline;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Range: {result.date_range?.start} to {result.date_range?.end}
        </span>
        <Badge className={decisionStyle(result.summary?.decision?.decision)}>
          {result.summary?.decision?.decision || '--'}
        </Badge>
      </div>
      <HeadlineStats headline={headline} />
    </div>
  );
}

function HeadlineStats({
  headline,
}: {
  headline?: { total_settled: number; wins: number; win_rate: number };
}) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div>
        <p className="text-lg font-bold">{headline?.total_settled ?? 0}</p>
        <p className="text-xs text-muted-foreground">Settled</p>
      </div>
      <div>
        <p className="text-lg font-bold">{headline?.wins ?? 0}</p>
        <p className="text-xs text-muted-foreground">Wins</p>
      </div>
      <div>
        <p className="text-lg font-bold">
          {headline?.win_rate != null ? `${(headline.win_rate * 100).toFixed(1)}%` : '--'}
        </p>
        <p className="text-xs text-muted-foreground">Win Rate</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

function useRecapRunner() {
  const [lastResult, setLastResult] = useState<RecapResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRecap = async (mode: 'daily' | 'weekly' | 'monthly') => {
    try {
      setLoading(mode);
      setError(null);
      const res = await fetch('/api/ops-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Recap failed: ${res.status}`);
      setLastResult(data);
      toast.success(`${mode} recap generated`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Recap failed';
      setError(msg);
      toast.error(msg);
      setLastResult(null);
    } finally {
      setLoading(null);
    }
  };

  return { lastResult, loading, error, runRecap };
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export default function RecapStatusWidget() {
  const { lastResult, loading, error, runRecap } = useRecapRunner();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <FileBarChart className="w-4 h-4 mr-2" />
          Recap Status
        </CardTitle>
        {lastResult?.success && (
          <Badge variant="outline" className="text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Last: {lastResult.mode}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {!lastResult && !error && (
            <p className="text-sm text-muted-foreground">No recap data. Click below to generate.</p>
          )}
          {error && (
            <div className="flex items-center p-2 rounded border border-red-500/30 bg-red-500/5 text-sm text-red-400">
              <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
              {error}
            </div>
          )}
          {lastResult?.success && <RecapBody result={lastResult} />}
          <RecapButtons loading={loading} onRun={runRecap} />
        </div>
      </CardContent>
    </Card>
  );
}

function RecapButtons({
  loading,
  onRun,
}: {
  loading: string | null;
  onRun: (m: 'daily' | 'weekly' | 'monthly') => void;
}) {
  const modes: Array<'daily' | 'weekly' | 'monthly'> = ['daily', 'weekly', 'monthly'];
  return (
    <div className="flex items-center gap-2">
      {modes.map(m => (
        <Button
          key={m}
          variant="outline"
          size="sm"
          onClick={() => onRun(m)}
          disabled={loading !== null}
        >
          {loading === m && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
          Run {m.charAt(0).toUpperCase() + m.slice(1)}
        </Button>
      ))}
    </div>
  );
}
