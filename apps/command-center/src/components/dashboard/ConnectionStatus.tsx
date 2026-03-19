'use client';

import { Wifi, WifiOff } from 'lucide-react';

import { usePipelineDashboard } from '@/hooks/useDashboardData';
import { cn } from '@/lib/utils';

/** Thin top-bar indicator showing live backend connectivity.
 * UTRP-R4 DEFECT-22: Shows "Disconnected" only after ≥3 consecutive poll failures (≥45s).
 * Shows "Reconnecting…" during the grace window (1-2 failures). */
export function ConnectionStatus() {
  const { isDisconnected, isChecking, isFetching, lastKnownGood } = usePipelineDashboard();

  const label = isDisconnected
    ? lastKnownGood
      ? `Disconnected · ${new Date(lastKnownGood).toLocaleTimeString()}`
      : 'Disconnected'
    : isChecking
      ? 'Reconnecting…'
      : 'Live';

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest',
        isDisconnected ? 'text-red-400' : isChecking ? 'text-yellow-400' : 'text-emerald-400'
      )}
    >
      {isDisconnected ? (
        <WifiOff className="h-3 w-3" />
      ) : (
        <Wifi className={cn('h-3 w-3', (isFetching || isChecking) && 'animate-pulse')} />
      )}
      {label}
    </div>
  );
}
