'use client';

/**
 * Publishing Metrics Component - Phase 2
 * Displays canonical pick_publish monitoring from Supabase
 * NO MOCK DATA - shows UNKNOWN when data unavailable
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send,
  Clock,
  XCircle,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PublishingMetrics {
  timestamp: string;
  counts_24h: {
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    total: number;
  };
  oldest_pending: {
    age_minutes: number | null;
    id: string | null;
    pick_id: string | null;
    attempts: number | null;
    max_attempts: number | null;
    last_error: string | null;
    discord_channel_id: string | null;
    updated_at: string | null;
  };
  recent_attempts: Array<{
    id: string;
    pick_id: string;
    channel: string | null;
    status: string;
    attempts: number;
    max_attempts: number;
    external_message_id: string | null;
    last_error: string | null;
    created_at: string;
    updated_at: string;
  }>;
  publish_lag_ms: {
    p50: number | null;
    p95: number | null;
    sample_size: number;
  };
  stuck_pending_count: number;
  retry_exhaustion_count: number;
  data_source: 'real' | 'error';
  error_message?: string;
}

interface PublishingMetricsProps {
  className?: string;
  compact?: boolean;
}

export function PublishingMetrics({ className, compact = false }: PublishingMetricsProps) {
  const [metrics, setMetrics] = useState<PublishingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPublishingMetrics = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/publishing/metrics');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PublishingMetrics = await response.json();

      if (data.data_source === 'error') {
        toast.error(`Publishing metrics error: ${data.error_message || 'Unknown error'}`);
        setMetrics(null);
        return;
      }

      setMetrics(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Failed to fetch publishing metrics:', error);
      toast.error(
        `Failed to load publishing metrics: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublishingMetrics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchPublishingMetrics, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-32">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading publishing metrics...</span>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Send className="w-5 h-5 mr-2" />
            Publishing Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-center">
            <div>
              <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
              <p className="text-lg font-semibold text-red-600">NO DATA AVAILABLE</p>
              <p className="text-sm text-gray-500 mt-1">
                Failed to load publishing metrics from database
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchPublishingMetrics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
        <div className="p-4 rounded-lg border bg-yellow-50">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-yellow-600" />
            <Badge className="bg-yellow-100 text-yellow-800">PENDING</Badge>
          </div>
          <div className="text-2xl font-bold text-yellow-900 mt-2">
            {metrics.counts_24h.pending}
          </div>
          <div className="text-sm text-yellow-700">Awaiting Publish</div>
        </div>

        <div className="p-4 rounded-lg border bg-green-50">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <Badge className="bg-green-100 text-green-800">SENT</Badge>
          </div>
          <div className="text-2xl font-bold text-green-900 mt-2">
            {metrics.counts_24h.sent}
          </div>
          <div className="text-sm text-green-700">Published (24h)</div>
        </div>

        <div className="p-4 rounded-lg border bg-red-50">
          <div className="flex items-center justify-between">
            <XCircle className="w-5 h-5 text-red-600" />
            <Badge className="bg-red-100 text-red-800">FAILED</Badge>
          </div>
          <div className="text-2xl font-bold text-red-900 mt-2">
            {metrics.counts_24h.failed}
          </div>
          <div className="text-sm text-red-700">Failed (24h)</div>
        </div>

        <div className="p-4 rounded-lg border bg-orange-50">
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-5 h-5 text-orange-600" />
            <Badge className="bg-orange-100 text-orange-800">STUCK</Badge>
          </div>
          <div className="text-2xl font-bold text-orange-900 mt-2">
            {metrics.stuck_pending_count}
          </div>
          <div className="text-sm text-orange-700">Stuck Pending</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Send className="w-5 h-5 mr-2" />
              Publishing Status Monitor
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-green-100 text-green-800">✓ REAL DATA</Badge>
              <Badge className="bg-blue-100 text-blue-800">
                Updated {lastUpdate.toLocaleTimeString()}
              </Badge>
              <Button variant="outline" size="sm" onClick={fetchPublishingMetrics}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of pick_publish table (canonical publishing truth)
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Status Counts */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="p-4 rounded-lg border bg-yellow-50">
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-yellow-600" />
            <Badge className="bg-yellow-100 text-yellow-800">PENDING</Badge>
          </div>
          <div className="text-2xl font-bold text-yellow-900 mt-2">
            {metrics.counts_24h.pending}
          </div>
          <div className="text-sm text-yellow-700">Awaiting Publish</div>
        </div>

        <div className="p-4 rounded-lg border bg-green-50">
          <div className="flex items-center justify-between">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <Badge className="bg-green-100 text-green-800">SENT</Badge>
          </div>
          <div className="text-2xl font-bold text-green-900 mt-2">
            {metrics.counts_24h.sent}
          </div>
          <div className="text-sm text-green-700">Published (24h)</div>
        </div>

        <div className="p-4 rounded-lg border bg-red-50">
          <div className="flex items-center justify-between">
            <XCircle className="w-5 h-5 text-red-600" />
            <Badge className="bg-red-100 text-red-800">FAILED</Badge>
          </div>
          <div className="text-2xl font-bold text-red-900 mt-2">
            {metrics.counts_24h.failed}
          </div>
          <div className="text-sm text-red-700">Failed (24h)</div>
        </div>

        <div className="p-4 rounded-lg border bg-gray-50">
          <div className="flex items-center justify-between">
            <XCircle className="w-5 h-5 text-gray-600" />
            <Badge className="bg-gray-100 text-gray-800">CANCELLED</Badge>
          </div>
          <div className="text-2xl font-bold text-gray-900 mt-2">
            {metrics.counts_24h.cancelled}
          </div>
          <div className="text-sm text-gray-700">Cancelled (24h)</div>
        </div>

        <div className="p-4 rounded-lg border bg-blue-50">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <Badge className="bg-blue-100 text-blue-800">TOTAL</Badge>
          </div>
          <div className="text-2xl font-bold text-blue-900 mt-2">
            {metrics.counts_24h.total}
          </div>
          <div className="text-sm text-blue-700">All Attempts (24h)</div>
        </div>
      </div>

      {/* Critical Alerts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={metrics.stuck_pending_count > 0 ? 'border-orange-300' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center text-orange-700">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Stuck Pending
            </CardTitle>
            <CardDescription>Pending picks not updated in 10+ minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-orange-900">
              {metrics.stuck_pending_count}
            </div>
            {metrics.stuck_pending_count > 0 && (
              <p className="text-sm text-orange-700 mt-2">⚠️ Requires investigation</p>
            )}
          </CardContent>
        </Card>

        <Card className={metrics.retry_exhaustion_count > 0 ? 'border-red-300' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center text-red-700">
              <XCircle className="w-5 h-5 mr-2" />
              Retry Exhaustion
            </CardTitle>
            <CardDescription>Failed after max retry attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-red-900">
              {metrics.retry_exhaustion_count}
            </div>
            {metrics.retry_exhaustion_count > 0 && (
              <p className="text-sm text-red-700 mt-2">🚨 Manual intervention needed</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Oldest Pending */}
      {metrics.oldest_pending.id && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Oldest Pending Pick
            </CardTitle>
            <CardDescription>Longest waiting pick in queue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Age:</span>
                <span className="font-mono font-bold">
                  {metrics.oldest_pending.age_minutes !== null
                    ? `${metrics.oldest_pending.age_minutes} minutes`
                    : 'UNKNOWN'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pick ID:</span>
                <span className="font-mono text-sm">{metrics.oldest_pending.pick_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Attempts:</span>
                <span className="font-mono">
                  {metrics.oldest_pending.attempts || 0} / {metrics.oldest_pending.max_attempts || 3}
                </span>
              </div>
              {metrics.oldest_pending.last_error && (
                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                  <span className="text-xs text-red-700 font-mono">
                    Error: {metrics.oldest_pending.last_error}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publish Lag */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Publishing Lag (24h)
          </CardTitle>
          <CardDescription>
            Time from pick creation to Discord publish (sample: {metrics.publish_lag_ms.sample_size}{' '}
            picks)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="text-sm text-muted-foreground">P50 (median)</div>
              <div className="text-2xl font-bold">
                {metrics.publish_lag_ms.p50 !== null
                  ? `${Math.round(metrics.publish_lag_ms.p50 / 1000)}s`
                  : 'UNKNOWN'}
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <div className="text-sm text-muted-foreground">P95 (95th percentile)</div>
              <div className="text-2xl font-bold">
                {metrics.publish_lag_ms.p95 !== null
                  ? `${Math.round(metrics.publish_lag_ms.p95 / 1000)}s`
                  : 'UNKNOWN'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
