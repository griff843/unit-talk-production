// @ts-nocheck
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Shield,
  FileText,
  Activity,
  Users,
  Database,
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Eye,
  RefreshCw,
  BarChart3,
  Settings,
  Lock,
  Key,
  Search,
} from 'lucide-react';
import { AuditTrail } from '@/components/monitoring/AuditTrail';
import { useAgentMonitoring } from '@/hooks/useAgentMonitoring';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { toast } from 'sonner';

interface ComplianceMetric {
  name: string;
  value: number;
  target: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

export default function AuditPage() {
  const { agents, loading: agentsLoading } = useAgentMonitoring();
  const { alerts, metrics, loading: securityLoading } = useSecurityMonitoring();
  const [selectedTab, setSelectedTab] = useState('logs');

  const complianceMetrics: ComplianceMetric[] = [
    {
      name: 'Data Retention',
      value: 98.5,
      target: 95,
      status: 'good',
      description: 'Log retention compliance for regulatory requirements',
    },
    {
      name: 'Access Control',
      value: 92.1,
      target: 98,
      status: 'warning',
      description: 'User access and permission management compliance',
    },
    {
      name: 'Audit Coverage',
      value: 99.2,
      target: 100,
      status: 'good',
      description: 'Percentage of system activities being audited',
    },
    {
      name: 'Security Events',
      value: 89.7,
      target: 95,
      status: 'warning',
      description: 'Security event logging and response compliance',
    },
  ];

  const systemActivities = [
    {
      category: 'Agent Operations',
      count: 1247,
      trend: '+12%',
      color: 'text-blue-600',
    },
    {
      category: 'User Actions',
      count: 234,
      trend: '+5%',
      color: 'text-green-600',
    },
    {
      category: 'Security Events',
      count: 23,
      trend: '-15%',
      color: 'text-orange-600',
    },
    {
      category: 'System Events',
      count: 456,
      trend: '+8%',
      color: 'text-purple-600',
    },
    {
      category: 'Data Access',
      count: 2134,
      trend: '+18%',
      color: 'text-indigo-600',
    },
    {
      category: 'Configuration Changes',
      count: 12,
      trend: '0%',
      color: 'text-yellow-600',
    },
  ];

  const handleGenerateReport = () => {
    toast.success('Compliance report generation started - will be available for download shortly');
  };

  const handleExportCompliance = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      complianceMetrics,
      systemActivities,
      securitySummary: {
        activeAlerts: metrics?.activeAlerts || 0,
        complianceRate: metrics?.complianceRate || 100,
        systemStatus: metrics?.systemStatus || 'secure',
      },
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Compliance report exported');
  };

  const getComplianceColor = (metric: ComplianceMetric) => {
    switch (metric.status) {
      case 'good':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getComplianceBadgeColor = (metric: ComplianceMetric) => {
    switch (metric.status) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (agentsLoading || securityLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading audit system...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Audit & Compliance Center</h1>
          <p className="text-muted-foreground">
            Comprehensive audit trails, compliance monitoring, and regulatory reporting
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={handleGenerateReport}>
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCompliance}>
            <Download className="w-4 h-4 mr-2" />
            Export Compliance
          </Button>
          <Badge
            className={
              metrics?.systemStatus === 'secure'
                ? 'bg-green-100 text-green-800'
                : metrics?.systemStatus === 'warning'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-red-100 text-red-800'
            }
          >
            System: {metrics?.systemStatus?.toUpperCase() || 'MONITORING'}
          </Badge>
        </div>
      </div>

      {/* Compliance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {complianceMetrics.map(metric => (
          <Card key={metric.name} className="metric-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.name}</CardTitle>
              <Badge className={getComplianceBadgeColor(metric)}>
                {metric.status.toUpperCase()}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${getComplianceColor(metric)}`}>
                {metric.value}%
              </div>
              <div className="mt-2">
                <Progress value={metric.value} className="h-2" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Target: {metric.target}% • {metric.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle>Audit & Compliance Dashboard</CardTitle>
          <CardDescription>
            Monitor system activities, review audit trails, and ensure regulatory compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="logs" className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Audit Logs
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center">
                <Activity className="w-4 h-4 mr-2" />
                System Activity
              </TabsTrigger>
              <TabsTrigger value="access" className="flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                Access Control
              </TabsTrigger>
            </TabsList>

            {/* Audit Logs Tab */}
            <TabsContent value="logs" className="mt-6">
              <AuditTrail />
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="mt-6">
              <div className="space-y-6">
                {/* Compliance Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Shield className="w-5 h-5 mr-2" />
                      Regulatory Compliance Status
                    </CardTitle>
                    <CardDescription>
                      Current compliance levels across all regulatory requirements
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {complianceMetrics.map(metric => (
                        <div
                          key={metric.name}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                metric.status === 'good'
                                  ? 'bg-green-500'
                                  : metric.status === 'warning'
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                            />
                            <div>
                              <p className="font-medium">{metric.name}</p>
                              <p className="text-sm text-muted-foreground">{metric.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${getComplianceColor(metric)}`}>
                              {metric.value}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Target: {metric.target}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Compliance Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Actions Required</CardTitle>
                    <CardDescription>
                      Recommended actions to improve compliance scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-3 rounded-lg border bg-yellow-50">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-yellow-800">Access Control Improvement</p>
                          <p className="text-sm text-yellow-700">
                            Review and update user access permissions to meet 98% compliance target
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border bg-blue-50">
                        <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">Data Retention Compliant</p>
                          <p className="text-sm text-blue-700">
                            Data retention policy is exceeding requirements at 98.5%
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* System Activity Tab */}
            <TabsContent value="activity" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Activity Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Activity className="w-5 h-5 mr-2" />
                      System Activity Summary
                    </CardTitle>
                    <CardDescription>
                      Overview of all system activities in the last 24 hours
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {systemActivities.map(activity => (
                        <div
                          key={activity.category}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        >
                          <div>
                            <p className="font-medium">{activity.category}</p>
                            <p className="text-sm text-muted-foreground">
                              {activity.count.toLocaleString()} events
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={activity.color}>
                              {activity.trend}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Clock className="w-5 h-5 mr-2" />
                      Recent Critical Activities
                    </CardTitle>
                    <CardDescription>Timeline of high-priority system events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-2 rounded border-l-4 border-l-green-500 bg-green-50">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">System Health Check Passed</p>
                          <p className="text-xs text-muted-foreground">5 minutes ago</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded border-l-4 border-l-blue-500 bg-blue-50">
                        <Database className="w-4 h-4 text-blue-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">Database Backup Completed</p>
                          <p className="text-xs text-muted-foreground">15 minutes ago</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded border-l-4 border-l-orange-500 bg-orange-50">
                        <AlertTriangle className="w-4 h-4 text-orange-600 mt-1" />
                        <div>
                          <p className="text-sm font-medium">High CPU Usage Detected</p>
                          <p className="text-xs text-muted-foreground">1 hour ago</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Access Control Tab */}
            <TabsContent value="access" className="mt-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Access Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lock className="w-5 h-5 mr-2" />
                      Access Control Statistics
                    </CardTitle>
                    <CardDescription>User access patterns and security metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <Users className="w-5 h-5 text-blue-500 mb-2" />
                        <div className="text-2xl font-bold">47</div>
                        <div className="text-sm text-muted-foreground">Active Users</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <Key className="w-5 h-5 text-green-500 mb-2" />
                        <div className="text-2xl font-bold">234</div>
                        <div className="text-sm text-muted-foreground">API Keys</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <Shield className="w-5 h-5 text-purple-500 mb-2" />
                        <div className="text-2xl font-bold">12</div>
                        <div className="text-sm text-muted-foreground">Admin Users</div>
                      </div>
                      <div className="p-3 rounded-lg border bg-muted/20">
                        <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
                        <div className="text-2xl font-bold">3</div>
                        <div className="text-sm text-muted-foreground">Failed Logins</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Access Events */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Eye className="w-5 h-5 mr-2" />
                      Recent Access Events
                    </CardTitle>
                    <CardDescription>Latest user access and authentication events</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3 p-2 rounded bg-card/50">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Admin login successful</p>
                          <p className="text-xs text-muted-foreground">
                            user@unit-talk.com • 2 minutes ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded bg-card/50">
                        <Key className="w-4 h-4 text-blue-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">API key generated</p>
                          <p className="text-xs text-muted-foreground">
                            GradingAgent • 5 minutes ago
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-3 p-2 rounded bg-card/50">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-1" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Failed login attempt</p>
                          <p className="text-xs text-muted-foreground">
                            192.168.1.100 • 10 minutes ago
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
