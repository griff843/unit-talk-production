/**
 * Phase 4: Autopilot Report Component
 * Displays daily autopilot evaluation metrics and timeline
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, PlayCircle, RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AutopilotReport {
  report_date: string;
  daily_summary: {
    total_evaluated: number;
    approved_count: number;
    rejected_count: number;
    unknown_count: number;
    would_publish_count: number;
    avg_risk_score: number | null;
    stale_count: number;
    avg_execution_time_ms: number | null;
  };
  rejection_reasons: Array<{ reason: string; count: number }>;
  timeline: Array<{
    hour_bucket: string;
    evaluated_count: number;
    approved_count: number;
    rejected_count: number;
    would_publish_count: number;
    avg_risk_score: number | null;
  }>;
  timestamp: string;
}

export function AutopilotReport() {
  const [report, setReport] = useState<AutopilotReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/autopilot/report');
      if (!response.ok) {
        if (response.status === 404) {
          setError('No autopilot data available yet');
          setReport(null);
          return;
        }
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      setReport(data);
    } catch (err: any) {
      console.error('[AutopilotReport] Failed to fetch report:', err);
      setError(err.message || 'Failed to fetch autopilot report');
    } finally {
      setLoading(false);
    }
  };

  const runAutopilot = async () => {
    try {
      setRunning(true);
      setError(null);

      const response = await fetch('/api/autopilot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'log_only' }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      console.log('[AutopilotReport] Evaluation complete:', result);

      // Refresh report after successful run
      setTimeout(() => fetchReport(), 1000);
    } catch (err: any) {
      console.error('[AutopilotReport] Failed to run autopilot:', err);
      setError(err.message || 'Failed to run autopilot');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  if (loading && !report) {
    return (
      <Card data-testid="autopilot-report-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Autopilot Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading autopilot data...</div>
        </CardContent>
      </Card>
    );
  }

  if (error && !report) {
    return (
      <Card data-testid="autopilot-report-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Autopilot Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center py-4 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              {error}
            </div>
            <div className="flex justify-center gap-3">
              <Button onClick={runAutopilot} disabled={running} data-testid="run-autopilot-button">
                <PlayCircle className="w-4 h-4 mr-2" />
                {running ? 'Running...' : 'Run Autopilot Now'}
              </Button>
              <Button onClick={fetchReport} variant="outline" disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!report) {
    return null;
  }

  const { daily_summary } = report;
  const approvalRate =
    daily_summary.total_evaluated > 0
      ? ((daily_summary.approved_count / daily_summary.total_evaluated) * 100).toFixed(1)
      : '0.0';
  const publishRate =
    daily_summary.total_evaluated > 0
      ? ((daily_summary.would_publish_count / daily_summary.total_evaluated) * 100).toFixed(1)
      : '0.0';

  return (
    <Card data-testid="autopilot-report-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <CardTitle>Autopilot Report (Log-Only Mode)</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={runAutopilot}
              disabled={running}
              size="sm"
              data-testid="run-autopilot-button"
            >
              <PlayCircle className="w-4 h-4 mr-2" />
              {running ? 'Running...' : 'Run Now'}
            </Button>
            <Button onClick={fetchReport} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          Daily picks evaluated: {daily_summary.total_evaluated} | Approval Rate: {approvalRate}% |
          Would Publish: {publishRate}%
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="autopilot-metrics">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Evaluated</div>
              <div className="text-2xl font-bold" data-testid="evaluated-count">
                {daily_summary.total_evaluated}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Approved</div>
              <div className="text-2xl font-bold text-green-600" data-testid="approved-count">
                {daily_summary.approved_count}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Rejected</div>
              <div className="text-2xl font-bold text-red-600" data-testid="rejected-count">
                {daily_summary.rejected_count}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Would Publish</div>
              <div className="text-2xl font-bold text-blue-600" data-testid="would-publish-count">
                {daily_summary.would_publish_count}
              </div>
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Avg Risk Score</div>
              <div className="flex items-center gap-2">
                <div className="text-lg font-semibold">
                  {daily_summary.avg_risk_score !== null
                    ? daily_summary.avg_risk_score.toFixed(1)
                    : 'N/A'}
                </div>
                {daily_summary.avg_risk_score !== null && (
                  <Badge
                    variant={
                      daily_summary.avg_risk_score < 20
                        ? 'default'
                        : daily_summary.avg_risk_score < 50
                          ? 'secondary'
                          : 'destructive'
                    }
                  >
                    {daily_summary.avg_risk_score < 20
                      ? 'Low'
                      : daily_summary.avg_risk_score < 50
                        ? 'Medium'
                        : 'High'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">Stale Picks</div>
              <div className="text-lg font-semibold">{daily_summary.stale_count}</div>
            </div>
          </div>

          {/* Rejection Reasons */}
          {report.rejection_reasons && report.rejection_reasons.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Top Rejection Reasons</div>
              <div className="space-y-1" data-testid="rejection-reasons">
                {report.rejection_reasons.slice(0, 5).map((reason, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{reason.reason}</span>
                    <span className="font-medium">{reason.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline Summary */}
          {report.timeline && report.timeline.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Last 24 Hours Activity</div>
              <div className="space-y-1" data-testid="autopilot-timeline">
                {report.timeline.slice(0, 6).map((bucket, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {new Date(bucket.hour_bucket).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <div className="flex gap-3">
                      <span>
                        Evaluated: <strong>{bucket.evaluated_count}</strong>
                      </span>
                      <span>
                        Approved: <strong className="text-green-600">{bucket.approved_count}</strong>
                      </span>
                      <span>
                        Would Publish:{' '}
                        <strong className="text-blue-600">{bucket.would_publish_count}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Footer */}
          <div className="pt-4 border-t text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Last updated: {new Date(report.timestamp).toLocaleString()}</span>
              <span>
                Mode:{' '}
                <Badge variant="outline" className="font-mono">
                  log_only
                </Badge>
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
