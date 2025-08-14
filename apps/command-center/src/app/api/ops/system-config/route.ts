import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminClient } from '@/server/db';
import { isConfigured, createNotConfiguredResponse } from '@/server/env';

const ToggleRequestSchema = z.object({
  key: z.enum(['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION']),
  value: z.boolean(),
});

// GET /api/ops/system-config - Get current system configuration
export async function GET(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    const supabase = getAdminClient();
    
    // Fetch system configuration from database
    const { data, error } = await supabase
      .from('app_system_config')
      .select('key, value')
      .in('key', ['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION']);

    if (error) {
      console.error('Failed to fetch system config:', error);
      return NextResponse.json({ error: 'Failed to fetch system configuration' }, { status: 500 });
    }

    // Transform to object format
    const flags = (data || []).reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {
      // Default values
      SAFE_MODE: false,
      SYSTEM_FREEZE: false,
      SHADOW_MODE: false,
      PUBLISH_TO_DISCORD: true,
      PUBLISH_TO_NOTION: true,
    });

    return NextResponse.json(flags);
  } catch (error) {
    console.error('System config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ops/system-config - Toggle system configuration setting
export async function POST(request: NextRequest) {
  try {
    // Check if system is properly configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    // Parse request body
    const body = await request.json();
    const { key, value } = ToggleRequestSchema.parse(body);

    const supabase = getAdminClient();

    // Update the system configuration in database
    const { data, error } = await supabase
      .from('app_system_config')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to update system config:', error);
      return NextResponse.json({ 
        error: 'Failed to update system flag' 
      }, { status: 500 });
    }

    // Log audit event
    await supabase
      .from('app_audit_log')
      .insert({
        actor: 'system',
        action: 'system_config_toggle',
        target: key,
        meta: JSON.stringify({ 
          previous_value: !value,
          new_value: value,
          timestamp: new Date().toISOString()
        }),
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      });

    return NextResponse.json({ 
      success: true, 
      key, 
      value,
      message: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
      updated_at: data.updated_at,
    });

  } catch (error) {
    console.error('System config toggle error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Invalid request format',
        details: error.errors,
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}