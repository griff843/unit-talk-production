'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';

import CapperPerformanceWidget from '@/components/dashboard/CapperPerformanceWidget';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DataFreshnessMonitor } from '@/components/dashboard/DataFreshnessMonitor';
import OpsConfidenceWidget from '@/components/dashboard/OpsConfidenceWidget';
import { PipelineHealthCards } from '@/components/dashboard/PipelineHealthCards';
import RecapStatusWidget from '@/components/dashboard/RecapStatusWidget';
import SettlementConsole from '@/components/dashboard/SettlementConsole';
import UnsettledSummaryWidget from '@/components/dashboard/UnsettledSummaryWidget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePipelineDashboard } from '@/hooks/useDashboardData';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('operations');
  const { isError, error } = usePipelineDashboard();

  useKeyboardShortcuts();

  return (
    <div className="space-y-6">
      {isError && <ErrorBanner message={(error as Error)?.message || 'Pipeline unavailable'} />}

      <DashboardHeader />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="operations">Operations</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="operations" className="space-y-4 mt-4">
          <OperationsTab />
        </TabsContent>
        <TabsContent value="pipeline" className="space-y-4 mt-4">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="system" className="space-y-4 mt-4">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab panels (extracted to keep main function under 50 lines)
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-sm">
      <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
      {message}
    </div>
  );
}

function OperationsTab() {
  return (
    <>
      <SettlementConsole />
      <OpsConfidenceWidget />
      <CapperPerformanceWidget />
      <div className="grid gap-4 md:grid-cols-2">
        <UnsettledSummaryWidget />
        <RecapStatusWidget />
      </div>
    </>
  );
}

function PipelineTab() {
  return (
    <>
      <DataFreshnessMonitor />
      <PipelineHealthCards />
    </>
  );
}

function SystemTab() {
  return (
    <>
      <LiveApiEndpoints />
      <SystemInfoCard />
    </>
  );
}

// ---------------------------------------------------------------------------
// Live API Endpoints — fetches real status
// ---------------------------------------------------------------------------

function LiveApiEndpoints() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">API Endpoints</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <EndpointRow name="Pipeline Health" path="/api/pipeline/health" />
        <EndpointRow name="Pipeline Lag" path="/api/pipeline/lag" />
        <EndpointRow name="Recent Promotions" path="/api/pipeline/recent-promotions" />
        <EndpointRow name="Promo Backlog" path="/api/pipeline/promo-backlog" />
      </div>
    </div>
  );
}

function EndpointRow({ name, path }: { name: string; path: string }) {
  const { data, isLoading } = useEndpointCheck(path);
  const ok = data === true;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/10">
      <div>
        <p className="font-medium text-sm">{name}</p>
        <p className="text-xs text-muted-foreground">{path}</p>
      </div>
      <EndpointBadge status={isLoading ? 'loading' : ok ? 'ok' : 'error'} />
    </div>
  );
}

function EndpointBadge({ status }: { status: 'ok' | 'error' | 'loading' }) {
  if (status === 'loading') {
    return <span className="text-xs text-muted-foreground">Checking...</span>;
  }
  const styles =
    status === 'ok'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
      : 'bg-red-500/15 text-red-400 border-red-500/25';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${styles}`}
    >
      {status === 'ok' ? 'Active' : 'Down'}
    </span>
  );
}

function useEndpointCheck(path: string) {
  return useQuery({
    queryKey: ['endpoint-check', path],
    queryFn: async () => {
      try {
        const res = await fetch(path, { method: 'HEAD' });
        return res.ok;
      } catch {
        return false;
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// System Info (dynamic)
// ---------------------------------------------------------------------------

function SystemInfoCard() {
  return (
    <div className="p-4 rounded-lg border bg-muted/10 space-y-2">
      <h3 className="text-sm font-medium">System Information</h3>
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
        <div>
          <p className="text-sm font-medium">Next.js Command Center</p>
          <p className="text-xs text-muted-foreground">
            Environment: {process.env.NODE_ENV} | Build: {new Date().toLocaleDateString()}
          </p>
        </div>
        <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-primary/10 text-primary border-primary/20">
          Production
        </span>
      </div>
    </div>
  );
}
