'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Bot,
  Activity,
  Shield,
  Database,
  Zap,
  Settings,
  Calendar,
  ArrowUpDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  agent_name: string;
  action: string;
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  metadata?: Record<string, any>;
  duration_ms?: number;
  user_id?: string;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
}

interface AuditTrailProps {
  className?: string;
}

export function AuditTrail({ className }: AuditTrailProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Mock audit log data for development
  const mockAuditLogs: AuditLogEntry[] = [
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
      agent_name: 'GradingAgent',
      action: 'process_pick',
      status: 'success',
      message: 'Successfully processed pick for approval',
      metadata: {
        pickId: 'pick-123',
        capper: 'Griff843',
        confidence: 85,
        tier: 'A',
        processingTime: 2.3,
      },
      duration_ms: 2300,
      resource_type: 'pick',
      resource_id: 'pick-123',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
      agent_name: 'AlertAgent',
      action: 'send_notification',
      status: 'success',
      message: 'Discord notification sent for high-tier pick',
      metadata: {
        channel: 'vip-picks',
        messageId: 'msg-456',
        userCount: 127,
        deliveryTime: 0.85,
      },
      duration_ms: 850,
      resource_type: 'notification',
      resource_id: 'msg-456',
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
      agent_name: 'RecapAgent',
      action: 'generate_recap',
      status: 'error',
      message: 'Failed to generate daily recap - database connection timeout',
      metadata: {
        error: 'Connection timeout after 30s',
        retryAttempt: 2,
        affectedPicks: 15,
      },
      duration_ms: 30000,
      resource_type: 'recap',
      resource_id: 'recap-daily-2024-01-05',
    },
    {
      id: 'log-4',
      timestamp: new Date(Date.now() - 1200000).toISOString(), // 20 minutes ago
      agent_name: 'FeedAgent',
      action: 'ingest_props',
      status: 'warning',
      message: 'Partial data ingestion completed with some missing odds',
      metadata: {
        totalProps: 450,
        successfulProps: 432,
        failedProps: 18,
        missingOdds: 23,
        source: 'optimal_sports',
      },
      duration_ms: 5400,
      resource_type: 'data_ingestion',
      resource_id: 'ingestion-batch-789',
    },
    {
      id: 'log-5',
      timestamp: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
      agent_name: 'AnalyticsAgent',
      action: 'calculate_metrics',
      status: 'success',
      message: 'Weekly performance metrics calculated successfully',
      metadata: {
        metricsCalculated: 47,
        performanceScore: 94.2,
        trendAnalysis: 'positive',
        dataPoints: 1247,
      },
      duration_ms: 3200,
      resource_type: 'metrics',
      resource_id: 'weekly-metrics-2024-w01',
    },
    {
      id: 'log-6',
      timestamp: new Date(Date.now() - 2400000).toISOString(), // 40 minutes ago
      agent_name: 'OperatorAgent',
      action: 'system_health_check',
      status: 'info',
      message: 'Routine system health check completed',
      metadata: {
        agentsChecked: 7,
        healthyAgents: 6,
        warningAgents: 1,
        cpuUsage: 34.5,
        memoryUsage: 67.2,
        diskUsage: 23.8,
      },
      duration_ms: 1100,
      resource_type: 'system',
      resource_id: 'health-check-456',
    },
  ];

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to fetch real audit logs from database
      if (supabase) {
        const { data: realLogs, error: dbError } = await supabase
          .from('agent_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!dbError && realLogs && realLogs.length > 0) {
          // Transform database logs to our format
          const transformedLogs: AuditLogEntry[] = realLogs.map(log => ({
            id: String(log.id || ''),
            timestamp: String(log.created_at || new Date().toISOString()),
            agent_name: String(log.agent || 'Unknown'),
            action: String(log.action || 'unknown_action'),
            status: (log.status || 'info') as 'success' | 'error' | 'warning' | 'info',
            message: String(log.message || 'No message'),
            metadata: log.metadata || {},
            duration_ms: Number(log.duration || 0),
            resource_type: String(log.resource_type || ''),
            resource_id: String(log.resource_id || ''),
          }));

          setLogs(transformedLogs);
        } else {
          // Fallback to mock data
          setLogs(mockAuditLogs);
        }
      } else {
        setLogs(mockAuditLogs);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setError(err as Error);
      setLogs(mockAuditLogs); // Fallback to mock data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();

    // Set up real-time subscription for agent logs
    if (supabase) {
      const subscription = supabase
        .channel('audit_logs')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'agent_logs' },
          payload => {
            const newLog: AuditLogEntry = {
              id: payload.new.id,
              timestamp: payload.new.created_at,
              agent_name: payload.new.agent || 'Unknown',
              action: payload.new.action || 'unknown_action',
              status: (payload.new.status || 'info') as 'success' | 'error' | 'warning' | 'info',
              message: payload.new.message || 'No message',
              metadata: payload.new.metadata || {},
              duration_ms: payload.new.duration || 0,
              resource_type: payload.new.resource_type,
              resource_id: payload.new.resource_id,
            };

            setLogs(prev => [newLog, ...prev.slice(0, 99)]); // Keep only latest 100
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }

    // Refresh logs every 30 seconds
    const interval = setInterval(fetchAuditLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        log =>
          log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by agent
    if (selectedAgent !== 'all') {
      filtered = filtered.filter(log => log.agent_name === selectedAgent);
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(log => log.status === selectedStatus);
    }

    // Filter by time range
    const now = Date.now();
    const timeRangeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    if (timeRange !== 'all') {
      const cutoff = now - timeRangeMs[timeRange as keyof typeof timeRangeMs];
      filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= cutoff);
    }

    // Sort by timestamp
    filtered = filtered.sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return sortOrder === 'desc' ? bTime - aTime : aTime - bTime;
    });

    return filtered;
  }, [logs, searchTerm, selectedAgent, selectedStatus, timeRange, sortOrder]);

  const uniqueAgents = useMemo(() => {
    const agents = Array.from(new Set(logs.map(log => log.agent_name)));
    return agents.sort();
  }, [logs]);

  const handleExportLogs = () => {
    const csvContent = [
      'Timestamp,Agent,Action,Status,Message,Duration(ms),Resource Type,Resource ID',
      ...filteredLogs.map(
        log =>
          `${log.timestamp},${log.agent_name},${log.action},${log.status},"${log.message}",${log.duration_ms || ''},${log.resource_type || ''},${log.resource_id || ''}`
      ),
    ].join('\\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Audit logs exported successfully');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading audit trails...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64 text-red-400">
          <AlertCircle className="w-8 h-8 mr-2" />
          <span>Error loading audit logs: {error.message}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2" />
              Comprehensive Audit Trail
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-blue-100 text-blue-800">{filteredLogs.length} entries</Badge>
              <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportLogs}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Complete audit trail of all agent activities, system events, and user actions
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Agent Filter */}
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {uniqueAgents.map(agent => (
                  <SelectItem key={agent} value={agent}>
                    {agent}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            {/* Time Range Filter */}
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger>
                <SelectValue placeholder="Time Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">Last Hour</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(prev => (prev === 'desc' ? 'asc' : 'desc'))}
              className="flex items-center"
            >
              <ArrowUpDown className="w-4 h-4 mr-2" />
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Activity Logs</CardTitle>
          <CardDescription>
            Detailed timeline of all system activities and agent operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(log.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{log.agent_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs">{log.action}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(log.status)}>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(log.status)}
                          <span>{log.status}</span>
                        </div>
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate">{log.message}</p>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.duration_ms ? `${log.duration_ms}ms` : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toast.info('Log details view coming soon');
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No audit logs found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or search terms</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Activities</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Success Rate</p>
                <p className="text-2xl font-bold">
                  {logs.length > 0
                    ? Math.round(
                        (logs.filter(l => l.status === 'success').length / logs.length) * 100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm font-medium">Error Count</p>
                <p className="text-2xl font-bold">
                  {logs.filter(l => l.status === 'error').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Active Agents</p>
                <p className="text-2xl font-bold">{uniqueAgents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
