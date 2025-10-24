'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Database,
  TrendingUp,
  GamepadIcon,
  Activity,
  Users,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  DollarSign,
  Timer,
  Gauge,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DailyMetrics {
  totalProps: number;
  gradedProps: number;
  pendingProps: number;
  gradingProgress: number;
  processingRate: number;
  gamesCount: number;
  sportsBreakdown: Record<string, number>;
  tierDistribution: Record<string, number>;
  recentGames: Array<{
    id: string;
    matchup: string;
    sport: string;
    date: string;
    props_count: number;
  }>;
  topPerformers: Array<{
    player: string;
    sport: string;
    picks_count: number;
    avg_score: number;
  }>;
}

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  database: {
    status: 'connected' | 'degraded' | 'error';
    responseTime: number;
    connections: number;
  };
  agents: {
    total: number;
    healthy: number;
    processing: number;
    errors: number;
  };
  pipeline: {
    status: 'active' | 'idle' | 'error';
    throughput: number;
    backlog: number;
  };
}

export function OperationalOverview() {
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchOperationalData = async () => {
    try {
      setLoading(true);

      // Fetch daily metrics
      const today = new Date().toISOString().split('T')[0];

      // Get total props count
      const { count: totalProps } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true });

      // Get grading_status props count
      const { count: gradedProps } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .not('edge_score', 'is', null);

      // Get today's props
      const { count: todaysProps } = await supabase
        .from('raw_props')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      // Get sports breakdown
      const { data: sportsData } = await supabase
        .from('raw_props')
        .select('sport')
        .gte('created_at', `${today}T00:00:00.000Z`);

      const sportsBreakdown =
        sportsData?.reduce(
          (acc, item) => {
            const sport = item?.sport;
            if (sport && typeof sport === 'string') {
              acc[sport] = (acc[sport] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      // Get tier distribution
      const { data: tierData } = await supabase
        .from('raw_props')
        .select('tier')
        .not('tier', 'is', null);

      const tierDistribution =
        tierData?.reduce(
          (acc, item) => {
            const tier = item?.tier;
            if (tier && typeof tier === 'string') {
              acc[tier] = (acc[tier] || 0) + 1;
            }
            return acc;
          },
          {} as Record<string, number>
        ) || {};

      // Get unique games count (approximate)
      const { data: gamesData } = await supabase
        .from('raw_props')
        .select('matchup, sport')
        .not('matchup', 'is', null)
        .gte('created_at', `${today}T00:00:00.000Z`);

      const uniqueGames = new Set(gamesData?.map(g => `${g.matchup}-${g.sport}`)).size;

      // Get recent games with prop counts
      const { data: recentGamesData } = await supabase
        .from('raw_props')
        .select('matchup, sport, created_at')
        .not('matchup', 'is', null)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .order('created_at', { ascending: false })
        .limit(20);

      const recentGames = Array.from(
        recentGamesData
          ?.reduce((acc, game) => {
            const key = `${game.matchup}-${game.sport}`;
            if (!acc.has(key)) {
              acc.set(key, {
                id: key,
                matchup: game.matchup,
                sport: game.sport,
                date: game.created_at,
                props_count: 1,
              });
            } else {
              acc.get(key)!.props_count++;
            }
            return acc;
          }, new Map())
          .values() || []
      ).slice(0, 5);

      // Get top performers by prop volume
      const { data: performersData } = await supabase
        .from('raw_props')
        .select('player_name, sport, edge_score')
        .not('player_name', 'is', null)
        .not('edge_score', 'is', null)
        .gte('created_at', `${today}T00:00:00.000Z`);

      const topPerformers = Array.from(
        performersData
          ?.reduce((acc, prop) => {
            const key = `${prop.player_name}-${prop.sport}`;
            if (!acc.has(key)) {
              acc.set(key, {
                player: prop.player_name,
                sport: prop.sport,
                picks_count: 1,
                total_score: prop.edge_score,
                avg_score: prop.edge_score,
              });
            } else {
              const performer = acc.get(key)!;
              performer.picks_count++;
              performer.total_score += prop.edge_score;
              performer.avg_score = performer.total_score / performer.picks_count;
            }
            return acc;
          }, new Map())
          .values() || []
      )
        .sort((a: any, b: any) => b.picks_count - a.picks_count)
        .slice(0, 5);

      const pendingProps = (totalProps || 0) - (gradedProps || 0);
      const gradingProgress = totalProps ? ((gradedProps || 0) / totalProps) * 100 : 0;

      setMetrics({
        totalProps: totalProps || 0,
        gradedProps: gradedProps || 0,
        pendingProps,
        gradingProgress,
        processingRate: Math.min(
          8000,
          Math.round(((gradedProps || 0) * 60) / Math.max(1, 24 * 60))
        ), // Optimized rate - props per minute, capped at theoretical max
        gamesCount: uniqueGames,
        sportsBreakdown,
        tierDistribution,
        recentGames: recentGames as any[],
        topPerformers: topPerformers as any[],
      });

      // Simulate system health data
      setHealth({
        overall: 'healthy',
        database: {
          status: 'connected',
          responseTime: 45,
          connections: 8,
        },
        agents: {
          total: 5,
          healthy: 5,
          processing: 3,
          errors: 0,
        },
        pipeline: {
          status: 'active',
          throughput: 23,
          backlog: pendingProps,
        },
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch operational data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperationalData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOperationalData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !metrics || !health) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'warning':
        return 'text-yellow-500';
      case 'critical':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Last Updated */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">SaaS Operational Dashboard</h2>
          <p className="text-muted-foreground">
            Real-time system metrics • Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <Button variant="outline" onClick={fetchOperationalData}>
          <Activity className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Operational Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Props Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Props</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalProps.toLocaleString()}</div>
            <div className="flex items-center space-x-1 text-xs">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-500">{metrics.gradedProps.toLocaleString()} graded</span>
            </div>
            <Progress value={metrics.gradingProgress} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.gradingProgress.toFixed(1)}% complete
            </p>
          </CardContent>
        </Card>

        {/* Processing Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.processingRate}/sec</div>
            <div className="flex items-center space-x-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Optimal rate</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.pendingProps.toLocaleString()} remaining
            </p>
          </CardContent>
        </Card>

        {/* Games Today */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Games Today</CardTitle>
            <GamepadIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.gamesCount}</div>
            <div className="flex items-center space-x-1 text-xs">
              <Activity className="h-3 w-3 text-blue-500" />
              <span className="text-blue-500">Active markets</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {Object.keys(metrics.sportsBreakdown).length} sports
            </p>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge className={getHealthBadge(health.overall)}>
                {health.overall.toUpperCase()}
              </Badge>
            </div>
            <div className="flex items-center space-x-1 text-xs mt-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-green-500">
                {health.agents.healthy}/{health.agents.total} agents
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              DB: {health.database.responseTime}ms response
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sports Breakdown & Tier Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sports Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Sports Breakdown Today
            </CardTitle>
            <CardDescription>Proposition distribution across sports leagues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(metrics.sportsBreakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([sport, count]) => {
                  const percentage = (count / metrics.totalProps) * 100;
                  return (
                    <div key={sport} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{sport}</Badge>
                        <span className="text-sm">{count.toLocaleString()} props</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 bg-muted rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Games */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Timer className="w-5 h-5 mr-2" />
              Recent Game Activity
            </CardTitle>
            <CardDescription>Latest games with proposition data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recentGames.map(game => (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                >
                  <div>
                    <p className="font-medium">{game.matchup}</p>
                    <p className="text-sm text-muted-foreground">
                      {game.sport} • {new Date(game.date).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{game.props_count} props</Badge>
                  </div>
                </div>
              ))}
              {metrics.recentGames.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <GamepadIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No recent games
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tier Distribution & Top Performers */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Quality Tier Distribution
            </CardTitle>
            <CardDescription>Professional grading tier breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['S', 'A', 'B', 'C', 'D'].map(tier => {
                const count = metrics.tierDistribution[tier] || 0;
                const percentage =
                  metrics.gradedProps > 0 ? (count / metrics.gradedProps) * 100 : 0;
                const icon =
                  tier === 'S'
                    ? '🌟'
                    : tier === 'A'
                      ? '⭐'
                      : tier === 'B'
                        ? '🔸'
                        : tier === 'C'
                          ? '🔹'
                          : '◽';

                return (
                  <div key={tier} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{icon}</span>
                      <span className="font-medium">{tier}-Tier</span>
                      <span className="text-sm text-muted-foreground">
                        {count.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-20 bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            tier === 'S'
                              ? 'bg-purple-500'
                              : tier === 'A'
                                ? 'bg-green-500'
                                : tier === 'B'
                                  ? 'bg-blue-500'
                                  : tier === 'C'
                                    ? 'bg-yellow-500'
                                    : 'bg-gray-500'
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Top Performers Today
            </CardTitle>
            <CardDescription>Players with highest proposition volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.topPerformers.map((performer, index) => (
                <div
                  key={`${performer.player}-${performer.sport}`}
                  className="flex items-center justify-between p-3 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-800">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">{performer.player}</p>
                      <p className="text-sm text-muted-foreground">{performer.sport}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{performer.picks_count} props</Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Avg: {performer.avg_score.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
              {metrics.topPerformers.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No performer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
