/* eslint-disable max-lines-per-function, complexity, no-console, security/detect-object-injection */
/**
 * Operations Credit Usage API Endpoint
 *
 * Phase 2 - Provides visibility into API credit usage across providers.
 * Tracks: Optimal API, Odds API, and other provider costs/usage.
 *
 * @module ops/credit-usage
 */

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseClient } from '@/lib/supabase';

interface ProviderUsage {
  provider: string;
  requests24h: number;
  creditsUsed24h: number;
  creditsRemaining: number | null;
  costUsd24h: number | null;
  lastRequest: string | null;
  avgLatencyMs: number | null;
  errorRate: number;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
}

interface DailyUsage {
  date: string;
  totalRequests: number;
  totalCredits: number;
  totalCostUsd: number | null;
  byProvider: Record<string, { requests: number; credits: number }>;
}

interface CreditUsageResponse {
  timestamp: string;
  summary: {
    totalRequests24h: number;
    totalCreditsUsed24h: number;
    totalCostUsd24h: number | null;
    activeProviders: number;
    healthyProviders: number;
  };
  providers: ProviderUsage[];
  dailyUsage: DailyUsage[];
  alerts: {
    type: 'credit_low' | 'rate_limit' | 'cost_spike' | 'provider_down';
    provider: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
  }[];
  deepLinks: {
    providerConfig: string;
    apiHealthStatus: string;
    ingestionLog: string;
  };
  correlation_id: string;
}

/**
 * GET /api/ops/credit-usage
 *
 * Query params:
 * - days: Number of days to look back for daily usage (default: 7, max: 30)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const correlationId = `credit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '7'), 30);

    console.log(`💳 GET /api/ops/credit-usage [${correlationId}] - Looking back ${days} days`);

    const client = getSupabaseClient();
    if (!client) {
      return NextResponse.json(
        { error: 'Database unavailable', correlation_id: correlationId },
        { status: 503 }
      );
    }

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const lookbackDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

    const providers: ProviderUsage[] = [];
    const alerts: CreditUsageResponse['alerts'] = [];

    interface ApiHealthRow {
      provider: string;
      last_checked: string;
      is_healthy: boolean;
      credits_remaining: number | null;
      [key: string]: unknown;
    }

    interface IngestionLogRow {
      provider: string;
      status: string;
      duration_ms: number | null;
      created_at: string;
      credits_used: number | null;
      cost_usd: number | null;
    }

    // Try to get data from api_health_status table
    const { data: apiHealthRaw } = await client
      .from('api_health_status')
      .select('*')
      .order('last_checked', { ascending: false });

    const apiHealth = (apiHealthRaw || []) as unknown as ApiHealthRow[];

    // Try to get data from data_ingestion_log for request counts
    const { data: ingestionLogsRaw } = await client
      .from('data_ingestion_log')
      .select('provider, status, duration_ms, created_at, credits_used, cost_usd')
      .gte('created_at', lookbackDate)
      .order('created_at', { ascending: false });

    const ingestionLogs = (ingestionLogsRaw || []) as unknown as IngestionLogRow[];

    // Process provider data from ingestion logs
    const providerMap = new Map<
      string,
      {
        requests24h: number;
        creditsUsed24h: number;
        costUsd24h: number;
        errors24h: number;
        totalLatency: number;
        lastRequest: string | null;
      }
    >();

    // Initialize from known providers in api_health_status
    for (const health of apiHealth) {
      const provider = health.provider;
      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          requests24h: 0,
          creditsUsed24h: 0,
          costUsd24h: 0,
          errors24h: 0,
          totalLatency: 0,
          lastRequest: health.last_checked,
        });
      }
    }

    // Process ingestion logs
    const logsArray = ingestionLogs;
    for (const log of logsArray) {
      const provider = log.provider || 'unknown';
      const isRecent = new Date(log.created_at).getTime() > new Date(twentyFourHoursAgo).getTime();

      if (!providerMap.has(provider)) {
        providerMap.set(provider, {
          requests24h: 0,
          creditsUsed24h: 0,
          costUsd24h: 0,
          errors24h: 0,
          totalLatency: 0,
          lastRequest: null,
        });
      }

      const data = providerMap.get(provider)!;

      if (isRecent) {
        data.requests24h++;
        data.creditsUsed24h += log.credits_used || 1; // Default 1 credit per request
        data.costUsd24h += log.cost_usd || 0;
        data.totalLatency += log.duration_ms || 0;

        if (log.status === 'error' || log.status === 'failed') {
          data.errors24h++;
        }

        if (!data.lastRequest || new Date(log.created_at) > new Date(data.lastRequest)) {
          data.lastRequest = log.created_at;
        }
      }
    }

    // Build provider usage array
    for (const [providerName, data] of providerMap.entries()) {
      const healthRecord = apiHealth.find(h => h.provider === providerName);
      const errorRate = data.requests24h > 0 ? (data.errors24h / data.requests24h) * 100 : 0;
      const avgLatency =
        data.requests24h > 0 ? Math.round(data.totalLatency / data.requests24h) : null;

      let status: ProviderUsage['status'] = 'unknown';
      if (healthRecord) {
        if (healthRecord.is_healthy && errorRate < 5) {
          status = 'healthy';
        } else if (errorRate < 20) {
          status = 'warning';
        } else {
          status = 'critical';
        }
      } else if (data.requests24h > 0) {
        status = errorRate < 5 ? 'healthy' : errorRate < 20 ? 'warning' : 'critical';
      }

      providers.push({
        provider: providerName,
        requests24h: data.requests24h,
        creditsUsed24h: data.creditsUsed24h,
        creditsRemaining: healthRecord?.credits_remaining ?? null,
        costUsd24h: data.costUsd24h > 0 ? data.costUsd24h : null,
        lastRequest: data.lastRequest,
        avgLatencyMs: avgLatency,
        errorRate: Math.round(errorRate * 10) / 10,
        status,
      });

      // Generate alerts
      if (status === 'critical') {
        alerts.push({
          type: 'provider_down',
          provider: providerName,
          message: `Provider ${providerName} has high error rate (${errorRate.toFixed(1)}%)`,
          severity: 'critical',
        });
      }

      if (healthRecord?.credits_remaining !== null && healthRecord?.credits_remaining < 100) {
        alerts.push({
          type: 'credit_low',
          provider: providerName,
          message: `Low credits remaining for ${providerName}: ${healthRecord.credits_remaining}`,
          severity: healthRecord.credits_remaining < 20 ? 'critical' : 'warning',
        });
      }
    }

    // Sort providers by usage
    providers.sort((a, b) => b.requests24h - a.requests24h);

    // Build daily usage
    const dailyMap = new Map<string, DailyUsage>();

    for (let d = 0; d < days; d++) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().slice(0, 10);
      dailyMap.set(dateKey, {
        date: dateKey,
        totalRequests: 0,
        totalCredits: 0,
        totalCostUsd: null,
        byProvider: {},
      });
    }

    for (const log of logsArray) {
      const dateKey = log.created_at.slice(0, 10);
      const daily = dailyMap.get(dateKey);
      if (daily) {
        daily.totalRequests++;
        daily.totalCredits += log.credits_used || 1;
        if (log.cost_usd) {
          daily.totalCostUsd = (daily.totalCostUsd || 0) + log.cost_usd;
        }

        const provider = log.provider || 'unknown';
        if (!daily.byProvider[provider]) {
          daily.byProvider[provider] = { requests: 0, credits: 0 };
        }
        daily.byProvider[provider].requests++;
        daily.byProvider[provider].credits += log.credits_used || 1;
      }
    }

    const dailyUsage = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

    // Calculate summary
    const totalRequests24h = providers.reduce((sum, p) => sum + p.requests24h, 0);
    const totalCreditsUsed24h = providers.reduce((sum, p) => sum + p.creditsUsed24h, 0);
    const totalCostUsd24h = providers.reduce((sum, p) => sum + (p.costUsd24h || 0), 0);
    const activeProviders = providers.filter(p => p.requests24h > 0).length;
    const healthyProviders = providers.filter(p => p.status === 'healthy').length;

    const response: CreditUsageResponse = {
      timestamp: now.toISOString(),
      summary: {
        totalRequests24h,
        totalCreditsUsed24h,
        totalCostUsd24h: totalCostUsd24h > 0 ? totalCostUsd24h : null,
        activeProviders,
        healthyProviders,
      },
      providers,
      dailyUsage,
      alerts,
      deepLinks: {
        providerConfig: '/dashboard/settings?tab=providers',
        apiHealthStatus: '/dashboard/pipeline?tab=providers',
        ingestionLog: '/dashboard/pipeline?tab=ingestion-log',
      },
      correlation_id: correlationId,
    };

    console.log(
      `💳 Credit usage: ${totalRequests24h} requests, ${totalCreditsUsed24h} credits in 24h [${correlationId}] in ${Date.now() - startTime}ms`
    );

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=120',
        'X-Correlation-ID': correlationId,
      },
    });
  } catch (error) {
    console.error(`❌ GET /api/ops/credit-usage error [${correlationId}]:`, error);
    return NextResponse.json(
      {
        error: 'Failed to fetch credit usage',
        message: error instanceof Error ? error.message : 'Unknown error',
        correlation_id: correlationId,
      },
      { status: 500 }
    );
  }
}
