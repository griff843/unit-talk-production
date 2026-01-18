'use client';

/**
 * SLO Dashboard Page - Phase 3
 *
 * Displays real-time SLO status, recent alerts, and key metrics.
 * NO MOCK DATA - all from real backend APIs.
 */

import { useState, useEffect } from 'react';
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
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Play,
  Database,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SLOStatusResponse, SLOStatus, AlertEvent } from '@/lib/slo/types';

export default function SLODashboardPage() {
  const [sloStatus, setSloStatus] = useState<SLOStatusResponse | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<AlertEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningManual, setRunningManual] = useState(false);

  const fetchSLOStatus = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/slo/status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setSloStatus(data);
    } catch (error) {
      console.error('Failed to fetch SLO status:', error);
      toast.error(
        `Error loading SLO status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentAlerts = async () => {
    try {
      const response = await fetch('/api/alerts/recent?limit=20');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setRecentAlerts(data.alerts || []);
    } catch (error) {
      console.error('Failed to fetch recent alerts:', error);
    }
  };

  const runManualEvaluation = async () => {
    try {
      setRunningManual(true);
      toast.info('Running manual SLO evaluation...');

      const response = await fetch('/api/alerts/run', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        toast.success(
          `Manual evaluation complete: ${data.alerts_generated} alerts generated`
        );
        // Refresh data
        await Promise.all([fetchSLOStatus(), fetchRecentAlerts()]);
      } else {
        toast.error(`Manual evaluation failed: ${data.message}`);
      }
    } catch (error) {
      console.error('Failed to run manual evaluation:', error);
      toast.error(
        `Error running manual evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setRunningManual(false);
    }
  };

  useEffect(() => {
    fetchSLOStatus();
    fetchRecentAlerts();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchSLOStatus();
      fetchRecentAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: SLOStatus) => {
    switch (status) {
      case 'PASS':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'WARN':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'FAIL':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'UNKNOWN':
        return <HelpCircle className="w-5 h-5 text-gray-600" />;
      default:
        return <HelpCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: SLOStatus) => {
    switch (status) {
      case 'PASS':
        return <Badge className="bg-green-100 text-green-800">PASS</Badge>;
      case 'WARN':
        return <Badge className="bg-yellow-100 text-yellow-800">WARN</Badge>;
      case 'FAIL':
        return <Badge className="bg-red-100 text-red-800">FAIL</Badge>;
      case 'UNKNOWN':
        return <Badge className="bg-gray-100 text-gray-800">UNKNOWN</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return (
          <Badge className="bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            CRITICAL
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            WARNING
          </Badge>
        );
      case 'info':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <HelpCircle className="w-3 h-3 mr-1" />
            INFO
          </Badge>
        );
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6" data-testid="slo-dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center" data-testid="page-title">
            <AlertTriangle className="w-8 h-8 mr-3" />
            SLO & Alerts Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time Service Level Objective monitoring and alerting
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={runManualEvaluation} disabled={runningManual} variant="default" data-testid="run-evaluation-button">
            <Play className={`w-4 h-4 mr-2 ${runningManual ? 'animate-spin' : ''}`} />
            Run Evaluation
          </Button>
          <Button onClick={fetchSLOStatus} disabled={loading} variant="outline" data-testid="refresh-button">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall Status Card */}
      {sloStatus && (
        <Card className="border-2" data-testid="overall-status-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                {getStatusIcon(sloStatus.overall_status)}
                <span>Overall SLO Status</span>
              </CardTitle>
              {getStatusBadge(sloStatus.overall_status)}
            </div>
            <CardDescription>
              Last updated: {new Date(sloStatus.timestamp).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2" data-testid="data-source-local-postgres">
                <Database className="w-4 h-4 text-gray-500" />
                <span className="text-sm">
                  Local Postgres:{' '}
                  {sloStatus.data_sources.local_postgres ? (
                    <Badge className="bg-green-100 text-green-800" data-testid="local-postgres-badge-connected">Connected</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800" data-testid="local-postgres-badge-disconnected">Disconnected</Badge>
                  )}
                </span>
              </div>
              <div className="flex items-center space-x-2" data-testid="data-source-supabase">
                <Cloud className="w-4 h-4 text-gray-500" />
                <span className="text-sm">
                  Supabase:{' '}
                  {sloStatus.data_sources.supabase ? (
                    <Badge className="bg-green-100 text-green-800" data-testid="supabase-badge-connected">Connected</Badge>
                  ) : (
                    <Badge className="bg-red-100 text-red-800" data-testid="supabase-badge-disconnected">Disconnected</Badge>
                  )}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLO Status Table */}
      <Card data-testid="slo-status-card">
        <CardHeader>
          <CardTitle>SLO Status Details</CardTitle>
          <CardDescription>
            All monitored SLOs with current values and thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32" data-testid="loading-indicator">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading SLO status...</span>
            </div>
          ) : sloStatus ? (
            <div className="overflow-x-auto">
              <Table data-testid="slo-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>SLO Name</TableHead>
                    <TableHead>Current Value</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Data Source</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="slo-table-body">
                  {sloStatus.slos.map(slo => (
                    <TableRow key={slo.slo_name} data-testid={`slo-row-${slo.slo_name}`}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(slo.status)}
                          {getStatusBadge(slo.status)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {slo.slo_name.replace(/_/g, ' ').toUpperCase()}
                      </TableCell>
                      <TableCell className="font-mono">
                        {slo.current_value !== null ? slo.current_value : 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono">{slo.threshold}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {slo.data_source}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{slo.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="no-data-message">
              <p>No SLO data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Alerts Table */}
      <Card data-testid="recent-alerts-card">
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>Last 20 alert events from alert_events table</CardDescription>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="no-alerts-message">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
              <p>No recent alerts - all systems nominal</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="recent-alerts-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>SLO</TableHead>
                    <TableHead>Value / Threshold</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody data-testid="recent-alerts-table-body">
                  {recentAlerts.map(alert => (
                    <TableRow key={alert.id} data-testid={`alert-row-${alert.id}`}>
                      <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                      <TableCell className="font-medium">{alert.title}</TableCell>
                      <TableCell className="font-mono text-xs">{alert.slo_name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {alert.current_value !== null ? alert.current_value : 'N/A'} /{' '}
                        {alert.threshold}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(alert.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          {alert.acknowledged ? (
                            <Badge className="bg-blue-100 text-blue-800 w-fit">ACK</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 w-fit">PENDING</Badge>
                          )}
                          {alert.resolved && (
                            <Badge className="bg-green-100 text-green-800 w-fit">
                              RESOLVED
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thresholds Configuration */}
      {sloStatus && (
        <Card>
          <CardHeader>
            <CardTitle>SLO Thresholds</CardTitle>
            <CardDescription>
              Current threshold configuration (set via environment variables)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(sloStatus.thresholds).map(([key, value]) => (
                <div key={key} className="p-3 rounded-lg border bg-muted/20">
                  <div className="text-xs text-muted-foreground">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="text-lg font-bold">{value}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
