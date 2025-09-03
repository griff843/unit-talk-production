'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, AlertCircle, Copy, Clock, Package, Filter } from 'lucide-react';
import { usePromoBacklog } from '@/hooks/usePromoBacklog';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/components/ui/use-toast';

interface PromoBacklogCardProps {
  className?: string;
}

export function PromoBacklogCard({ className }: PromoBacklogCardProps) {
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  
  const { data, loading, error, refetch } = usePromoBacklog({
    sport: selectedSport,
    tier: selectedTier,
    limit: 500
  });

  // Get available options from data
  const { availableSports, availableTiers } = useMemo(() => {
    if (!data || data.length === 0) {
      return { availableSports: ['all'], availableTiers: ['all'] };
    }

    const sports = [...new Set(data.map(item => item.sport))].sort();
    const tiers = [...new Set(data.map(item => item.tier))].sort();

    return {
      availableSports: ['all', ...sports],
      availableTiers: ['all', ...tiers],
    };
  }, [data]);

  const handleCopyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast({
        title: "ID Copied",
        description: `Copied ${id} to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy ID to clipboard",
        variant: "destructive",
      });
    }
  };

  const getBacklogStatus = (count: number) => {
    if (count > 100) return { level: 'critical', color: 'destructive', text: 'High Backlog' };
    if (count > 50) return { level: 'warning', color: 'secondary', text: 'Moderate Backlog' };
    return { level: 'healthy', color: 'default', text: 'Normal' };
  };

  const backlogStatus = getBacklogStatus(data?.length || 0);

  if (error) {
    return (
      <Card className={`border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 ${className}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
            <Package className="w-4 h-4 mr-2 inline" />
            Promo Backlog
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={refetch}
            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 dark:text-red-400"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-600 dark:text-red-400">
              {error}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Promo Backlog
              <Badge variant={backlogStatus.color as any} className="ml-2">
                {data?.length || 0} items
              </Badge>
            </CardTitle>
            <CardDescription>
              Unprocessed promotional items awaiting processing
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Sport" />
              </SelectTrigger>
              <SelectContent>
                {availableSports.map(sport => (
                  <SelectItem key={sport} value={sport}>
                    {sport === 'all' ? 'All Sports' : sport.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTier} onValueChange={setSelectedTier}>
              <SelectTrigger className="w-20">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                {availableTiers.map(tier => (
                  <SelectItem key={tier} value={tier}>
                    {tier === 'all' ? 'All' : tier}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading && !data ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mr-2" />
            <span>Loading backlog data...</span>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No backlog items found
          </div>
        ) : (
          <>
            {/* Status Summary */}
            <div className="mb-4 p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Backlog Status:</span>
                  <Badge variant={backlogStatus.color as any} className="ml-2">
                    {backlogStatus.text}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {data.length} items
                </div>
              </div>
            </div>

            {/* Data Table */}
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Sport</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Odds</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.raw_prop_id}>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          <span className="font-mono text-xs">
                            {item.raw_prop_id.slice(-8)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleCopyId(item.raw_prop_id)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.sport}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.pick_type}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.line}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.odds > 0 ? '+' : ''}{item.odds}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={item.tier === 'S' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {item.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(item.processed_at), { addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {data.length >= 500 && (
              <div className="mt-4 text-center text-sm text-muted-foreground">
                Showing first 500 items. Use filters to narrow results.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PromoBacklogCard;