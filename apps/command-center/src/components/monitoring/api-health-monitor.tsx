'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  AlertCircle,
  Database,
  Zap,
  Shield,
  Activity,
  DollarSign,
  Key,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useApiHealthMonitoring } from '@/lib/apiHealthMonitoring';

interface ApiAlert {
  id: string;
  provider: string;
  alertType: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  timestamp: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'down':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'degraded':
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'down':
      return <AlertCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Clock className="w-4 h-4 text-gray-600" />;
  }
}

function getAlertTypeIcon(alertType: string) {
  switch (alertType) {
    case 'api_key_expired':
    case 'api_key_invalid':
    case 'api_key_missing':
      return <Key className="w-4 h-4" />;
    case 'quota_exceeded':
      return <Database className="w-4 h-4" />;
    case 'provider_down':
    case 'connection_failed':
      return <WifiOff className="w-4 h-4" />;
    default:
      return <AlertTriangle className="w-4 h-4" />;
  }
}

export function ApiHealthMonitor() {
  const { statuses, summary, loading, lastUpdate, refreshAll } = useApiHealthMonitoring();
  const [alerts, setAlerts] = useState<ApiAlert[]>([]);
  const [dataIngestion, setDataIngestion] = useState<any>(null);

  // Fetch alerts and data ingestion status
  useEffect(() => {
    const fetchMonitoringData = async () => {
      try {
        // Fetch alerts
        const alertsResponse = await fetch('/api/alerts');
        if (alertsResponse.ok) {
          const alertsData = await alertsResponse.json();
          if (alertsData.success) {
            setAlerts(alertsData.alerts.slice(0, 5)); // Show latest 5 alerts
          }
        }

        // Fetch data ingestion status
        const ingestionResponse = await fetch('/api/monitoring?type=ingestion');
        if (ingestionResponse.ok) {
          const ingestionData = await ingestionResponse.json();
          if (ingestionData.success) {
            setDataIngestion(ingestionData.data_ingestion);
          }
        }
      } catch (error) {
        console.error('Failed to fetch monitoring data:', error);
      }
    };

    fetchMonitoringData();
    const interval = setInterval(fetchMonitoringData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (loading && statuses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            API Health Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading API health data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* API Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              API Health Monitor
            </div>
            <div className="flex items-center space-x-2">
              {lastUpdate && (
                <span className="text-sm text-muted-foreground">
                  Last check: {lastUpdate.toLocaleTimeString()}
                </span>
              )}
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Real-time monitoring of all data provider APIs with immediate alert notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Overall Status Banner */}
          {summary && (
            <div
              className={`p-4 rounded-lg border-2 mb-6 ${
                summary.overallStatus === 'healthy'
                  ? 'border-green-200 bg-green-50'
                  : summary.overallStatus === 'degraded'
                    ? 'border-yellow-200 bg-yellow-50'
                    : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-4 h-4 rounded-full animate-pulse ${
                      summary.overallStatus === 'healthy'
                        ? 'bg-green-500'
                        : summary.overallStatus === 'degraded'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <h3
                      className={`font-semibold ${
                        summary.overallStatus === 'healthy'
                          ? 'text-green-800'
                          : summary.overallStatus === 'degraded'
                            ? 'text-yellow-800'
                            : 'text-red-800'
                      }`}
                    >
                      System Status: {summary.overallStatus.toUpperCase()}
                    </h3>
                    <p
                      className={`text-sm ${
                        summary.overallStatus === 'healthy'
                          ? 'text-green-600'
                          : summary.overallStatus === 'degraded'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }`}
                    >
                      {summary.healthyAPIs} of {summary.totalAPIs} APIs operational
                      {summary.downAPIs > 0 && ` • ${summary.downAPIs} critical issues detected`}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    summary.overallStatus === 'healthy'
                      ? 'bg-green-100 text-green-800'
                      : summary.overallStatus === 'degraded'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }
                >
                  {Math.round(summary.averageResponseTime)}ms avg
                </Badge>
              </div>
            </div>
          )}

          {/* API Status Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {statuses.map(api => (
              <div
                key={api.name}
                className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-3 h-3 rounded-full animate-pulse ${getStatusColor(api.status)}`}
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{api.name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {api.errorMessage || `Healthy • ${api.responseTime}ms`}
                    </p>
                    {api.details?.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {api.details.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(api.status)}
                    <Badge
                      variant="outline"
                      className={
                        api.status === 'healthy'
                          ? 'text-green-600'
                          : api.status === 'degraded'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }
                    >
                      {api.status}
                    </Badge>
                  </div>
                  {api.quotaPercent !== undefined && (
                    <div className="text-xs text-muted-foreground">
                      Quota: {api.quotaPercent.toFixed(1)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Critical API Alerts
            </CardTitle>
            <CardDescription>Recent critical issues requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map(alert => (
                <div
                  key={alert.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'border-red-200 bg-red-50'
                      : alert.severity === 'warning'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-blue-200 bg-blue-50'
                  }`}
                >
                  <div
                    className={`p-1 rounded-full ${
                      alert.severity === 'critical'
                        ? 'bg-red-500/20 text-red-600'
                        : alert.severity === 'warning'
                          ? 'bg-yellow-500/20 text-yellow-600'
                          : 'bg-blue-500/20 text-blue-600'
                    }`}
                  >
                    {getAlertTypeIcon(alert.alertType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{alert.provider}</h4>
                      <Badge
                        className={
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : alert.severity === 'warning'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Ingestion Status */}
      {dataIngestion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Database className="w-5 h-5 mr-2" />
              Data Ingestion Monitor
            </CardTitle>
            <CardDescription>Real-time monitoring of data flow from all sources</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {dataIngestion.statuses?.map((source: any) => (
                <div
                  key={source.source}
                  className="flex items-center justify-between p-4 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        source.status === 'healthy'
                          ? 'bg-green-500'
                          : source.status === 'stale'
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                      }`}
                    />
                    <div>
                      <h4 className="font-medium">{source.source}</h4>
                      <p className="text-sm text-muted-foreground">
                        Last data: {source.minutesSinceLastData}min ago
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="outline"
                      className={
                        source.status === 'healthy'
                          ? 'text-green-600'
                          : source.status === 'stale'
                            ? 'text-yellow-600'
                            : 'text-red-600'
                      }
                    >
                      {source.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {source.recordsInLastHour} records/hr
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
