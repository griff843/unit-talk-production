'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Clock,
  Database,
  Wifi,
  WifiOff,
  Key,
  DollarSign,
  TrendingUp,
  Settings,
  Download,
  Filter,
} from 'lucide-react';
import { ApiHealthMonitor } from '@/components/monitoring/api-health-monitor';

interface MonitoringConfig {
  intervalMs: number;
  retryAttempts: number;
  timeout: number;
  alertThresholds: {
    responseTime: number;
    errorRate: number;
    quotaWarning: number;
  };
}

export default function ApiHealthPage() {
  const [config, setConfig] = useState<MonitoringConfig>({
    intervalMs: 60000, // 1 minute
    retryAttempts: 3,
    timeout: 10000, // 10 seconds
    alertThresholds: {
      responseTime: 5000,
      errorRate: 0.1,
      quotaWarning: 0.9,
    },
  });

  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const response = await fetch('/api/monitoring');
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch system status:', error);
      }
    };

    fetchSystemStatus();
    const interval = setInterval(fetchSystemStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const exportHealthData = async () => {
    try {
      const response = await fetch('/api/monitoring?export=csv');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api-health-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export health data:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">API Health Monitor</h1>
          <p className="text-muted-foreground">
            Comprehensive monitoring of all data provider APIs with real-time alerting
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={exportHealthData}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      {systemStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              System Overview
            </CardTitle>
            <CardDescription>
              Overall health status across all monitored systems
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg border bg-muted/20">
                <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                  systemStatus.overall_system_health?.status === 'healthy' ? 'bg-green-500' :
                  systemStatus.overall_system_health?.status === 'degraded' ? 'bg-yellow-500' :
                  'bg-red-500'
                } animate-pulse`} />
                <div className="text-lg font-bold">
                  {systemStatus.overall_system_health?.status?.toUpperCase() || 'UNKNOWN'}
                </div>
                <div className="text-sm text-muted-foreground">Overall Status</div>
              </div>

              <div className="text-center p-4 rounded-lg border bg-muted/20">
                <div className="w-4 h-4 bg-blue-500 rounded-full mx-auto mb-2 animate-pulse" />
                <div className="text-lg font-bold">
                  {systemStatus.api_health?.summary?.totalAPIs || 0}
                </div>
                <div className="text-sm text-muted-foreground">Total APIs</div>
              </div>

              <div className="text-center p-4 rounded-lg border bg-muted/20">
                <div className="w-4 h-4 bg-green-500 rounded-full mx-auto mb-2 animate-pulse" />
                <div className="text-lg font-bold">
                  {systemStatus.api_health?.summary?.healthyAPIs || 0}
                </div>
                <div className="text-sm text-muted-foreground">Healthy APIs</div>
              </div>

              <div className="text-center p-4 rounded-lg border bg-muted/20">
                <div className="w-4 h-4 bg-red-500 rounded-full mx-auto mb-2 animate-pulse" />
                <div className="text-lg font-bold">
                  {systemStatus.overall_system_health?.critical_issues?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Critical Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs defaultValue="monitor" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monitor">Live Monitor</TabsTrigger>
          <TabsTrigger value="alerts">Alert History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-4">
          <ApiHealthMonitor />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertHistoryTab />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <AnalyticsTab historicalData={historicalData} />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <ConfigurationTab config={config} onConfigChange={setConfig} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertHistoryTab() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('/api/alerts?limit=50');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setAlerts(data.alerts);
          }
        }
      } catch (error) {
        console.error('Failed to fetch alerts:', error);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Alert History</span>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="all">All Alerts</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No alerts found
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border ${
                  alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                  alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                  'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium">{alert.provider}</h4>
                    <p className="text-sm mt-1">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge className={
                    alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }>
                    {alert.severity}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsTab({ historicalData }: { historicalData: any[] }) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>API Performance Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
            Performance charts will be available soon
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigurationTab({ 
  config, 
  onConfigChange 
}: { 
  config: MonitoringConfig; 
  onConfigChange: (config: MonitoringConfig) => void; 
}) {
  const handleConfigUpdate = async () => {
    try {
      const response = await fetch('/api/monitoring/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        alert('Configuration updated successfully!');
      }
    } catch (error) {
      console.error('Failed to update configuration:', error);
      alert('Failed to update configuration');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Configuration</CardTitle>
        <CardDescription>
          Configure API monitoring intervals, thresholds, and alert settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium">Check Interval (ms)</label>
            <input
              type="number"
              value={config.intervalMs}
              onChange={(e) => onConfigChange({ ...config, intervalMs: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
              min="10000"
              step="1000"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Timeout (ms)</label>
            <input
              type="number"
              value={config.timeout}
              onChange={(e) => onConfigChange({ ...config, timeout: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
              min="1000"
              step="1000"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Response Time Alert (ms)</label>
            <input
              type="number"
              value={config.alertThresholds.responseTime}
              onChange={(e) => onConfigChange({
                ...config,
                alertThresholds: { ...config.alertThresholds, responseTime: parseInt(e.target.value) }
              })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
              min="1000"
              step="500"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Quota Warning (%)</label>
            <input
              type="number"
              value={config.alertThresholds.quotaWarning * 100}
              onChange={(e) => onConfigChange({
                ...config,
                alertThresholds: { ...config.alertThresholds, quotaWarning: parseInt(e.target.value) / 100 }
              })}
              className="w-full mt-1 px-3 py-2 border rounded-md"
              min="50"
              max="99"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleConfigUpdate}>
            <Settings className="w-4 h-4 mr-2" />
            Update Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}