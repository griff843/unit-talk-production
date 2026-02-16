'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Gavel, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';

import {
  ConfirmDialog,
  SettlementToolbar,
  type ConfirmState,
  type SettleOutcome,
  type SortDir,
  type SortField,
  type UnsettledPick,
} from './SettlementParts';
import { Pagination, SettlementTable } from './SettlementTableView';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useUnsettledPicks() {
  return useQuery({
    queryKey: ['settlement', 'unsettled'],
    queryFn: async (): Promise<UnsettledPick[]> => {
      const res = await fetch('/api/settlement?limit=200');
      if (!res.ok) throw new Error(`Settlement fetch: ${res.status}`);
      const json = await res.json();
      return json.picks ?? [];
    },
    refetchInterval: 30_000,
  });
}

function useSettleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pickId, outcome }: { pickId: string; outcome: SettleOutcome }) => {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pick_id: pickId, result: outcome, operator: 'command-center' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Settlement failed');
      return data;
    },
    onSuccess: (_data, { outcome }) => {
      toast.success(`Pick settled as ${outcome.toUpperCase()}`);
      qc.invalidateQueries({ queryKey: ['settlement'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Sorting & filtering helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

function sortPicks(picks: UnsettledPick[], field: SortField, dir: SortDir) {
  return [...picks].sort((a, b) => {
    // eslint-disable-next-line security/detect-object-injection
    const av = a[field] ?? '';
    // eslint-disable-next-line security/detect-object-injection
    const bv = b[field] ?? '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
    return dir === 'asc' ? cmp : -cmp;
  });
}

function filterPicks(picks: UnsettledPick[], search: string, sport: string) {
  return picks.filter(p => {
    if (sport && sport !== 'all' && p.sport !== sport) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (p.player_name || '').toLowerCase().includes(q) ||
      (p.stat_type || '').toLowerCase().includes(q)
    );
  });
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
export default function SettlementConsole() {
  const { data: picks = [], isLoading, isError, error, refetch } = useUnsettledPicks();
  const settleMut = useSettleMutation();

  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const sports = useMemo(
    () => [...new Set(picks.map(p => p.sport).filter(Boolean))].sort(),
    [picks]
  );

  const filtered = useMemo(
    () => filterPicks(picks, search, sportFilter),
    [picks, search, sportFilter]
  );
  const sorted = useMemo(
    () => sortPicks(filtered, sortField, sortDir),
    [filtered, sortField, sortDir]
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = useCallback(
    (field: SortField) => {
      setSortDir(d => (sortField === field ? (d === 'asc' ? 'desc' : 'asc') : 'desc'));
      setSortField(field);
    },
    [sortField]
  );

  const requestSettle = (pick: UnsettledPick, outcome: SettleOutcome) => {
    setConfirm({ pick, outcome });
  };

  const confirmSettle = () => {
    if (!confirm) return;
    settleMut.mutate(
      { pickId: confirm.pick.id, outcome: confirm.outcome },
      { onSettled: () => setConfirm(null) }
    );
  };

  if (isError) {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Gavel className="h-4 w-4 mr-2" />
            Settlement Console
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 w-7 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>{(error as Error)?.message || 'Failed to load'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ConfirmDialog
        state={confirm}
        onConfirm={confirmSettle}
        onCancel={() => setConfirm(null)}
        isPending={settleMut.isPending}
      />
      <Card id="settlement">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Gavel className="h-4 w-4 mr-2" />
            Settlement Console
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-7 w-7 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <SettlementToolbar
            search={search}
            setSearch={setSearch}
            sportFilter={sportFilter}
            setSportFilter={setSportFilter}
            sports={sports}
            count={picks.length}
          />
          <SettlementTable
            picks={paged}
            sortField={sortField}
            sortDir={sortDir}
            onSort={toggleSort}
            onSettle={requestSettle}
            isPending={settleMut.isPending}
            isLoading={isLoading}
          />
          <Pagination page={page} pageCount={pageCount} setPage={setPage} total={sorted.length} />
        </CardContent>
      </Card>
    </>
  );
}
