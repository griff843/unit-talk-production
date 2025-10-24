/**
 * @fileoverview Exposure Risk Widget - Kelly-at-risk monitoring
 * Real-time risk exposure tracking with auto-remediation controls
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Target,
  Zap,
  Users,
  Activity,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';

// =============================================================================
// INTERFACES
// =============================================================================

interface ExposureData {
  total_exposure: number;
  kelly_at_risk: number;
  max_loss_today: number;
  exposure_by_sport: Record<string, number>;
  exposure_by_market: Record<string, number>;
  correlation_clusters: Array<{
    cluster: string;
    exposure: number;
    picks_count: number;
    risk_tier: string;
  }>;
  daily_limits: {
    max_daily_exposure: number;
    current_exposure: number;
    utilization_percentage: number;
    remaining_capacity: number;
  };
  risk_alerts: Array<{
    type: 'correlation' | 'kelly' | 'exposure' | 'concentration';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affected_picks: string[];
    recommended_action: string;
  }>;
  remediation_actions?: Array<{
    type: string;
    target_pick_ids: string[];
    adjustment: { reason: string };
    estimated_impact: {
      exposure_reduction: number;
      kelly_reduction: number;
    };
  }>;
}

// =============================================================================
// EXPOSURE RISK WIDGET
// =============================================================================

export function ExposureRiskWidget() {
  const [data, setData] = useState<ExposureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [executingRemediation, setExecutingRemediation] = useState<string | null>(null);

  /**
   * Fetch exposure data
   */
  const fetchExposureData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/exposure/snapshot?include_remediation=true');
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch exposure data');
      }

      setData(result.data);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching exposure data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExposureData();

    // Refresh every 60 seconds
    const interval = setInterval(fetchExposureData, 60000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Execute auto-remediation action
   */
  const executeRemediation = async (actionIndex: number) => {
    if (!data?.remediation_actions?.[actionIndex]) return;

    const action = data.remediation_actions[actionIndex];
    setExecutingRemediation(action.type);

    try {
      const response = await fetch('/api/exposure/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          confirm: true,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Refresh data after successful remediation
        await fetchExposureData();
      } else {
        throw new Error(result.error || 'Remediation failed');
      }
    } catch (err) {
      console.error('Error executing remediation:', err);
      // Could show error toast here
    } finally {
      setExecutingRemediation(null);
    }
  };

  /**
   * Format currency
   */
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${amount.toFixed(0)}`;
  };

  /**
   * Get risk tier color
   */
  const getRiskTierColor = (tier: string) => {
    switch (tier.toLowerCase()) {
      case 'critical':
        return 'text-red-500';
      case 'high':
        return 'text-orange-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-green-500';
    }
  };

  /**
   * Get exposure utilization color
   */
  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  /**
   * Get alert severity color
   */
  const getAlertSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high':
        return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium':
        return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      default:
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            Exposure & Kelly Risk
          </CardTitle>
          <CardDescription>Real-time position risk monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading exposure data...</span>
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
            Exposure Risk - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500 mb-4">{error}</p>
            <Button variant="outline" onClick={fetchExposureData}>
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
            <Shield className="w-5 h-5 mr-2" />
            Exposure & Kelly Risk
          </div>
          <div className="flex items-center space-x-2">
            <Badge
              variant={data?.daily_limits.utilization_percentage < 75 ? 'default' : 'destructive'}
              className="text-xs"
            >
              {data ? `${data.daily_limits.utilization_percentage}%` : 'N/A'} Utilized
            </Badge>
            <Button variant="ghost" size="sm" onClick={fetchExposureData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardTitle>
        <CardDescription>
          Real-time position risk with auto-remediation
          {data && (
            <span className="block text-xs text-muted-foreground mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data && (
          <div className="space-y-6">
            {/* Key Metrics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-center mb-2">
                  <DollarSign className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{formatCurrency(data.total_exposure)}</div>
                <div className="text-xs text-muted-foreground">Total Exposure</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-center mb-2">
                  <Target className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold">{data.kelly_at_risk.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">Kelly at Risk</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold">{formatCurrency(data.max_loss_today)}</div>
                <div className="text-xs text-muted-foreground">Max Loss Today</div>
              </div>

              <div className="text-center p-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-center mb-2">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold">{data.correlation_clusters.length}</div>
                <div className="text-xs text-muted-foreground">Correlation Groups</div>
              </div>
            </div>

            {/* Daily Exposure Limit */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Daily Exposure Limit</h4>
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(data.daily_limits.current_exposure)} /{' '}
                  {formatCurrency(data.daily_limits.max_daily_exposure)}
                </span>
              </div>
              <Progress value={data.daily_limits.utilization_percentage} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{data.daily_limits.utilization_percentage}% utilized</span>
                <span>{formatCurrency(data.daily_limits.remaining_capacity)} remaining</span>
              </div>
            </div>

            {/* Risk Alerts */}
            {data.risk_alerts.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-red-500" />
                  Active Risk Alerts ({data.risk_alerts.length})
                </h4>
                <div className="space-y-2">
                  {data.risk_alerts.slice(0, 3).map((alert, index) => (
                    <Alert
                      key={index}
                      className={`border-l-4 ${getAlertSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <AlertDescription>
                            <div className="font-medium text-sm mb-1">{alert.message}</div>
                            <div className="text-xs text-muted-foreground mb-2">
                              Type: {alert.type} • Severity: {alert.severity} • Affects:{' '}
                              {alert.affected_picks.length} picks
                            </div>
                            <div className="text-xs bg-muted/50 p-2 rounded">
                              <strong>Recommended:</strong> {alert.recommended_action}
                            </div>
                          </AlertDescription>
                        </div>
                        <Badge
                          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="ml-2"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {/* Correlation Clusters */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Top Risk Clusters</h4>
              <div className="space-y-2">
                {data.correlation_clusters.slice(0, 5).map((cluster, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm">{cluster.cluster}</span>
                        <Badge variant="outline" className={getRiskTierColor(cluster.risk_tier)}>
                          {cluster.risk_tier}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {cluster.picks_count} picks • {formatCurrency(cluster.exposure)} exposure
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">{formatCurrency(cluster.exposure)}</div>
                      <div className="text-xs text-muted-foreground">
                        {((cluster.exposure / data.total_exposure) * 100).toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-Remediation Actions */}
            {data.remediation_actions && data.remediation_actions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-yellow-500" />
                  Auto-Remediation Recommendations
                </h4>
                <div className="space-y-3">
                  {data.remediation_actions.map((action, index) => (
                    <div key={index} className="p-4 rounded-lg border bg-muted/10">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {action.type.replace('_', ' ').toUpperCase()}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {action.target_pick_ids.length} picks affected
                            </span>
                          </div>
                          <p className="text-sm mb-2">{action.adjustment.reason}</p>

                          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <ArrowDown className="w-3 h-3 text-green-500" />
                              <span>
                                Exposure: -
                                {formatCurrency(action.estimated_impact.exposure_reduction)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <ArrowDown className="w-3 h-3 text-blue-500" />
                              <span>
                                Kelly: -{action.estimated_impact.kelly_reduction.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => executeRemediation(index)}
                          disabled={executingRemediation === action.type}
                          className="ml-4"
                        >
                          {executingRemediation === action.type ? (
                            <>
                              <RefreshCw className="w-3 h-3 mr-2 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-2" />
                              Execute
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sport/Market Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* By Sport */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Exposure by Sport</h4>
                <div className="space-y-2">
                  {Object.entries(data.exposure_by_sport)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([sport, exposure]) => (
                      <div key={sport} className="flex items-center justify-between text-sm">
                        <span>{sport}</span>
                        <div className="text-right">
                          <div>{formatCurrency(exposure)}</div>
                          <div className="text-xs text-muted-foreground">
                            {((exposure / data.total_exposure) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* By Market */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Exposure by Market</h4>
                <div className="space-y-2">
                  {Object.entries(data.exposure_by_market)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 4)
                    .map(([market, exposure]) => (
                      <div key={market} className="flex items-center justify-between text-sm">
                        <span>{market.replace('_', ' ')}</span>
                        <div className="text-right">
                          <div>{formatCurrency(exposure)}</div>
                          <div className="text-xs text-muted-foreground">
                            {((exposure / data.total_exposure) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* No Exposure State */}
            {data.total_exposure === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No active exposure positions</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
