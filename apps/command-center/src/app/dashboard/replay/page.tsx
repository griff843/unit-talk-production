'use client';

import { AlertTriangle, CheckCircle, Play, RefreshCw, XCircle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// ============================================================================
// Types
// ============================================================================

type ReplayAction = 'rerun-grading' | 'reemit-alerts' | 'preview';
type TimeRange = '1h' | '6h' | '24h' | 'custom';

interface ReplayCriteria {
  timeRange: TimeRange;
  reason: string;
  dryRun: boolean;
  batchSize: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
  customStart?: string;
  customEnd?: string;
}

interface ReplayResult {
  replayId: string;
  success: boolean;
  message: string;
  eventCount: number;
  estimatedDuration?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60000)}m`;
}

// ============================================================================
// Component
// ============================================================================

export default function ReplayPage() {
  const [action, setAction] = useState<ReplayAction>('preview');
  const [criteria, setCriteria] = useState<ReplayCriteria>({
    timeRange: '1h',
    reason: '',
    dryRun: false,
    batchSize: 5,
    priority: 'normal',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reasonValid = criteria.reason.trim().length >= 10;

  async function handleSubmit() {
    if (!reasonValid) {
      toast.error('Reason must be at least 10 characters');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, criteria }),
      });

      const data = await response.json();

      if (response.status === 503) {
        setError('Replay feature is not enabled in this environment.');
        return;
      }

      if (!response.ok) {
        setError(data.error || `Request failed (${response.status})`);
        return;
      }

      setResult(data);
      toast.success(data.message || 'Replay initiated');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Replay Operations</h1>
        <p className="text-muted-foreground mt-1">
          Re-trigger grading or alert workflows for historical events. Requires{' '}
          <code className="text-xs">REPLAY_WORKFLOWS</code> permission.
        </p>
      </div>

      {/* Config card */}
      <Card>
        <CardHeader>
          <CardTitle>Replay Configuration</CardTitle>
          <CardDescription>
            Select an action, time window, and provide a reason before triggering.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Action */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action</label>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { value: 'preview', label: 'Preview (read-only)' },
                  { value: 'rerun-grading', label: 'Re-run Grading' },
                  { value: 'reemit-alerts', label: 'Re-emit Alerts' },
                ] as const
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAction(opt.value)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    action === opt.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time range */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Time Range</label>
            <div className="flex gap-2 flex-wrap">
              {(['1h', '6h', '24h', 'custom'] as TimeRange[]).map(t => (
                <button
                  key={t}
                  onClick={() => setCriteria(c => ({ ...c, timeRange: t }))}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    criteria.timeRange === t
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-accent'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Custom time range */}
          {criteria.timeRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Start (ISO 8601)</label>
                <input
                  type="text"
                  placeholder="2026-03-15T00:00:00Z"
                  value={criteria.customStart ?? ''}
                  onChange={e => setCriteria(c => ({ ...c, customStart: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">End (ISO 8601)</label>
                <input
                  type="text"
                  placeholder="2026-03-15T23:59:59Z"
                  value={criteria.customEnd ?? ''}
                  onChange={e => setCriteria(c => ({ ...c, customEnd: e.target.value }))}
                  className="w-full rounded-md border px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          )}

          {/* Batch size + priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Batch Size</label>
              <input
                type="number"
                min={1}
                max={50}
                value={criteria.batchSize}
                onChange={e =>
                  setCriteria(c => ({ ...c, batchSize: Math.max(1, Number(e.target.value)) }))
                }
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Priority</label>
              <select
                value={criteria.priority}
                onChange={e =>
                  setCriteria(c => ({
                    ...c,
                    priority: e.target.value as ReplayCriteria['priority'],
                  }))
                }
                className="w-full rounded-md border px-3 py-1.5 text-sm"
              >
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason <span className="text-muted-foreground font-normal">(min 10 characters)</span>
            </label>
            <textarea
              rows={3}
              placeholder="Explain why this replay is necessary…"
              value={criteria.reason}
              onChange={e => setCriteria(c => ({ ...c, reason: e.target.value }))}
              className={`w-full rounded-md border px-3 py-2 text-sm resize-none ${
                criteria.reason.length > 0 && !reasonValid ? 'border-destructive' : ''
              }`}
            />
            {criteria.reason.length > 0 && !reasonValid && (
              <p className="text-xs text-destructive">
                At least 10 characters required ({criteria.reason.trim().length} / 10)
              </p>
            )}
          </div>

          {/* Dry run toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dry-run"
              checked={criteria.dryRun}
              onChange={e => setCriteria(c => ({ ...c, dryRun: e.target.checked }))}
              className="h-4 w-4 rounded border"
            />
            <label htmlFor="dry-run" className="text-sm font-medium cursor-pointer">
              Dry run (preview only — no events will be created)
            </label>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleSubmit} disabled={loading || !reasonValid} className="gap-2">
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {loading ? 'Triggering…' : 'Trigger Replay'}
            </Button>
            {(result || error) && (
              <Button variant="ghost" onClick={handleReset}>
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-start gap-3 pt-5">
            <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm">Replay Failed</p>
              <p className="text-sm text-muted-foreground mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result state */}
      {result && (
        <Card className={result.success ? 'border-green-500/50' : 'border-amber-500/50'}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <CardTitle className="text-base">
                {result.success ? 'Replay Initiated' : 'No Events Found'}
              </CardTitle>
              <Badge variant={result.success ? 'default' : 'secondary'}>
                {result.replayId || 'preview'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{result.message}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                  Events
                </p>
                <p className="text-2xl font-bold tabular-nums">{result.eventCount}</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium mb-1">
                  Est. Duration
                </p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatDuration(result.estimatedDuration)}
                </p>
              </div>
            </div>
            {result.replayId && result.success && action !== 'preview' && (
              <p className="text-xs text-muted-foreground">
                Monitor workflow status at{' '}
                <code className="bg-muted px-1 rounded">/api/temporal/workflows</code> using
                workflow ID <code className="bg-muted px-1 rounded">{result.replayId}</code>.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
