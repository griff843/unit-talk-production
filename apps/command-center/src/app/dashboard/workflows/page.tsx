'use client';

/**
 * Workflow Registry Dashboard
 * Sprint: SPRINT-060-LAYER3-PHASE11-CC-WORKFLOW-MANAGEMENT
 * Layer: Layer 3 / Phase 11 — Workflow Optimization
 *
 * Surfaces the WorkflowRegistry (18 entries, 6 categories) from
 *   GET /api/ops/workflows → API GET /ops/workflows
 */

import { Activity, GitBranch, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { PermissionGate } from '@/components/PermissionGate';
import { Permission } from '@/lib/rbac';

// ─── Local type definitions ────────────────────────────────────────────────────
// Mirrors apps/api/src/lib/workflow-registry/types.ts — do not import from API

type WorkflowCategory = 'analysis' | 'backfill' | 'feed' | 'health' | 'settlement' | 'ops';
type WorkflowRiskLevel = 'low' | 'medium' | 'high';

interface WorkflowParameter {
  name: string;
  description: string;
  required: boolean;
  type: 'string' | 'number' | 'boolean';
  example?: string;
}

interface WorkflowEntry {
  name: string;
  displayName: string;
  description: string;
  category: WorkflowCategory;
  scriptPath: string;
  riskLevel: WorkflowRiskLevel;
  invocation: string;
  parameters?: WorkflowParameter[];
  requiresDatabase?: boolean;
}

interface WorkflowsResponse {
  workflows: WorkflowEntry[];
  categories: WorkflowCategory[];
  counts: Record<WorkflowCategory, number>;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_BADGE: Record<WorkflowRiskLevel, { label: string; className: string }> = {
  low: {
    label: 'Low',
    className: 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
  },
  medium: {
    label: 'Medium',
    className: 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20',
  },
  high: {
    label: 'High',
    className: 'bg-red-500/10 text-red-600 border border-red-500/20',
  },
};

const CATEGORY_LABELS: Record<WorkflowCategory, string> = {
  analysis: 'Analysis',
  backfill: 'Backfill',
  feed: 'Feed',
  health: 'Health',
  settlement: 'Settlement',
  ops: 'Ops',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskBadge({ level }: { level: WorkflowRiskLevel }) {
  const { label, className } = RISK_BADGE[level];
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function WorkflowRow({ workflow }: { workflow: WorkflowEntry }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4">
        <div className="font-medium text-sm text-foreground">{workflow.displayName}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{workflow.name}</div>
      </td>
      <td className="py-3 px-4 text-sm text-muted-foreground max-w-xs">{workflow.description}</td>
      <td className="py-3 px-4">
        <RiskBadge level={workflow.riskLevel} />
      </td>
      <td className="py-3 px-4">
        <code className="text-xs bg-muted rounded px-1.5 py-0.5 font-mono text-muted-foreground break-all">
          {workflow.invocation}
        </code>
      </td>
    </tr>
  );
}

function CategorySection({
  category,
  workflows,
}: {
  category: WorkflowCategory;
  workflows: WorkflowEntry[];
}) {
  if (workflows.length === 0) return null;
  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5" />
        {CATEGORY_LABELS[category]}
        <span className="text-xs font-normal text-muted-foreground/60">({workflows.length})</span>
      </h3>
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-48">
                Workflow
              </th>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">
                Description
              </th>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground w-20">
                Risk
              </th>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted-foreground">
                Invocation
              </th>
            </tr>
          </thead>
          <tbody>
            {workflows.map(w => (
              <WorkflowRow key={w.name} workflow={w} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const [data, setData] = useState<WorkflowsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/workflows');
      const json: WorkflowsResponse = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `Error ${res.status}`);
        setData(null);
      } else {
        setData(json);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PermissionGate
      permission={Permission.VIEW_DASHBOARD}
      fallback={
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Activity className="h-8 w-8 mb-2" />
          <p className="text-sm">Insufficient permissions to view workflows.</p>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-primary" />
              Workflow Registry
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Registered workflows across the Unit Talk platform
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary stats */}
        {data && (
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span>
              <span className="font-semibold text-foreground">{data.workflows.length}</span>{' '}
              workflows
            </span>
            <span>
              <span className="font-semibold text-foreground">{data.categories.length}</span>{' '}
              categories
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading workflow registry…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
            <span className="font-medium">Failed to load workflows: </span>
            {error}
          </div>
        )}

        {/* Registry grouped by category */}
        {!loading &&
          data &&
          data.categories.map(category => (
            <CategorySection
              key={category}
              category={category}
              workflows={data.workflows.filter(w => w.category === category)}
            />
          ))}
      </div>
    </PermissionGate>
  );
}
