'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, DollarSign, Trophy, Flame, Star, Award } from 'lucide-react';

interface Stats {
  totalPicks: number;
  winRate: number;
  totalWins: number;
  totalLosses: number;
  currentStreak: number;
  bestStreak: number;
  totalUnits: number;
  profitLoss: number;
  roi: number;
  avgConfidence: number;
}

interface PerformanceMetricsProps {
  stats: Stats;
}

export function PerformanceMetrics({ stats }: PerformanceMetricsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 70) return 'text-green-400';
    if (winRate >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getProfitColor = (profit: number) => {
    return profit >= 0 ? 'text-green-400' : 'text-red-400';
  };

  const getROIColor = (roi: number) => {
    if (roi >= 10) return 'text-green-400';
    if (roi >= 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <Card className="bg-black/20 backdrop-blur-sm border-gray-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Performance Metrics</span>
        </CardTitle>
        <CardDescription className="text-gray-400">
          Your betting performance overview
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Win Rate */}
          <div className="text-center p-4 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-sm text-gray-400">Win Rate</span>
            </div>
            <div className={`text-2xl font-bold ${getWinRateColor(stats.winRate)}`}>
              {formatPercentage(stats.winRate)}
            </div>
            <Progress value={stats.winRate} />
          </div>

          {/* ROI */}
          <div className="text-center p-4 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">ROI</span>
            </div>
            <div className={`text-2xl font-bold ${getROIColor(stats.roi)}`}>
              {formatPercentage(stats.roi)}
            </div>
            <div className="text-xs text-gray-500 mt-1">Return on Investment</div>
          </div>
        </div>

        {/* Profit/Loss */}
        <div className="p-4 bg-black/20 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-green-400" />
              <span className="text-sm text-gray-400">Total P&L</span>
            </div>
            <Badge variant="outline" className="border-green-500 text-green-400">
              {stats.profitLoss >= 0 ? 'Profitable' : 'Loss'}
            </Badge>
          </div>
          <div className={`text-3xl font-bold ${getProfitColor(stats.profitLoss)}`}>
            {formatCurrency(stats.profitLoss)}
          </div>
          <div className="text-xs text-gray-500 mt-1">{stats.totalUnits} total units wagered</div>
        </div>

        {/* Pick Statistics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Total Picks</span>
            <span className="text-white font-semibold">{stats.totalPicks}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Wins</span>
            <div className="flex items-center space-x-2">
              <span className="text-green-400 font-semibold">{stats.totalWins}</span>
              <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                {formatPercentage((stats.totalWins / stats.totalPicks) * 100)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Losses</span>
            <div className="flex items-center space-x-2">
              <span className="text-red-400 font-semibold">{stats.totalLosses}</span>
              <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                {formatPercentage((stats.totalLosses / stats.totalPicks) * 100)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Streak Information */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Flame className="h-3 w-3 text-orange-400" />
              <span className="text-xs text-gray-400">Current</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.currentStreak}</div>
            <div className="text-xs text-gray-500">Streak</div>
          </div>
          <div className="text-center p-3 bg-black/20 rounded-lg border border-gray-800">
            <div className="flex items-center justify-center space-x-2 mb-1">
              <Award className="h-3 w-3 text-yellow-400" />
              <span className="text-xs text-gray-400">Best</span>
            </div>
            <div className="text-lg font-bold text-white">{stats.bestStreak}</div>
            <div className="text-xs text-gray-500">Streak</div>
          </div>
        </div>

        {/* Confidence Rating */}
        <div className="p-3 bg-black/20 rounded-lg border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Star className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-gray-400">Avg Confidence</span>
            </div>
            <span className="text-white font-semibold">{stats.avgConfidence}/10</span>
          </div>
          <Progress value={stats.avgConfidence * 10} />
          <div className="text-xs text-gray-500 mt-1">Based on {stats.totalPicks} picks</div>
        </div>

        {/* Performance Indicators */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-gray-400">Excellent</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
            <span className="text-gray-400">Good</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-gray-400">Needs Work</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
