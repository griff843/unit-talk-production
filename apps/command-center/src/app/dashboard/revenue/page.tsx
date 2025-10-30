'use client';

/**
 * Revenue Analytics Dashboard
 * Real-time revenue metrics, subscription health, and usage analytics
 * 
 * Phase 15: Analytics and Monetization Engine
 * Date: 2025-01-25
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';

interface RevenueMetrics {
  mrr: number;
  arr: number;
  totalRevenue: number;
  newRevenue: number;
  churnRevenue: number;
  arpu: number;
  ltv: number;
  churnRate: number;
  retentionRate: number;
}

interface SubscriptionMetrics {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  canceledSubscriptions: number;
  pastDueSubscriptions: number;
  byPlan: Record<string, number>;
}

interface UsageMetrics {
  totalEvents: number;
  apiCalls: number;
  pickSubmissions: number;
  gradingOperations: number;
  aiAnalyses: number;
  dataExports: number;
}

export default function RevenueDashboard() {
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [subscriptionMetrics, setSubscriptionMetrics] = useState<SubscriptionMetrics | null>(null);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function loadMetrics() {
    try {
      setLoading(true);
      setError(null);

      // Load revenue metrics
      const { data: revenue, error: revenueError } = await supabase.rpc('calculate_current_mrr');
      if (revenueError) throw revenueError;

      // Load subscription metrics
      const { data: subscriptions, error: subsError } = await supabase
        .from('user_subscriptions')
        .select('status, subscription_plans(name)');
      if (subsError) throw subsError;

      // Load usage metrics
      const { data: usage, error: usageError } = await supabase
        .from('tenant_usage')
        .select('event_type, quantity')
        .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (usageError) throw usageError;

      // Calculate metrics - ensure mrr is a number
      const mrr = Number(revenue) || 0;
      const arr = mrr * 12;

      const activeCount = subscriptions?.filter((s) => s.status === 'active').length || 0;
      const trialingCount = subscriptions?.filter((s) => s.status === 'trialing').length || 0;
      const canceledCount = subscriptions?.filter((s) => s.status === 'canceled').length || 0;
      const pastDueCount = subscriptions?.filter((s) => s.status === 'past_due').length || 0;

      const byPlan = subscriptions?.reduce((acc: Record<string, number>, s: any) => {
        const planName = s.subscription_plans?.name || 'Unknown';
        acc[planName] = (acc[planName] || 0) + 1;
        return acc;
      }, {}) || {};

      const totalEvents = usage?.length || 0;
      const apiCalls = usage?.filter((u) => u.event_type === 'api_call').length || 0;
      const pickSubmissions = usage?.filter((u) => u.event_type === 'pick_submission').length || 0;
      const gradingOperations = usage?.filter((u) => u.event_type === 'grading_operation').length || 0;
      const aiAnalyses = usage?.filter((u) => u.event_type === 'ai_analysis').length || 0;
      const dataExports = usage?.filter((u) => u.event_type === 'data_export').length || 0;

      setRevenueMetrics({
        mrr: mrr / 100, // Convert cents to dollars
        arr: arr / 100,
        totalRevenue: mrr / 100,
        newRevenue: 0,
        churnRevenue: 0,
        arpu: activeCount > 0 ? mrr / 100 / activeCount : 0,
        ltv: 0,
        churnRate: 0,
        retentionRate: 0,
      });

      setSubscriptionMetrics({
        totalSubscriptions: subscriptions?.length || 0,
        activeSubscriptions: activeCount,
        trialingSubscriptions: trialingCount,
        canceledSubscriptions: canceledCount,
        pastDueSubscriptions: pastDueCount,
        byPlan,
      });

      setUsageMetrics({
        totalEvents,
        apiCalls,
        pickSubmissions,
        gradingOperations,
        aiAnalyses,
        dataExports,
      });
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !revenueMetrics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading revenue analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revenue Analytics</h1>
        <p className="text-muted-foreground">
          Real-time revenue metrics, subscription health, and usage analytics
        </p>
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MRR</CardTitle>
                <span className="text-2xl">💰</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${revenueMetrics?.mrr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Monthly Recurring Revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ARR</CardTitle>
                <span className="text-2xl">📈</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${revenueMetrics?.arr.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Annual Recurring Revenue</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">ARPU</CardTitle>
                <span className="text-2xl">👤</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${revenueMetrics?.arpu.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">Average Revenue Per User</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retention</CardTitle>
                <span className="text-2xl">🎯</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((1 - (revenueMetrics?.churnRate || 0)) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Customer Retention Rate</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <span className="text-2xl">📊</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{subscriptionMetrics?.totalSubscriptions}</div>
                <p className="text-xs text-muted-foreground">Total Subscriptions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
                <span className="text-2xl">✅</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {subscriptionMetrics?.activeSubscriptions}
                </div>
                <p className="text-xs text-muted-foreground">Active Subscriptions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Trialing</CardTitle>
                <span className="text-2xl">🆓</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {subscriptionMetrics?.trialingSubscriptions}
                </div>
                <p className="text-xs text-muted-foreground">Trial Subscriptions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Past Due</CardTitle>
                <span className="text-2xl">⚠️</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {subscriptionMetrics?.pastDueSubscriptions}
                </div>
                <p className="text-xs text-muted-foreground">Payment Issues</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Subscriptions by Plan</CardTitle>
              <CardDescription>Distribution across subscription tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(subscriptionMetrics?.byPlan || {}).map(([plan, count]) => (
                  <div key={plan} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{plan}</span>
                    <span className="text-sm text-muted-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">API Calls</CardTitle>
                <span className="text-2xl">🔌</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.apiCalls.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pick Submissions</CardTitle>
                <span className="text-2xl">🎯</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.pickSubmissions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Grading Operations</CardTitle>
                <span className="text-2xl">⚖️</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.gradingOperations.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">AI Analyses</CardTitle>
                <span className="text-2xl">🤖</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.aiAnalyses.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Data Exports</CardTitle>
                <span className="text-2xl">📥</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.dataExports.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                <span className="text-2xl">📊</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{usageMetrics?.totalEvents.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

