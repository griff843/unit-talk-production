'use client';

/**
 * Tenant Analytics Component
 * Multi-tenant usage metrics, cost analysis, and performance tracking
 * 
 * Phase 15: Analytics & Monetization Layer - Data Systems Engineering Approach
 * Date: 2025-01-25
 */

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Loader2, Users, DollarSign, Activity, TrendingUp } from 'lucide-react';

interface TenantMetrics {
  tenantId: string;
  username: string;
  totalEvents: number;
  totalCostCents: number;
  apiCalls: number;
  pickSubmissions: number;
  gradingOperations: number;
  webhookDeliveries: number;
  lastActivityAt: string;
}

interface APIMetrics {
  hour: string;
  endpoint: string;
  requestCount: number;
  errorCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
}

interface UsageBreakdown {
  eventType: string;
  count: number;
  costCents: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function TenantAnalytics() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [tenantMetrics, setTenantMetrics] = useState<TenantMetrics[]>([]);
  const [apiMetrics, setAPIMetrics] = useState<APIMetrics[]>([]);
  const [usageBreakdown, setUsageBreakdown] = useState<UsageBreakdown[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  const [stats, setStats] = useState({
    activeTenants: 0,
    totalEvents: 0,
    totalRevenueCents: 0,
    avgCostPerTenant: 0,
    errorRate: 0,
    avgLatencyMs: 0,
  });

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      await Promise.all([loadTenantMetrics(), loadAPIMetrics(), loadUsageBreakdown()]);
      calculateStats();
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTenantMetrics() {
    const periodHours = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
    const startTime = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('tenant_usage')
      .select('tenant_id, user_id, event_type, cost_cents, timestamp, users!tenant_usage_user_id_fkey (username)')
      .gte('timestamp', startTime)
      .order('timestamp', { ascending: false });

    if (error) throw error;

    const tenantMap = new Map<string, TenantMetrics>();

    data?.forEach((row: any) => {
      const tenantId = row.tenant_id || row.user_id;
      if (!tenantMap.has(tenantId)) {
        tenantMap.set(tenantId, {
          tenantId,
          username: row.users?.username || 'Unknown',
          totalEvents: 0,
          totalCostCents: 0,
          apiCalls: 0,
          pickSubmissions: 0,
          gradingOperations: 0,
          webhookDeliveries: 0,
          lastActivityAt: row.timestamp,
        });
      }

      const metrics = tenantMap.get(tenantId)!;
      metrics.totalEvents++;
      metrics.totalCostCents += row.cost_cents || 0;

      if (row.event_type === 'api_call') metrics.apiCalls++;
      if (row.event_type === 'pick_submission') metrics.pickSubmissions++;
      if (row.event_type === 'grading_operation') metrics.gradingOperations++;
      if (row.event_type === 'webhook_delivery') metrics.webhookDeliveries++;

      if (new Date(row.timestamp) > new Date(metrics.lastActivityAt)) {
        metrics.lastActivityAt = row.timestamp;
      }
    });

    setTenantMetrics(Array.from(tenantMap.values()).sort((a, b) => b.totalCostCents - a.totalCostCents));
  }

  async function loadAPIMetrics() {
    const periodHours = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
    const startTime = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('mv_api_metrics_hourly')
      .select('*')
      .gte('hour', startTime)
      .order('hour', { ascending: true });

    if (error) {
      console.warn('Materialized view not available:', error);
      setAPIMetrics([]);
      return;
    }

    setAPIMetrics(data || []);
  }

  async function loadUsageBreakdown() {
    const periodHours = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
    const startTime = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('tenant_usage')
      .select('event_type, cost_cents')
      .gte('timestamp', startTime);

    if (error) throw error;

    const breakdown = new Map<string, UsageBreakdown>();

    data?.forEach((row: any) => {
      if (!breakdown.has(row.event_type)) {
        breakdown.set(row.event_type, { eventType: row.event_type, count: 0, costCents: 0 });
      }
      const item = breakdown.get(row.event_type)!;
      item.count++;
      item.costCents += row.cost_cents || 0;
    });

    setUsageBreakdown(Array.from(breakdown.values()));
  }

  function calculateStats() {
    const activeTenants = tenantMetrics.length;
    const totalEvents = tenantMetrics.reduce((sum, t) => sum + t.totalEvents, 0);
    const totalRevenueCents = tenantMetrics.reduce((sum, t) => sum + t.totalCostCents, 0);
    const avgCostPerTenant = activeTenants > 0 ? totalRevenueCents / activeTenants : 0;

    const totalRequests = apiMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const totalErrors = apiMetrics.reduce((sum, m) => sum + m.errorCount, 0);
    const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

    const avgLatencyMs =
      apiMetrics.length > 0
        ? apiMetrics.reduce((sum, m) => sum + m.avgLatencyMs, 0) / apiMetrics.length
        : 0;

    setStats({ activeTenants, totalEvents, totalRevenueCents, avgCostPerTenant, errorRate, avgLatencyMs });
  }

  if (loading && tenantMetrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-end gap-2">
        {(['24h', '7d', '30d'] as const).map((period) => (
          <button
            key={period}
            onClick={() => setSelectedPeriod(period)}
            className={`px-4 py-2 rounded ${
              selectedPeriod === period ? 'bg-primary text-white' : 'bg-secondary'
            }`}
          >
            {period}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeTenants}</div>
            <p className="text-xs text-muted-foreground">Tenants with activity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Billable events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.totalRevenueCents / 100).toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              ${(stats.avgCostPerTenant / 100).toFixed(2)} avg/tenant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgLatencyMs.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">{stats.errorRate.toFixed(2)}% errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Usage & Cost</CardTitle>
          <CardDescription>Usage volume and cost per tenant</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Tenant</th>
                  <th className="text-right p-2">Events</th>
                  <th className="text-right p-2">API</th>
                  <th className="text-right p-2">Picks</th>
                  <th className="text-right p-2">Grading</th>
                  <th className="text-right p-2">Webhooks</th>
                  <th className="text-right p-2">Cost</th>
                  <th className="text-left p-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {tenantMetrics.map((tenant) => (
                  <tr key={tenant.tenantId} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{tenant.username}</td>
                    <td className="text-right p-2">{tenant.totalEvents.toLocaleString()}</td>
                    <td className="text-right p-2">{tenant.apiCalls.toLocaleString()}</td>
                    <td className="text-right p-2">{tenant.pickSubmissions.toLocaleString()}</td>
                    <td className="text-right p-2">{tenant.gradingOperations.toLocaleString()}</td>
                    <td className="text-right p-2">{tenant.webhookDeliveries.toLocaleString()}</td>
                    <td className="text-right p-2 font-semibold">
                      ${(tenant.totalCostCents / 100).toFixed(2)}
                    </td>
                    <td className="text-left p-2 text-sm text-muted-foreground">
                      {new Date(tenant.lastActivityAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Usage by Event Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={usageBreakdown} dataKey="count" nameKey="eventType" cx="50%" cy="50%" outerRadius={100} label>
                  {usageBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Latency Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={apiMetrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tickFormatter={(v) => new Date(v).toLocaleTimeString()} />
                <YAxis label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
                <Tooltip labelFormatter={(v) => new Date(v).toLocaleString()} />
                <Legend />
                <Line type="monotone" dataKey="avgLatencyMs" stroke="#8884d8" name="Avg" />
                <Line type="monotone" dataKey="p95LatencyMs" stroke="#82ca9d" name="P95" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

