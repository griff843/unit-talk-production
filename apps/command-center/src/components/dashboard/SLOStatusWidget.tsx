/**
 * @fileoverview SLO Status Widget - Fortune-100 quality SLO monitoring
 * Real-time SLO burn-rate tracking with alert visualization
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Target,
  Zap,
} from 'lucide-react';

// =============================================================================
// INTERFACES
// =============================================================================

interface SLOStatus {
  id: string;
  name: string;
  title: string;
  objective: number;
  current_sli: number;
  status: 'healthy' | 'breached';
  error_budget_consumed: number;
  active_incidents: number;
  burn_rate: number;
  trend: 'up' | 'down' | 'stable';
  last_updated: string;
}

interface SLOIncident {
  id: string;
  slo_name: string;
  burn_rate: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  window: string;
  status: string;
  created_at: string;
}

interface SLOData {
  slos: SLOStatus[];
  incidents: SLOIncident[];
  overall_health_score: number;
  total_breaches: number;
  critical_incidents: number;
}

// =============================================================================
// SLO STATUS WIDGET
// =============================================================================

export function SLOStatusWidget() {
  const [data, setData] = useState<SLOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Fetch SLO status data
   */
  const fetchSLOData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/monitoring/slos');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch SLO data');
      }

      setData(result.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching SLO data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSLOData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSLOData, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Get status color based on SLO health
   */
  const getStatusColor = (slo: SLOStatus) => {
    if (slo.status === 'breached' || slo.active_incidents > 0) return 'text-red-500';
    if (slo.error_budget_consumed > 75) return 'text-yellow-500';
    if (slo.error_budget_consumed > 50) return 'text-orange-500';
    return 'text-green-500';
  };

  /**
   * Get burn rate indicator
   */
  const getBurnRateIndicator = (burnRate: number) => {
    if (burnRate > 10) return { icon: AlertTriangle, color: 'text-red-500', label: 'Critical' };
    if (burnRate > 5) return { icon: AlertCircle, color: 'text-orange-500', label: 'High' };
    if (burnRate > 2) return { icon: Clock, color: 'text-yellow-500', label: 'Moderate' };
    return { icon: CheckCircle2, color: 'text-green-500', label: 'Normal' };
  };

  /**
   * Get trend indicator
   */
  const getTrendIndicator = (trend: string) => {
    switch (trend) {
      case 'up':
        return { icon: TrendingUp, color: 'text-red-500' };
      case 'down':
        return { icon: TrendingDown, color: 'text-green-500' };
      default:
        return { icon: Target, color: 'text-gray-500' };
    }
  };

  /**
   * Format percentage
   */
  const formatPercentage = (value: number) => {
    return `${Math.round(value * 100) / 100}%`;
  };

  /**
   * Format burn rate
   */
  const formatBurnRate = (rate: number) => {
    return `${Math.round(rate * 100) / 100}x`;
  };

  /**
   * Get overall system health color
   */
  const getOverallHealthColor = (score: number) => {
    if (score >= 98) return 'text-green-500';
    if (score >= 95) return 'text-yellow-500';
    if (score >= 90) return 'text-orange-500';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            SLO Status
          </CardTitle>
          <CardDescription>Service Level Objectives monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading SLO data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-red-500">
            <AlertTriangle className="w-5 h-5 mr-2" />
            SLO Status - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchSLOData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Target className="w-5 h-5 mr-2" />
            SLO Status
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={data?.overall_health_score >= 95 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {data ? formatPercentage(data.overall_health_score) : 'N/A'} Health
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchSLOData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Service Level Objectives with burn-rate monitoring
          {data && (
            <span className="block text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data && (
          <div className="space-y-4">
            {/* Overall Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 rounded-lg bg-muted/20">
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${getOverallHealthColor(data.overall_health_score)}`}
                >
                  {formatPercentage(data.overall_health_score)}
                </div>
                <div className="text-xs text-muted-foreground">Overall Health</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${data.total_breaches > 0 ? 'text-red-500' : 'text-green-500'}`}
                >
                  {data.total_breaches}
                </div>
                <div className="text-xs text-muted-foreground">Active Breaches</div>
              </div>
              <div className="text-center">
                <div
                  className={`text-2xl font-bold ${data.critical_incidents > 0 ? 'text-red-500' : 'text-green-500'}`}
                >
                  {data.critical_incidents}
                </div>
                <div className="text-xs text-muted-foreground">Critical Incidents</div>
              </div>
            </div>

            {/* Individual SLOs */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Service Level Objectives</h4>
              {data.slos.map(slo => {
                const burnRateIndicator = getBurnRateIndicator(slo.burn_rate);
                const trendIndicator = getTrendIndicator(slo.trend);
                const BurnRateIcon = burnRateIndicator.icon;
                const TrendIcon = trendIndicator.icon;

                return (
                  <div
                    key={slo.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/10 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{slo.title}</span>
                        <Badge
                          variant={slo.status === 'healthy' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {slo.status === 'healthy' ? 'OK' : 'BREACH'}
                        </Badge>
                        {slo.active_incidents > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {slo.active_incidents} incident{slo.active_incidents > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center space-x-4 mt-2">
                        <div className="text-xs text-muted-foreground">
                          SLI:{' '}
                          <span className={getStatusColor(slo)}>{slo.current_sli || 'N/A'}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Target: {slo.objective}</div>
                      </div>

                      {/* Error Budget Progress */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Error Budget</span>
                          <span
                            className={
                              slo.error_budget_consumed > 75
                                ? 'text-red-500'
                                : 'text-muted-foreground'
                            }
                          >
                            {formatPercentage(slo.error_budget_consumed)} consumed
                          </span>
                        </div>
                        <Progress value={slo.error_budget_consumed} className="mt-1 h-2" />
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 ml-4">
                      {/* Burn Rate Indicator */}
                      <div className="flex items-center space-x-1">
                        <BurnRateIcon className={`w-4 h-4 ${burnRateIndicator.color}`} />
                        <div className="text-xs">
                          <div className={`font-medium ${burnRateIndicator.color}`}>
                            {formatBurnRate(slo.burn_rate)}
                          </div>
                          <div className="text-muted-foreground">burn rate</div>
                        </div>
                      </div>

                      {/* Trend Indicator */}
                      <div className="flex items-center">
                        <TrendIcon className={`w-4 h-4 ${trendIndicator.color}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent Critical Incidents */}
            {data.incidents.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-red-500" />
                  Recent Incidents
                </h4>
                <div className="space-y-2">
                  {data.incidents.slice(0, 3).map(incident => (
                    <div
                      key={incident.id}
                      className="flex items-center justify-between p-2 rounded border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-medium">{incident.slo_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatBurnRate(incident.burn_rate)} burn rate in {incident.window}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={incident.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {incident.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(incident.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.slos.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No SLOs configured</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
