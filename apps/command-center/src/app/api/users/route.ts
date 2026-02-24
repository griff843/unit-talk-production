import { NextRequest, NextResponse } from 'next/server';

import type { Json } from '@/types/database';

import { dbOperations, User, supabase } from '@/lib/supabase';

/**
 * Users API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 */

// GET /api/users - Get all users or specific user by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const limit = searchParams.get('limit');
    const tier = searchParams.get('tier');
    const status = searchParams.get('status');

    console.log('[CC] GET /api/users', { userId, limit, tier, status });

    // If specific user requested
    if (userId) {
      const user = await dbOperations.getUserById(userId);
      return NextResponse.json({
        success: true,
        data: user,
        source: 'database',
      });
    }

    // Get all users with optional filtering
    let users = await dbOperations.getUsers();

    // Apply filters
    if (tier) {
      users = users.filter(u => u.tier === tier);
    }
    if (status) {
      users = users.filter(u => u.status === status);
    }
    if (limit) {
      users = users.slice(0, parseInt(limit));
    }

    return NextResponse.json({
      success: true,
      data: users,
      count: users.length,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] GET /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['discord_id', 'username', 'tier'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ['Free', 'Premium', 'VIP'];
    if (!validTiers.includes(body.tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['active', 'inactive', 'banned'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    console.log('[CC] POST /api/users - Creating user:', body.username);

    // Production schema fields
    const isActive = body.status !== 'banned' && body.status !== 'inactive';
    const dbUser = {
      discord_id: body.discord_id,
      username: body.username,
      tier: body.tier || null,
      active: isActive,
      is_active: isActive,
      tenant_id: body.tenant_id || 'default',
      meta: {
        status: body.status || 'active',
        last_active: new Date().toISOString(),
        total_picks: body.total_picks || 0,
        win_rate: body.win_rate || 0,
        revenue: body.revenue || 0,
      } as Json,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('users').insert(dbUser).select().single();

    if (error) {
      console.error('[CC] User creation failed:', error.message);
      return NextResponse.json(
        { success: false, error: `Database operation failed: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: data,
        message: 'User created successfully',
        source: 'database',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CC] POST /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// PUT /api/users - Update existing user
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    const body = await request.json();

    // Validate tier if provided
    if (body.tier) {
      const validTiers = ['Free', 'Premium', 'VIP'];
      if (!validTiers.includes(body.tier)) {
        return NextResponse.json(
          { success: false, error: `Invalid tier. Must be one of: ${validTiers.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['active', 'inactive', 'banned'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
    }

    console.log('[CC] PUT /api/users - Updating user:', userId);

    const updatedUser = await dbOperations.updateUser(userId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] PUT /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// DELETE /api/users - Delete user (soft delete by setting status to inactive)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
    }

    console.log('[CC] DELETE /api/users', { userId, permanent });

    if (permanent) {
      // Hard delete from database
      const { error } = await supabase.from('users').delete().eq('id', userId);

      if (error) {
        console.error('[CC] User deletion failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Database operation failed: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'User permanently deleted',
        source: 'database',
      });
    } else {
      // Soft delete - set status to inactive
      const updatedUser = await dbOperations.updateUser(userId, {
        status: 'inactive',
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        data: updatedUser,
        message: 'User deactivated successfully',
        source: 'database',
      });
    }
  } catch (error) {
    console.error('[CC] DELETE /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
