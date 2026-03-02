'use client';

/**
 * Capper Command Center - Main Page
 * Sprint: CAPPER-COMMAND-CENTER-MVP-001
 *
 * SPEC CONFORMANCE:
 * - CAPPER_COMMAND_CENTER_SPEC_v1.0.md
 * - Compression-first: auto-eliminate 70-90% of slate noise
 * - Top ranked plays with minimal decision surface
 * - Action logging with latency metrics
 */

import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRightCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Clock,
  Ban,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

import type { RankedPlay, CCCResponse, EliminationReason } from '@/lib/ccc/rankingEngine';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ============================================================================
// TYPES
// ============================================================================

type ActionType = 'APPROVE' | 'REJECT' | 'OVERRIDE';

interface ActionState {
  legId: string;
  play: RankedPlay;
  action: ActionType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ELIMINATION_LABELS: Record<EliminationReason, { label: string; icon: typeof AlertTriangle }> =
  {
    NO_EVENT_LINK: { label: 'No Event Link', icon: Ban },
    MISSING_PRIMITIVE: { label: 'Missing Data', icon: AlertTriangle },
    INSUFFICIENT_BOOKS: { label: 'Few Books', icon: AlertTriangle },
    HIGH_UNCERTAINTY: { label: 'High Uncertainty', icon: AlertTriangle },
    LOW_EDGE: { label: 'Low Edge', icon: TrendingDown },
    NEGATIVE_CLV: { label: 'Negative CLV', icon: TrendingDown },
  };

// ============================================================================
// COMPONENT
// ============================================================================

export default function CapperCommandCenterPage() {
  // State
  const [data, setData] = useState<CCCResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerExpanded, setBannerExpanded] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionState | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Refs for metrics
  const pageLoadTime = useRef<string>(new Date().toISOString());
  const firstActionLogged = useRef(false);

  // Fetch plays
  const fetchPlays = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ccc/plays');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch plays');
      }

      const result: CCCResponse = await res.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('[CCC] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    pageLoadTime.current = new Date().toISOString();
    firstActionLogged.current = false;
    fetchPlays();
  }, [fetchPlays]);

  // Handle action
  const handleAction = useCallback(
    async (play: RankedPlay, action: ActionType, reason?: string) => {
      setActionLoading(true);

      try {
        // Calculate latency for first action
        let firstActionLatencyMs: number | undefined;
        if (!firstActionLogged.current) {
          firstActionLatencyMs = Date.now() - new Date(pageLoadTime.current).getTime();
          firstActionLogged.current = true;
        }

        const res = await fetch('/api/ccc/actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            legId: play.legId,
            scoredLegId: play.scoredLegId,
            action,
            overrideReason: reason,
            actorId: 'capper-user', // TODO: Replace with actual auth
            actorName: 'Capper',
            pFinal: play.pFinal,
            pMarketDevig: play.pMarketDevig,
            edgeFinal: play.edgeFinalPct / 100,
            uncertaintyFinal:
              play.uncertaintyBadge === 'Low'
                ? 0.05
                : play.uncertaintyBadge === 'Med'
                  ? 0.12
                  : 0.18,
            clvForecast: play.clvBadge === '+' ? 0.01 : play.clvBadge === '-' ? -0.01 : 0,
            booksUsed: play.booksUsed,
            tier: play.tier,
            promotionBand: play.promotionBand,
            rankPosition: play.rank,
            pageLoadAt: pageLoadTime.current,
            firstActionLatencyMs,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Failed to log action');
        }

        // Mark as completed
        setCompletedActions(prev => new Set(prev).add(play.legId));
        setActionDialog(null);
        setOverrideReason('');

        toast.success(`${action} recorded for ${play.selection}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Action failed');
        console.error('[CCC] Action error:', err);
      } finally {
        setActionLoading(false);
      }
    },
    []
  );

  // Open override dialog
  const openOverrideDialog = useCallback((play: RankedPlay) => {
    setActionDialog({ legId: play.legId, play, action: 'OVERRIDE' });
  }, []);

  // Submit override
  const submitOverride = useCallback(() => {
    if (!actionDialog || !overrideReason.trim()) {
      toast.error('Override reason is required');
      return;
    }
    handleAction(actionDialog.play, 'OVERRIDE', overrideReason.trim());
  }, [actionDialog, overrideReason, handleAction]);

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading Command Center...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-destructive font-medium">{error}</p>
        <Button variant="outline" onClick={fetchPlays}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const eliminationTotal = data?.eliminationBanner.totalRemoved ?? 0;
  const playsCount = data?.plays.length ?? 0;
  const totalProcessed = eliminationTotal + playsCount;
  const eliminationPct =
    totalProcessed > 0 ? ((eliminationTotal / totalProcessed) * 100).toFixed(0) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Capper Command Center</h1>
          <p className="text-muted-foreground">
            Intelligence utilization layer — compress research time
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={fetchPlays}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Badge variant="outline" className="text-xs">
            v{data?.configUsed.RANKING_VERSION}
          </Badge>
        </div>
      </div>

      {/* Elimination Banner */}
      <Card className={eliminationTotal > 0 ? 'border-amber-500/50 bg-amber-500/5' : ''}>
        <CardHeader className="cursor-pointer" onClick={() => setBannerExpanded(!bannerExpanded)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <div>
                <CardTitle className="text-lg">
                  {eliminationTotal} plays removed automatically
                </CardTitle>
                <CardDescription>
                  {eliminationPct}% of slate auto-eliminated by intelligence filters
                </CardDescription>
              </div>
            </div>
            {bannerExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {bannerExpanded && data && (
          <CardContent>
            <div className="grid gap-3 md:grid-cols-5">
              {(
                Object.entries(data.eliminationBanner.removedByReason) as [
                  EliminationReason,
                  number,
                ][]
              ).map(([reason, count]) => {
                const { label, icon: Icon } = ELIMINATION_LABELS[reason];
                return (
                  <div
                    key={reason}
                    className="flex items-center space-x-2 p-2 rounded-lg border bg-card/50"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{count}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Top Ranked Plays */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            Top Ranked Plays
          </CardTitle>
          <CardDescription>{playsCount} eligible plays ranked by composite score</CardDescription>
        </CardHeader>
        <CardContent>
          {playsCount === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Ban className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No eligible plays after filtering</p>
              <p className="text-sm">All plays were auto-eliminated by intelligence gates</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data?.plays.map(play => (
                <PlayCard
                  key={play.legId}
                  play={play}
                  isCompleted={completedActions.has(play.legId)}
                  onApprove={() => handleAction(play, 'APPROVE')}
                  onReject={() => handleAction(play, 'REJECT')}
                  onOverride={() => openOverrideDialog(play)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={actionDialog !== null} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Required Reason</DialogTitle>
            <DialogDescription>Overriding: {actionDialog?.play.selection}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="override-reason">Reason for override</Label>
              <Input
                id="override-reason"
                placeholder="Enter reason for override..."
                value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={submitOverride} disabled={!overrideReason.trim() || actionLoading}>
              {actionLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRightCircle className="w-4 h-4 mr-2" />
              )}
              Confirm Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// PLAY CARD COMPONENT
// ============================================================================

interface PlayCardProps {
  play: RankedPlay;
  isCompleted: boolean;
  onApprove: () => void;
  onReject: () => void;
  onOverride: () => void;
}

function PlayCard({ play, isCompleted, onApprove, onReject, onOverride }: PlayCardProps) {
  const executionColors = {
    FIRE_NOW: 'bg-green-500/10 border-green-500/30 text-green-600',
    WAIT: 'bg-amber-500/10 border-amber-500/30 text-amber-600',
    AVOID: 'bg-red-500/10 border-red-500/30 text-red-600',
  };

  const executionIcons = {
    FIRE_NOW: Zap,
    WAIT: Clock,
    AVOID: Ban,
  };

  const ExecIcon = executionIcons[play.executionSuggestion];

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isCompleted ? 'bg-muted/50 opacity-60' : 'bg-card hover:border-primary/30'
      }`}
    >
      <div className="flex items-start justify-between">
        {/* Left: Identity + Metrics */}
        <div className="flex-1 space-y-3">
          {/* Rank + Selection */}
          <div className="flex items-center space-x-3">
            <Badge variant="outline" className="font-mono">
              #{play.rank}
            </Badge>
            <span className="font-medium text-foreground">{play.selection}</span>
            {play.tier && (
              <Badge variant="secondary" className="text-xs">
                {play.tier}
              </Badge>
            )}
          </div>

          {/* Metrics Row */}
          <div className="flex flex-wrap gap-2">
            {/* Edge */}
            <Badge variant="outline" className="bg-primary/5">
              <TrendingUp className="w-3 h-3 mr-1" />
              Edge: {play.edgeFinalPct.toFixed(2)}%
            </Badge>

            {/* Delta View */}
            <Badge variant="outline" className="font-mono text-xs">
              P: {(play.pFinal * 100).toFixed(1)}% vs Mkt: {(play.pMarketDevig * 100).toFixed(1)}%
              {' ('}
              {play.delta >= 0 ? '+' : ''}
              {(play.delta * 100).toFixed(1)}%{')'}
            </Badge>

            {/* Uncertainty Badge */}
            <Badge
              variant="outline"
              className={
                play.uncertaintyBadge === 'Low'
                  ? 'bg-green-500/10 text-green-600'
                  : play.uncertaintyBadge === 'Med'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-red-500/10 text-red-600'
              }
            >
              U: {play.uncertaintyBadge}
            </Badge>

            {/* CLV Badge */}
            <Badge variant="outline">
              CLV:{' '}
              {play.clvBadge === '+' ? (
                <TrendingUp className="w-3 h-3 ml-1 text-green-500" />
              ) : play.clvBadge === '-' ? (
                <TrendingDown className="w-3 h-3 ml-1 text-red-500" />
              ) : (
                <Minus className="w-3 h-3 ml-1" />
              )}
            </Badge>

            {/* Consensus Badge */}
            <Badge variant="outline">
              {play.booksUsed} books ({play.consensusBadge})
            </Badge>

            {/* Execution Suggestion */}
            <Badge className={executionColors[play.executionSuggestion]}>
              <ExecIcon className="w-3 h-3 mr-1" />
              {play.executionSuggestion.replace('_', ' ')}
            </Badge>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center space-x-2 ml-4">
          {isCompleted ? (
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Done
            </Badge>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={onApprove}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500/30 text-red-600 hover:bg-red-500/10"
                onClick={onReject}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button size="sm" variant="outline" onClick={onOverride}>
                <ArrowRightCircle className="w-4 h-4 mr-1" />
                Override
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
