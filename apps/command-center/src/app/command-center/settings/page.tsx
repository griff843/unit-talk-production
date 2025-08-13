'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Settings, 
  Users, 
  Key, 
  Database,
  Webhook,
  RefreshCw,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Calendar,
  User,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  meta: any;
}

interface AlertmanagerConfig {
  webhook_url: string;
  webhook_status: string;
  safe_mode_enabled: boolean;
  recent_activity: Array<{
    timestamp: string;
    action: string;
    details: any;
  }>;
  configuration: {
    critical_alerts_trigger_safe_mode: boolean;
    auto_incident_creation: boolean;
    auto_resolution: boolean;
  };
}

interface TestAlertConfig {
  test_alerts_enabled: boolean;
  environment: string;
  available_alert_types: Array<{
    type: string;
    description: string;
    triggers_safe_mode: boolean;
  }>;
  permissions: {
    can_trigger_test_alerts: boolean;
  };
}

const AuditLogCard = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);

  const fetchAuditLogs = async () => {
    try {
      const response = await fetch(`/api/ops/audit?limit=${limit}`);
      if (response.ok) {
        const data = await response.json();
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [limit]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Database className="w-5 h-5 mr-2" />
          Audit Log
        </CardTitle>
        <CardDescription>
          Recent system actions and configuration changes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Show last:</label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="p-1 border rounded text-sm"
              >
                <option value={25}>25 entries</option>
                <option value={50}>50 entries</option>
                <option value={100}>100 entries</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-4">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8">
              <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="font-medium">{log.target}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{log.actor}</span>
                  </div>
                  {log.meta && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted-foreground">
                        View Details
                      </summary>
                      <pre className="mt-1 p-2 bg-muted/20 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.meta, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const EnvironmentConfigCard = () => {
  const [showSecrets, setShowSecrets] = useState(false);

  const envVars = [
    { key: 'NODE_ENV', value: 'production', sensitive: false },
    { key: 'NEXT_PUBLIC_SUPABASE_URL', value: process.env.NEXT_PUBLIC_SUPABASE_URL || '[Not Set]', sensitive: false },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', value: '[REDACTED]', sensitive: true },
    { key: 'TEMPORAL_ADDRESS', value: process.env.TEMPORAL_ADDRESS || '[Not Set]', sensitive: false },
    { key: 'GITHUB_TOKEN', value: '[REDACTED]', sensitive: true },
    { key: 'DISCORD_BOT_TOKEN', value: '[REDACTED]', sensitive: true },
    { key: 'NOTION_TOKEN', value: '[REDACTED]', sensitive: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Environment Configuration
        </CardTitle>
        <CardDescription>
          Current environment variables and configuration (sensitive values redacted)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Environment Variables</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSecrets(!showSecrets)}
            >
              {showSecrets ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide Secrets
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show Secrets
                </>
              )}
            </Button>
          </div>

          <div className="space-y-2">
            {envVars.map(({ key, value, sensitive }) => (
              <div key={key} className="flex items-center justify-between p-2 border rounded-lg">
                <div className="flex items-center space-x-2">
                  <code className="text-sm font-mono">{key}</code>
                  {sensitive && <Shield className="w-3 h-3 text-yellow-500" />}
                </div>
                <div className="text-sm font-mono">
                  {sensitive && !showSecrets ? '[REDACTED]' : value}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <h4 className="text-sm font-medium mb-2">System Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Platform:</span>
                <span className="ml-2 font-mono">Node.js</span>
              </div>
              <div>
                <span className="text-muted-foreground">Framework:</span>
                <span className="ml-2 font-mono">Next.js 14</span>
              </div>
              <div>
                <span className="text-muted-foreground">Database:</span>
                <span className="ml-2 font-mono">Supabase PostgreSQL</span>
              </div>
              <div>
                <span className="text-muted-foreground">Deployment:</span>
                <span className="ml-2 font-mono">Docker Container</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const WebhookStatusCard = () => {
  const [alertmanagerConfig, setAlertmanagerConfig] = useState<AlertmanagerConfig | null>(null);
  const [testAlertConfig, setTestAlertConfig] = useState<TestAlertConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchWebhookStatus = async () => {
    try {
      const [alertmanagerResponse, testAlertResponse] = await Promise.all([
        fetch('/api/alerts/alertmanager'),
        fetch('/api/ops/test/safemode-from-alert'),
      ]);

      if (alertmanagerResponse.ok) {
        setAlertmanagerConfig(await alertmanagerResponse.json());
      }

      if (testAlertResponse.ok) {
        setTestAlertConfig(await testAlertResponse.json());
      }
    } catch (error) {
      console.error('Error fetching webhook status:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerTestAlert = async (alertType: string) => {
    try {
      const response = await fetch('/api/ops/test/safemode-from-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alertType,
          severity: 'critical',
          reason: 'Test alert from Command Center settings',
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: 'Success',
          description: result.message,
        });
        
        // Refresh webhook status
        fetchWebhookStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || 'Failed to trigger test alert',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error triggering test alert:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger test alert',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchWebhookStatus();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading webhook status...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Webhook className="w-5 h-5 mr-2" />
          Webhook Status
        </CardTitle>
        <CardDescription>
          Alertmanager integration and webhook configuration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alertmanager Status */}
        {alertmanagerConfig && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Alertmanager Webhook</h4>
              <Badge variant={alertmanagerConfig.webhook_status === 'active' ? 'default' : 'secondary'}>
                {alertmanagerConfig.webhook_status}
              </Badge>
            </div>
            
            <div className="p-3 border rounded-lg bg-muted/20">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Webhook URL:</span>
                  <code className="text-xs">{alertmanagerConfig.webhook_url}</code>
                </div>
                <div className="flex justify-between">
                  <span>Auto Incident Creation:</span>
                  <Badge variant={alertmanagerConfig.configuration.auto_incident_creation ? 'default' : 'secondary'}>
                    {alertmanagerConfig.configuration.auto_incident_creation ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>Critical Alerts → Safe Mode:</span>
                  <Badge variant={alertmanagerConfig.configuration.critical_alerts_trigger_safe_mode ? 'default' : 'secondary'}>
                    {alertmanagerConfig.configuration.critical_alerts_trigger_safe_mode ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            {alertmanagerConfig.recent_activity.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Recent Webhook Activity</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {alertmanagerConfig.recent_activity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="p-2 border rounded text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{activity.action}</span>
                        <span className="text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test Alerts */}
        {testAlertConfig && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Test Alerts</h4>
              <Badge variant={testAlertConfig.test_alerts_enabled ? 'default' : 'secondary'}>
                {testAlertConfig.test_alerts_enabled ? 'Available' : 'Disabled'}
              </Badge>
            </div>

            {testAlertConfig.permissions.can_trigger_test_alerts ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Trigger test alerts to verify webhook integration
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {testAlertConfig.available_alert_types.slice(0, 4).map((alertType) => (
                    <Button
                      key={alertType.type}
                      variant="outline"
                      size="sm"
                      onClick={() => triggerTestAlert(alertType.type)}
                      className="justify-start"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {alertType.type.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Admin permissions required to trigger test alerts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/command-center">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Command Center
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">
              System configuration, audit logs, and webhook management
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Environment Configuration */}
        <EnvironmentConfigCard />

        {/* Webhook Status */}
        <WebhookStatusCard />
      </div>

      {/* Audit Log - Full Width */}
      <AuditLogCard />

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-medium">Command Center v1.0</p>
            </div>
            <div>
              <p className="text-muted-foreground">Database Schema</p>
              <p className="font-medium">v3.0.0 Unified</p>
            </div>
            <div>
              <p className="text-muted-foreground">Last Restart</p>
              <p className="font-medium">{new Date().toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Uptime</p>
              <p className="font-medium">Available</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}