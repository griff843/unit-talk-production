'use client';

import { Wifi, WifiOff } from 'lucide-react';

import { usePipelineDashboard } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

/** Thin top-bar indicator showing live backend connectivity. */
export function ConnectionStatus() {
  const { isError, isFetching } = usePipelineDashboard();

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest',
        isError ? 'text-red-400' : 'text-emerald-400'
      )}
    >
      {isError ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <Wifi className={cn('h-3 w-3', isFetching && 'animate-pulse')} />
      )}
      {isError ? 'Disconnected' : 'Live'}
    </div>
  );
}
