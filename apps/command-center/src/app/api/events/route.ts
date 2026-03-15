import { NextRequest, NextResponse } from 'next/server';

import { getOperatorIdentity, requireOperatorIdentity } from '@/lib/auth';
import { RBACService, Permission } from '@/lib/rbac';
import { supabase } from '@/lib/supabase';
import { UnitTalkTracing } from '@/lib/telemetry';

/**
 * Production Pipeline Events API for Command Center
 *
 * Provides real-time access to production pipeline events including:
 * - Bridge outbox events (Smart Form integration)
 * - Temporal workflow executions
 * - Agent processing events
 * - Alert generations and emissions
 * - System health and performance metrics
 */

interface EventQuery {
  eventTypes?: string[];
  timeRange?: '1h' | '6h' | '24h' | '7d' | 'custom';
  customStart?: string;
  customEnd?: string;
  aggregateTypes?: string[];
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
  source?: 'events' | 'bridge_outbox' | 'workflow_executions' | 'all';
}

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

export async function GET(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('command-center', 'fetch-events');

  try {
    const identity = requireOperatorIdentity(request);
    const clientIP = request.headers.get('x-forwarded-for') || 'unknown';

    if (!identity) {
      return NextResponse.json(
        {
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      );
    }
    const userId = identity.userId;

    // Check permissions
    await RBACService.requirePermission(userId, Permission.VIEW_EVENTS, {
      ip_address: clientIP,
      operation: 'fetch_events',
    });

    const { searchParams } = new URL(request.url);
    const query: EventQuery = {
      eventTypes: searchParams.get('eventTypes')?.split(','),
      timeRange: (searchParams.get('timeRange') as any) || '1h',
      customStart: searchParams.get('customStart') || undefined,
      customEnd: searchParams.get('customEnd') || undefined,
      aggregateTypes: searchParams.get('aggregateTypes')?.split(','),
      status: searchParams.get('status') as any,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      includeMetadata: searchParams.get('includeMetadata') === 'true',
      source: (searchParams.get('source') as any) || 'all',
    };

    const events = await fetchPipelineEvents(query);
    const eventStats = await getEventStatistics(query);

    // Log the operation for audit trail
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'FETCH_EVENTS',
      resource_type: 'event',
      payload: {
        query,
        resultCount: events.length,
      },
      ip_address: clientIP,
      status: 'success',
    });

    return NextResponse.json({
      events,
      statistics: eventStats,
      query,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: eventStats.totalCount,
        hasMore: events.length === query.limit,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;

    console.error('Events fetch failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: errorMessage,
        code: statusCode === 403 ? 'ACCESS_DENIED' : 'FETCH_FAILED',
      },
      { status: statusCode }
    );
  } finally {
    span.end();
  }
}

/**
 * Stream live events via Server-Sent Events (SSE)
 */
export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('command-center', 'stream-events');

  try {
    const identity = requireOperatorIdentity(request);
    if (!identity) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const userId = identity.userId;

    await RBACService.requirePermission(userId, Permission.VIEW_EVENTS);

    const { eventTypes, source = 'all' } = await request.json();
    const connectionId = `events-${userId}-${Date.now()}`;

    // Create SSE stream for real-time events
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const welcomeMessage = `data: ${JSON.stringify({
          type: 'connected',
          connectionId,
          timestamp: new Date().toISOString(),
          supportedEventTypes: [
            'ticket.submitted.v1',
            'ticket.processing.completed.v1',
            'grading.completed.v1',
            'alert.injury.detected.v1',
            'alert.high_tier.v1',
            'alert.hedge.opportunity.v1',
            'alert.middle.opportunity.v1',
            'workflow.started.v1',
            'workflow.completed.v1',
            'bridge.outbox.completed.v1',
          ],
          sources: ['events', 'bridge_outbox', 'workflow_executions'],
        })}\n\n`;

        controller.enqueue(new TextEncoder().encode(welcomeMessage));

        // Set up database subscriptions for real-time events
        const subscriptions = setupEventSubscriptions(controller, eventTypes, source);

        // Cleanup on connection close
        request.signal.addEventListener('abort', () => {
          console.log(`🔌 Events stream closed: ${connectionId}`);
          cleanupSubscriptions(subscriptions);
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: errorMessage,
        code: 'STREAM_SETUP_FAILED',
      },
      { status: 500 }
    );
  } finally {
    span.end();
  }
}

async function fetchPipelineEvents(query: EventQuery): Promise<PipelineEvent[]> {
  const events: PipelineEvent[] = [];

  // Fetch from events table
  if (query.source === 'events' || query.source === 'all') {
    const eventsData = await fetchFromEventsTable(query);
    events.push(...eventsData);
  }

  // Fetch from bridge_outbox table
  if (query.source === 'bridge_outbox' || query.source === 'all') {
    const bridgeData = await fetchFromBridgeOutboxTable(query);
    events.push(...bridgeData);
  }

  // Fetch from workflow_executions table
  if (query.source === 'workflow_executions' || query.source === 'all') {
    const workflowData = await fetchFromWorkflowExecutionsTable(query);
    events.push(...workflowData);
  }

  // Sort by creation time (most recent first)
  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Apply limit
  return events.slice(query.offset || 0, (query.offset || 0) + (query.limit || 50));
}

async function fetchFromEventsTable(query: EventQuery): Promise<PipelineEvent[]> {
  let dbQuery = supabase.from('events').select('*');

  // Apply filters
  if (query.eventTypes && query.eventTypes.length > 0) {
    dbQuery = dbQuery.in('event_type', query.eventTypes);
  }

  if (query.aggregateTypes && query.aggregateTypes.length > 0) {
    dbQuery = dbQuery.in('aggregate_type', query.aggregateTypes);
  }

  // Apply time range filter
  const timeFilter = getTimeRangeFilter(query.timeRange!, query.customStart, query.customEnd);
  dbQuery = dbQuery.gte('created_at', timeFilter.start).lte('created_at', timeFilter.end);

  // Order and limit
  dbQuery = dbQuery.order('created_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return (data || []).map(event => ({
    id: String(event.id || ''),
    eventType: String(event.event_type || ''),
    aggregateId: String(event.aggregate_id || ''),
    aggregateType: String(event.aggregate_type || ''),
    eventData: event.event_data || {},
    metadata: event.metadata || {},
    source: 'events' as const,
    createdAt: String(event.created_at || ''),
    processedAt: String(event.processed_at || ''),
    status: determineEventStatus(event),
  }));
}

async function fetchFromBridgeOutboxTable(query: EventQuery): Promise<PipelineEvent[]> {
  let dbQuery = supabase.from('bridge_outbox').select('*');

  // Apply filters (bridge_outbox has different column names)
  if (query.eventTypes && query.eventTypes.length > 0) {
    dbQuery = dbQuery.in('event_type', query.eventTypes);
  }

  if (query.status) {
    dbQuery = dbQuery.eq('status', query.status);
  }

  // Apply time range filter
  const timeFilter = getTimeRangeFilter(query.timeRange!, query.customStart, query.customEnd);
  dbQuery = dbQuery.gte('created_at', timeFilter.start).lte('created_at', timeFilter.end);

  // Order and limit
  dbQuery = dbQuery.order('created_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to fetch bridge outbox events: ${error.message}`);
  }

  // Production schema: id, bet_slip_id, event_type, event_data, error_message,
  // processed_at, resolved_channel_id, resolved_thread_id, status, created_at, updated_at
  return (data || []).map(outboxRecord => ({
    id: String(outboxRecord.id || ''),
    eventType: String(outboxRecord.event_type || ''),
    aggregateId: String(outboxRecord.bet_slip_id || ''), // Use bet_slip_id as aggregate_id
    aggregateType: 'bridge_outbox',
    eventData: outboxRecord.event_data || {},
    metadata: {
      bet_slip_id: outboxRecord.bet_slip_id || null,
      resolved_channel_id: outboxRecord.resolved_channel_id || null,
      resolved_thread_id: outboxRecord.resolved_thread_id || null,
      error_message: outboxRecord.error_message || null,
    },
    source: 'bridge_outbox' as const,
    createdAt: String(outboxRecord.created_at || ''),
    processedAt: String(outboxRecord.processed_at || ''),
    status: (outboxRecord.status as 'pending' | 'processing' | 'completed' | 'failed') || 'pending',
  }));
}

async function fetchFromWorkflowExecutionsTable(query: EventQuery): Promise<PipelineEvent[]> {
  let dbQuery = supabase.from('workflow_executions').select('*');

  // Apply filters
  if (query.status) {
    const statusMapping = {
      pending: 'queued',
      processing: 'running',
      completed: 'completed',
      failed: 'failed',
    };
    dbQuery = dbQuery.eq('execution_status', statusMapping[query.status] || query.status);
  }

  // Apply time range filter
  const timeFilter = getTimeRangeFilter(query.timeRange!, query.customStart, query.customEnd);
  dbQuery = dbQuery.gte('started_at', timeFilter.start).lte('started_at', timeFilter.end);

  // Order and limit
  dbQuery = dbQuery.order('started_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    throw new Error(`Failed to fetch workflow executions: ${error.message}`);
  }

  return (data || []).map(workflow => ({
    id: String(workflow.workflow_id || ''),
    eventType: `workflow.${String(workflow.execution_status || 'unknown')}.v1`,
    aggregateId: String(workflow.bet_slip_id || workflow.workflow_id || ''),
    aggregateType: 'workflow',
    eventData: {
      workflowType: workflow.workflow_type || '',
      inputData: workflow.input_data || {},
      executionResult: workflow.execution_result || {},
      processingTimeMs: workflow.processing_time_ms || 0,
    },
    metadata: {
      runId: workflow.run_id || '',
      taskQueue: workflow.task_queue || '',
      workerId: workflow.worker_id || '',
      errorDetails: workflow.error_details || null,
    },
    source: 'workflow_executions' as const,
    createdAt: String(workflow.started_at || ''),
    processedAt: String(workflow.completed_at || ''),
    status: mapWorkflowStatusToEventStatus(String(workflow.execution_status || 'unknown')),
  }));
}

async function getEventStatistics(query: EventQuery) {
  const stats = {
    totalCount: 0,
    byType: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    recentActivity: {
      lastHour: 0,
      last6Hours: 0,
      last24Hours: 0,
    },
  };

  // Get counts from each source
  if (query.source === 'events' || query.source === 'all') {
    const eventsStats = await getEventsTableStatistics(query);
    stats.totalCount += eventsStats.count;
    Object.assign(stats.byType, eventsStats.byType);
    stats.bySource.events = eventsStats.count;
    Object.assign(stats.byStatus, eventsStats.byStatus);
  }

  if (query.source === 'bridge_outbox' || query.source === 'all') {
    const bridgeStats = await getBridgeOutboxStatistics(query);
    stats.totalCount += bridgeStats.count;
    stats.bySource.bridge_outbox = bridgeStats.count;
    // Merge status counts
    Object.keys(bridgeStats.byStatus).forEach(status => {
      stats.byStatus[status] = (stats.byStatus[status] || 0) + bridgeStats.byStatus[status];
    });
  }

  if (query.source === 'workflow_executions' || query.source === 'all') {
    const workflowStats = await getWorkflowExecutionsStatistics(query);
    stats.totalCount += workflowStats.count;
    stats.bySource.workflow_executions = workflowStats.count;
    // Merge status counts
    Object.keys(workflowStats.byStatus).forEach(status => {
      stats.byStatus[status] = (stats.byStatus[status] || 0) + workflowStats.byStatus[status];
    });
  }

  return stats;
}

function setupEventSubscriptions(
  controller: ReadableStreamDefaultController,
  eventTypes?: string[],
  source?: string
) {
  const subscriptions: any[] = [];

  try {
    // Subscribe to events table
    if (source === 'events' || source === 'all') {
      const eventsSubscription = supabase
        .channel('command-center-events')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'events',
            filter: eventTypes ? `event_type=in.(${eventTypes.join(',')})` : undefined,
          },
          payload => {
            const event = mapDatabaseEventToPipelineEvent(payload.new, 'events');
            const message = `data: ${JSON.stringify({
              type: 'event_update',
              event,
              changeType: payload.eventType,
              timestamp: new Date().toISOString(),
            })}\n\n`;

            try {
              controller.enqueue(new TextEncoder().encode(message));
            } catch (error) {
              console.error('Failed to send event update:', error);
            }
          }
        )
        .subscribe();

      subscriptions.push(eventsSubscription);
    }

    // Subscribe to bridge_outbox table
    if (source === 'bridge_outbox' || source === 'all') {
      const bridgeSubscription = supabase
        .channel('command-center-bridge-outbox')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'bridge_outbox',
          },
          payload => {
            const event = mapDatabaseEventToPipelineEvent(payload.new, 'bridge_outbox');
            const message = `data: ${JSON.stringify({
              type: 'bridge_outbox_update',
              event,
              changeType: payload.eventType,
              timestamp: new Date().toISOString(),
            })}\n\n`;

            try {
              controller.enqueue(new TextEncoder().encode(message));
            } catch (error) {
              console.error('Failed to send bridge outbox update:', error);
            }
          }
        )
        .subscribe();

      subscriptions.push(bridgeSubscription);
    }

    // Subscribe to workflow_executions table
    if (source === 'workflow_executions' || source === 'all') {
      const workflowSubscription = supabase
        .channel('command-center-workflows')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'workflow_executions',
          },
          payload => {
            const event = mapDatabaseEventToPipelineEvent(payload.new, 'workflow_executions');
            const message = `data: ${JSON.stringify({
              type: 'workflow_update',
              event,
              changeType: payload.eventType,
              timestamp: new Date().toISOString(),
            })}\n\n`;

            try {
              controller.enqueue(new TextEncoder().encode(message));
            } catch (error) {
              console.error('Failed to send workflow update:', error);
            }
          }
        )
        .subscribe();

      subscriptions.push(workflowSubscription);
    }
  } catch (error) {
    console.error('Failed to setup event subscriptions:', error);
  }

  return subscriptions;
}

function cleanupSubscriptions(subscriptions: any[]) {
  subscriptions.forEach(subscription => {
    try {
      subscription.unsubscribe();
    } catch (error) {
      console.error('Failed to cleanup subscription:', error);
    }
  });
}

// Helper functions
function determineEventStatus(event: any): 'pending' | 'processing' | 'completed' | 'failed' {
  if (event.failed_at) return 'failed';
  if (event.processed_at) return 'completed';
  if (event.processing_started_at) return 'processing';
  return 'pending';
}

function mapWorkflowStatusToEventStatus(
  workflowStatus: string
): 'pending' | 'processing' | 'completed' | 'failed' {
  switch (workflowStatus) {
    case 'queued':
      return 'pending';
    case 'running':
      return 'processing';
    case 'completed':
      return 'completed';
    case 'failed':
    case 'terminated':
    case 'cancelled':
      return 'failed';
    default:
      return 'pending';
  }
}

function mapDatabaseEventToPipelineEvent(
  dbRecord: any,
  source: 'events' | 'bridge_outbox' | 'workflow_executions'
): PipelineEvent {
  switch (source) {
    case 'events':
      return {
        id: dbRecord.id,
        eventType: dbRecord.event_type,
        aggregateId: dbRecord.aggregate_id,
        aggregateType: dbRecord.aggregate_type,
        eventData: dbRecord.event_data,
        metadata: dbRecord.metadata,
        source: 'events',
        createdAt: dbRecord.created_at,
        processedAt: dbRecord.processed_at,
        status: determineEventStatus(dbRecord),
      };

    case 'bridge_outbox':
      return {
        id: dbRecord.id,
        eventType: dbRecord.event_type,
        aggregateId: dbRecord.unique_key,
        aggregateType: 'bridge_outbox',
        eventData: dbRecord.payload,
        metadata: {
          attempts: dbRecord.attempts,
          max_attempts: dbRecord.max_attempts,
          next_attempt_at: dbRecord.next_attempt_at,
          error_message: dbRecord.error_message,
        },
        source: 'bridge_outbox',
        createdAt: dbRecord.created_at,
        processedAt: dbRecord.processed_at,
        status: dbRecord.status,
      };

    case 'workflow_executions':
      return {
        id: dbRecord.workflow_id,
        eventType: `workflow.${dbRecord.execution_status}.v1`,
        aggregateId: dbRecord.bet_slip_id || dbRecord.workflow_id,
        aggregateType: 'workflow',
        eventData: {
          workflowType: dbRecord.workflow_type,
          inputData: dbRecord.input_data,
          executionResult: dbRecord.execution_result,
          processingTimeMs: dbRecord.processing_time_ms,
        },
        metadata: {
          runId: dbRecord.run_id,
          taskQueue: dbRecord.task_queue,
          workerId: dbRecord.worker_id,
          errorDetails: dbRecord.error_details,
        },
        source: 'workflow_executions',
        createdAt: dbRecord.started_at,
        processedAt: dbRecord.completed_at,
        status: mapWorkflowStatusToEventStatus(dbRecord.execution_status),
      };
  }
}

function getTimeRangeFilter(timeRange: string, customStart?: string, customEnd?: string) {
  const now = new Date();

  switch (timeRange) {
    case '1h':
      return {
        start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
    case '6h':
      return {
        start: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
    case '24h':
      return {
        start: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
    case '7d':
      return {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
    case 'custom':
      return {
        start: customStart || new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        end: customEnd || now.toISOString(),
      };
    default:
      return {
        start: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        end: now.toISOString(),
      };
  }
}

// Statistics helper functions (simplified implementations)
async function getEventsTableStatistics(query: EventQuery) {
  const { count } = await supabase.from('events').select('*', { count: 'exact', head: true });

  return {
    count: count || 0,
    byType: {},
    byStatus: {},
  };
}

async function getBridgeOutboxStatistics(query: EventQuery) {
  const { count } = await supabase
    .from('bridge_outbox')
    .select('*', { count: 'exact', head: true });

  return {
    count: count || 0,
    byStatus: {},
  };
}

async function getWorkflowExecutionsStatistics(query: EventQuery) {
  const { count } = await supabase
    .from('workflow_executions')
    .select('*', { count: 'exact', head: true });

  return {
    count: count || 0,
    byStatus: {},
  };
}
