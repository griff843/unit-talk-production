'use client';

/**
 * Publishing Dashboard Page - Phase 2
 * Dedicated page for pick_publish monitoring
 * NO MOCK DATA - all from Supabase pick_publish table
 */

import { useState, useEffect } from 'react';
import { PublishingMetrics } from '@/components/monitoring/PublishingMetrics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { RefreshCw, Filter, CheckCircle, XCircle, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';

interface PublishAttempt {
  id: string;
  pick_id: string;
  channel: string | null;
  status: string;
  attempts: number;
  max_attempts: number;
  external_message_id: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export default function PublishingPage() {
  const [recentAttempts, setRecentAttempts] = useState<PublishAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchRecentAttempts = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/publishing/metrics');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.data_source === 'error') {
        toast.error(`Failed to load publishing data: ${data.error_message || 'Unknown error'}`);
        setRecentAttempts([]);
        return;
      }

      setRecentAttempts(data.recent_attempts || []);
    } catch (error) {
      console.error('Failed to fetch recent publishing attempts:', error);
      toast.error(
        `Error loading publishing data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      setRecentAttempts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentAttempts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchRecentAttempts, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredAttempts =
    statusFilter === 'all'
      ? recentAttempts
      : recentAttempts.filter(attempt => attempt.status === statusFilter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            SENT
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            PENDING
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            FAILED
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3 mr-1" />
            CANCELLED
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center">
            <Send className="w-8 h-8 mr-3" />
            Publishing Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time monitoring of pick_publish table (canonical publishing truth)
          </p>
        </div>
        <Button onClick={fetchRecentAttempts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Publishing Metrics Overview */}
      <PublishingMetrics />

      {/* Recent Publishing Attempts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Recent Publishing Attempts (Last 50)</span>
            <div className="flex items-center space-x-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === 'sent' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('sent')}
              >
                Sent
              </Button>
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
              >
                Failed
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Live data from pick_publish table • Showing {filteredAttempts.length} of{' '}
            {recentAttempts.length} attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading publishing attempts...</span>
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No publishing attempts found</p>
              {statusFilter !== 'all' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setStatusFilter('all')}
                >
                  Clear Filter
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pick ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Discord Message ID</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttempts.map(attempt => (
                    <TableRow key={attempt.id}>
                      <TableCell className="font-mono text-sm">{attempt.pick_id}</TableCell>
                      <TableCell>{getStatusBadge(attempt.status)}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {attempt.channel || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            attempt.attempts >= attempt.max_attempts
                              ? 'text-red-600 font-bold'
                              : ''
                          }
                        >
                          {attempt.attempts} / {attempt.max_attempts}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {attempt.external_message_id || 'N/A'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(attempt.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(attempt.updated_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {attempt.last_error ? (
                          <span className="text-xs text-red-600 font-mono truncate max-w-xs block">
                            {attempt.last_error.substring(0, 50)}
                            {attempt.last_error.length > 50 ? '...' : ''}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
