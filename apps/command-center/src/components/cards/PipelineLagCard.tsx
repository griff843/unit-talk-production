// @ts-nocheck
/**
 * @fileoverview Pipeline Lag (24h) Card Component
 * Displays p50/p95 pipeline lag metrics with time-series visualization
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { usePipelineLag } from '@/hooks/usePipelineLag';
import { format } from 'date-fns';

interface PipelineLagCardProps {
  className?: string;
}

export function PipelineLagCard({ className }: PipelineLagCardProps) {
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const { data, isLoading, error, lastUpdated, refetch } = usePipelineLag(selectedSport);

  // Get available sports from data
  const availableSports = useMemo(() => {
    const sports = Object.keys(data);
    return sports.length > 0 ? sports : ['all'];
  }, [data]);

  // Get current sport data
  const currentData = useMemo(() => {
    return data[selectedSport] || [];
  }, [data, selectedSport]);

  // Calculate KPI metrics for last 15 minutes
  const last15MinKPIs = useMemo(() => {
    if (currentData.length === 0) return { p50: 0, p95: 0, count: 0 };

    const now = new Date();
    const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    const recentData = currentData.filter(point => 
      new Date(point.t) >= fifteenMinAgo
    );

    if (recentData.length === 0) return { p50: 0, p95: 0, count: 0 };

    const p50Avg = recentData.reduce((sum, point) => sum + point.p50s, 0) / recentData.length;
    const p95Avg = recentData.reduce((sum, point) => sum + point.p95s, 0) / recentData.length;
    const totalCount = recentData.reduce((sum, point) => sum + point.ct, 0);

    return {
      p50: Math.round(p50Avg * 100) / 100,
      p95: Math.round(p95Avg * 100) / 100,
      count: totalCount,
    };
  }, [currentData]);

  // Determine status based on p95 thresholds
  const status = useMemo(() => {
    const p95 = last15MinKPIs.p95;
    if (p95 > 15) return { level: 'critical', color: 'bg-red-500', text: 'Critical' };
    if (p95 > 5) return { level: 'warning', color: 'bg-yellow-500', text: 'Warning' };
    return { level: 'healthy', color: 'bg-green-500', text: 'Healthy' };
  }, [last15MinKPIs.p95]);

  // Format chart data for recharts
  const chartData = useMemo(() => {
    return currentData.map(point => ({
      time: new Date(point.t).getTime(),
      timeFormatted: format(new Date(point.t), 'HH:mm'),
      p50: point.p50s,
      p95: point.p95s,
      count: point.ct,
      sport: point.sport,
    }));
  }, [currentData]);

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{format(new Date(label), 'MMM dd, HH:mm')}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              p50: {data.p50.toFixed(2)}s
            </p>
            <p className="text-purple-600">
              p95: {data.p95.toFixed(2)}s
            </p>
            <p className="text-muted-foreground">
              Promoted: {data.count.toLocaleString()}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="w-5 h-5 mr-2" />
            Pipeline Lag (24h)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-red-400">
            <AlertTriangle className="w-8 h-8 mr-2" />
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Pipeline Lag (24h)
              <div className={`w-3 h-3 rounded-full ml-2 ${status.color}`} />
            </CardTitle>
            <CardDescription>
              p50/p95 promotion lag in seconds, per sport
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                {availableSports
                  .filter(sport => sport !== 'all')
                  .map(sport => (
                    <SelectItem key={sport} value={sport}>
                      {sport.toUpperCase()}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* KPI Chips */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="text-center p-3 rounded-lg border bg-muted/20">
            <div className="text-lg font-bold text-blue-600">
              {last15MinKPIs.p50}s
            </div>
            <div className="text-sm text-muted-foreground">Last 15m p50</div>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/20">
            <div className="text-lg font-bold text-purple-600">
              {last15MinKPIs.p95}s
            </div>
            <div className="text-sm text-muted-foreground">Last 15m p95</div>
          </div>
          <div className="text-center p-3 rounded-lg border bg-muted/20">
            <div className="text-lg font-bold">
              {last15MinKPIs.count.toLocaleString()}
            </div>
            <div className="text-sm text-muted-foreground">Promoted</div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex justify-center mb-4">
          <Badge 
            variant="outline" 
            className={`${
              status.level === 'critical' 
                ? 'border-red-500 text-red-600' 
                : status.level === 'warning'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-green-500 text-green-600'
            }`}
          >
            {status.level === 'critical' && <AlertTriangle className="w-3 h-3 mr-1" />}
            {status.level === 'warning' && <TrendingUp className="w-3 h-3 mr-1" />}
            {status.level === 'healthy' && <CheckCircle className="w-3 h-3 mr-1" />}
            {status.text}
          </Badge>
        </div>

        {/* Time Series Chart */}
        <div className="h-64">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading lag metrics...
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <Clock className="w-6 h-6 mr-2" />
              No lag data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis 
                  dataKey="timeFormatted"
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Seconds', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {/* Threshold reference lines */}
                <ReferenceLine 
                  y={5} 
                  stroke="#eab308" 
                  strokeDasharray="5 5"
                  label={{ value: "5s threshold", position: "top", fontSize: 10 }}
                />
                <ReferenceLine 
                  y={15} 
                  stroke="#dc2626" 
                  strokeDasharray="5 5"
                  label={{ value: "15s threshold", position: "top", fontSize: 10 }}
                />
                
                {/* Data lines */}
                <Line 
                  type="monotone" 
                  dataKey="p50" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                  name="p50"
                />
                <Line 
                  type="monotone" 
                  dataKey="p95" 
                  stroke="#7c3aed" 
                  strokeWidth={2}
                  dot={false}
                  name="p95"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Footer with last updated info */}
        {lastUpdated && (
          <div className="text-xs text-muted-foreground text-center mt-4">
            Last updated: {format(new Date(lastUpdated), 'MMM dd, HH:mm:ss')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}