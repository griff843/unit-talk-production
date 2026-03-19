'use client';

/**
 * Home Page
 *
 * SPRINT-REM-003-COMMAND-CENTER-TRUTH-FIX
 * System status derived exclusively from /api/health/summary -> platform_status.
 * No hardcoded false-green defaults. Fails closed to "Unknown" on unavailable data.
 */

import { Activity, BarChart3, Settings, Users, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type PlatformStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'UNKNOWN';

const STATUS_META: Record<PlatformStatus, { dot: string; label: string; sub: string }> = {
  HEALTHY: {
    dot: 'bg-emerald-500',
    label: 'Platform Healthy',
    sub: 'All systems operational',
  },
  DEGRADED: {
    dot: 'bg-yellow-500',
    label: 'Degraded',
    sub: 'Some systems impaired',
  },
  CRITICAL: {
    dot: 'bg-red-500',
    label: 'Critical',
    sub: 'Service disruption detected',
  },
  UNKNOWN: {
    dot: 'bg-gray-400',
    label: 'Status Unavailable',
    sub: 'Unable to reach health API',
  },
};

function usePlatformStatus() {
  // SPRINT-REM-003: Fail closed — default to UNKNOWN, not HEALTHY
  const [status, setStatus] = useState<PlatformStatus>('UNKNOWN');
  const [loading, setLoading] = useState(true);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/health/summary');
      if (!res.ok) {
        setStatus('CRITICAL');
        return;
      }
      const data = await res.json();
      const ps = data.platform_status;
      if (ps === 'HEALTHY' || ps === 'DEGRADED' || ps === 'CRITICAL') {
        setStatus(ps);
      } else {
        setStatus('UNKNOWN');
      }
    } catch {
      setStatus('UNKNOWN');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  return { status, loading };
}

export default function HomePage() {
  const { status, loading } = usePlatformStatus();
  const { dot, label, sub } = STATUS_META[status];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 command-gradient opacity-50"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-foreground mb-6">Unit Talk Command Center</h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Fortune 100 SaaS-grade operational dashboard for real-time monitoring, agent
              orchestration, and intelligent system control
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="premium-button text-lg px-8 py-4">
                  <Activity className="w-5 h-5 mr-2" />
                  Access Dashboard
                </Button>
              </Link>
              <Link href="/dashboard/agents">
                <Button variant="outline" size="lg" className="text-lg px-8 py-4">
                  <Settings className="w-5 h-5 mr-2" />
                  Agent Control
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Link href="/dashboard">
            <Card className="metric-card cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <BarChart3 className="w-5 h-5 mr-2 text-primary" />
                  System Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Real-time system metrics, performance monitoring, and operational insights
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/agents">
            <Card className="metric-card cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Zap className="w-5 h-5 mr-2 text-primary" />
                  Agent Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Control and monitor intelligent agents with real-time health status
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/users">
            <Card className="metric-card cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  User Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage users, permissions, and access control across the platform
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/dashboard/analytics">
            <Card className="metric-card cursor-pointer h-full">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center text-lg">
                  <Activity className="w-5 h-5 mr-2 text-primary" />
                  Advanced Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Deep insights, performance analytics, and business intelligence
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Status Section — derived from /api/health/summary */}
      <div className="bg-card/50 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-6">System Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="flex flex-col items-center">
                {loading ? (
                  <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse mb-2"></div>
                ) : (
                  <div className={`w-3 h-3 ${dot} rounded-full animate-pulse mb-2`}></div>
                )}
                <div className="text-lg font-medium text-foreground">
                  {loading ? 'Checking...' : label}
                </div>
                <div className="text-sm text-muted-foreground">
                  {loading ? 'Fetching platform status' : sub}
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse mb-2"></div>
                <div className="text-lg font-medium text-foreground">Real-time Data</div>
                <div className="text-sm text-muted-foreground">Live Supabase integration</div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse mb-2"></div>
                <div className="text-lg font-medium text-foreground">Agent Network</div>
                <div className="text-sm text-muted-foreground">Monitoring active agents</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
