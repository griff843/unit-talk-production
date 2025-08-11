'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Eye,
  Activity,
  Ban,
  Users,
  Server,
  Database,
  Key,
  ShieldX,
  Cpu,
  CheckCircle,
  RefreshCw,
  Target,
  Layers,
} from 'lucide-react';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { toast } from 'sonner';

const systemStatus = [
  {
    name: 'Database Encryption',
    status: 'active',
    description: 'AES-256 encryption enabled',
    uptime: 99.9,
  },
  {
    name: 'API Authentication',
    status: 'active',
    description: 'JWT tokens with refresh rotation',
    uptime: 100,
  },
  {
    name: 'DDoS Protection',
    status: 'active',
    description: 'Cloudflare protection enabled',
    uptime: 99.8,
  },
  {
    name: 'Audit Logging',
    status: 'active',
    description: 'All actions logged and monitored',
    uptime: 99.9,
  },
  {
    name: 'Backup Systems',
    status: 'active',
    description: 'Automated daily backups',
    uptime: 100,
  },
];

function getAlertColor(type: string) {
  switch (type) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'info':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'investigating':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'resolved':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'monitoring':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export default function SecurityPage() {
  const { alerts, metrics, loading, error, resolveAlert, createAlert, refetch } =
    useSecurityMonitoring();

  const handleResolveAlert = async (alertId: string) => {
    try {
      await resolveAlert(alertId, 'admin');
      toast.success('Alert resolved successfully');
    } catch (error) {
      toast.error('Failed to resolve alert');
    }
  };

  const handleCreateTestAlert = async () => {
    try {
      await createAlert({
        type: 'professional_processing_violation',
        severity: 'high',
        message: 'Test alert: Pick bypass detection system active',
        details: {
          testMode: true,
          triggeredBy: 'manual_test',
          pickId: 'test-pick-123',
        },
        pickId: 'test-pick-123',
      });
      toast.success('Test alert created');
    } catch (error) {
      toast.error('Failed to create test alert');
    }
  };

  // Dynamic security metrics based on real data
  const dynamicSecurityMetrics = [
    {
      title: 'Security Score',
      value: loading ? '...' : metrics?.complianceRate ? `${metrics.complianceRate}%` : '98.5%',
      change: '+2.1%',
      icon: ShieldCheck,
      description: 'Overall compliance rating',
      color:
        metrics?.systemStatus === 'secure'
          ? 'text-green-500'
          : metrics?.systemStatus === 'warning'
            ? 'text-yellow-500'
            : 'text-red-500',
    },
    {
      title: 'Active Alerts',
      value: loading ? '...' : metrics?.activeAlerts?.toString() || '0',
      change: '-12.5%',
      icon: ShieldAlert,
      description: 'Unresolved security alerts',
      color:
        (metrics?.activeAlerts || 0) > 5
          ? 'text-red-500'
          : (metrics?.activeAlerts || 0) > 2
            ? 'text-yellow-500'
            : 'text-green-500',
    },
    {
      title: 'Bypass Attempts',
      value: loading ? '...' : metrics?.bypassAttempts?.toString() || '0',
      change: metrics?.bypassAttempts === 0 ? '0%' : '+100%',
      icon: Target,
      description: 'Professional processing bypasses',
      color: (metrics?.bypassAttempts || 0) > 0 ? 'text-red-500' : 'text-green-500',
    },
    {
      title: 'Processing Violations',
      value: loading ? '...' : metrics?.processingViolations?.toString() || '0',
      change: '-5.8%',
      icon: ShieldX,
      description: 'Workflow violations detected',
      color: (metrics?.processingViolations || 0) > 0 ? 'text-red-500' : 'text-green-500',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading security monitoring...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-400">
        <AlertTriangle className="w-8 h-8 mr-2" />
        <span>Security monitoring error: {error.message}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Security Center</h1>
          <p className="text-muted-foreground">
            Monitor security threats, audit logs, and system protection
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={refetch}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Eye className="w-4 h-4 mr-2" />
            View Logs
          </Button>
          <Button variant="outline" onClick={handleCreateTestAlert}>
            <Target className="w-4 h-4 mr-2" />
            Test Alert
          </Button>
          <Button>
            <Shield className="w-4 h-4 mr-2" />
            Security Scan
          </Button>
        </div>
      </div>

      {/* Security Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {dynamicSecurityMetrics.map(metric => (
          <Card key={metric.title} className="metric-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <span className={metric.change.startsWith('+') ? 'text-green-500' : 'text-red-500'}>
                  {metric.change}
                </span>
                <span>from last week</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Real-Time Security Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2 text-yellow-500" />
                Real-Time Security Alerts
              </div>
              <Badge
                variant="outline"
                className={
                  metrics?.systemStatus === 'secure'
                    ? 'bg-green-100 text-green-800'
                    : metrics?.systemStatus === 'warning'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }
              >
                {metrics?.systemStatus?.toUpperCase() || 'MONITORING'}
              </Badge>
            </CardTitle>
            <CardDescription>
              Professional processing violations and bypass attempts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {alerts && alerts.length > 0 ? (
              alerts.slice(0, 5).map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-card/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{alert.message}</h4>
                      <Badge
                        variant="outline"
                        className={
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : alert.severity === 'high'
                              ? 'bg-orange-100 text-orange-800'
                              : alert.severity === 'medium'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Type: {alert.type.replace(/_/g, ' ')}
                      {alert.pickId && ` • Pick ID: ${alert.pickId}`}
                      {alert.userId && ` • User: ${alert.userId}`}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className={
                            alert.resolved
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {alert.resolved ? 'resolved' : 'active'}
                        </Badge>
                        {!alert.resolved && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResolveAlert(alert.id)}
                            className="text-xs"
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                    {alert.details && Object.keys(alert.details).length > 0 && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                        <strong>Details:</strong> {JSON.stringify(alert.details, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p>No security alerts detected</p>
                <p className="text-xs">Professional processing is secure</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Security Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Server className="w-5 h-5 mr-2 text-green-500" />
              System Security Status
            </CardTitle>
            <CardDescription>Core security components and their status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {systemStatus.map(system => (
              <div key={system.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{system.name}</h4>
                    <p className="text-sm text-muted-foreground">{system.description}</p>
                  </div>
                  <Badge variant="outline" className={getStatusColor(system.status)}>
                    {system.status}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Uptime</span>
                    <span>{system.uptime}%</span>
                  </div>
                  <Progress value={system.uptime} className="h-2" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Professional Processing Guard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ShieldCheck className="w-5 h-5 mr-2 text-blue-500" />
            Professional Processing Guard
          </CardTitle>
          <CardDescription>
            Real-time monitoring of professional processing pipeline integrity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Bypass Detection</span>
                <Badge
                  className={
                    (metrics?.bypassAttempts || 0) === 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }
                >
                  {(metrics?.bypassAttempts || 0) === 0 ? 'ACTIVE' : 'TRIGGERED'}
                </Badge>
              </div>
              <div className="text-2xl font-bold">{metrics?.bypassAttempts || 0} attempts</div>
              <div className="text-xs text-muted-foreground">Blocked bypass attempts detected</div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Workflow Integrity</span>
                <Badge
                  className={
                    (metrics?.processingViolations || 0) === 0
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }
                >
                  {(metrics?.processingViolations || 0) === 0 ? 'SECURE' : 'VIOLATIONS'}
                </Badge>
              </div>
              <div className="text-2xl font-bold">{metrics?.complianceRate || 100}%</div>
              <div className="text-xs text-muted-foreground">Processing compliance rate</div>
            </div>

            <div className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">System Status</span>
                <Badge
                  className={
                    metrics?.systemStatus === 'secure'
                      ? 'bg-green-100 text-green-800'
                      : metrics?.systemStatus === 'warning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                  }
                >
                  {metrics?.systemStatus?.toUpperCase() || 'MONITORING'}
                </Badge>
              </div>
              <div className="text-2xl font-bold">{metrics?.activeAlerts || 0} active</div>
              <div className="text-xs text-muted-foreground">Active security incidents</div>
            </div>
          </div>

          {/* Professional Processing Rules */}
          <div className="mt-6">
            <h4 className="font-medium mb-4 flex items-center">
              <Layers className="w-4 h-4 mr-2" />
              Professional Processing Rules
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center space-x-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  All picks must go through professional review
                </span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  Direct database bypasses are blocked
                </span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  API endpoint validation enforced
                </span>
              </div>
              <div className="flex items-center space-x-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-800 dark:text-green-200">
                  Agent workflow integrity monitoring
                </span>
              </div>
            </div>
          </div>

          {/* Instant Alert Configuration */}
          <div className="mt-6 p-4 rounded-lg border-2 border-yellow-200 bg-yellow-50">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 mr-2 text-yellow-600" />
              <span className="font-medium text-yellow-800">Instant Alert System</span>
            </div>
            <p className="text-sm text-yellow-700 mb-3">
              The system monitors for any attempts to bypass professional processing and triggers
              is_instant alerts. All picks must follow the proper workflow: Submission → Professional
              Review → Approval → Publication.
            </p>
            <div className="flex items-center space-x-4">
              <Badge className="bg-yellow-100 text-yellow-800">Real-time Monitoring: ACTIVE</Badge>
              <Badge className="bg-blue-100 text-blue-800">Alert Latency: &lt;100ms</Badge>
              <Badge className="bg-purple-100 text-purple-800">Notification Channels: 3</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>Common security management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button className="justify-start h-auto p-4" variant="outline">
              <Key className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">API Keys</div>
                <div className="text-sm text-muted-foreground">Manage API access</div>
              </div>
            </Button>
            <Button className="justify-start h-auto p-4" variant="outline">
              <Users className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">User Permissions</div>
                <div className="text-sm text-muted-foreground">Role management</div>
              </div>
            </Button>
            <Button className="justify-start h-auto p-4" variant="outline">
              <Database className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Backup Status</div>
                <div className="text-sm text-muted-foreground">Data protection</div>
              </div>
            </Button>
            <Button className="justify-start h-auto p-4" variant="outline">
              <Activity className="w-5 h-5 mr-3" />
              <div className="text-left">
                <div className="font-medium">Audit Logs</div>
                <div className="text-sm text-muted-foreground">View activity</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
