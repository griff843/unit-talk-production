'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { createComponentLogger } from '@/lib/logger';
import { formatDistanceToNow } from 'date-fns';

const log = createComponentLogger('RecentPicksSidebar');

interface RecentPick {
  id: string;
  username: string;
  player_name: string | null;
  sport: string | null;
  market_type: string | null;
  line: number | null;
  side: string;
  odds: number | null;
  status: string;
  created_at: string;
  publish_status: string | null;
  professional_score: number | null;
  devigged_edge: number | null;
}

interface RecentPicksSidebarProps {
  userId?: string;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function RecentPicksSidebar({
  userId,
  limit = 5,
  autoRefresh = true,
  refreshInterval = 30000, // 30 seconds
}: RecentPicksSidebarProps) {
  const [picks, setPicks] = useState<RecentPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRecentPicks();

    if (autoRefresh) {
      const interval = setInterval(fetchRecentPicks, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [userId, limit, autoRefresh, refreshInterval]);

  async function fetchRecentPicks() {
    try {
      const supabase = createClient();

      let query = supabase
        .from('vw_recent_picks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Filter by user if specified
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(queryError.message);
      }

      setPicks(data || []);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load recent picks';
      log.error({ error: message }, 'Failed to fetch recent picks');
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <Spinner />
          <span className="ml-2 text-sm text-muted-foreground">Loading recent picks...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-destructive">
        <div className="text-sm text-destructive">
          <p className="font-semibold">Error loading picks</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      </Card>
    );
  }

  if (picks.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground text-center">
          <p>No recent picks</p>
          <p className="mt-1 text-xs">Submitted picks will appear here</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Picks</h3>
        <Badge variant="outline" className="text-xs">
          {picks.length} {picks.length === 1 ? 'pick' : 'picks'}
        </Badge>
      </div>

      <div className="space-y-3">
        {picks.map((pick) => (
          <PickCard key={pick.id} pick={pick} />
        ))}
      </div>

      {autoRefresh && (
        <div className="mt-4 text-xs text-muted-foreground text-center">
          Auto-refreshing every {refreshInterval / 1000}s
        </div>
      )}
    </Card>
  );
}

function PickCard({ pick }: { pick: RecentPick }) {
  const timeAgo = formatDistanceToNow(new Date(pick.created_at), { addSuffix: true });

  return (
    <div className="rounded-lg border p-3 hover:bg-accent/50 transition-colors">
      {/* Header: Capper and Sport */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {pick.username}
          </span>
          {pick.sport && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {pick.sport}
            </Badge>
          )}
        </div>
        <PickStatusBadge status={pick.status} publishStatus={pick.publish_status} />
      </div>

      {/* Pick Details */}
      <div className="space-y-1">
        {pick.player_name && (
          <p className="text-sm font-medium">{pick.player_name}</p>
        )}

        {pick.market_type && pick.line !== null && (
          <p className="text-xs text-muted-foreground">
            {pick.market_type} {pick.side === 'over' ? 'O' : 'U'} {pick.line}
          </p>
        )}

        {pick.odds && (
          <p className="text-xs text-muted-foreground">
            Odds: {pick.odds > 0 ? '+' : ''}{pick.odds}
          </p>
        )}
      </div>

      {/* Professional Grading (if available) */}
      {pick.professional_score !== null && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">Score:</span>
            <span className="font-semibold text-primary">
              {pick.professional_score.toFixed(1)}
            </span>
          </div>
          {pick.devigged_edge !== null && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Edge:</span>
              <span className={`font-semibold ${pick.devigged_edge > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pick.devigged_edge > 0 ? '+' : ''}{(pick.devigged_edge * 100).toFixed(2)}%
              </span>
            </div>
          )}
        </div>
      )}

      {/* Footer: Timestamp */}
      <div className="mt-2 text-xs text-muted-foreground">
        {timeAgo}
      </div>
    </div>
  );
}

function PickStatusBadge({
  status,
  publishStatus
}: {
  status: string;
  publishStatus: string | null;
}) {
  // Determine badge variant and text based on status
  let variant: 'default' | 'secondary' | 'success' | 'destructive' | 'outline' = 'outline';
  let text = status;

  if (publishStatus === 'sent') {
    variant = 'success';
    text = 'Published';
  } else if (publishStatus === 'pending' || publishStatus === 'queued') {
    variant = 'secondary';
    text = 'Queued';
  } else if (status === 'approved') {
    variant = 'default';
    text = 'Approved';
  } else if (status === 'pending') {
    variant = 'secondary';
    text = 'Pending';
  } else if (status === 'rejected') {
    variant = 'destructive';
    text = 'Rejected';
  }

  return (
    <Badge variant={variant} className="text-xs px-2 py-0.5">
      {text}
    </Badge>
  );
}

/**
 * Compact version for mobile/smaller viewports
 */
export function RecentPicksCompact({ userId, limit = 3 }: { userId?: string; limit?: number }) {
  return (
    <RecentPicksSidebar
      userId={userId}
      limit={limit}
      autoRefresh={true}
      refreshInterval={60000} // 1 minute for mobile to conserve battery
    />
  );
}
