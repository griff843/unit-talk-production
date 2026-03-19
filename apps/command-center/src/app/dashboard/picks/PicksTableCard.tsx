'use client';

import {
  Eye,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Target,
  BarChart3,
  Layers,
  CheckSquare,
  XSquare,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

import type { BatchAction } from './usePicksPage';
import type { Pick } from '@/hooks/usePicks';

import { CLVChart } from '@/components/charts/CLVChart';
import { ComboPlayBuilder } from '@/components/charts/ComboPlayBuilder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LifecycleBadge } from '@/components/ui/LifecycleBadge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getTierColor, formatPercentage } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PicksTableCardProps {
  picks: Pick[];
  filteredPicks: Pick[];
  selectedTab: string;
  onTabChange: (tab: string) => void;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShowDetails: (pick: Pick) => void;
  // Batch selection (SPRINT-082)
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onBatchAction: (action: BatchAction) => void;
  batchLoading: boolean;
}

/* ------------------------------------------------------------------ */
/*  Main card                                                          */
/* ------------------------------------------------------------------ */

export function PicksTableCard({
  picks,
  filteredPicks,
  selectedTab,
  onTabChange,
  actionLoading,
  onApprove,
  onReject,
  onShowDetails,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchAction,
  batchLoading,
}: PicksTableCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pick Management</CardTitle>
        <CardDescription>
          Review, approve, and analyze betting picks with advanced filtering
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedTab} onValueChange={onTabChange}>
          <PicksTabsList picks={picks} />
          <DataTabContent
            filteredPicks={filteredPicks}
            selectedTab={selectedTab}
            actionLoading={actionLoading}
            onApprove={onApprove}
            onReject={onReject}
            onShowDetails={onShowDetails}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
            onSelectAll={onSelectAll}
            onClearSelection={onClearSelection}
            onBatchAction={onBatchAction}
            batchLoading={batchLoading}
          />
          <TabsContent value="clv" className="mt-6">
            <CLVChart picks={picks} />
          </TabsContent>
          <TabsContent value="combo" className="mt-6">
            <ComboPlayBuilder
              picks={picks}
              onComboCreate={combo => {
                toast.success(`${combo.type} combo created with ${combo.picks.length} picks`);
              }}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs header                                                        */
/* ------------------------------------------------------------------ */

function PicksTabsList({ picks }: { picks: Pick[] }) {
  return (
    <TabsList className="grid w-full grid-cols-6">
      <TabsTrigger value="all">All Picks ({picks.length})</TabsTrigger>
      <TabsTrigger value="pending">
        Pending ({picks.filter(p => p.status === 'pending').length})
      </TabsTrigger>
      <TabsTrigger value="approved">
        Approved ({picks.filter(p => p.status === 'approved').length})
      </TabsTrigger>
      <TabsTrigger value="rejected">
        Rejected ({picks.filter(p => p.status === 'rejected').length})
      </TabsTrigger>
      <TabsTrigger value="clv">
        <BarChart3 className="w-4 h-4 mr-1" />
        CLV Analysis
      </TabsTrigger>
      <TabsTrigger value="combo">
        <Layers className="w-4 h-4 mr-1" />
        Combo Builder
      </TabsTrigger>
    </TabsList>
  );
}

/* ------------------------------------------------------------------ */
/*  Data tab (all / pending / approved / rejected)                     */
/* ------------------------------------------------------------------ */

const DATA_TABS = new Set(['all', 'pending', 'approved', 'rejected']);

function DataTabContent({
  filteredPicks,
  selectedTab,
  actionLoading,
  onApprove,
  onReject,
  onShowDetails,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onBatchAction,
  batchLoading,
}: Omit<PicksTableCardProps, 'picks' | 'onTabChange'>) {
  if (!DATA_TABS.has(selectedTab)) return null;

  const allSelected = filteredPicks.length > 0 && filteredPicks.every(p => selectedIds.has(p.id));

  return (
    <TabsContent value={selectedTab} className="mt-6">
      {selectedIds.size > 0 && (
        <BatchToolbar
          count={selectedIds.size}
          loading={batchLoading}
          onPromote={() => onBatchAction('promote')}
          onReject={() => onBatchAction('reject')}
          onRequeue={() => onBatchAction('requeue')}
          onClear={onClearSelection}
        />
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() =>
                    allSelected ? onClearSelection() : onSelectAll(filteredPicks.map(p => p.id))
                  }
                  className="cursor-pointer"
                />
              </TableHead>
              <TableHead>Capper</TableHead>
              <TableHead>Sport</TableHead>
              <TableHead>Pick Details</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>EV Score</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>ROI</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPicks.map(pick => (
              <PickTableRow
                key={pick.id}
                pick={pick}
                actionLoading={actionLoading}
                onApprove={onApprove}
                onReject={onReject}
                onShowDetails={onShowDetails}
                selected={selectedIds.has(pick.id)}
                onToggleSelect={onToggleSelect}
              />
            ))}
          </TableBody>
        </Table>
      </div>
      {filteredPicks.length === 0 && <EmptyState />}
    </TabsContent>
  );
}

/* ------------------------------------------------------------------ */
/*  Batch toolbar (shown when picks are selected)                      */
/* ------------------------------------------------------------------ */

interface BatchToolbarProps {
  count: number;
  loading: boolean;
  onPromote: () => void;
  onReject: () => void;
  onRequeue: () => void;
  onClear: () => void;
}

function BatchToolbar({
  count,
  loading,
  onPromote,
  onReject,
  onRequeue,
  onClear,
}: BatchToolbarProps) {
  return (
    <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-md bg-muted border text-sm">
      <span className="font-medium">{count} selected</span>
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="outline"
          size="sm"
          className="text-green-600 hover:text-green-700"
          onClick={onPromote}
          disabled={loading}
        >
          <CheckSquare className="h-4 w-4 mr-1" />
          Promote
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 hover:text-red-700"
          onClick={onReject}
          disabled={loading}
        >
          <XSquare className="h-4 w-4 mr-1" />
          Reject
        </Button>
        <Button variant="outline" size="sm" onClick={onRequeue} disabled={loading}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Requeue
        </Button>
        <Button variant="ghost" size="sm" onClick={onClear} disabled={loading}>
          Clear
        </Button>
        {loading && <RefreshCw className="h-4 w-4 animate-spin ml-1 text-muted-foreground" />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single table row                                                   */
/* ------------------------------------------------------------------ */

interface PickRowProps {
  pick: Pick;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShowDetails: (pick: Pick) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}

function PickTableRow({
  pick,
  actionLoading,
  onApprove,
  onReject,
  onShowDetails,
  selected,
  onToggleSelect,
}: PickRowProps) {
  return (
    <TableRow
      data-selected={selected || undefined}
      className={selected ? 'bg-muted/50' : undefined}
    >
      <TableCell>
        <input
          type="checkbox"
          aria-label={`Select pick ${pick.id}`}
          checked={selected}
          onChange={() => onToggleSelect(pick.id)}
          className="cursor-pointer"
        />
      </TableCell>
      <TableCell className="font-medium">{pick.capper}</TableCell>
      <TableCell>
        <Badge variant="outline">{pick.sport}</Badge>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{pick.player_name || pick.line}</p>
          <p className="text-sm text-muted-foreground">
            {pick.line} ({pick.odds != null ? `${pick.odds > 0 ? '+' : ''}${pick.odds}` : '—'})
          </p>
          {pick.bet_type != null && (
            <p className="text-xs text-muted-foreground">{pick.bet_type}</p>
          )}
          {(pick.home_team != null || pick.away_team != null) && (
            <p className="text-xs text-muted-foreground">
              {[pick.away_team, pick.home_team].filter(Boolean).join(' @ ')}
            </p>
          )}
          {pick.posted_to_discord === true && (
            <p className="text-xs text-emerald-500">&#10003; Discord</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        {pick.tier != null ? (
          <Badge className={getTierColor(pick.tier)}>{pick.tier}</Badge>
        ) : (
          <span className="text-muted-foreground">&mdash;</span>
        )}
      </TableCell>
      <TableCell>
        <span className="font-mono">
          {pick.ev_score != null ? (
            pick.ev_score.toFixed(1)
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <span className="font-mono">
          {pick.confidence != null ? (
            `${pick.confidence}%`
          ) : (
            <span className="text-muted-foreground">&mdash;</span>
          )}
        </span>
      </TableCell>
      <TableCell>
        <LifecycleBadge
          pick={{
            status:
              pick.status === 'approved'
                ? 'pending'
                : pick.status === 'rejected'
                  ? 'cancelled'
                  : 'pending',
            promotion_status: pick.status === 'approved' ? 'promoted' : 'not_promoted',
            blocked_reason: pick.status === 'rejected' ? 'BLOCKED_PROMOTION_INELIGIBLE' : undefined,
          }}
          size="sm"
        />
      </TableCell>
      <TableCell>
        <RoiCell roi={pick.roi} />
      </TableCell>
      <TableCell>
        <PickActions
          pick={pick}
          loading={actionLoading === pick.id}
          onApprove={onApprove}
          onReject={onReject}
          onShowDetails={onShowDetails}
        />
      </TableCell>
    </TableRow>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny sub-components to keep complexity low                         */
/* ------------------------------------------------------------------ */

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'approved'
      ? 'default'
      : status === 'pending'
        ? 'secondary'
        : status === 'rejected'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant as 'default'}>{status}</Badge>;
}

function RoiCell({ roi }: { roi?: number }) {
  if (!roi) return <span className="text-muted-foreground">&mdash;</span>;
  return (
    <span className={`font-mono ${roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
      {formatPercentage(roi)}
    </span>
  );
}

interface PickActionsProps {
  pick: Pick;
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShowDetails: (pick: Pick) => void;
}

function PickActions({ pick, loading, onApprove, onReject, onShowDetails }: PickActionsProps) {
  return (
    <div className="flex items-center space-x-1">
      <Button variant="ghost" size="sm" onClick={() => onShowDetails(pick)}>
        <Eye className="h-4 w-4" />
      </Button>
      {pick.status === 'pending' && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="text-green-600 hover:text-green-700"
            onClick={() => onApprove(pick.id)}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => onReject(pick.id)}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsDown className="h-4 w-4" />
            )}
          </Button>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="text-lg font-semibold mb-2">No picks found</h3>
      <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
    </div>
  );
}
