'use client';

/**
 * Capper Performance Dashboard
 *
 * SPRINT-075-LAYER3-PHASE10-CC-CAPPER-DASHBOARD
 * Layer/Phase: Layer 3 / Phase 10 — Command Center UX
 *
 * Displays per-capper rolling performance stats: picks, win rate, ROI, streak.
 * Data sourced via /api/capper-performance (CC proxy → API /api/cappers).
 */

import { useCallback, useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapperStats {
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  units_wagered: number;
  units_profit: number;
  win_rate: number;
  roi: number;
}

interface CapperStreak {
  type: 'win' | 'loss' | null;
  length: number;
}

interface CapperSummary {
  capper_id: string;
  username: string;
  tier: string;
  active: boolean;
  rolling_window_days: number;
  stats: CapperStats;
  streak: CapperStreak | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  S: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  A: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  B: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  C: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function TierBadge({ tier }: { tier: string }) {
  const cls = TIER_COLORS[tier] ?? TIER_COLORS['C'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {tier}
    </span>
  );
}

function StreakBadge({ streak }: { streak: CapperStreak | null }) {
  if (!streak || !streak.length) return <span className="text-muted-foreground text-xs">—</span>;
  const isWin = streak.type === 'win';
  const cls = isWin ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return (
    <span className={`text-sm font-medium ${cls}`}>
      {isWin ? 'W' : 'L'}
      {streak.length}
    </span>
  );
}

function RoiCell({ roi }: { roi: number }) {
  if (roi > 0)
    return <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{roi}%</span>;
  if (roi < 0) return <span className="text-red-600 dark:text-red-400 font-medium">{roi}%</span>;
  return <span className="text-muted-foreground">0%</span>;
}

type SortKey = 'username' | 'tier' | 'picks' | 'win_rate' | 'roi';

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CapperDashboard() {
  const [cappers, setCappers] = useState<CapperSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [window, setWindow] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>('roi');
  const [sortDesc, setSortDesc] = useState(true);

  const fetchCappers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/capper-performance?window=${window}`);
      if (res.status === 401) {
        setError('Unauthorized — operator login required');
        return;
      }
      if (!res.ok) {
        setError(`Upstream error (${res.status})`);
        return;
      }
      const json = await res.json();
      setCappers(json.data ?? []);
    } catch {
      setError('Failed to fetch capper data');
    } finally {
      setLoading(false);
    }
  }, [window]);

  useEffect(() => {
    fetchCappers();
  }, [fetchCappers]);

  const sorted = [...cappers].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case 'username':
        av = a.username;
        bv = b.username;
        break;
      case 'tier':
        av = a.tier;
        bv = b.tier;
        break;
      case 'picks':
        av = a.stats.picks;
        bv = b.stats.picks;
        break;
      case 'win_rate':
        av = a.stats.win_rate;
        bv = b.stats.win_rate;
        break;
      case 'roi':
        av = a.stats.roi;
        bv = b.stats.roi;
        break;
      default:
        av = 0;
        bv = 0;
    }
    if (typeof av === 'string' && typeof bv === 'string') {
      return sortDesc ? bv.localeCompare(av) : av.localeCompare(bv);
    }
    return sortDesc ? (bv as number) - (av as number) : (av as number) - (bv as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDesc(d => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-muted-foreground/40 ml-1">↕</span>;
    return <span className="ml-1">{sortDesc ? '↓' : '↑'}</span>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Capper Performance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Rolling {window}-day stats: win rate, ROI, streak
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Window selector */}
          <span className="text-sm text-muted-foreground">Window:</span>
          {[7, 10, 30].map(d => (
            <button
              key={d}
              onClick={() => setWindow(d)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                window === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent/40 text-muted-foreground hover:bg-accent/60'
              }`}
            >
              {d}d
            </button>
          ))}
          <button
            onClick={fetchCappers}
            className="ml-2 px-3 py-1.5 rounded text-sm bg-accent/40 hover:bg-accent/60 transition-colors"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sorted.length === 0 && (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground">No active cappers found for this window.</p>
        </div>
      )}

      {/* Table */}
      {!loading && !error && sorted.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <Th
                  col="username"
                  label="Capper"
                  onSort={toggleSort}
                  indicator={<SortIndicator col="username" />}
                />
                <Th
                  col="tier"
                  label="Tier"
                  onSort={toggleSort}
                  indicator={<SortIndicator col="tier" />}
                />
                <Th
                  col="picks"
                  label="Picks"
                  onSort={toggleSort}
                  indicator={<SortIndicator col="picks" />}
                />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">W/L/P</th>
                <Th
                  col="win_rate"
                  label="Win%"
                  onSort={toggleSort}
                  indicator={<SortIndicator col="win_rate" />}
                />
                <Th
                  col="roi"
                  label="ROI"
                  onSort={toggleSort}
                  indicator={<SortIndicator col="roi" />}
                />
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Streak</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr
                  key={c.capper_id}
                  className={`border-t border-border transition-colors hover:bg-accent/20 ${
                    i % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                  }`}
                >
                  <td className="px-4 py-3 font-medium">{c.username}</td>
                  <td className="px-4 py-3">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.stats.picks}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {c.stats.wins}/{c.stats.losses}/{c.stats.pushes}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c.stats.win_rate}%</td>
                  <td className="px-4 py-3 tabular-nums">
                    <RoiCell roi={c.stats.roi} />
                  </td>
                  <td className="px-4 py-3">
                    <StreakBadge streak={c.streak} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      {!loading && sorted.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {sorted.length} cappers · {window}-day rolling window
        </p>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────────────────────────

function Th({
  col,
  label,
  onSort,
  indicator,
}: {
  col: SortKey;
  label: string;
  onSort: (k: SortKey) => void;
  indicator: React.ReactNode;
}) {
  return (
    <th
      className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground"
      onClick={() => onSort(col)}
    >
      {label}
      {indicator}
    </th>
  );
}
