'use client';

import { Eye, ThumbsUp, ThumbsDown, RefreshCw, Target, BarChart3, Layers } from 'lucide-react';
import { toast } from 'sonner';

import type { Pick } from '@/hooks/usePicks';

import { CLVChart } from '@/components/charts/CLVChart';
import { ComboPlayBuilder } from '@/components/charts/ComboPlayBuilder';
import { Badge } from '@/components/ui/badge';
import { LifecycleBadge } from '@/components/ui/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
}: Omit<PicksTableCardProps, 'picks' | 'onTabChange'>) {
  if (!DATA_TABS.has(selectedTab)) return null;

  return (
    <TabsContent value={selectedTab} className="mt-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
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
/*  Single table row                                                   */
/* ------------------------------------------------------------------ */

interface PickRowProps {
  pick: Pick;
  actionLoading: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onShowDetails: (pick: Pick) => void;
}

function PickTableRow({ pick, actionLoading, onApprove, onReject, onShowDetails }: PickRowProps) {
  return (
    <TableRow>
      <TableCell className="font-medium">{pick.capper}</TableCell>
      <TableCell>
        <Badge variant="outline">{pick.sport}</Badge>
      </TableCell>
      <TableCell>
        <div>
          <p className="font-medium">{pick.player_name || pick.line}</p>
          <p className="text-sm text-muted-foreground">
            {pick.line} ({pick.odds > 0 ? '+' : ''}
            {pick.odds})
          </p>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={getTierColor(pick.tier || 'C')}>{pick.tier || 'C'}</Badge>
      </TableCell>
      <TableCell>
        <span className="font-mono">{pick.ev_score?.toFixed(1) || '0.0'}</span>
      </TableCell>
      <TableCell>
        <span className="font-mono">{pick.confidence || 50}%</span>
      </TableCell>
      <TableCell>
        <LifecycleBadge
          pick={{
            status: pick.status === 'approved' ? 'pending' : pick.status === 'rejected' ? 'cancelled' : 'pending',
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
