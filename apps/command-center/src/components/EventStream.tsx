'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  Pause,
  Play,
  RefreshCw,
  Search,
  Workflow,
  Zap,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PipelineEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  eventData: any;
  metadata: any;
  source: 'events' | 'bridge_outbox' | 'workflow_executions';
  createdAt: string;
  processedAt?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface EventStreamProps {
  className?: string;
}

const EVENT_TYPE_CONFIGS = {
  'ticket.submitted.v1': {
    label: 'Ticket Submitted',
    icon: '🎫',
    color: 'bg-blue-500',
    description: 'New betting ticket submitted via Smart Form',
  },
  'ticket.processing.completed.v1': {
    label: 'Ticket Processed',
    icon: '✅',
    color: 'bg-green-500',
    description: 'Ticket processing completed successfully',
  },
  'grading.completed.v1': {
    label: 'Grading Complete',
    icon: '📊',
    color: 'bg-purple-500',
    description: 'Professional grading analysis completed',
  },
  'alert.injury.detected.v1': {
    label: 'Injury Alert',
    icon: '🏥',
    color: 'bg-yellow-500',
    description: 'Player injury detected - betting impact alert',
  },
  'alert.high_tier.v1': {
    label: 'High Tier Alert',
    icon: '⭐',
    color: 'bg-orange-500',
    description: 'S-tier or A-tier pick alert',
  },
  'alert.hedge.opportunity.v1': {
    label: 'Hedge Opportunity',
    icon: '🛡️',
    color: 'bg-indigo-500',
    description: 'Hedge betting opportunity detected',
  },
  'alert.middle.opportunity.v1': {
    label: 'Middle Opportunity',
    icon: '🎯',
    color: 'bg-cyan-500',
    description: 'Middle betting opportunity detected',
  },
  'workflow.started.v1': {
    label: 'Workflow Started',
    icon: '▶️',
    color: 'bg-blue-400',
    description: 'Temporal workflow execution started',
  },
  'workflow.completed.v1': {
    label: 'Workflow Complete',
    icon: '✅',
    color: 'bg-green-400',
    description: 'Temporal workflow execution completed',
  },
  'workflow.failed.v1': {
    label: 'Workflow Failed',
    icon: '❌',
    color: 'bg-red-500',
    description: 'Temporal workflow execution failed',
  },
  'bridge.outbox.completed.v1': {
    label: 'Bridge Complete',
    icon: '🌉',
    color: 'bg-teal-500',
    description: 'Smart Form bridge processing completed',
  },
};

const STATUS_CONFIGS = {
  pending: { label: 'Pending', icon: Clock, color: 'text-yellow-600 bg-yellow-100' },
  processing: { label: 'Processing', icon: Activity, color: 'text-blue-600 bg-blue-100' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-600 bg-green-100' },
  failed: { label: 'Failed', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
};

const SOURCE_CONFIGS = {
  events: { label: 'Events', icon: '📋', color: 'bg-gray-500' },
  bridge_outbox: { label: 'Bridge', icon: '🌉', color: 'bg-blue-600' },
  workflow_executions: { label: 'Workflows', icon: '⚡', color: 'bg-purple-600' },
};

export function EventStream({ className }: EventStreamProps) {
  const { toast } = useToast();

  // State management
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'connecting'
  >('disconnected');
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    timeRange: '1h' as '1h' | '6h' | '24h' | '7d' | 'custom',
    eventTypes: [] as string[],
    source: 'all' as 'all' | 'events' | 'bridge_outbox' | 'workflow_executions',
    status: 'all' as 'all' | 'pending' | 'processing' | 'completed' | 'failed',
    search: '',
  });

  // UI state
  const [selectedEvent, setSelectedEvent] = useState<PipelineEvent | null>(null);
  const [replayDialogOpen, setReplayDialogOpen] = useState(false);

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          event.eventType,
          event.aggregateId,
          event.aggregateType,
          JSON.stringify(event.eventData),
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // Event type filter
      if (filters.eventTypes.length > 0 && !filters.eventTypes.includes(event.eventType)) {
        return false;
      }

      // Source filter
      if (filters.source !== 'all' && event.source !== filters.source) {
        return false;
      }

      // Status filter
      if (filters.status !== 'all' && event.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [events, filters]);

  // Load initial events
  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams({
        timeRange: filters.timeRange,
        source: filters.source,
        limit: '100',
        includeMetadata: 'true',
      });

      if (filters.eventTypes.length > 0) {
        searchParams.set('eventTypes', filters.eventTypes.join(','));
      }

      if (filters.status !== 'all') {
        searchParams.set('status', filters.status);
      }

      const response = await fetch(`/api/events?${searchParams}`, {
        headers: {
          'x-user-id': 'command-center-user', // TODO: Get from auth context
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load events: ${response.statusText}`);
      }

      const data = await response.json();
      setEvents(data.events || []);

      toast({
        title: 'Events Loaded',
        description: `Loaded ${data.events?.length || 0} events`,
      });
    } catch (error) {
      console.error('Failed to load events:', error);
      toast({
        title: 'Load Failed',
        description: 'Failed to load events from the server',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [filters, toast]);

  // Start streaming events
  const startStreaming = useCallback(() => {
    if (eventSource) {
      eventSource.close();
    }

    setConnectionStatus('connecting');
    setIsStreaming(true);

    try {
      const source = new EventSource('/api/stream');
      setEventSource(source);

      source.onopen = () => {
        setConnectionStatus('connected');
        toast({
          title: 'Stream Connected',
          description: 'Now receiving live event updates',
        });
      };

      source.onmessage = event => {
        try {
          const data = JSON.parse(event.data);

          if (
            data.type === 'event_update' ||
            data.type === 'bridge_outbox_update' ||
            data.type === 'workflow_update'
          ) {
            setEvents(prev => {
              // Avoid duplicates and keep most recent events first
              const filtered = prev.filter(e => e.id !== data.event.id);
              return [data.event, ...filtered].slice(0, 200); // Keep only last 200 events
            });
          }
        } catch (error) {
          console.error('Failed to parse event data:', error);
        }
      };

      source.onerror = () => {
        setConnectionStatus('disconnected');
        setIsStreaming(false);
        toast({
          title: 'Stream Disconnected',
          description: 'Lost connection to event stream',
          variant: 'destructive',
        });
      };
    } catch (error) {
      console.error('Failed to start streaming:', error);
      setConnectionStatus('disconnected');
      setIsStreaming(false);
      toast({
        title: 'Stream Failed',
        description: 'Failed to connect to event stream',
        variant: 'destructive',
      });
    }
  }, [eventSource, toast]);

  // Stop streaming events
  const stopStreaming = useCallback(() => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setIsStreaming(false);
    setConnectionStatus('disconnected');
  }, [eventSource]);

  // Handle replay request
  const handleReplay = useCallback(
    async (event: PipelineEvent) => {
      try {
        const replayData = {
          action: 'rerun-grading',
          criteria: {
            timeRange: '1h',
            eventType: event.eventType,
            reason: `Manual replay from Command Center for event ${event.id}`,
            batchSize: 1,
            priority: 'high',
            dryRun: false,
          },
        };

        const response = await fetch('/api/replay', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': 'command-center-user',
          },
          body: JSON.stringify(replayData),
        });

        if (!response.ok) {
          throw new Error(`Replay failed: ${response.statusText}`);
        }

        const result = await response.json();

        toast({
          title: 'Replay Started',
          description: `Replay ${result.replayId} initiated for ${result.eventCount} events`,
        });
      } catch (error) {
        console.error('Failed to start replay:', error);
        toast({
          title: 'Replay Failed',
          description: 'Failed to initiate event replay',
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  // Load initial data on mount
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold">Production Pipeline Events</h2>
          <Badge
            variant="outline"
            className={
              connectionStatus === 'connected'
                ? 'border-green-500 text-green-700'
                : connectionStatus === 'connecting'
                  ? 'border-yellow-500 text-yellow-700'
                  : 'border-red-500 text-red-700'
            }
          >
            {connectionStatus === 'connected' && '🟢'}
            {connectionStatus === 'connecting' && '🟡'}
            {connectionStatus === 'disconnected' && '🔴'}
            {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadEvents} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          {isStreaming ? (
            <Button size="sm" onClick={stopStreaming} variant="outline">
              <Pause className="w-4 h-4 mr-2" />
              Stop Stream
            </Button>
          ) : (
            <Button size="sm" onClick={startStreaming}>
              <Play className="w-4 h-4 mr-2" />
              Start Stream
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search events..."
            value={filters.search}
            onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="pl-10"
          />
        </div>

        <Select
          value={filters.timeRange}
          onValueChange={(value: any) => setFilters(prev => ({ ...prev, timeRange: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="6h">Last 6 Hours</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.source}
          onValueChange={(value: any) => setFilters(prev => ({ ...prev, source: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="events">Events Table</SelectItem>
            <SelectItem value="bridge_outbox">Bridge Outbox</SelectItem>
            <SelectItem value="workflow_executions">Workflows</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.status}
          onValueChange={(value: any) => setFilters(prev => ({ ...prev, status: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" className="justify-start">
          <Filter className="w-4 h-4 mr-2" />
          Event Types ({filters.eventTypes.length})
        </Button>
      </div>

      {/* Events Display */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Events List */}
        <div className="lg:col-span-2">
          <ScrollArea className="h-[600px] w-full border rounded-lg">
            <div className="p-4 space-y-4">
              {filteredEvents.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  {isLoading ? 'Loading events...' : 'No events found matching your filters'}
                </div>
              ) : (
                filteredEvents.map(event => {
                  const eventConfig =
                    EVENT_TYPE_CONFIGS[event.eventType as keyof typeof EVENT_TYPE_CONFIGS];
                  const statusConfig = STATUS_CONFIGS[event.status];
                  const sourceConfig = SOURCE_CONFIGS[event.source];

                  return (
                    <div
                      key={event.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                        selectedEvent?.id === event.id ? 'ring-2 ring-blue-500' : ''
                      }`}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-2 h-8 rounded ${eventConfig?.color || 'bg-gray-400'}`}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {eventConfig?.icon} {eventConfig?.label || event.eventType}
                              </span>
                              <Badge variant="outline" className={statusConfig.color}>
                                {(() => {
                                  const IconComponent = statusConfig.icon;
                                  return <IconComponent className="w-3 h-3 mr-1" />;
                                })()}
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {event.aggregateId} • {event.source}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              setSelectedEvent(event);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={e => {
                              e.stopPropagation();
                              handleReplay(event);
                            }}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Event Details */}
        <div className="lg:col-span-1">
          {selectedEvent ? (
            <div className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold mb-4">Event Details</h3>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="metadata">Metadata</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Event Type</div>
                    <div className="font-medium">{selectedEvent.eventType}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Aggregate ID</div>
                    <div className="font-medium break-all">{selectedEvent.aggregateId}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Source</div>
                    <Badge variant="outline">
                      {SOURCE_CONFIGS[selectedEvent.source].icon}{' '}
                      {SOURCE_CONFIGS[selectedEvent.source].label}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Status</div>
                    <Badge className={STATUS_CONFIGS[selectedEvent.status].color}>
                      {(() => {
                        const IconComponent = STATUS_CONFIGS[selectedEvent.status].icon;
                        return <IconComponent className="w-3 h-3 mr-1" />;
                      })()}
                      {STATUS_CONFIGS[selectedEvent.status].label}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">Created</div>
                    <div className="font-medium">
                      {new Date(selectedEvent.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {selectedEvent.processedAt && (
                    <div className="space-y-2">
                      <div className="text-sm text-gray-600">Processed</div>
                      <div className="font-medium">
                        {new Date(selectedEvent.processedAt).toLocaleString()}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="data">
                  <ScrollArea className="h-[300px]">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.eventData, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="metadata">
                  <ScrollArea className="h-[300px]">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedEvent.metadata, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            <div className="border rounded-lg p-4 text-center text-gray-500">
              Select an event to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
