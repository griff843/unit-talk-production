import { NextRequest, NextResponse } from 'next/server';

import { dbOperations, SecurityEvent, supabase } from '@/lib/supabase';

/**
 * Security Events API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

// GET /api/security - Get security events with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');
    const severity = searchParams.get('severity');
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const resolved = searchParams.get('resolved');
    const userId = searchParams.get('user_id');
    const ipAddress = searchParams.get('ip_address');
    const since = searchParams.get('since');
    const includeStats = searchParams.get('stats') === 'true';

    console.log('[CC] GET /api/security', {
      eventId,
      severity,
      type,
      limit,
      offset,
      resolved,
      userId,
      ipAddress,
      since,
      includeStats,
    });

    // If specific event requested
    if (eventId) {
      const { data, error } = await supabase
        .from('security_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        console.error('[CC] Security event query failed:', error.message);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: error.code === 'PGRST116' ? 404 : 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
        source: 'database',
      });
    }

    // Get all events with filtering
    let query = supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (severity) {
      query = query.eq('severity', severity as 'low' | 'medium' | 'high' | 'critical');
    }
    if (type) {
      query = query.eq(
        'type',
        type as 'login_attempt' | 'api_access' | 'rate_limit' | 'suspicious_activity'
      );
    }
    if (resolved === 'true') {
      query = query.not('resolved_at', 'is', null);
    } else if (resolved === 'false') {
      query = query.is('resolved_at', null);
    }
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (ipAddress) {
      query = query.eq('ip_address', ipAddress);
    }
    if (since) {
      query = query.gte('created_at', since);
    }

    if (limit > 0) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('[CC] Security events query failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database query failed: ${error.message}` },
        { status: 500 }
      );
    }

    const responseData: any = {
      events,
      pagination: {
        offset,
        limit,
        total: count || events?.length || 0,
      },
    };

    if (includeStats) {
      responseData.stats = calculateSecurityStats((events as unknown as SecurityEvent[]) || []);
    }

    return NextResponse.json({
      success: true,
      data: responseData,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] GET /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/security - Create new security event or perform action
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, eventId, ...eventData } = body;

    // Handle security event actions (resolve, escalate, etc.)
    if (action) {
      console.log('[CC] POST /api/security - Action:', action, { eventId });

      if (!eventId) {
        return NextResponse.json(
          { success: false, error: 'Event ID is required for actions' },
          { status: 400 }
        );
      }

      const validActions = ['resolve', 'escalate', 'acknowledge', 'investigate'];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          { success: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
          { status: 400 }
        );
      }

      const updateData: any = {};

      switch (action) {
        case 'resolve':
          updateData.resolved_at = new Date().toISOString();
          break;
        case 'escalate':
          const { data: eventDataRes } = await supabase
            .from('security_events')
            .select('severity')
            .eq('id', eventId)
            .single();

          if (eventDataRes?.severity !== 'critical') {
            const severities = ['low', 'medium', 'high', 'critical'];
            const currentIndex = severities.indexOf((eventDataRes?.severity as string) || 'low');
            updateData.severity = severities[Math.min(currentIndex + 1, severities.length - 1)];
          }
          break;
        case 'acknowledge':
          updateData.metadata = { acknowledged: true, acknowledged_at: new Date().toISOString() };
          break;
        case 'investigate':
          updateData.metadata = {
            under_investigation: true,
            investigation_started: new Date().toISOString(),
          };
          break;
      }

      const { data, error } = await supabase
        .from('security_events')
        .update(updateData)
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        console.error('[CC] Security event action failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Database operation failed: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
        message: `Security event ${action} completed successfully`,
        source: 'database',
      });
    }

    // Handle security event creation
    const requiredFields = ['type', 'severity', 'description', 'ip_address'];
    const missingFields = requiredFields.filter(field => !eventData[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    const validTypes = ['login_attempt', 'api_access', 'rate_limit', 'suspicious_activity'];
    if (!validTypes.includes(eventData.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(eventData.severity)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log('[CC] POST /api/security - Creating security event:', eventData.type);

    const newEvent: Omit<SecurityEvent, 'id' | 'created_at'> = {
      type: eventData.type,
      severity: eventData.severity,
      description: eventData.description,
      ip_address: eventData.ip_address,
      user_id: eventData.user_id || undefined,
      metadata: eventData.metadata || {},
      resolved_at: undefined,
    };

    const createdEvent = await dbOperations.createSecurityEvent(newEvent);

    return NextResponse.json(
      {
        success: true,
        data: createdEvent,
        message: 'Security event created successfully',
        source: 'database',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CC] POST /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/security - Update security event
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Event ID is required' }, { status: 400 });
    }

    const body = await request.json();

    if (body.severity) {
      const validSeverities = ['low', 'medium', 'high', 'critical'];
      if (!validSeverities.includes(body.severity)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    console.log('[CC] PUT /api/security - Updating event:', eventId);

    const { data, error } = await supabase
      .from('security_events')
      .update(body)
      .eq('id', eventId)
      .select()
      .single();

    if (error) {
      console.error('[CC] Security event update failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database operation failed: ${error.message}` },
        { status: error.code === 'PGRST116' ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data,
      message: 'Security event updated successfully',
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] PUT /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/security - Delete security event
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'Event ID is required' }, { status: 400 });
    }

    console.log('[CC] DELETE /api/security - Deleting event:', eventId);

    const { error } = await supabase.from('security_events').delete().eq('id', eventId);

    if (error) {
      console.error('[CC] Security event delete failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database operation failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Security event deleted successfully',
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] DELETE /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Helper function to calculate security statistics
function calculateSecurityStats(events: SecurityEvent[]) {
  const totalEvents = events.length;
  const resolvedEvents = events.filter(e => e.resolved_at).length;
  const openEvents = totalEvents - resolvedEvents;

  const eventsBySeverity = events.reduce(
    (acc, event) => {
      acc[event.severity] = (acc[event.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const eventsByType = events.reduce(
    (acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const criticalOpen = events.filter(e => e.severity === 'critical' && !e.resolved_at).length;
  const highOpen = events.filter(e => e.severity === 'high' && !e.resolved_at).length;

  const resolvedEventsWithTime = events.filter(e => e.resolved_at);
  const avgResolutionTime =
    resolvedEventsWithTime.length > 0
      ? resolvedEventsWithTime.reduce((sum, event) => {
          const created = new Date(event.created_at).getTime();
          const resolved = new Date(event.resolved_at!).getTime();
          return sum + (resolved - created);
        }, 0) / resolvedEventsWithTime.length
      : 0;

  return {
    summary: {
      total: totalEvents,
      open: openEvents,
      resolved: resolvedEvents,
      criticalOpen,
      highOpen,
      resolutionRate: totalEvents > 0 ? Math.round((resolvedEvents / totalEvents) * 100) : 0,
    },
    distribution: {
      bySeverity: eventsBySeverity,
      byType: eventsByType,
    },
    performance: {
      avgResolutionTimeMs: Math.round(avgResolutionTime),
      avgResolutionTimeHours: Math.round((avgResolutionTime / (1000 * 60 * 60)) * 100) / 100,
    },
    lastUpdated: new Date().toISOString(),
  };
}
