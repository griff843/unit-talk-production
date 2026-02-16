'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Settings } from 'lucide-react';

import { ConnectionStatus } from './ConnectionStatus';

import { Button } from '@/components/ui/button';
import { useInvalidateCache, usePipelineDashboard } from '@/hooks/useDashboardData';

export function DashboardHeader() {
  const { isFetching } = usePipelineDashboard();
  const invalidateCache = useInvalidateCache();
  const qc = useQueryClient();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pipeline-health'] });
    qc.invalidateQueries({ queryKey: ['provider-health'] });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Command Center</h1>
          <ConnectionStatus />
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time pipeline monitoring and system health
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => invalidateCache.mutate()}
          disabled={invalidateCache.isPending}
        >
          <Settings className="h-4 w-4 mr-1.5" />
          Clear Cache
        </Button>
      </div>
    </div>
  );
}
