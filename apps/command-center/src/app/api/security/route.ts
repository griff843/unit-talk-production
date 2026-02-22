import { NextRequest, NextResponse } from 'next/server';

import { mockSecurityEvents, simulateNewSecurityEvent } from '@/lib/mockData';
import { dbOperations, SecurityEvent, supabase } from '@/lib/supabase';

/**
 * Security Events API Endpoint
 * Handles security event management, monitoring, and incident response
 * Falls back to mock data when database is unavailable
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
    const since = searchParams.get('since'); // ISO date string
    const includeStats = searchParams.get('stats') === 'true';

    console.log('📡 GET /api/security', {
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
      try {
        const { data, error } = await supabase
          .from('security_events')
          .select('*')
          .eq('id', eventId)
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data,
          source: 'database',
        });
      } catch (error) {
        console.log('⚠️ Database unavailable, using mock data for event:', eventId);
        const mockEvent = mockSecurityEvents.find(e => e.id === eventId);
        if (mockEvent) {
          return NextResponse.json({
            success: true,
            data: mockEvent,
            source: 'mock',
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'Security event not found',
            },
            { status: 404 }
          );
        }
      }
    }

    // Get all events with filtering
    try {
      let query = supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply filters - cast string params to match enum types
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

      // Apply pagination
      if (limit > 0) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data: events, error, count } = await query;

      if (error) throw error;

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
      console.log('⚠️ Database unavailable, using mock data');
      let events = [...mockSecurityEvents];

      // Apply filters to mock data
      if (severity) {
        events = events.filter(e => e.severity === severity);
      }
      if (type) {
        events = events.filter(e => e.type === type);
      }
      if (resolved === 'true') {
        events = events.filter(e => e.resolved_at !== undefined);
      } else if (resolved === 'false') {
        events = events.filter(e => e.resolved_at === undefined);
      }
      if (userId) {
        events = events.filter(e => e.user_id === userId);
      }
      if (ipAddress) {
        events = events.filter(e => e.ip_address === ipAddress);
      }
      if (since) {
        const sinceDate = new Date(since);
        events = events.filter(e => new Date(e.created_at) >= sinceDate);
      }

      // Apply pagination
      const totalEvents = events.length;
      if (limit > 0) {
        events = events.slice(offset, offset + limit);
      }

      // Occasionally add new simulated events
      if (Math.random() < 0.1) {
        // 10% chance
        const newEvent = simulateNewSecurityEvent();
        mockSecurityEvents.unshift(newEvent);
      }

      const responseData: any = {
        events,
        pagination: {
          offset,
          limit,
          total: totalEvents,
        },
      };

      if (includeStats) {
        responseData.stats = calculateSecurityStats(events);
      }

      return NextResponse.json({
        success: true,
        data: responseData,
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ GET /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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
      console.log('🚨 POST /api/security - Action:', action, { eventId });

      if (!eventId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Event ID is required for actions',
          },
          { status: 400 }
        );
      }

      const validActions = ['resolve', 'escalate', 'acknowledge', 'investigate'];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
          },
          { status: 400 }
        );
      }

      try {
        // Try to perform action on database
        const updateData: any = {};

        switch (action) {
          case 'resolve':
            updateData.resolved_at = new Date().toISOString();
            break;
          case 'escalate':
            // Escalate severity if not already critical
            const { data: eventData } = await supabase
              .from('security_events')
              .select('severity')
              .eq('id', eventId)
              .single();

            if (eventData?.severity !== 'critical') {
              const severities = ['low', 'medium', 'high', 'critical'];
              const currentIndex = severities.indexOf((eventData?.severity as string) || 'low');
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

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data,
          message: `Security event ${action} completed successfully`,
          source: 'database',
        });
      } catch (error) {
        console.log('⚠️ Database unavailable, simulating security action');

        // Simulate action on mock data
        const eventIndex = mockSecurityEvents.findIndex(e => e.id === eventId);
        if (eventIndex === -1) {
          return NextResponse.json(
            {
              success: false,
              error: 'Security event not found',
            },
            { status: 404 }
          );
        }

        const event = mockSecurityEvents[eventIndex];

        switch (action) {
          case 'resolve':
            event.resolved_at = new Date().toISOString();
            break;
          case 'escalate':
            if (event.severity !== 'critical') {
              const severities = ['low', 'medium', 'high', 'critical'];
              const currentIndex = severities.indexOf(event.severity);
              event.severity = severities[
                Math.min(currentIndex + 1, severities.length - 1)
              ] as SecurityEvent['severity'];
            }
            break;
          case 'acknowledge':
            event.metadata = {
              ...event.metadata,
              acknowledged: true,
              acknowledged_at: new Date().toISOString(),
            };
            break;
          case 'investigate':
            event.metadata = {
              ...event.metadata,
              under_investigation: true,
              investigation_started: new Date().toISOString(),
            };
            break;
        }

        return NextResponse.json({
          success: true,
          data: event,
          message: `Security event ${action} completed successfully (mock)`,
          source: 'mock',
        });
      }
    }

    // Handle security event creation
    const requiredFields = ['type', 'severity', 'description', 'ip_address'];
    const missingFields = requiredFields.filter(field => !eventData[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes = ['login_attempt', 'api_access', 'rate_limit', 'suspicious_activity'];
    if (!validTypes.includes(eventData.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate severity
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

    console.log('📝 POST /api/security - Creating security event:', eventData.type);

    const newEvent: Omit<SecurityEvent, 'id' | 'created_at'> = {
      type: eventData.type,
      severity: eventData.severity,
      description: eventData.description,
      ip_address: eventData.ip_address,
      user_id: eventData.user_id || undefined,
      metadata: eventData.metadata || {},
      resolved_at: undefined,
    };

    try {
      // Try to create in database
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
      console.log('⚠️ Database unavailable, simulating security event creation');

      // Simulate creation with mock data
      const mockEvent: SecurityEvent = {
        id: Math.random().toString(36).substr(2, 9),
        ...newEvent,
        created_at: new Date().toISOString(),
      };

      // Add to mock data for session persistence
      mockSecurityEvents.unshift(mockEvent);

      return NextResponse.json(
        {
          success: true,
          data: mockEvent,
          message: 'Security event created successfully (mock)',
          source: 'mock',
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('❌ POST /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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
      return NextResponse.json(
        {
          success: false,
          error: 'Event ID is required',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate severity if provided
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

    console.log('✏️ PUT /api/security - Updating event:', eventId);

    try {
      const { data, error } = await supabase
        .from('security_events')
        .update(body)
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({
        success: true,
        data: data,
        message: 'Security event updated successfully',
        source: 'database',
      });
    } catch (error) {
      console.log('⚠️ Database unavailable, updating mock data');

      // Update mock data
      const eventIndex = mockSecurityEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Security event not found',
          },
          { status: 404 }
        );
      }

      mockSecurityEvents[eventIndex] = {
        ...mockSecurityEvents[eventIndex],
        ...body,
      };

      return NextResponse.json({
        success: true,
        data: mockSecurityEvents[eventIndex],
        message: 'Security event updated successfully (mock)',
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ PUT /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/security - Delete security event (admin only)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('id');

    if (!eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Event ID is required',
        },
        { status: 400 }
      );
    }

    console.log('🗑️ DELETE /api/security - Deleting event:', eventId);

    try {
      const { error } = await supabase.from('security_events').delete().eq('id', eventId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        message: 'Security event deleted successfully',
        source: 'database',
      });
    } catch (error) {
      console.log('⚠️ Database unavailable, updating mock data');

      const eventIndex = mockSecurityEvents.findIndex(e => e.id === eventId);
      if (eventIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Security event not found',
          },
          { status: 404 }
        );
      }

      const deletedEvent = mockSecurityEvents.splice(eventIndex, 1)[0];

      return NextResponse.json({
        success: true,
        data: deletedEvent,
        message: 'Security event deleted successfully (mock)',
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ DELETE /api/security error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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

  // Calculate average resolution time for resolved events
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
