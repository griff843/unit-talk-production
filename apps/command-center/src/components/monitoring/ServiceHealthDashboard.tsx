'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Activity,
  Server,
  Play,
  Square,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ServiceHealth, ServiceMetrics } from '@/lib/dockerServiceMonitor';

interface ServiceHealthDashboardProps {
  refreshInterval?: number;
}

export function ServiceHealthDashboard({ refreshInterval = 5000 }: ServiceHealthDashboardProps) {
  const [metrics, setMetrics] = useState<ServiceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState<{ [key: string]: boolean }>({});
  const [isRealTime, setIsRealTime] = useState(true);

  // Fetch service metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/services?system=true&docker=true', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Control service
  const controlService = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: serviceName, action }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Service control failed');
      }

      // Refresh metrics after control action
      setTimeout(fetchMetrics, 1000);
    } catch (err) {
      console.error(`Failed to ${action} service:`, err);
      setError(err instanceof Error ? err.message : 'Service control failed');
    }
  };

  // Toggle log visibility
  const toggleLogs = (serviceName: string) => {
    setShowLogs(prev => ({
      ...prev,
      [serviceName]: !prev[serviceName],
    }));
  };

  // Real-time updates
  useEffect(() => {
    fetchMetrics();

    if (!isRealTime) return;

    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, isRealTime]);

  // Status badge component
  const StatusBadge = ({ status }: { status: ServiceHealth['status'] }) => {
    const variants = {
      healthy: { variant: 'default' as const, icon: CheckCircle, color: 'text-green-500' },
      unhealthy: { variant: 'destructive' as const, icon: XCircle, color: 'text-red-500' },
      starting: { variant: 'secondary' as const, icon: Clock, color: 'text-yellow-500' },
      stopped: { variant: 'outline' as const, icon: Square, color: 'text-gray-500' },
      error: { variant: 'destructive' as const, icon: AlertTriangle, color: 'text-red-500' },
    };

    const config = variants[status] || variants.error;
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <IconComponent className={`w-3 h-3 ${config.color}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Activity className="w-4 h-4 animate-spin" />
            <span>Loading service metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2 text-red-500">
            <AlertTriangle className="w-4 h-4" />
            <span>Error: {error}</span>
          </div>
          <Button onClick={fetchMetrics} className="mt-4">
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Server className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Service Health Dashboard</h2>
          {metrics && <Badge variant="outline">{metrics.services?.length || 0} services</Badge>}
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

          <Button onClick={fetchMetrics} size="sm" variant="outline">
            <RotateCcw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Overview */}
      {metrics?.system && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Cpu className="w-4 h-4" />
              <span>System Health</span>
              <StatusBadge status={(metrics.system as any)?.health || 'unknown'} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <div className="text-sm font-medium">CPU Usage</div>
                <div className="text-2xl font-bold">
                  {(metrics.system as any)?.metrics?.system?.cpu || 0}%
                </div>
                <Progress
                  value={(metrics.system as any)?.metrics?.system?.cpu || 0}
                  className="mt-1"
                />
              </div>

              <div>
                <div className="text-sm font-medium">Memory Usage</div>
                <div className="text-2xl font-bold">
                  {(metrics.system as any)?.metrics?.system?.memory?.percentage || 0}%
                </div>
                <Progress
                  value={(metrics.system as any)?.metrics?.system?.memory?.percentage || 0}
                  className="mt-1"
                />
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes((metrics.system as any)?.metrics?.system?.memory?.used || 0)} /
                  {formatBytes((metrics.system as any)?.metrics?.system?.memory?.total || 0)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Disk Usage</div>
                <div className="text-2xl font-bold">
                  {metrics.system.metrics?.system.disk.percentage}%
                </div>
                <Progress value={metrics.system.metrics?.system.disk.percentage} className="mt-1" />
                <div className="text-xs text-muted-foreground mt-1">
                  {formatBytes(metrics.system.metrics?.system.disk.used)} /
                  {formatBytes(metrics.system.metrics?.system.disk.total)}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium">Uptime</div>
                <div className="text-lg font-bold">
                  {Math.floor((metrics.system.metrics?.system.uptime || 0) / 3600)}h{' '}
                  {Math.floor(((metrics.system.metrics?.system.uptime || 0) % 3600) / 60)}m
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Load: {metrics.system.metrics?.system.load.load1}
                </div>
              </div>
            </div>

            {metrics.system.issues?.length > 0 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center space-x-2 text-yellow-800">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">System Issues:</span>
                </div>
                <ul className="mt-2 text-sm text-yellow-700">
                  {metrics.system.issues.map((issue, index) => (
                    <li key={index}>• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Docker Overview */}
      {metrics?.docker && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Server className="w-4 h-4" />
              <span>Docker Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {metrics.docker.running_containers}
                </div>
                <div className="text-sm text-muted-foreground">Running</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-gray-500">
                  {metrics.docker.stopped_containers}
                </div>
                <div className="text-sm text-muted-foreground">Stopped</div>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {metrics.docker.total_images}
                </div>
                <div className="text-sm text-muted-foreground">Images</div>
              </div>

              <div className="text-center">
                <div className="text-xl font-bold text-purple-500">{metrics.docker.disk_usage}</div>
                <div className="text-sm text-muted-foreground">Disk Usage</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service List */}
      <div className="grid gap-4">
        {metrics?.services?.map(service => (
          <Card key={service.container_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CardTitle className="text-lg">{service.name}</CardTitle>
                  <StatusBadge status={service.status} />
                  {service.health_check_passing && (
                    <Badge variant="outline" className="text-green-600">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Health Check Passing
                    </Badge>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Button size="sm" variant="outline" onClick={() => toggleLogs(service.name)}>
                    {showLogs[service.name] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => controlService(service.name, 'start')}
                    disabled={service.status === 'healthy'}
                  >
                    <Play className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => controlService(service.name, 'stop')}
                    disabled={service.status === 'stopped'}
                  >
                    <Square className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => controlService(service.name, 'restart')}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <div className="text-sm font-medium flex items-center space-x-1">
                    <Cpu className="w-3 h-3" />
                    <span>CPU</span>
                  </div>
                  <div className="text-lg font-bold">{service.cpu_usage.toFixed(1)}%</div>
                  <Progress value={service.cpu_usage} className="mt-1" />
                </div>

                <div>
                  <div className="text-sm font-medium flex items-center space-x-1">
                    <MemoryStick className="w-3 h-3" />
                    <span>Memory</span>
                  </div>
                  <div className="text-lg font-bold">
                    {((service.memory_usage / service.memory_limit) * 100).toFixed(1)}%
                  </div>
                  <Progress
                    value={(service.memory_usage / service.memory_limit) * 100}
                    className="mt-1"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatBytes(service.memory_usage)} / {formatBytes(service.memory_limit)}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium flex items-center space-x-1">
                    <Network className="w-3 h-3" />
                    <span>Network I/O</span>
                  </div>
                  <div className="text-sm">
                    <div>↓ {formatBytes(service.network_rx)}</div>
                    <div>↑ {formatBytes(service.network_tx)}</div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Uptime</span>
                  </div>
                  <div className="text-lg font-bold">{service.uptime}</div>
                  <div className="text-xs text-muted-foreground">
                    Restarts: {service.restart_count}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <div>Image: {service.image}</div>
                <div>Container ID: {service.container_id.substring(0, 12)}</div>
                {service.ports.length > 0 && <div>Ports: {service.ports.join(', ')}</div>}
              </div>

              {showLogs[service.name] && service.logs.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <div className="text-sm font-medium mb-2">Recent Logs</div>
                    <div className="bg-gray-50 p-3 rounded-md text-xs font-mono">
                      {service.logs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!metrics?.services || metrics.services.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center">
            <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2">No Services Found</h3>
            <p className="text-muted-foreground">
              No Docker containers are currently running. Start the development environment to see
              services.
            </p>
          </CardContent>
        </Card>
      )}

      {metrics && (
        <div className="text-xs text-muted-foreground text-center">
          Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
