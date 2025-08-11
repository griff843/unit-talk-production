import { NextRequest, NextResponse } from 'next/server';

import { mockUsers } from '@/lib/mockData';
import { dbOperations, User, supabase } from '@/lib/supabase';

/**
 * Users API Endpoint
 * Handles complete CRUD operations for user management
 * Falls back to mock data when database is unavailable
 */

// GET /api/users - Get all users or specific user by ID
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');
    const limit = searchParams.get('limit');
    const tier = searchParams.get('tier');
    const status = searchParams.get('status');

    console.log('📡 GET /api/users', { userId, limit, tier, status });

    // If specific user requested
    if (userId) {
      try {
        const user = await dbOperations.getUserById(userId);
        return NextResponse.json({
          success: true,
          data: user,
          source: 'database',
        });
      } catch (error) {
        console.log('⚠️ Database unavailable, using mock data for user:', userId);
        const mockUser = mockUsers.find(u => u.id === userId);
        if (mockUser) {
          return NextResponse.json({
            success: true,
            data: mockUser,
            source: 'mock',
          });
        } else {
          return NextResponse.json(
            {
              success: false,
              error: 'User not found',
            },
            { status: 404 }
          );
        }
      }
    }

    // Get all users with optional filtering
    try {
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
      console.log('⚠️ Database unavailable, using mock data');
      let users = [...mockUsers];

      // Apply filters to mock data
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
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ GET /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate tier
    const validTiers = ['Free', 'Premium', 'VIP'];
    if (!validTiers.includes(body.tier)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid tier. Must be one of: ${validTiers.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate status if provided
    const validStatuses = ['active', 'inactive', 'banned'];
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log('📝 POST /api/users - Creating user:', body.username);

    const newUser: Omit<User, 'id' | 'created_at' | 'updated_at'> = {
      discord_id: body.discord_id,
      username: body.username,
      tier: body.tier,
      status: body.status || 'active',
      last_active: new Date().toISOString(),
      total_picks: body.total_picks || 0,
      win_rate: body.win_rate || 0,
      revenue: body.revenue || 0,
    };

    try {
      // Try to create in database
      const { data, error } = await supabase
        .from('users')
        .insert({
          ...newUser,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

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
      console.log('⚠️ Database unavailable, simulating user creation');

      // Simulate creation with mock data
      const mockUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        ...newUser,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Add to mock data for session persistence
      mockUsers.push(mockUser);

      return NextResponse.json(
        {
          success: true,
          data: mockUser,
          message: 'User created successfully (mock)',
          source: 'mock',
        },
        { status: 201 }
      );
    }
  } catch (error) {
    console.error('❌ POST /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
        },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate tier if provided
    if (body.tier) {
      const validTiers = ['Free', 'Premium', 'VIP'];
      if (!validTiers.includes(body.tier)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid tier. Must be one of: ${validTiers.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    // Validate status if provided
    if (body.status) {
      const validStatuses = ['active', 'inactive', 'banned'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    console.log('✏️ PUT /api/users - Updating user:', userId);

    try {
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
      console.log('⚠️ Database unavailable, updating mock data');

      // Update mock data
      const userIndex = mockUsers.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'User not found',
          },
          { status: 404 }
        );
      }

      mockUsers[userIndex] = {
        ...mockUsers[userIndex],
        ...body,
        updated_at: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        data: mockUsers[userIndex],
        message: 'User updated successfully (mock)',
        source: 'mock',
      });
    }
  } catch (error) {
    console.error('❌ PUT /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
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
      return NextResponse.json(
        {
          success: false,
          error: 'User ID is required',
        },
        { status: 400 }
      );
    }

    console.log('🗑️ DELETE /api/users', { userId, permanent });

    try {
      if (permanent) {
        // Hard delete from database
        const { error } = await supabase.from('users').delete().eq('id', userId);

        if (error) throw error;

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
      console.log('⚠️ Database unavailable, updating mock data');

      const userIndex = mockUsers.findIndex(u => u.id === userId);
      if (userIndex === -1) {
        return NextResponse.json(
          {
            success: false,
            error: 'User not found',
          },
          { status: 404 }
        );
      }

      if (permanent) {
        // Remove from mock data
        const deletedUser = mockUsers.splice(userIndex, 1)[0];
        return NextResponse.json({
          success: true,
          data: deletedUser,
          message: 'User permanently deleted (mock)',
          source: 'mock',
        });
      } else {
        // Soft delete
        mockUsers[userIndex].status = 'inactive';
        mockUsers[userIndex].updated_at = new Date().toISOString();

        return NextResponse.json({
          success: true,
          data: mockUsers[userIndex],
          message: 'User deactivated successfully (mock)',
          source: 'mock',
        });
      }
    }
  } catch (error) {
    console.error('❌ DELETE /api/users error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
