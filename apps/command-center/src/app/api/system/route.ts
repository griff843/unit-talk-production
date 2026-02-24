'use server';

import { NextRequest, NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase';

/**
 * System Configuration API Endpoint
 * SPRINT-DEMO-MODE-REMOVAL: All default/mock fallbacks removed.
 * Fail-closed: If database unavailable, return explicit error.
 *
 * NOTE: system_config, system_status, system_logs tables required in production.
 */

interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  type: 'string' | 'number' | 'boolean' | 'json';
  category: 'general' | 'security' | 'performance' | 'alerts' | 'emergency';
  description?: string;
  environment: string;
  created_at: string;
  updated_at: string;
}

interface SystemStatus {
  maintenance_mode: boolean;
  emergency_stop: boolean;
  rate_limiting: boolean;
  agent_orchestration: boolean;
  real_time_updates: boolean;
  alert_notifications: boolean;
  last_updated: string;
  updated_by: string;
}

// GET /api/system - Get system configuration and status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const key = searchParams.get('key');
    const includeStatus = searchParams.get('status') === 'true';

    const supabase = createClient();
    const response: {
      configuration?: Record<string, unknown>;
      status?: SystemStatus;
    } = {};

    // Get specific configuration key
    if (key) {
      const { data, error } = await supabase
        .from('system_config')
        .select('*')
        .eq('key', key)
        .single();

      if (error) {
        console.error('[CC] System config query failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Failed to get config '${key}': ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
        source: 'database',
      });
    }

    // Get configuration by category or all
    let query = supabase.from('system_config').select('*');

    if (category) {
      query = query.eq('category', category);
    }

    const { data: configs, error: configError } = await query.order('category', {
      ascending: true,
    });

    if (configError) {
      console.error('[CC] System config list query failed:', configError.message);
      return NextResponse.json(
        { success: false, error: `Failed to get system config: ${configError.message}` },
        { status: 500 }
      );
    }

    response.configuration = (configs || []).reduce(
      (acc: Record<string, unknown>, config: Record<string, unknown>) => {
        const configKey = config.key as string;
        acc[configKey] = {
          value: config.value,
          type: config.type,
          category: config.category,
          description: config.description,
          updated_at: config.updated_at,
        };
        return acc;
      },
      {}
    );

    // Get system status if requested
    if (includeStatus) {
      const { data: status, error: statusError } = await supabase
        .from('system_status')
        .select('*')
        .single();

      if (statusError) {
        console.error('[CC] System status query failed:', statusError.message);
        return NextResponse.json(
          { success: false, error: `Failed to get system status: ${statusError.message}` },
          { status: 500 }
        );
      }

      response.status = status as SystemStatus;
    }

    return NextResponse.json({
      success: true,
      data: response,
      source: 'database',
    });
  } catch (error) {
    console.error('[CC] System GET error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/system - Update system configuration or execute system commands
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, key, value, category } = body;

    const supabase = createClient();

    // Handle system actions
    if (action) {
      switch (action) {
        case 'emergency_stop':
          return await handleEmergencyStop(supabase);
        case 'maintenance_mode':
          return await handleMaintenanceMode(supabase, body.enabled);
        case 'restart_agents':
          return await handleAgentRestart(supabase, body.agentIds);
        case 'clear_cache':
          return await handleClearCache();
        case 'backup_config':
          return await handleBackupConfig(supabase);
        default:
          return NextResponse.json(
            { success: false, error: `Unknown action: ${action}` },
            { status: 400 }
          );
      }
    }

    // Handle configuration updates
    if (key && value !== undefined) {
      const configUpdate: Partial<SystemConfig> = {
        key,
        value,
        type:
          typeof value === 'object' ? 'json' : (typeof value as 'string' | 'number' | 'boolean'),
        category: category || 'general',
        environment: process.env.NODE_ENV || 'development',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('system_config')
        .upsert(configUpdate)
        .select()
        .single();

      if (error) {
        console.error('[CC] System config update failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Failed to update configuration: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
        message: `Configuration '${key}' updated successfully`,
        source: 'database',
      });
    }

    // Handle bulk configuration update
    if (config && typeof config === 'object') {
      const updates = Object.entries(config).map(([configKey, configValue]) => ({
        key: configKey,
        value: configValue,
        type:
          typeof configValue === 'object'
            ? 'json'
            : (typeof configValue as 'string' | 'number' | 'boolean'),
        category: category || 'general',
        environment: process.env.NODE_ENV || 'development',
        updated_at: new Date().toISOString(),
      }));

      const { data, error } = await supabase.from('system_config').upsert(updates).select();

      if (error) {
        console.error('[CC] System config bulk update failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Failed to update configurations: ${error.message}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: data,
        message: `${updates.length} configurations updated successfully`,
        source: 'database',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[CC] System POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Emergency system control functions
async function handleEmergencyStop(
  supabase: ReturnType<typeof createClient>
): Promise<NextResponse> {
  console.log('[CC] Emergency stop activated');

  const { error: statusError } = await supabase.from('system_status').upsert({
    emergency_stop: true,
    last_updated: new Date().toISOString(),
    updated_by: 'system',
  });

  if (statusError) {
    console.error('[CC] Failed to update system status:', statusError.message);
    return NextResponse.json(
      { success: false, error: `Failed to activate emergency stop: ${statusError.message}` },
      { status: 500 }
    );
  }

  const { error: logError } = await supabase.from('system_logs').insert({
    level: 'critical',
    message: 'Emergency stop activated',
    metadata: { action: 'emergency_stop', timestamp: new Date().toISOString() },
  });

  if (logError) {
    console.error('[CC] Failed to log emergency stop:', logError.message);
    // Continue - logging failure shouldn't block emergency stop
  }

  return NextResponse.json({
    success: true,
    message: 'Emergency stop activated successfully',
    timestamp: new Date().toISOString(),
  });
}

async function handleMaintenanceMode(
  supabase: ReturnType<typeof createClient>,
  enabled: boolean
): Promise<NextResponse> {
  console.log(`[CC] Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);

  const { error } = await supabase.from('system_status').upsert({
    maintenance_mode: enabled,
    last_updated: new Date().toISOString(),
    updated_by: 'admin',
  });

  if (error) {
    console.error('[CC] Failed to update maintenance mode:', error.message);
    return NextResponse.json(
      { success: false, error: `Failed to update maintenance mode: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
    maintenance_mode: enabled,
  });
}

async function handleAgentRestart(
  supabase: ReturnType<typeof createClient>,
  agentIds?: string[]
): Promise<NextResponse> {
  console.log('[CC] Restarting agents:', agentIds || 'all');

  let query = supabase.from('agents').update({
    status: 'healthy',
    last_run: new Date().toISOString(),
  });

  if (agentIds && agentIds.length > 0) {
    query = query.in('id', agentIds);
  }

  const { data, error } = await query.select();

  if (error) {
    console.error('[CC] Failed to restart agents:', error.message);
    return NextResponse.json(
      { success: false, error: `Failed to restart agents: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `${data?.length || 0} agents restarted successfully`,
    restarted_agents: data?.length || 0,
  });
}

async function handleClearCache(): Promise<NextResponse> {
  console.log('[CC] Clear cache requested');

  // Fail-closed: Cache clearing requires Redis/external cache integration
  return NextResponse.json(
    {
      success: false,
      error: 'Cache clearing not configured. Redis integration required.',
    },
    { status: 501 }
  );
}

async function handleBackupConfig(
  supabase: ReturnType<typeof createClient>
): Promise<NextResponse> {
  console.log('[CC] Creating configuration backup');

  const { data: configs, error } = await supabase.from('system_config').select('*');

  if (error) {
    console.error('[CC] Failed to fetch configs for backup:', error.message);
    return NextResponse.json(
      { success: false, error: `Failed to create backup: ${error.message}` },
      { status: 500 }
    );
  }

  // Note: In production, this would save to S3/backup storage
  // For now, just return the data for client-side download
  const backup = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION || '1.0.0',
    configurations: configs,
  };

  return NextResponse.json({
    success: true,
    message: 'Configuration backup created successfully',
    backup_size: configs?.length || 0,
    timestamp: backup.timestamp,
    data: backup,
  });
}
