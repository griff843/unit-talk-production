/* eslint-disable max-lines-per-function, complexity */
'use client';

import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  Database,
  MessageSquare,
  Activity,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, use } from 'react';

import { PickCard } from '../components/PickCard';
import { LIFECYCLE_COLORS, LIFECYCLE_LABELS } from '../components/TraceRow';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';


interface TraceDetailResponse {
  trace_id: string;
  lifecycle_stage: string;
  picks: Array<{
    id: string;
    sport: string;
    selection: string;
    line?: number;
    odds: number;
    stake: number;
    status: string;
    form_source: string;
    workflow_stage?: string;
    is_live?: boolean;
    created_at: string;
    capper: { username: string };
    publish?: {
      id: string;
      status: string;
      attempts: number;
      max_attempts: number;
      discord_channel_id: string | null;
      discord_message_id: string | null;
      last_error?: string | null;
    } | null;
  }>;
  discord_links: Array<{ pick_id: string; channel_id: string; message_id: string; link: string }>;
  summary: {
    pick_count: number;
    publish_count: number;
    bridge_event_count: number;
    discord_published: number;
    created_at: string;
  };
  query_ms: number;
}

export default function TraceDetailPage({ params }: { params: Promise<{ trace_id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [data, setData] = useState<TraceDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTraceDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ops/traces/${resolvedParams.trace_id}`);
      if (!response.ok)
        throw new Error(
          response.status === 404 ? 'Trace not found' : `Failed: ${response.statusText}`
        );
      setData(await response.json());
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [resolvedParams.trace_id]);

  useEffect(() => {
    fetchTraceDetail();
  }, [fetchTraceDetail]);
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTraceDetail, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTraceDetail]);

  const copyTraceId = () => {
    navigator.clipboard.writeText(resolvedParams.trace_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  if (loading && !data)
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  if (error)
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    );

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/ops/traces')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight font-mono">
                {resolvedParams.trace_id.slice(0, 8)}...
              </h1>
              <Button variant="ghost" size="sm" onClick={copyTraceId}>
                <Copy className="h-4 w-4" />
              </Button>
              {copied && <span className="text-sm text-green-600">Copied!</span>}
            </div>
            <p className="text-muted-foreground">
              Trace Detail • {data.summary.pick_count} pick(s)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh (3s)
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTraceDetail} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Lifecycle Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div
              className={`w-4 h-4 rounded-full ${LIFECYCLE_COLORS[data.lifecycle_stage] || LIFECYCLE_COLORS.unknown}`}
            />
            <span className="text-xl font-semibold">
              {LIFECYCLE_LABELS[data.lifecycle_stage] || data.lifecycle_stage}
            </span>
            {data.lifecycle_stage === 'discord_published' && (
              <CheckCircle className="h-5 w-5 text-green-600" />
            )}
            {data.lifecycle_stage === 'publish_failed' && (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          {lastUpdated && (
            <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last: {formatTime(lastUpdated.toISOString())}
              {data.query_ms > 0 && ` (${data.query_ms}ms)`}
            </div>
          )}
        </CardContent>
      </Card>

      {data.discord_links.length > 0 && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <MessageSquare className="h-5 w-5" />
              Discord Proof
            </CardTitle>
            <CardDescription>Click to view</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.discord_links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-lg bg-white border border-green-200 hover:border-green-400"
                >
                  <ExternalLink className="h-4 w-4 text-green-600" />
                  <span className="font-mono text-sm">{link.link}</span>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.summary.pick_count}</div>
            <p className="text-sm text-muted-foreground">Picks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.summary.publish_count}</div>
            <p className="text-sm text-muted-foreground">Publish</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{data.summary.bridge_event_count}</div>
            <p className="text-sm text-muted-foreground">Bridge</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {data.summary.discord_published}
            </div>
            <p className="text-sm text-muted-foreground">Published</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            unified_picks
          </CardTitle>
          <CardDescription>Pick records</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.picks.map(pick => (
              <PickCard key={pick.id} pick={pick} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
