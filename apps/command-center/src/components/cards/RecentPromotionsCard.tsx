'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, AlertCircle, TrendingUp, Calendar, CheckCircle, Clock } from 'lucide-react';
import { useRecentPromotions } from '@/hooks/useRecentPromotions';
import { formatDistanceToNow, format } from 'date-fns';

interface RecentPromotionsCardProps {
  className?: string;
}

export function RecentPromotionsCard({ className }: RecentPromotionsCardProps) {
  const { data, loading, error, refetch } = useRecentPromotions({
    limit: 500
  });

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        total: 0,
        successful: 0,
        pending: 0,
        successRate: 0
      };
    }

    const successful = data.filter(item => item.promotion_status === 'promoted').length;
    const pending = data.filter(item => item.promotion_status === 'pending').length;
    const successRate = data.length > 0 ? (successful / data.length) * 100 : 0;

    return {
      total: data.length,
      successful,
      pending,
      successRate: Math.round(successRate)
    };
  }, [data]);

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'promoted':
        return <Badge variant="default" className="text-xs bg-green-100 text-green-800">Promoted</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    const tierColors = {
      'S': 'bg-purple-100 text-purple-800',
      'A': 'bg-blue-100 text-blue-800',
      'B': 'bg-yellow-100 text-yellow-800',
      'C': 'bg-gray-100 text-gray-800'
    };
    
    return (
      <Badge 
        variant="outline" 
        className={`text-xs ${tierColors[tier as keyof typeof tierColors] || 'bg-gray-100 text-gray-800'}`}
      >
        {tier}
      </Badge>
    );
  };

  if (error) {
    return (
      <Card className={`border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
            <TrendingUp className="w-4 h-4 mr-2 inline" />
            Recent Promotions (24h)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-600 dark:text-red-400">
              {error}
            </span>
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
              <TrendingUp className="w-5 h-5 mr-2" />
              Recent Promotions (24h)
              <Badge variant="outline" className="ml-2">
                {summaryStats.total} items
              </Badge>
            </CardTitle>
            <CardDescription>
              Picks promoted to production in the last 24 hours
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refetch}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading promotions data...</span>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No recent promotions found
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 rounded-lg border bg-muted/20">
                <div className="text-lg font-bold">{summaryStats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-green-50">
                <div className="text-lg font-bold text-green-600">{summaryStats.successful}</div>
                <div className="text-xs text-muted-foreground">Promoted</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-yellow-50">
                <div className="text-lg font-bold text-yellow-600">{summaryStats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-blue-50">
                <div className="text-lg font-bold text-blue-600">{summaryStats.successRate}%</div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>

            {/* Data Table */}
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Promoted At</TableHead>
                    <TableHead>Pick Source</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Selection</TableHead>
                    <TableHead>Line / Odds</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Game Start</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.unified_pick_id}>
                      <TableCell className="text-sm">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {formatDistanceToNow(new Date(item.promoted_at), { addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {item.pick_source}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.sport}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.pick_type}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {item.selection}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div>
                          <div>{item.line}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.odds > 0 ? '+' : ''}{item.odds}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getTierBadge(item.tier_when_placed)}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {format(new Date(item.game_start_time), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(item.promotion_status)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.length >= 500 && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing first 500 items from the last 24 hours.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentPromotionsCard;