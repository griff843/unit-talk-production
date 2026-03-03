'use client';

/**
 * STUCK PICKS PANEL COMPONENT
 * Sprint: POSTING-SETTLEMENT-EXACTNESS-040 (updated from 039)
 *
 * Displays stuck picks detection with threshold info and actionable retry.
 * Retry calls API endpoint (Command Center remains READ-ONLY).
 */

import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  RotateCcw,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StageBadge } from '@/components/ui/LifecycleBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { type LifecycleStage } from '@/lib/lifecycleDisplay';

interface StuckPick {
  pickId: string;
  stage: LifecycleStage;
  stuckSince: string;
  stuckMinutes: number;
  reason: string;
  capper: string;
  selection: string;
  sport: string;
}

interface StuckThresholds {
  submittedToQueued: number;
  queuedToPosted: number;
  postedToSettled: number;
}

interface StuckSummary {
  total: number;
  byStage: Record<LifecycleStage, number>;
}

interface StuckPicksResponse {
  thresholds: StuckThresholds;
  stuckPicks: StuckPick[];
  summary: StuckSummary;
}

interface RetryState {
  pickId: string;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

function formatStuckDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/**
 * Map lifecycle stage to drift mode for retry API
 */
function getDriftMode(stage: LifecycleStage): 'P1' | 'P3' | 'P5' | null {
  switch (stage) {
    case 'QUEUED':
      return 'P5'; // Stuck in queue = outbox stuck
    case 'SUBMITTED':
      return 'P3'; // Stuck after submission
    case 'POSTED':
      return null; // Settlement drift, not posting
    default:
      return 'P1';
  }
}

export function StuckPicksPanel() {
  const [data, setData] = useState<StuckPicksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryStates, setRetryStates] = useState<Record<string, RetryState>>({});

  const fetchStuckPicks = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/lifecycle/stuck');
      if (!response.ok) {
        throw new Error('Failed to fetch stuck picks');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Request retry via API endpoint (Command Center remains READ-ONLY)
   * Calls /api/lifecycle/retry which proxies to API service
   */
  const requestRetry = useCallback(async (pick: StuckPick) => {
    const driftMode = getDriftMode(pick.stage);

    // Only posting-related stages can be retried here
    if (!driftMode) {
      setRetryStates(prev => ({
        ...prev,
        [pick.pickId]: {
          pickId: pick.pickId,
          status: 'error',
          message: 'Settlement retries not supported via this panel',
        },
      }));
      return;
    }

    setRetryStates(prev => ({
      ...prev,
      [pick.pickId]: { pickId: pick.pickId, status: 'pending' },
    }));

    try {
      const response = await fetch('/api/lifecycle/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pick_id: pick.pickId,
          drift_mode: driftMode,
          reason: `Stuck pick retry from Command Center - ${pick.reason}`,
          retry_type: 'posting',
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setRetryStates(prev => ({
          ...prev,
          [pick.pickId]: {
            pickId: pick.pickId,
            status: 'error',
            message: result.error || 'Retry failed',
          },
        }));
        return;
      }

      setRetryStates(prev => ({
        ...prev,
        [pick.pickId]: {
          pickId: pick.pickId,
          status: 'success',
          message: result.message || 'Retry queued',
        },
      }));

      // Refresh after short delay
      setTimeout(fetchStuckPicks, 2000);
    } catch (err) {
      setRetryStates(prev => ({
        ...prev,
        [pick.pickId]: {
          pickId: pick.pickId,
          status: 'error',
          message: err instanceof Error ? err.message : 'Request failed',
        },
      }));
    }
  }, []);

  useEffect(() => {
    fetchStuckPicks();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Stuck Picks Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Stuck Picks Detection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-500">
            Error: {error}
            <Button variant="outline" size="sm" className="ml-4" onClick={fetchStuckPicks}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { thresholds, stuckPicks, summary } = data || {
    thresholds: { submittedToQueued: 5, queuedToPosted: 15, postedToSettled: 1440 },
    stuckPicks: [],
    summary: { total: 0, byStage: {} },
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Stuck Picks Detection
              {summary.total > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {summary.total}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Picks exceeding transition thresholds</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStuckPicks}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Thresholds Info */}
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Info className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Stuck Thresholds</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">SUBMITTED → QUEUED:</span>
              <p className="font-mono">{thresholds.submittedToQueued} min</p>
            </div>
            <div>
              <span className="text-muted-foreground">QUEUED → POSTED:</span>
              <p className="font-mono">{thresholds.queuedToPosted} min</p>
            </div>
            <div>
              <span className="text-muted-foreground">POSTED → SETTLED:</span>
              <p className="font-mono">{thresholds.postedToSettled / 60} hours</p>
            </div>
          </div>
        </div>

        {/* Summary by Stage */}
        {summary.total > 0 && (
          <div className="mb-4 flex gap-2">
            {Object.entries(summary.byStage).map(([stage, count]) => (
              <Badge key={stage} variant="outline">
                {stage}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Stuck Picks Table */}
        {stuckPicks.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No stuck picks detected</p>
            <p className="text-sm">All picks are transitioning within thresholds</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Capper</TableHead>
                  <TableHead>Selection</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Stuck For</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stuckPicks.map(pick => {
                  const retryState = retryStates[pick.pickId];
                  const canRetry = pick.stage !== 'POSTED'; // Settlement retries handled elsewhere

                  return (
                    <TableRow key={pick.pickId}>
                      <TableCell>
                        <StageBadge stage={pick.stage} size="sm" />
                      </TableCell>
                      <TableCell className="font-medium">{pick.capper}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={pick.selection}>
                        {pick.selection}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{pick.sport}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {formatStuckDuration(pick.stuckMinutes)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {retryState?.status === 'pending' ? (
                          <Button variant="ghost" size="sm" disabled>
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            Retrying...
                          </Button>
                        ) : retryState?.status === 'success' ? (
                          <span className="flex items-center text-green-600 text-sm">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Queued
                          </span>
                        ) : retryState?.status === 'error' ? (
                          <span
                            className="flex items-center text-red-500 text-sm"
                            title={retryState.message}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </span>
                        ) : canRetry ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => requestRetry(pick)}
                            className="text-xs"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Settlement</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Retry Info (Sprint 040 implementation) */}
        {stuckPicks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium text-blue-700 dark:text-blue-400">Retry Actions:</span>
                <p className="text-blue-600 dark:text-blue-300">
                  Retry resets the posting claim via API (Command Center remains read-only). The
                  pick will be re-queued for Discord posting by DiscordPromotionAgent. POSTED stage
                  picks require settlement intervention via /ops/retry-settlement.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
