/* eslint-disable max-lines-per-function */
'use client';

import { RefreshCw, Search, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';

import { TraceRow, TraceRecord } from './components/TraceRow';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';


interface TracesResponse {
  traces: TraceRecord[];
  count: number;
  query_ms: number;
}

export default function LiveTracePage() {
  const router = useRouter();
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [queryMs, setQueryMs] = useState<number>(0);

  const fetchTraces = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);

      const response = await fetch(`/api/ops/traces?${params}`);
      if (!response.ok) throw new Error(`Failed to fetch traces: ${response.statusText}`);

      const data: TracesResponse = await response.json();
      setTraces(data.traces);
      setQueryMs(data.query_ms);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTraces();
  }, [fetchTraces]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTraces, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTraces]);

  const filteredTraces = traces.filter(trace => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      trace.trace_id.toLowerCase().includes(term) ||
      trace.pick.capper.toLowerCase().includes(term) ||
      trace.pick.sport.toLowerCase().includes(term) ||
      trace.pick.selection.toLowerCase().includes(term)
    );
  });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const published = traces.filter(t => t.lifecycle_stage === 'discord_published').length;
  const pending = traces.filter(t =>
    ['awaiting_publish', 'publishing'].includes(t.lifecycle_stage)
  ).length;
  const failed = traces.filter(t => t.lifecycle_stage === 'publish_failed').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Trace</h1>
          <p className="text-muted-foreground">Real-time visibility into pick lifecycle</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh (5s)
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTraces} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{traces.length}</div>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{published}</div>
            <p className="text-sm text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pending}</div>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            {lastUpdated && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {formatTime(lastUpdated.toISOString())}
                {queryMs > 0 && ` (${queryMs}ms)`}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent Traces</CardTitle>
          <CardDescription>Click to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && traces.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTraces.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No traces found</div>
          ) : (
            <div className="space-y-2">
              {filteredTraces.map(trace => (
                <TraceRow
                  key={trace.trace_id}
                  trace={trace}
                  onClick={() => router.push(`/dashboard/ops/traces/${trace.trace_id}`)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
