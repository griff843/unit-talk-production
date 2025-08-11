'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Target, Users } from 'lucide-react';

interface CLVChartProps {
  picks: any[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function CLVChart({ picks, timeRange = '30d' }: CLVChartProps) {
  const chartData = useMemo(() => {
    if (!picks || picks.length === 0) return [];

    // Group picks by date and calculate cumulative CLV
    const dailyData = picks.reduce((acc: any, pick) => {
      const date = new Date(pick.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          totalPicks: 0,
          won: 0,
          lost: 0,
          profit: 0,
          cumulativeProfit: 0,
          avgOdds: 0,
          clv: 0,
        };
      }

      acc[date].totalPicks += 1;
      if (pick.status === 'won') acc[date].won += 1;
      if (pick.status === 'lost') acc[date].lost += 1;
      if (pick.profit) acc[date].profit += pick.profit;
      acc[date].avgOdds = (acc[date].avgOdds + Math.abs(pick.odds)) / acc[date].totalPicks;

      return acc;
    }, {});

    // Convert to array and calculate cumulative values
    const dataArray = Object.values(dailyData).sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    let cumulativeProfit = 0;
    return dataArray.map((day: any, index) => {
      cumulativeProfit += day.profit;
      const winRate = day.totalPicks > 0 ? (day.won / day.totalPicks) * 100 : 0;
      const clv = calculateCLV(day.profit, day.avgOdds, winRate);

      return {
        ...day,
        cumulativeProfit,
        winRate: Math.round(winRate * 100) / 100,
        clv: Math.round(clv * 100) / 100,
        dateFormatted: new Date(day.date).toLocaleDateString(),
      };
    });
  }, [picks]);

  const aggregateStats = useMemo(() => {
    if (!picks || picks.length === 0) return null;

    const totalPicks = picks.length;
    const wonPicks = picks.filter(p => p.status === 'won').length;
    const lostPicks = picks.filter(p => p.status === 'lost').length;
    const totalProfit = picks.reduce((sum, pick) => sum + (pick.profit || 0), 0);
    const avgOdds = picks.reduce((sum, pick) => sum + Math.abs(pick.odds), 0) / totalPicks;
    const winRate = (wonPicks / totalPicks) * 100;
    const roi = (totalProfit / (totalPicks * 100)) * 100; // Assuming $100 unit size
    const clv = calculateCLV(totalProfit, avgOdds, winRate);

    // Performance by tier
    const tierStats = picks.reduce((acc: any, pick) => {
      const tier = pick.tier || 'C';
      if (!acc[tier]) {
        acc[tier] = { count: 0, profit: 0, won: 0, total: 0 };
      }
      acc[tier].total += 1;
      acc[tier].count += 1;
      if (pick.status === 'won') acc[tier].won += 1;
      if (pick.profit) acc[tier].profit += pick.profit;
      return acc;
    }, {});

    const tierData = Object.entries(tierStats).map(([tier, stats]: [string, any]) => ({
      tier,
      count: stats.count,
      profit: Math.round(stats.profit * 100) / 100,
      winRate: Math.round((stats.won / stats.total) * 100),
      roi: Math.round((stats.profit / (stats.count * 100)) * 100),
    }));

    return {
      totalPicks,
      wonPicks,
      lostPicks,
      totalProfit: Math.round(totalProfit * 100) / 100,
      avgOdds: Math.round(avgOdds),
      winRate: Math.round(winRate * 100) / 100,
      roi: Math.round(roi * 100) / 100,
      clv: Math.round(clv * 100) / 100,
      tierStats: tierData,
    };
  }, [picks]);

  if (!aggregateStats) {
    return (
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">No data available for CLV analysis</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CLV Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CLV</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${aggregateStats.clv}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              {aggregateStats.clv > 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={aggregateStats.clv > 0 ? 'text-green-500' : 'text-red-500'}>
                {aggregateStats.roi}% ROI
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregateStats.winRate}%</div>
            <div className="text-xs text-muted-foreground">
              {aggregateStats.wonPicks}W / {aggregateStats.lostPicks}L
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                aggregateStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              ${aggregateStats.totalProfit}
            </div>
            <div className="text-xs text-muted-foreground">
              {aggregateStats.totalPicks} total picks
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Odds</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {aggregateStats.avgOdds > 0 ? '+' : ''}
              {aggregateStats.avgOdds}
            </div>
            <div className="text-xs text-muted-foreground">Average line value</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Cumulative CLV Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cumulative CLV Trend</CardTitle>
            <CardDescription>Customer lifetime value progression over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dateFormatted" />
                <YAxis />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name === 'cumulativeProfit'
                      ? `$${value}`
                      : name === 'clv'
                        ? `$${value}`
                        : name === 'winRate'
                          ? `${value}%`
                          : value,
                    name === 'cumulativeProfit'
                      ? 'Cumulative Profit'
                      : name === 'clv'
                        ? 'CLV'
                        : name === 'winRate'
                          ? 'Win Rate'
                          : name,
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeProfit"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  name="Cumulative Profit"
                />
                <Line type="monotone" dataKey="clv" stroke="#10b981" strokeWidth={2} name="CLV" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance by Tier */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Tier</CardTitle>
            <CardDescription>ROI and profit analysis across user tiers</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aggregateStats.tierStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tier" />
                <YAxis />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    name === 'profit'
                      ? `$${value}`
                      : name === 'roi'
                        ? `${value}%`
                        : name === 'winRate'
                          ? `${value}%`
                          : value,
                    name === 'profit'
                      ? 'Profit'
                      : name === 'roi'
                        ? 'ROI'
                        : name === 'winRate'
                          ? 'Win Rate'
                          : name,
                  ]}
                />
                <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
                <Bar dataKey="roi" fill="#10b981" name="ROI" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tier Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Tier Analysis</CardTitle>
          <CardDescription>Comprehensive performance metrics by user tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Tier</th>
                  <th className="text-right p-2">Picks</th>
                  <th className="text-right p-2">Win Rate</th>
                  <th className="text-right p-2">Profit</th>
                  <th className="text-right p-2">ROI</th>
                  <th className="text-right p-2">Performance</th>
                </tr>
              </thead>
              <tbody>
                {aggregateStats.tierStats.map(tier => (
                  <tr key={tier.tier} className="border-b">
                    <td className="p-2">
                      <Badge className={getTierColor(tier.tier)}>{tier.tier} Tier</Badge>
                    </td>
                    <td className="text-right p-2 font-mono">{tier.count}</td>
                    <td className="text-right p-2 font-mono">{tier.winRate}%</td>
                    <td
                      className={`text-right p-2 font-mono ${
                        tier.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      ${tier.profit}
                    </td>
                    <td
                      className={`text-right p-2 font-mono ${
                        tier.roi >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {tier.roi}%
                    </td>
                    <td className="text-right p-2">
                      {tier.roi >= 10 ? (
                        <Badge className="bg-green-100 text-green-800">Excellent</Badge>
                      ) : tier.roi >= 5 ? (
                        <Badge className="bg-blue-100 text-blue-800">Good</Badge>
                      ) : tier.roi >= 0 ? (
                        <Badge className="bg-yellow-100 text-yellow-800">Fair</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">Poor</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Helper function to calculate CLV
function calculateCLV(profit: number, avgOdds: number, winRate: number): number {
  // Simplified CLV calculation based on profit, odds value, and consistency
  const consistencyFactor = winRate > 55 ? 1.2 : winRate > 50 ? 1.0 : 0.8;
  const oddsFactor = avgOdds > 150 ? 1.1 : avgOdds > 100 ? 1.0 : 0.9;

  return profit * consistencyFactor * oddsFactor;
}

// Helper function for tier colors
function getTierColor(tier: string) {
  switch (tier) {
    case 'S':
      return 'bg-purple-100 text-purple-800';
    case 'A':
      return 'bg-blue-100 text-blue-800';
    case 'B':
      return 'bg-green-100 text-green-800';
    case 'C':
      return 'bg-yellow-100 text-yellow-800';
    case 'D':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}
