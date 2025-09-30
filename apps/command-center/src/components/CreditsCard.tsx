'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

interface CreditUsageData {
  provider: string;
  credits: number;
  calls: number;
}

interface CreditsSummary {
  data: CreditUsageData[];
  error: any;
  timestamp: string;
  summary?: {
    totalProviders: number;
    totalCredits: number;
    totalCalls: number;
  };
}

export function CreditsCard() {
  const [credits, setCredits] = useState<CreditsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/ops/credits');
      const data = await response.json();

      setCredits(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch credits:', error);
      setCredits({
        data: [],
        error: { message: 'Failed to fetch credits' },
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Auto-refresh every 120 seconds
  useEffect(() => {
    const interval = setInterval(fetchCredits, 120000); // 120s = 2 minutes
    return () => clearInterval(interval);
  }, [fetchCredits]);

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, string> = {
      oddsapi: '🎲',
      sgo: '🎯',
      optimal: '⚡',
    };
    return icons[provider.toLowerCase()] || '📊';
  };

  const getProviderName = (provider: string) => {
    const names: Record<string, string> = {
      oddsapi: 'Odds API',
      sgo: 'SGO',
      optimal: 'Optimal',
    };
    return names[provider.toLowerCase()] || provider;
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Card className="w-full" data-testid="credits-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Credits by Provider
          </CardTitle>
          <CardDescription>
            Real-time API credit usage tracking
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchCredits}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>

      <CardContent>
        {loading && !credits ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading credits data...
          </div>
        ) : credits?.error ? (
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-4 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="font-medium">RPC Not Available</p>
              <p className="text-sm text-amber-700">
                {credits.error.message || 'Credit tracking RPC needs to be applied to database'}
              </p>
            </div>
          </div>
        ) : credits?.data && credits.data.length > 0 ? (
          <div className="space-y-4">
            {/* Summary Stats */}
            {credits.summary && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {credits.summary.totalCredits}
                  </div>
                  <div className="text-sm text-slate-600">Total Credits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {credits.summary.totalCalls}
                  </div>
                  <div className="text-sm text-slate-600">Total Calls</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {credits.summary.totalProviders}
                  </div>
                  <div className="text-sm text-slate-600">Providers</div>
                </div>
              </div>
            )}

            {/* Provider Details Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3 font-medium">Provider</th>
                    <th className="text-center p-3 font-medium">Credits</th>
                    <th className="text-center p-3 font-medium">Calls</th>
                    <th className="text-center p-3 font-medium">Avg/Call</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.data.map((provider, index) => {
                    const avgCredits = provider.calls > 0 ?
                      (provider.credits / provider.calls).toFixed(1) : '0';

                    return (
                      <tr key={provider.provider} className={index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{getProviderIcon(provider.provider)}</span>
                            <span className="font-medium">
                              {getProviderName(provider.provider)}
                            </span>
                          </div>
                        </td>
                        <td className="text-center p-3">
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                            {provider.credits}
                          </Badge>
                        </td>
                        <td className="text-center p-3">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {provider.calls}
                          </Badge>
                        </td>
                        <td className="text-center p-3 text-slate-600">
                          {avgCredits}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
            <CheckCircle className="h-5 w-5" />
            <p>No credit usage data available</p>
          </div>
        )}

        {/* Footer with last updated timestamp */}
        {credits && (
          <div className="mt-4 pt-3 border-t text-xs text-slate-500 flex justify-between items-center">
            <span>
              Last updated: {formatTimestamp(credits.timestamp)}
            </span>
            <span>
              Auto-refresh: 120s
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}