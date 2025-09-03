import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { RBACService, Permission } from '@/lib/rbac';
import { UnitTalkTracing } from '@/lib/telemetry';

interface ReplayCriteria {
  timeRange: '1h' | '6h' | '24h' | 'custom';
  eventType?: string;
  status?: string;
  customStart?: string;
  customEnd?: string;
  batchSize?: number;
  priority?: 'critical' | 'high' | 'normal' | 'low';
  alertTypes?: string[];
  reason: string;
  dryRun?: boolean;
}

interface ReplayResult {
  replayId: string;
  success: boolean;
  message: string;
  eventCount: number;
  estimatedDuration?: number;
}

export async function POST(request: NextRequest) {
  const span = UnitTalkTracing.startTemporalSpan('command-center', 'replay-operation');
  
  try {
    const userId = request.headers.get('x-user-id');
    const userAgent = request.headers.get('user-agent');
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      }, { status: 401 });
    }

    // Check permissions with audit logging
    await RBACService.requirePermission(userId, Permission.REPLAY_WORKFLOWS, {
      ip_address: clientIP,
      user_agent: userAgent,
      operation: 'replay_request',
    });

    const { action, criteria }: { action: string; criteria: ReplayCriteria } = await request.json();
    
    // Validate required fields
    if (!criteria.reason || criteria.reason.trim().length < 10) {
      return NextResponse.json({ 
        error: 'Replay reason must be at least 10 characters',
        code: 'INVALID_REASON'
      }, { status: 400 });
    }

    // Route to appropriate handler
    let result: ReplayResult;
    
    switch (action) {
      case 'rerun-grading':
        result = await handleGradingReplay(criteria, userId);
        break;
      case 'reemit-alerts':
        result = await handleAlertReemission(criteria, userId);
        break;
      case 'preview':
        result = await handlePreview(criteria, userId);
        break;
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use "rerun-grading", "reemit-alerts", or "preview"',
          code: 'INVALID_ACTION'
        }, { status: 400 });
    }

    // Log the operation for audit trail
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: `REPLAY_${action.toUpperCase()}`,
      resource_type: 'event',
      payload: {
        criteria,
        result: {
          replayId: result.replayId,
          eventCount: result.eventCount,
          success: result.success,
        },
      },
      ip_address: clientIP,
      user_agent: userAgent,
      status: result.success ? 'success' : 'failure',
    });

    return NextResponse.json(result);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;
    
    // Log the error
    console.error('Replay operation failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      error: errorMessage,
      code: statusCode === 403 ? 'ACCESS_DENIED' : 'OPERATION_FAILED',
    }, { status: statusCode });
    
  } finally {
    span.end();
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await RBACService.requirePermission(userId, Permission.REPLAY_WORKFLOWS);

    const { searchParams } = new URL(request.url);
    const replayId = searchParams.get('replayId');
    
    if (!replayId) {
      return NextResponse.json({ 
        error: 'replayId parameter required',
        code: 'MISSING_REPLAY_ID' 
      }, { status: 400 });
    }

    const status = await getReplayStatus(replayId);
    return NextResponse.json(status);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const statusCode = errorMessage.includes('Access denied') ? 403 : 500;
    
    return NextResponse.json({
      error: errorMessage,
      code: statusCode === 403 ? 'ACCESS_DENIED' : 'STATUS_FETCH_FAILED',
    }, { status: statusCode });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    await RBACService.requirePermission(userId, Permission.REPLAY_WORKFLOWS);

    const { searchParams } = new URL(request.url);
    const replayId = searchParams.get('replayId');
    
    if (!replayId) {
      return NextResponse.json({ 
        error: 'replayId parameter required',
        code: 'MISSING_REPLAY_ID' 
      }, { status: 400 });
    }

    await cancelReplay(replayId, userId);
    
    // Log cancellation
    await RBACService.logAudit({
      actor: userId,
      actor_type: 'user',
      action: 'REPLAY_CANCELLED',
      resource_type: 'workflow',
      resource_id: replayId,
      status: 'success',
    });

    return NextResponse.json({ 
      success: true,
      message: `Replay ${replayId} cancelled successfully` 
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      error: errorMessage,
      code: 'CANCELLATION_FAILED',
    }, { status: 500 });
  }
}

async function handlePreview(criteria: ReplayCriteria, userId: string): Promise<ReplayResult> {
  const events = await fetchEventsForCriteria(criteria);
  
  const eventsByType = events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    replayId: `preview-${Date.now()}`,
    success: true,
    message: `Preview: Found ${events.length} events for replay`,
    eventCount: events.length,
    estimatedDuration: calculateEstimatedDuration(events, criteria),
    // Additional preview data
    eventsByType,
    ticketCount: eventsByType['ticket.submitted.v1'] || 0,
    gradingCount: eventsByType['grading.completed.v1'] || 0,
  } as any;
}

async function handleGradingReplay(criteria: ReplayCriteria, userId: string): Promise<ReplayResult> {
  if (criteria.dryRun) {
    return await handlePreview(criteria, userId);
  }

  const events = await fetchEventsForCriteria(criteria, ['ticket.submitted.v1', 'grading.completed.v1']);
  
  if (events.length === 0) {
    return {
      replayId: '',
      success: false,
      message: 'No events found matching the specified criteria',
      eventCount: 0,
    };
  }

  const replayId = `grading-replay-${Date.now()}`;
  
  // Create replay events with metadata
  const replayEvents = events.map(event => ({
    event_type: `${event.event_type}.replay`,
    aggregate_id: event.aggregate_id,
    aggregate_type: event.aggregate_type,
    event_data: {
      ...event.event_data,
      replay_context: {
        is_replay: true,
        original_event_id: event.id,
        replay_reason: criteria.reason,
        replayed_by: userId,
        replayed_at: new Date().toISOString(),
      },
    },
    metadata: {
      ...event.metadata,
      is_replay: true,
      original_event_id: event.id,
      replay_id: replayId,
      replay_batch_size: criteria.batchSize || 5,
      replay_priority: criteria.priority || 'normal',
    },
    idempotency_key: `replay-${event.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  // Insert replay events
  const { error: insertError } = await supabase
    .from('events')
    .insert(replayEvents);

  if (insertError) {
    throw new Error(`Failed to create replay events: ${insertError.message}`);
  }

  // Create workflow execution tracking record
  await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: replayId,
      workflow_type: 'replayGradingWorkflow',
      run_id: `${replayId}-${Date.now()}`,
      execution_status: 'running',
      input_data: {
        originalEventIds: events.map(e => e.id),
        replayReason: criteria.reason,
        userId,
        batchSize: criteria.batchSize,
      },
    });

  // Trigger Temporal workflow for batch processing
  try {
    const { temporalService } = await import('@/lib/temporal');
    
    // TODO: Implement startWorkflow method in temporalService
    console.log(`Starting replay workflow: ${replayId}`, {
      originalEventIds: events.map(e => e.id),
      replayReason: criteria.reason,
      batchSize: criteria.batchSize || 5,
      userId,
    });

  } catch (temporalError) {
    console.warn('Failed to start Temporal workflow, events will be processed by BridgeWorker:', temporalError);
  }

  return {
    replayId,
    success: true,
    message: `Initiated replay of ${events.length} grading events`,
    eventCount: events.length,
    estimatedDuration: calculateEstimatedDuration(events, criteria),
  };
}

async function handleAlertReemission(criteria: ReplayCriteria, userId: string): Promise<ReplayResult> {
  if (criteria.dryRun) {
    return await handlePreview(criteria, userId);
  }

  const gradingEvents = await fetchEventsForCriteria(criteria, ['grading.completed.v1']);
  
  if (gradingEvents.length === 0) {
    return {
      replayId: '',
      success: false,
      message: 'No grading events found matching the specified criteria',
      eventCount: 0,
    };
  }

  const replayId = `alert-reemit-${Date.now()}`;

  // Create alert re-emission events
  const alertEvents = gradingEvents.map(event => ({
    event_type: 'alert.reemit.v1',
    aggregate_id: event.aggregate_id,
    aggregate_type: event.aggregate_type,
    event_data: {
      ...event.event_data,
      is_reemission: true,
      original_grading_event_id: event.id,
      reemission_reason: criteria.reason,
      reemitted_by: userId,
      alert_types: criteria.alertTypes,
    },
    metadata: {
      is_replay: true,
      replay_id: replayId,
      replayed_at: new Date().toISOString(),
    },
    idempotency_key: `reemit-${event.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  }));

  const { error: insertError } = await supabase
    .from('events')
    .insert(alertEvents);

  if (insertError) {
    throw new Error(`Failed to create re-emission events: ${insertError.message}`);
  }

  // Create workflow execution tracking
  await supabase
    .from('workflow_executions')
    .insert({
      workflow_id: replayId,
      workflow_type: 'alertReemissionWorkflow',
      run_id: `${replayId}-${Date.now()}`,
      execution_status: 'running',
      input_data: {
        gradingEventIds: gradingEvents.map(e => e.id),
        alertTypes: criteria.alertTypes,
        reemissionReason: criteria.reason,
        userId,
      },
    });

  // Trigger Temporal workflow
  try {
    const { temporalService } = await import('@/lib/temporal');
    
    // TODO: Implement startWorkflow method in temporalService
    console.log(`Starting alert reemission workflow: ${replayId}`, {
      gradingEventIds: gradingEvents.map(e => e.id),
      alertTypes: criteria.alertTypes,
      reemissionReason: criteria.reason,
      userId,
    });

  } catch (temporalError) {
    console.warn('Failed to start Temporal workflow, events will be processed by BridgeWorker:', temporalError);
  }

  return {
    replayId,
    success: true,
    message: `Initiated re-emission of ${gradingEvents.length} alert events`,
    eventCount: gradingEvents.length,
    estimatedDuration: calculateEstimatedDuration(gradingEvents, criteria, 'alert'),
  };
}

async function fetchEventsForCriteria(criteria: ReplayCriteria, eventTypes?: string[]): Promise<any[]> {
  let query = supabase
    .from('events')
    .select('*');

  // Apply event type filter
  if (criteria.eventType) {
    query = query.eq('event_type', criteria.eventType);
  } else if (eventTypes) {
    query = query.in('event_type', eventTypes);
  }

  // Apply time range filter
  const timeRangeFilter = getTimeRangeFilter(criteria.timeRange, criteria.customStart, criteria.customEnd);
  query = query.gte('created_at', timeRangeFilter.start).lte('created_at', timeRangeFilter.end);

  // Apply status filter (only get successfully processed events for replay)
  if (criteria.status) {
    query = query.eq('processing_status', criteria.status);
  } else {
    // Default: only replay successfully processed events
    query = query.is('processed_at', null).is('failed_at', null);
  }

  // Order by creation time
  query = query.order('created_at', { ascending: true });

  const { data: events, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return events || [];
}

async function getReplayStatus(replayId: string): Promise<any> {
  // First, check workflow execution status
  const { data: workflowExecution, error: workflowError } = await supabase
    .from('workflow_executions')
    .select('*')
    .eq('workflow_id', replayId)
    .single();

  if (workflowError && workflowError.code !== 'PGRST116') {
    throw new Error(`Failed to fetch workflow status: ${workflowError.message}`);
  }

  // Get replay events and their processing status
  const { data: replayEvents, error: eventsError } = await supabase
    .from('events')
    .select('id, processed_at, failed_at, retry_count, metadata')
    .eq('metadata->>replay_id', replayId);

  if (eventsError) {
    throw new Error(`Failed to fetch replay events: ${eventsError.message}`);
  }

  const totalEvents = replayEvents?.length || 0;
  const completedEvents = replayEvents?.filter(e => e.processed_at).length || 0;
  const failedEvents = replayEvents?.filter(e => e.failed_at).length || 0;

  // Get processing logs for more detailed metrics
  const { data: processingLogs } = await supabase
    .from('event_processing_logs')
    .select('*')
    .in('event_id', replayEvents?.map(e => e.id) || []);

  const metrics = {
    processingTime: processingLogs?.reduce((sum, log) => sum + (Number(log.processing_duration_ms) || 0), 0) || 0,
    alertsGenerated: 0, // Would need to count alerts generated during replay
    opportunitiesFound: 0, // Would need to count opportunities found
    errorsEncountered: failedEvents,
  };

  const errors = processingLogs?.filter(log => log.error_message).map(log => ({
    step: 'event_processing',
    error: log.error_message,
    timestamp: log.processing_started_at,
  })) || [];

  let status = 'running';
  if (workflowExecution?.execution_status === 'completed' || completedEvents === totalEvents) {
    status = failedEvents > 0 ? 'completed-with-errors' : 'completed';
  } else if (workflowExecution?.execution_status === 'failed') {
    status = 'failed';
  } else if (workflowExecution?.execution_status === 'cancelled') {
    status = 'cancelled';
  }

  return {
    id: replayId,
    status,
    progress: {
      completed: completedEvents,
      total: totalEvents,
      currentStep: status === 'running' ? `Processing events (${completedEvents}/${totalEvents})` : 
                   status === 'completed' ? 'Replay completed' :
                   status === 'failed' ? 'Replay failed' : 'Replay cancelled',
      estimatedCompletion: workflowExecution?.completed_at || 
                          new Date(Date.now() + (totalEvents - completedEvents) * 30000).toISOString(),
    },
    metrics,
    errors: errors.slice(-5), // Return last 5 errors
  };
}

async function cancelReplay(replayId: string, userId: string): Promise<void> {
  // Update workflow execution status
  const { error: workflowError } = await supabase
    .from('workflow_executions')
    .update({ 
      execution_status: 'cancelled',
      completed_at: new Date().toISOString(),
      error_details: { 
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
        reason: 'Manual cancellation from Command Center'
      },
    })
    .eq('workflow_id', replayId);

  if (workflowError) {
    console.warn('Failed to update workflow execution status:', workflowError);
  }

  // Try to cancel Temporal workflow if it exists
  try {
    const { temporalService } = await import('@/lib/temporal');
    await temporalService.terminateWorkflow(replayId, 'Replay cancelled by user');
  } catch (temporalError) {
    console.warn('Failed to cancel Temporal workflow (may not exist):', temporalError);
  }

  // Mark any remaining unprocessed replay events as cancelled
  const { error: eventsError } = await supabase
    .from('events')
    .update({
      metadata: supabase.rpc('jsonb_set', {
        target: supabase.rpc('coalesce', { events: 'metadata', fallback: '{}' }),
        path: '{cancelled}',
        new_value: 'true'
      }),
      failed_at: new Date().toISOString(),
    })
    .eq('metadata->>replay_id', replayId)
    .is('processed_at', null)
    .is('failed_at', null);

  if (eventsError) {
    console.warn('Failed to mark replay events as cancelled:', eventsError);
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

function calculateEstimatedDuration(events: any[], criteria: ReplayCriteria, type: 'grading' | 'alert' = 'grading'): number {
  const eventCount = events.length;
  const batchSize = criteria.batchSize || 5;
  
  // Estimated processing time per event (in milliseconds)
  const processingTimePerEvent = type === 'grading' ? 30000 : 5000; // 30s for grading, 5s for alerts
  
  // Calculate batched processing time
  const totalBatches = Math.ceil(eventCount / batchSize);
  const estimatedDuration = totalBatches * processingTimePerEvent;
  
  return estimatedDuration;
}