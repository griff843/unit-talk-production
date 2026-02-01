'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, MinusCircle, Gavel } from 'lucide-react';

interface UnsettledPick {
  id: string;
  player_name: string;
  stat_type: string;
  line: number;
  side: string;
  sport: string;
  odds: number;
  confidence: number;
  professional_score: number | null;
  promotion_band: string | null;
  bet_type: string | null;
  market: string | null;
  capper_id: string | null;
  created_at: string;
}

interface SettleResult {
  success: boolean;
  pick_id?: string;
  result?: string;
  error?: string;
}

const SettlementConsole: React.FC = () => {
  const [picks, setPicks] = useState<UnsettledPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState<Record<string, string>>({});
  const [settled, setSettled] = useState<Record<string, SettleResult>>({});

  const fetchUnsettled = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settlement?limit=50');
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      const data = await res.json();
      setPicks(data.picks || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnsettled();
    const interval = setInterval(fetchUnsettled, 30000);
    return () => clearInterval(interval);
  }, [fetchUnsettled]);

  const handleSettle = async (pickId: string, result: 'win' | 'loss' | 'push') => {
    setSettling(prev => ({ ...prev, [pickId]: result }));
    try {
      const res = await fetch('/api/settlement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pick_id: pickId,
          result,
          operator: 'command-center',
        }),
      });
      const data = await res.json();
      setSettled(prev => ({ ...prev, [pickId]: data }));
      if (data.success) {
        setPicks(prev => prev.filter(p => p.id !== pickId));
      }
    } catch (err) {
      setSettled(prev => ({
        ...prev,
        [pickId]: { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      }));
    } finally {
      setSettling(prev => {
        const next = { ...prev };
        delete next[pickId];
        return next;
      });
    }
  };

  const unsettledCount = picks.length;

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center">
            <Gavel className="h-5 w-5 mr-2" />
            Settlement Console
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchUnsettled} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Gavel className="h-5 w-5 mr-2" />
          Settlement Console
        </CardTitle>
        <div className="flex items-center space-x-2">
          <Badge
            variant={unsettledCount > 10 ? 'destructive' : unsettledCount > 0 ? 'secondary' : 'default'}
            className="text-xs"
          >
            {unsettledCount} unsettled
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchUnsettled}
            disabled={loading}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && picks.length === 0 ? (
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded bg-muted" />
          </div>
        ) : picks.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No unsettled picks found
          </div>
        ) : (
          <div className="max-h-[400px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Prop</TableHead>
                  <TableHead>Line</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Sport</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {picks.map(pick => {
                  const isSettling = !!settling[pick.id];
                  const settleResult = settled[pick.id];

                  return (
                    <TableRow key={pick.id}>
                      <TableCell className="font-medium text-xs">
                        {pick.player_name || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-xs">{pick.stat_type || '-'}</TableCell>
                      <TableCell className="text-xs">{pick.line ?? '-'}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-xs">
                          {pick.side || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{pick.sport || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(pick.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {settleResult?.success ? (
                          <Badge className="bg-green-100 text-green-800 text-xs">Settled</Badge>
                        ) : settleResult?.error ? (
                          <span className="text-xs text-red-500">{settleResult.error}</span>
                        ) : (
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
                              disabled={isSettling}
                              onClick={() => handleSettle(pick.id, 'win')}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {settling[pick.id] === 'win' ? '...' : 'WIN'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
                              disabled={isSettling}
                              onClick={() => handleSettle(pick.id, 'loss')}
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              {settling[pick.id] === 'loss' ? '...' : 'LOSS'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs text-gray-700 border-gray-300 hover:bg-gray-50"
                              disabled={isSettling}
                              onClick={() => handleSettle(pick.id, 'push')}
                            >
                              <MinusCircle className="h-3 w-3 mr-1" />
                              {settling[pick.id] === 'push' ? '...' : 'PUSH'}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SettlementConsole;
