/**
 * Realtime Pick Feed Component
 *
 * Production-grade real-time pick feed with:
 * - WebSocket/polling fallback for live updates
 * - Filterable by league, capper, date
 * - Lifecycle stage indicators
 * - Quick actions for pick management
 *
 * Charter v3.0: Canonical picks table integration
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Play, Pause, RefreshCw, Filter } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================
interface Pick {
  id: string;
  user_id: string;
  selection: string;
  odds: number;
  stake: number;
  confidence: number | null;
  workflow_stage: string;
  status: string;
  self_score: number | null;
  professional_score: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  // Relations
  users: {
    username: string;
    tier: string;
  };
  props: {
    sport: string;
    league: string | null;
    player_name: string;
    stat_type: string;
    line: number | null;
  } | null;
}

interface PickFeedFilters {
  league: string | null;
  workflowStage: string | null;
  capperId: string | null;
  dateRange: string;
}

// ============================================================================
// Hooks
// ============================================================================
function useRealtimePickFeed(filters: PickFeedFilters, enabled: boolean) {
  const queryClient = useQueryClient();
  const [client] = React.useState(() =>
    createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );

  // Query for picks with filters
  const query = useQuery({
    queryKey: ['picks', 'feed', filters],
    queryFn: async () => {
      let query = client
        .from('picks')
        .select(`
          *,
          users!picks_user_id_fkey(username, tier),
          props(sport, league, player_name, stat_type, line)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filters.league) {
        query = query.eq('props.league', filters.league);
      }

      if (filters.workflowStage) {
        query = query.eq('workflow_stage', filters.workflowStage);
      }

      if (filters.capperId) {
        query = query.eq('user_id', filters.capperId);
      }

      // Date range filter
      if (filters.dateRange !== 'all') {
        const now = new Date();
        const pastDate = new Date();
        switch (filters.dateRange) {
          case '24h':
            pastDate.setHours(now.getHours() - 24);
            break;
          case '7d':
            pastDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            pastDate.setDate(now.getDate() - 30);
            break;
        }
        query = query.gte('created_at', pastDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch picks: ${error.message}`);
      }

      return data as Pick[];
    },
    enabled,
    refetchInterval: enabled ? 5000 : false, // Poll every 5s when enabled
    staleTime: 3000,
  });

  // Set up realtime subscription
  React.useEffect(() => {
    if (!enabled) return;

    const channel = client
      .channel('picks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'picks',
        },
        (payload) => {
          console.log('Pick changed:', payload);
          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ['picks', 'feed'] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [client, enabled, queryClient]);

  return query;
}

// ============================================================================
// Helper Functions
// ============================================================================
function getWorkflowStageColor(stage: string): string {
  switch (stage) {
    case 'draft':
      return 'bg-gray-500';
    case 'pending_review':
      return 'bg-yellow-500';
    case 'approved':
      return 'bg-blue-500';
    case 'published':
      return 'bg-green-500';
    case 'rejected':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'pending':
      return 'bg-blue-500';
    case 'won':
      return 'bg-green-500';
    case 'lost':
      return 'bg-red-500';
    case 'push':
      return 'bg-gray-500';
    case 'void':
      return 'bg-orange-500';
    case 'cancelled':
      return 'bg-gray-600';
    default:
      return 'bg-gray-500';
  }
}

// ============================================================================
// Components
// ============================================================================
function PickCard({ pick, onAction }: { pick: Pick; onAction: (pickId: string, action: string) => void }) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base">
              {pick.props?.player_name || 'Unknown Player'}{' '}
              {pick.props?.stat_type || 'Unknown Stat'} {pick.props?.line || ''}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span className="font-medium">{pick.users.username}</span>
              <Badge variant="outline" className="text-xs">
                {pick.users.tier}
              </Badge>
              <Badge className={cn('text-xs text-white', getStatusBadgeColor(pick.status))}>
                {pick.status}
              </Badge>
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge className={cn('text-xs text-white', getWorkflowStageColor(pick.workflow_stage))}>
              {pick.workflow_stage.replace(/_/g, ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(pick.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Selection</p>
            <p className="font-medium">{pick.selection.toUpperCase()}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Odds</p>
            <p className="font-medium">{pick.odds > 0 ? `+${pick.odds}` : pick.odds}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-medium">{pick.confidence ? `${pick.confidence}/10` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Self Score</p>
            <p className="font-medium">{pick.self_score ? `${pick.self_score}/10` : 'N/A'}</p>
          </div>
        </div>

        {pick.professional_score && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Professional Score</p>
            <p className="text-lg font-bold text-primary">{pick.professional_score}/10</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {pick.workflow_stage === 'pending_review' && (
            <>
              <Button size="sm" variant="default" onClick={() => onAction(pick.id, 'approve')}>
                Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={() => onAction(pick.id, 'reject')}>
                Reject
              </Button>
            </>
          )}
          {pick.workflow_stage === 'approved' && (
            <Button size="sm" variant="default" onClick={() => onAction(pick.id, 'publish')}>
              Publish
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => onAction(pick.id, 'view')}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================
export function RealtimePickFeed() {
  const [isLive, setIsLive] = React.useState(true);
  const [filters, setFilters] = React.useState<PickFeedFilters>({
    league: null,
    workflowStage: null,
    capperId: null,
    dateRange: '24h',
  });

  const { data: picks, isLoading, refetch } = useRealtimePickFeed(filters, isLive);

  const handleAction = React.useCallback((pickId: string, action: string) => {
    console.log(`Action: ${action} on pick ${pickId}`);
    // TODO: Implement pick lifecycle actions via API
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Realtime Pick Feed</h2>
          <p className="text-muted-foreground">
            Live updates from canonical picks table{' '}
            {isLive && <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-2"
          >
            {isLive ? (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="league">League</Label>
              <Select
                value={filters.league || 'all'}
                onValueChange={(value) => setFilters({ ...filters, league: value === 'all' ? null : value })}
              >
                <SelectTrigger id="league">
                  <SelectValue placeholder="All Leagues" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Leagues</SelectItem>
                  <SelectItem value="NBA">NBA</SelectItem>
                  <SelectItem value="NFL">NFL</SelectItem>
                  <SelectItem value="MLB">MLB</SelectItem>
                  <SelectItem value="NHL">NHL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow">Workflow Stage</Label>
              <Select
                value={filters.workflowStage || 'all'}
                onValueChange={(value) =>
                  setFilters({ ...filters, workflowStage: value === 'all' ? null : value })
                }
              >
                <SelectTrigger id="workflow">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select
                value={filters.dateRange}
                onValueChange={(value) => setFilters({ ...filters, dateRange: value })}
              >
                <SelectTrigger id="dateRange">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capper">Capper</Label>
              <Input
                id="capper"
                placeholder="Filter by capper..."
                value={filters.capperId || ''}
                onChange={(e) => setFilters({ ...filters, capperId: e.target.value || null })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pick Feed */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading picks...</div>
        ) : picks && picks.length > 0 ? (
          picks.map((pick) => <PickCard key={pick.id} pick={pick} onAction={handleAction} />)
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No picks found matching filters
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
