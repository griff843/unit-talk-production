'use client';

import { Clock } from 'lucide-react';

import type { DataFreshness } from '@/hooks/useDashboardData';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProviderFreshness } from '@/hooks/useDashboardData';

const STATUS_STYLES: Record<DataFreshness['status'], string> = {
  fresh: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  stale: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  critical: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const STATUS_LABELS: Record<DataFreshness['status'], string> = {
  fresh: 'FRESH',
  stale: 'STALE',
  critical: 'CRITICAL',
};

export function DataFreshnessMonitor() {
  const { data } = useProviderFreshness();
  const freshness = data?.dataFreshness;
  if (!freshness) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Data Freshness</CardTitle>
        <Clock className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Badge className={STATUS_STYLES[freshness.status]}>
            {STATUS_LABELS[freshness.status]}
          </Badge>
          <span className="text-sm text-muted-foreground">{freshness.statusText}</span>
        </div>
        <FreshnessDetails freshness={freshness} />
      </CardContent>
    </Card>
  );
}

function FreshnessDetails({ freshness }: { freshness: DataFreshness }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">Last Ingestion</p>
        <p className="text-sm font-medium">
          {freshness.lastIngestion ? new Date(freshness.lastIngestion).toLocaleString() : 'Never'}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Minutes Ago</p>
        <p className="text-sm font-medium">{freshness.minutesSinceLastIngestion ?? 'Unknown'}</p>
      </div>
    </div>
  );
}
