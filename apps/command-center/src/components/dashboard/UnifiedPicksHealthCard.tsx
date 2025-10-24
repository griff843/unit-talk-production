'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, TrendingUp, Users, FileText, Target } from 'lucide-react';
import { useUnifiedPicksHealth } from '@/hooks/useUnifiedPicksHealth';

const UnifiedPicksHealthCard: React.FC = () => {
  const { data, loading, error, refetch } = useUnifiedPicksHealth();

  const handleRefresh = async () => {
    await refetch();
  };

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
            Unified Picks Health (24h)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading && !data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unified Picks Health (24h)</CardTitle>
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted"></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-12 animate-pulse rounded bg-muted"></div>
              <div className="h-12 animate-pulse rounded bg-muted"></div>
              <div className="h-12 animate-pulse rounded bg-muted"></div>
              <div className="h-12 animate-pulse rounded bg-muted"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unified Picks Health (24h)</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-muted-foreground">No data available</div>
        </CardContent>
      </Card>
    );
  }

  const hasAlerts = data.duplicate_fingerprints > 0 || data.missing_prop_ids > 0;
  const writerAuditGood = data.writer_audit_percentage >= 100;

  // Status-based styling
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950';
      case 'warning':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
      case 'critical':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      default:
        return '';
    }
  };

  return (
    <Card className={getStatusColor(data.status)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Unified Picks Health (24h)</CardTitle>
        <div className="flex items-center space-x-2">
          {hasAlerts && <AlertTriangle className="h-4 w-4 text-amber-600" />}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Main KPIs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{data.total_picks_24h.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Total (24h)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{data.system_picks_24h.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">System (24h)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{data.manual_picks_24h.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Manual (24h)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Target
                className={`h-4 w-4 ${writerAuditGood ? 'text-green-600' : 'text-red-600'}`}
              />
              <div>
                <div
                  className={`text-2xl font-bold ${writerAuditGood ? 'text-green-600' : 'text-red-600'}`}
                >
                  {data.writer_audit_percentage.toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground">Writer Audit %</p>
              </div>
            </div>
          </div>

          {/* Alerts Section */}
          {hasAlerts && (
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Active Alerts
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.duplicate_fingerprints > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {data.duplicate_fingerprints} Duplicate Fingerprints
                  </Badge>
                )}
                {data.missing_prop_ids > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {data.missing_prop_ids} Missing Prop IDs
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Success State */}
          {!hasAlerts && writerAuditGood && (
            <div className="border-t pt-4">
              <div className="flex items-center space-x-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">All systems healthy</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UnifiedPicksHealthCard;
