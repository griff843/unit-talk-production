'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineHealthData {
  total_picks_24h: number;
  system_picks_24h: number;
  manual_picks_24h: number;
  writer_audit_percentage: number;
  status: string;
  last_updated: string;
}

export interface DataFreshness {
  status: 'fresh' | 'stale' | 'critical';
  lastIngestion: string | null;
  minutesSinceLastIngestion: number | null;
  statusText: string;
}

export interface ProviderHealth {
  dataFreshness: DataFreshness;
}

// ---------------------------------------------------------------------------
// Fetch helpers (kept tiny for lint)
// ---------------------------------------------------------------------------

async function fetchPipelineHealth(): Promise<PipelineHealthData> {
  const res = await fetch('/api/pipeline/health');
  if (!res.ok) throw new Error(`Pipeline health: ${res.status}`);
  return res.json();
}

async function fetchProviderHealth(): Promise<ProviderHealth | null> {
  const res = await fetch('/api/health/provider', {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePipelineDashboard() {
  return useQuery({
    queryKey: ['pipeline-health'],
    queryFn: fetchPipelineHealth,
    refetchInterval: 15_000,
    retry: 2,
  });
}

export function useProviderFreshness() {
  return useQuery({
    queryKey: ['provider-health'],
    queryFn: fetchProviderHealth,
    refetchInterval: 15_000,
    retry: 1,
  });
}

export function useInvalidateCache() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/invalidate-cache', { method: 'POST' });
      if (!res.ok) throw new Error(`Cache invalidation failed: ${res.status}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipeline-health'] });
      qc.invalidateQueries({ queryKey: ['provider-health'] });
      toast.success('Cache invalidated');
    },
    onError: (err: Error) => {
      toast.error(`Cache invalidation failed: ${err.message}`);
    },
  });
}
