'use client';

/**
 * Recap Dashboard
 * Sprint: SPRINT-080-LAYER3-PHASE10-CC-RECAP-DASHBOARD
 * Layer: Layer 3 / Phase 10 — Command Center UX
 *
 * Lets operators generate daily/weekly/monthly recap summaries via
 * POST /api/ops-recap. Displays headline stats + PROMOTE/DEMOTE/HOLD decision.
 */

import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'daily' | 'weekly' | 'monthly';
type DecisionType = 'PROMOTE' | 'DEMOTE' | 'HOLD';

interface RecapHeadline {
  total_settled: number;
  wins: number;
  losses: number;
  win_rate: number;
}

interface RecapDecision {
  decision: DecisionType;
  reasons: string[];
}

interface RecapResult {
  success: boolean;
  mode: Mode;
  date_range: { start: string; end: string };
  summary: {
    headline: RecapHeadline;
    decision: RecapDecision;
  };
  timestamp: string;
  error?: string;
}

// ─── Decision meta ────────────────────────────────────────────────────────────

const DECISION_META: Record<DecisionType, { color: string }> = {
  PROMOTE: { color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  DEMOTE: { color: 'text-red-700 bg-red-50 border-red-200' },
  HOLD: { color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
};

const MODES: Mode[] = ['daily', 'weekly', 'monthly'];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RecapsDashboardPage() {
  const [mode, setMode] = useState<Mode>('daily');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecapResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generateRecap() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ops-recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const data = (await res.json()) as RecapResult;
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate recap');
      } else {
        setResult(data);
      }
    } catch {
      setError('Network error — check API connection');
    } finally {
      setLoading(false);
    }
  }

  const decision = result?.summary.decision.decision;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Recaps</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate performance summaries and promotion decisions for a time window.
        </p>
      </div>

      {/* Mode selector + trigger */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-md border border-border overflow-hidden">
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-accent/50'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={generateRecap}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate Recap'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results */}
      {result && decision && (
        <div className="space-y-4">
          {/* Date range + timestamp */}
          <p className="text-xs text-muted-foreground">
            {result.date_range.start} → {result.date_range.end} &middot; Generated{' '}
            {new Date(result.timestamp).toLocaleTimeString()}
          </p>

          {/* Headline stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Settled', value: String(result.summary.headline.total_settled) },
              { label: 'Wins', value: String(result.summary.headline.wins) },
              { label: 'Losses', value: String(result.summary.headline.losses) },
              {
                label: 'Win Rate',
                value: `${(result.summary.headline.win_rate * 100).toFixed(1)}%`,
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
              </div>
            ))}
          </div>

          {/* Decision card */}
          <div className={`rounded-lg border p-5 ${DECISION_META[decision].color}`}>
            <p className="text-lg font-semibold">Decision: {decision}</p>
            <ul className="mt-2 space-y-1">
              {result.summary.decision.reasons.map((reason, i) => (
                <li key={i} className="text-sm opacity-80">
                  &bull; {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
