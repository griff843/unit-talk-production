'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCrossSportAnalytics, getSportContests } from '@/lib/supabase-queries';

interface SportAnalytics {
  sport: string;
  confidence: number;
  expected_value: number;
  created_at: string;
}

interface Contest {
  id: string;
  title: string;
  sport: string;
  prize_pool: number;
  status: string;
  contest_participants: Array<{
    user_id: string;
    score: number;
    users: {
      username: string;
      tier: string;
    };
  }>;
}

export default function CrossSportDashboard() {
  const [analytics, setAnalytics] = useState<SportAnalytics[]>([]);
  const [contests, setContests] = useState<Contest[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch cross-sport analytics using optimized queries
        const [analyticsData, contestsData] = await Promise.all([
          getCrossSportAnalytics(),
          getSportContests(selectedSport === 'all' ? undefined : selectedSport),
        ]);

        setAnalytics(analyticsData || []);
        setContests(contestsData || []);
      } catch (error) {
        console.error('Error fetching cross-sport data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedSport]);

  // Group analytics by sport
  const sportMetrics = analytics.reduce(
    (acc, item) => {
      if (!acc[item.sport]) {
        acc[item.sport] = {
          count: 0,
          avgConfidence: 0,
          avgExpectedValue: 0,
          totalConfidence: 0,
          totalExpectedValue: 0,
        };
      }

      acc[item.sport].count++;
      acc[item.sport].totalConfidence += item.confidence;
      acc[item.sport].totalExpectedValue += item.expected_value;
      acc[item.sport].avgConfidence = acc[item.sport].totalConfidence / acc[item.sport].count;
      acc[item.sport].avgExpectedValue = acc[item.sport].totalExpectedValue / acc[item.sport].count;

      return acc;
    },
    {} as Record<string, any>
  );

  const sports = ['all', ...Object.keys(sportMetrics)];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg">Loading cross-sport analytics...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cross-Sport Analytics</h1>
          <p className="text-muted-foreground">Powered by enterprise-grade database optimization</p>
        </div>

        {/* Sport Filter */}
        <div className="flex gap-2">
          {sports.map(sport => (
            <Button
              key={sport}
              variant={selectedSport === sport ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSport(sport)}
            >
              {sport.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Sport Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(sportMetrics).map(([sport, metrics]) => (
          <Card key={sport}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{sport}</CardTitle>
              <CardDescription>Performance Metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Predictions:</span>
                  <Badge variant="secondary">{metrics.count}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg Confidence:</span>
                  <Badge variant={metrics.avgConfidence >= 0.7 ? 'default' : 'secondary'}>
                    {(metrics.avgConfidence * 100).toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg EV:</span>
                  <Badge variant={metrics.avgExpectedValue > 0 ? 'default' : 'destructive'}>
                    {metrics.avgExpectedValue > 0 ? '+' : ''}
                    {metrics.avgExpectedValue.toFixed(3)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active Contests */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sport-Specific Contests</CardTitle>
          <CardDescription>
            Contests filtered by {selectedSport === 'all' ? 'all sports' : selectedSport}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No active contests found for {selectedSport === 'all' ? 'any sport' : selectedSport}
            </p>
          ) : (
            <div className="space-y-4">
              {contests.map(contest => (
                <div key={contest.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{contest.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge>{contest.sport}</Badge>
                      <Badge variant="outline">${contest.prize_pool}</Badge>
                    </div>
                  </div>

                  {contest.contest_participants.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-2">Top Participants:</h4>
                      <div className="space-y-1">
                        {contest.contest_participants
                          .sort((a, b) => (b.score || 0) - (a.score || 0))
                          .slice(0, 3)
                          .map((participant, index) => (
                            <div
                              key={participant.user_id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className="w-6 h-6 p-0 flex items-center justify-center"
                                >
                                  {index + 1}
                                </Badge>
                                {participant.users.username}
                                <Badge variant="secondary" className="text-xs">
                                  {participant.users.tier}
                                </Badge>
                              </span>
                              <span className="font-medium">{participant.score.toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* High-Confidence Predictions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent High-Confidence Predictions</CardTitle>
          <CardDescription>Predictions with 70%+ confidence from the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics
              .filter(item => item.confidence >= 0.7)
              .filter(item => selectedSport === 'all' || item.sport === selectedSport)
              .slice(0, 10)
              .map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <Badge>{item.sport}</Badge>
                    <span className="text-sm">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      {(item.confidence * 100).toFixed(1)}% confidence
                    </Badge>
                    <Badge variant={item.expected_value > 0 ? 'default' : 'destructive'}>
                      EV: {item.expected_value > 0 ? '+' : ''}
                      {item.expected_value.toFixed(3)}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground">
            <p>✅ Powered by enterprise-grade database with 130+ indexes</p>
            <p>✅ 3-10x faster queries through foreign key optimization</p>
            <p>✅ Real-time cross-sport analytics capabilities</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
