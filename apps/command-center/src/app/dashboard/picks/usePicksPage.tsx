import { Target, Clock, TrendingUp, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

import type { Pick } from '@/hooks/usePicks';
import type { ComponentType } from 'react';

import { usePicks } from '@/hooks/usePicks';
import { formatCurrency } from '@/lib/utils';

export type { Pick } from '@/hooks/usePicks';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PicksPageFilters {
  selectedTab: string;
  setSelectedTab: (v: string) => void;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  selectedSport: string;
  setSelectedSport: (v: string) => void;
  selectedTier: string;
  setSelectedTier: (v: string) => void;
  selectedStatus: string;
  setSelectedStatus: (v: string) => void;
  selectedLifecycleStage: string;
  setSelectedLifecycleStage: (v: string) => void;
  clearAll: () => void;
}

export interface DynamicStat {
  title: string;
  value: string;
  change: string;
  icon: ComponentType<{ className?: string }>;
}

/* ------------------------------------------------------------------ */
/*  Pure helpers (outside hooks — no line-count pressure)              */
/* ------------------------------------------------------------------ */

function matchesSearch(pick: Pick, term: string): boolean {
  if (!term) return true;
  const t = term.toLowerCase();
  const p = (pick.player_name || pick.line || '').toLowerCase().includes(t);
  return p || pick.capper.toLowerCase().includes(t);
}

function applyFilters(
  picks: Pick[],
  f: { tab: string; sport: string; tier: string; status: string; search: string }
): Pick[] {
  return picks.filter(
    p =>
      (f.tab === 'all' || p.status === f.tab) &&
      (f.sport === 'all' || p.sport === f.sport) &&
      (f.tier === 'all' || p.tier === f.tier) &&
      (f.status === 'all' || p.status === f.status) &&
      matchesSearch(p, f.search)
  );
}

function buildStats(
  s: { totalPicks: number; pendingReview: number; avgEvScore: number; totalRoi: number },
  loading: boolean
): DynamicStat[] {
  return [
    {
      title: 'Total Picks',
      value: loading ? '...' : s.totalPicks.toLocaleString(),
      change: '+12.5%',
      icon: Target,
    },
    {
      title: 'Pending Review',
      value: loading ? '...' : s.pendingReview.toString(),
      change: '-8.3%',
      icon: Clock,
    },
    {
      title: 'Avg EV Score',
      value: loading ? '...' : s.avgEvScore.toFixed(1),
      change: '+1.1',
      icon: TrendingUp,
    },
    {
      title: 'Total ROI',
      value: loading ? '...' : formatCurrency(s.totalRoi),
      change: '+18.9%',
      icon: DollarSign,
    },
  ];
}

async function doApprove(
  pickId: string,
  fn: (id: string) => Promise<{ success: boolean }>,
  setLoading: (id: string | null) => void
): Promise<boolean> {
  setLoading(pickId);
  const r = await fn(pickId);
  if (r.success) {
    toast.success('Pick approved', {
      description: 'The pick has been approved and is now live.',
      icon: <CheckCircle className="w-4 h-4" />,
    });
  } else {
    toast.error('Failed to approve pick', {
      description: (r as any).error?.message || 'Please try again.',
    });
  }
  setLoading(null);
  return r.success;
}

async function doReject(
  pickId: string,
  fn: (id: string) => Promise<{ success: boolean }>,
  setLoading: (id: string | null) => void
): Promise<boolean> {
  setLoading(pickId);
  const r = await fn(pickId);
  if (r.success) {
    toast.success('Pick rejected', {
      description: 'The pick has been rejected.',
      icon: <XCircle className="w-4 h-4" />,
    });
  } else {
    toast.error('Failed to reject pick', {
      description: (r as any).error?.message || 'Please try again.',
    });
  }
  setLoading(null);
  return r.success;
}

function exportPicksData(filteredPicks: Pick[]) {
  const rows = filteredPicks.map(
    p =>
      `${p.capper},${p.sport},${p.player_name || p.line},${p.line},${p.odds},${p.tier},${p.ev_score},${p.confidence}%,${p.status},${p.roi || ''},${new Date(p.submitted_at).toLocaleDateString()}`
  );
  const csv = [
    'Capper,Sport,Player,Line,Odds,Tier,EV Score,Confidence,Status,ROI,Submitted',
    ...rows,
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `picks-export-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/*  Sub-hook: filter state                                             */
/* ------------------------------------------------------------------ */

function usePicksFilters(): PicksPageFilters {
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedLifecycleStage, setSelectedLifecycleStage] = useState('all');
  const clearAll = useCallback(() => {
    setSearchTerm('');
    setSelectedSport('all');
    setSelectedTier('all');
    setSelectedStatus('all');
    setSelectedLifecycleStage('all');
    setSelectedTab('all');
  }, []);
  return {
    selectedTab,
    setSelectedTab,
    searchTerm,
    setSearchTerm,
    selectedSport,
    setSelectedSport,
    selectedTier,
    setSelectedTier,
    selectedStatus,
    setSelectedStatus,
    selectedLifecycleStage,
    setSelectedLifecycleStage,
    clearAll,
  };
}

/* ------------------------------------------------------------------ */
/*  Sub-hook: pick actions (approve / reject)                          */
/* ------------------------------------------------------------------ */

function usePicksActions(
  approvePick: (id: string) => Promise<{ success: boolean }>,
  rejectPick: (id: string) => Promise<{ success: boolean }>
) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const handleApprove = useCallback(
    (id: string) => doApprove(id, approvePick, setActionLoading),
    [approvePick]
  );
  const handleReject = useCallback(
    (id: string) => doReject(id, rejectPick, setActionLoading),
    [rejectPick]
  );
  return { actionLoading, handleApprove, handleReject };
}

/* ------------------------------------------------------------------ */
/*  Sub-hook: modal state                                              */
/* ------------------------------------------------------------------ */

function usePicksModal() {
  const [selectedPick, setSelectedPick] = useState<Pick | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const show = useCallback((pick: Pick) => {
    setSelectedPick(pick);
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedPick(null);
  }, []);
  return { selectedPick, isOpen, show, close };
}

/* ------------------------------------------------------------------ */
/*  Sub-hook: batch selection + bulk action                            */
/*  SPRINT-082-LAYER3-PHASE11-CC-BATCH-PICK-OPERATIONS                */
/* ------------------------------------------------------------------ */

export type BatchAction = 'promote' | 'reject' | 'requeue';

async function doBatchAction(
  selectedIds: Set<string>,
  action: BatchAction,
  setLoading: (v: boolean) => void,
  clearSelection: () => void,
  refresh: () => void
) {
  if (selectedIds.size === 0) return;
  setLoading(true);
  try {
    const res = await fetch('/api/picks/batch-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickIds: [...selectedIds], action }),
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { succeeded: string[]; failed: { id: string; error: string }[] };
      error?: string;
    };
    if (json.success && json.data) {
      const { succeeded, failed } = json.data;
      toast.success(`Batch ${action}: ${succeeded.length} succeeded`, {
        description: failed.length > 0 ? `${failed.length} failed — see console` : undefined,
      });
      if (failed.length > 0) {
        console.warn('[BatchAction] failed picks:', failed);
      }
    } else {
      toast.error('Batch action failed', { description: json.error ?? 'Unknown error' });
    }
    clearSelection();
    refresh();
  } catch (err) {
    toast.error('Batch action error', {
      description: err instanceof Error ? err.message : 'Network error',
    });
  } finally {
    setLoading(false);
  }
}

function usePicksBatchSelection(refreshPicks: () => void) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchAction = useCallback(
    (action: BatchAction) =>
      doBatchAction(selectedIds, action, setBatchLoading, clearSelection, refreshPicks),
    [selectedIds, clearSelection, refreshPicks]
  );

  return { selectedIds, toggleSelect, selectAll, clearSelection, batchLoading, handleBatchAction };
}

/* ------------------------------------------------------------------ */
/*  Main hook                                                          */
/* ------------------------------------------------------------------ */

export function usePicksPage() {
  const { picks, stats, loading, error, approvePick, rejectPick, refreshPicks } = usePicks();
  const filters = usePicksFilters();
  const actions = usePicksActions(approvePick, rejectPick);
  const modal = usePicksModal();
  const batch = usePicksBatchSelection(refreshPicks);
  const filteredPicks = applyFilters(picks, {
    tab: filters.selectedTab,
    sport: filters.selectedSport,
    tier: filters.selectedTier,
    status: filters.selectedStatus,
    search: filters.searchTerm,
  });
  const dynamicStats = buildStats(stats, loading);
  const handleExport = useCallback(() => exportPicksData(filteredPicks), [filteredPicks]);
  return {
    picks,
    loading,
    error,
    refreshPicks,
    filteredPicks,
    dynamicStats,
    filters,
    ...actions,
    ...modal,
    ...batch,
    handleExport,
  };
}
