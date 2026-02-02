'use client';

import { Activity, Target, Bot, Eye } from 'lucide-react';

import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePipelineDashboard } from '@/hooks/useDashboardData';

/** 4-up metric cards for 24h pipeline stats. */
export function PipelineHealthCards() {
  const { data, isLoading, isError } = usePipelineDashboard();

  if (isLoading) return <HealthCardsLoading />;
  if (isError || !data) return <HealthCardsError />;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Picks (24h)"
        value={data.total_picks_24h.toLocaleString()}
        description="All picks processed in last 24 hours"
        icon={<Target className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="System Picks"
        value={data.system_picks_24h.toLocaleString()}
        description="Automated system picks"
        icon={<Bot className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="Manual Picks"
        value={data.manual_picks_24h.toLocaleString()}
        description="Manually submitted picks"
        icon={<Eye className="h-4 w-4 text-muted-foreground" />}
      />
      <StatusCard status={data.status} />
    </div>
  );
}

// ---- Sub-components (keep main function under 50 lines) ----

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}

function MetricCard({ title, value, description, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

function StatusCard({ status }: { status: string }) {
  const isHealthy = status === 'healthy';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">System Health</CardTitle>
        <Activity className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <Badge variant={isHealthy ? 'default' : 'destructive'} className="text-sm">
          {status.toUpperCase()}
        </Badge>
        <p className="text-xs text-muted-foreground mt-1">Overall pipeline status</p>
      </CardContent>
    </Card>
  );
}

function HealthCardsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loading...</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 rounded bg-muted animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function HealthCardsError() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Picks (24h)"
        value="—"
        description="Backend unavailable"
        icon={<Target className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="System Picks"
        value="—"
        description="Backend unavailable"
        icon={<Bot className="h-4 w-4 text-muted-foreground" />}
      />
      <MetricCard
        title="Manual Picks"
        value="—"
        description="Backend unavailable"
        icon={<Eye className="h-4 w-4 text-muted-foreground" />}
      />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">System Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <Badge variant="destructive" className="text-sm">
            DISCONNECTED
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">Pipeline API unreachable</p>
        </CardContent>
      </Card>
    </div>
  );
}
