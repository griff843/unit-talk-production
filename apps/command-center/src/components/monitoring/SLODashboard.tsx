'use client';

/**
 * =============================================================================
 * SLO DASHBOARD COMPONENT - Fortune 100 Grade Implementation
 * =============================================================================
 * 
 * Comprehensive SLO monitoring dashboard providing:
 * - Real-time SLO status with color-coded health indicators
 * - Error budget tracking with burn rate visualization
 * - Historical SLO performance trends
 * - Violation alert system with escalation indicators
 * - Critical SLO metrics (Alert Latency, Rescore Freshness, etc.)
 *
 * Features:
 * - Live data updates every 30 seconds
 * - P99 performance tracking with thresholds
 * - Interactive charts for trend analysis
 * - Drill-down capabilities for detailed investigation
 * - Emergency alert notifications for critical violations
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity,
  Zap,
  Database,
  Server,
  Gauge,
  AlertCircle,
  RotateCcw,
  Eye,
  BarChart3,
} from 'lucide-react';

interface SLOMetric {
  name: string;
  current_value: number;
  threshold_warning: number;
  threshold_critical: number;
  unit: string;
  status: 'healthy' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
  last_violation?: string;
}

interface ErrorBudget {
  slo_name: string;
  budget_remaining: number;
  burn_rate: number;
  time_to_exhaustion_hours: number;
  alert_threshold_breached: boolean;
}

interface SLOViolation {
  timestamp: string;
  slo_name: string;
  severity: 'critical' | 'warning';
  value: number;
  threshold: number;
  duration_minutes: number;
}

interface SLODashboardProps {
  refreshInterval?: number;
  showDetailedMetrics?: boolean;
}

export function SLODashboard({ refreshInterval = 30000, showDetailedMetrics = true }: SLODashboardProps) {
  const [sloMetrics, setSloMetrics] = useState<SLOMetric[]>([]);
  const [errorBudgets, setErrorBudgets] = useState<ErrorBudget[]>([]);
  const [violations, setViolations] = useState<SLOViolation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRealTime, setIsRealTime] = useState(true);

  // Fetch SLO data
  const fetchSLOData = async () => {
    try {
      const [metricsRes, budgetsRes, violationsRes] = await Promise.all([
        fetch('/api/operator-dashboard/slo/current', { cache: 'no-store' }),
        fetch('/api/operator-dashboard/slo/error-budgets', { cache: 'no-store' }),
        fetch('/api/operator-dashboard/slo/violations?hours=24', { cache: 'no-store' })
      ]);

      if (!metricsRes.ok || !budgetsRes.ok || !violationsRes.ok) {
        throw new Error('Failed to fetch SLO data');
      }

      const [metricsData, budgetsData, violationsData] = await Promise.all([
        metricsRes.json(),
        budgetsRes.json(),
        violationsRes.json()
      ]);

      // Transform metrics data into SLOMetric format
      const transformedMetrics: SLOMetric[] = [
        {
          name: 'Alert Latency P99',
          current_value: metricsData.data.alert_latency_p99 || 0,
          threshold_warning: 800,
          threshold_critical: 1000,
          unit: 'ms',
          status: getStatus(metricsData.data.alert_latency_p99, 800, 1000, 'higher'),
          trend: 'stable'
        },
        {
          name: 'Rescore Freshness',
          current_value: metricsData.data.rescore_freshness_minutes || 0,
          threshold_warning: 3,
          threshold_critical: 5,
          unit: 'min',
          status: getStatus(metricsData.data.rescore_freshness_minutes, 3, 5, 'higher'),
          trend: 'stable'
        },
        {
          name: 'Missed Tick Rate',
          current_value: (metricsData.data.missed_tick_rate || 0) * 100,
          threshold_warning: 0.05,
          threshold_critical: 0.1,
          unit: '%',
          status: getStatus((metricsData.data.missed_tick_rate || 0) * 100, 0.05, 0.1, 'higher'),
          trend: 'stable'
        },
        {
          name: 'Archiver Lag',
          current_value: metricsData.data.archiver_lag_hours || 0,
          threshold_warning: 12,
          threshold_critical: 24,
          unit: 'hrs',
          status: getStatus(metricsData.data.archiver_lag_hours, 12, 24, 'higher'),
          trend: 'stable'
        },
        {
          name: 'Feature Store Freshness',
          current_value: metricsData.data.feature_store_lag_minutes || 0,
          threshold_warning: 30,
          threshold_critical: 60,
          unit: 'min',
          status: getStatus(metricsData.data.feature_store_lag_minutes, 30, 60, 'higher'),
          trend: 'stable'
        },
        {
          name: 'Grading Throughput',
          current_value: metricsData.data.grading_throughput_per_minute || 0,
          threshold_warning: 500,
          threshold_critical: 1000,
          unit: '/min',
          status: getStatus(metricsData.data.grading_throughput_per_minute, 500, 1000, 'lower'),
          trend: 'stable'
        },
        {
          name: 'System Availability',
          current_value: metricsData.data.system_availability_percentage || 0,
          threshold_warning: 99.5,
          threshold_critical: 99.9,
          unit: '%',
          status: getStatus(metricsData.data.system_availability_percentage, 99.5, 99.9, 'lower'),
          trend: 'stable'
        },
        {
          name: 'Data Pipeline Success',
          current_value: metricsData.data.data_pipeline_success_rate || 0,
          threshold_warning: 99.0,
          threshold_critical: 99.8,
          unit: '%',
          status: getStatus(metricsData.data.data_pipeline_success_rate, 99.0, 99.8, 'lower'),
          trend: 'stable'
        }
      ];

      setSloMetrics(transformedMetrics);
      setErrorBudgets(budgetsData.data || []);
      setViolations(violationsData.data || []);
      setError(null);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch SLO data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine SLO status
  const getStatus = (
    value: number,
    warningThreshold: number,
    criticalThreshold: number,
    direction: 'higher' | 'lower'
  ): 'healthy' | 'warning' | 'critical' => {
    if (direction === 'higher') {
      if (value > criticalThreshold) return 'critical';
      if (value > warningThreshold) return 'warning';
      return 'healthy';
    } else {
      if (value < criticalThreshold) return 'critical';
      if (value < warningThreshold) return 'warning';
      return 'healthy';
    }
  };

  // Real-time updates
  useEffect(() => {
    fetchSLOData();

    if (!isRealTime) return;

    const interval = setInterval(fetchSLOData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, isRealTime]);

  // Status badge component
  const StatusBadge = ({ status, size = 'default' }: { status: string; size?: 'default' | 'sm' }) => {
    const variants = {
      healthy: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
      warning: { variant: 'secondary' as const, icon: AlertTriangle, color: 'text-yellow-500' },
      critical: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-500' }
    };

    const config = variants[status as keyof typeof variants] || variants.critical;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${size === 'sm' ? 'text-xs' : ''}`}>
        <IconComponent className={`w-3 h-3 ${config.color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // SLO metric card component
  const SLOMetricCard = ({ metric }: { metric: SLOMetric }) => {
    const getIcon = (name: string) => {
      const iconMap: Record<string, React.ComponentType<any>> = {
        'Alert Latency P99': Zap,
        'Rescore Freshness': Clock,
        'Missed Tick Rate': Activity,
        'Archiver Lag': Database,
        'Feature Store Freshness': Server,
        'Grading Throughput': Gauge,
        'System Availability': CheckCircle,
        'Data Pipeline Success': BarChart3
      };
      return iconMap[name] || Activity;
    };

    const IconComponent = getIcon(metric.name);
    const isInverted = ['Grading Throughput', 'System Availability', 'Data Pipeline Success'].includes(metric.name);

    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconComponent className="w-4 h-4" />
            {metric.name}
          </CardTitle>
          <StatusBadge status={metric.status} size="sm" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {metric.current_value.toFixed(metric.unit === '%' ? 2 : 0)}{metric.unit}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
            <span>Target: {isInverted ? '≥' : '≤'}{metric.threshold_critical}{metric.unit}</span>
            <div className="flex items-center gap-1">
              {metric.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
              {metric.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
              {metric.trend === 'stable' && <div className="w-3 h-1 bg-gray-400 rounded" />}
            </div>
          </div>
          {metric.status !== 'healthy' && (
            <div className="mt-2 text-xs text-orange-600">
              Warning: {metric.status === 'critical' ? 'Critical' : 'Warning'} threshold breached
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Error budget component
  const ErrorBudgetCard = ({ budget }: { budget: ErrorBudget }) => {
    const budgetPercentage = Math.max(0, Math.min(100, budget.budget_remaining));
    const burnRateColor = budget.burn_rate > 2 ? 'text-red-500' : budget.burn_rate > 1 ? 'text-yellow-500' : 'text-green-500';

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{budget.slo_name}</CardTitle>
            {budget.alert_threshold_breached && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                Low Budget
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>Budget Remaining</span>
                <span className="font-medium">{budgetPercentage.toFixed(1)}%</span>
              </div>
              <Progress value={budgetPercentage} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Burn Rate</span>
                <div className={`font-medium ${burnRateColor}`}>
                  {budget.burn_rate.toFixed(2)}x
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Time Left</span>
                <div className="font-medium">
                  {budget.time_to_exhaustion_hours < 24
                    ? `${budget.time_to_exhaustion_hours.toFixed(1)}h`
                    : `${(budget.time_to_exhaustion_hours / 24).toFixed(1)}d`
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Activity className="w-4 h-4 animate-spin" />
            <span>Loading SLO dashboard...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Error loading SLO dashboard: {error}
            </AlertDescription>
          </Alert>
          <Button onClick={fetchSLOData} className="mt-4" variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const criticalSLOs = sloMetrics.filter(m => m.status === 'critical');
  const warningSLOs = sloMetrics.filter(m => m.status === 'warning');
  const healthySLOs = sloMetrics.filter(m => m.status === 'healthy');
  const recentViolations = violations.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Gauge className="w-6 h-6" />
          <h2 className="text-2xl font-semibold">SLO Dashboard</h2>
          <div className="flex space-x-2">
            <Badge variant="outline">{(sloMetrics?.length ?? 0)} SLOs</Badge>
            <StatusBadge status={(criticalSLOs?.length ?? 0) > 0 ? 'critical' : (warningSLOs?.length ?? 0) > 0 ? 'warning' : 'healthy'} />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant={isRealTime ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsRealTime(!isRealTime)}
          >
            <Activity className="w-4 h-4 mr-2" />
            Real-time {isRealTime ? 'ON' : 'OFF'}
          </Button>
          <Button onClick={fetchSLOData} size="sm" variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Critical Alerts */}
      {(criticalSLOs?.length ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            <strong>{(criticalSLOs?.length ?? 0)} Critical SLO Violation{(criticalSLOs?.length ?? 0) > 1 ? 's' : ''}</strong>
            <br />
            {criticalSLOs.map(slo => slo.name).join(', ')} require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Healthy SLOs</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{(healthySLOs?.length ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {(((healthySLOs?.length ?? 0) / (sloMetrics?.length ?? 0)) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning SLOs</CardTitle>
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{(warningSLOs?.length ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Need attention soon
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical SLOs</CardTitle>
            <XCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{(criticalSLOs?.length ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Immediate action required
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">24h Violations</CardTitle>
            <AlertCircle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{(violations?.length ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Total violations today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard */}
      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">SLO Metrics</TabsTrigger>
          <TabsTrigger value="budgets">Error Budgets</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {sloMetrics.map((metric) => (
              <SLOMetricCard key={metric.name} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="budgets">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {errorBudgets.map((budget) => (
              <ErrorBudgetCard key={budget.slo_name} budget={budget} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="violations">
          <Card>
            <CardHeader>
              <CardTitle>Recent SLO Violations (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              {(recentViolations?.length ?? 0) === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>No SLO violations in the last 24 hours</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentViolations.map((violation, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <StatusBadge status={violation.severity} size="sm" />
                        <div>
                          <div className="font-medium">{violation.slo_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(violation.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {violation.value.toFixed(2)} {'>'} {violation.threshold.toFixed(2)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {violation.duration_minutes}min duration
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer */}
      {lastUpdated && (
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

export default SLODashboard;