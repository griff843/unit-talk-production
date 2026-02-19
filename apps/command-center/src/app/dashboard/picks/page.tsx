'use client';

import { RefreshCw, AlertCircle, Download, TrendingUp } from 'lucide-react';

import { PicksFilterCard } from './PicksFilterCard';
import { PicksTableCard } from './PicksTableCard';
import { usePicksPage } from './usePicksPage';

import type { DynamicStat } from './usePicksPage';

import { PickDetailsModal } from '@/components/PickDetailsModal';
import { StuckPicksPanel } from '@/components/StuckPicksPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function wrapModalAction(action: (id: string) => Promise<boolean>, close: () => void) {
  return async (id: string) => {
    const ok = await action(id);
    if (ok) close();
    return ok;
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PicksHQPage() {
  const page = usePicksPage();

  if (page.loading) return <LoadingState />;
  if (page.error) return <ErrorFallback onRetry={page.refreshPicks} />;

  return (
    <div className="space-y-6">
      <PageHeader onRefresh={page.refreshPicks} onExport={page.handleExport} />
      <StatsGrid stats={page.dynamicStats} />
      <PicksFilterCard filters={page.filters} />
      <StuckPicksPanel />
      <PicksTableCard
        picks={page.picks}
        filteredPicks={page.filteredPicks}
        selectedTab={page.filters.selectedTab}
        onTabChange={page.filters.setSelectedTab}
        actionLoading={page.actionLoading}
        onApprove={page.handleApprove}
        onReject={page.handleReject}
        onShowDetails={page.show}
      />
      <PickDetailsModal
        pick={page.selectedPick}
        isOpen={page.isOpen}
        onClose={page.close}
        onApprove={wrapModalAction(page.handleApprove, page.close)}
        onReject={wrapModalAction(page.handleReject, page.close)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">PicksHQ</h1>
        <p className="text-muted-foreground">
          Advanced pick filtering, analytics, and approval workflow
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-12 h-12 text-yellow-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Backend Unavailable</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            Unable to load picks data. This typically means the Supabase backend is not connected.
            Picks will appear here once the database connection is established.
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function PageHeader({ onRefresh, onExport }: { onRefresh: () => void; onExport: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold text-foreground">PicksHQ</h1>
        <p className="text-muted-foreground">
          Advanced pick filtering, analytics, and approval workflow
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: DynamicStat[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map(stat => (
        <Card key={stat.title} className="metric-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{stat.change}</span>
              <span>from last week</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
