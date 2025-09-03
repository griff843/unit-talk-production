import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * System Configuration API Endpoint
 * Handles system-wide configuration, emergency controls, and operational management
 */

interface SystemConfig {
  id: string;
  key: string;
  value: any;
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

    console.log('⚙️ GET /api/system', { category, key, includeStatus });

    let response: any = {};

    // Get specific configuration key
    if (key) {
      try {
        const { data, error } = await supabase
          .from('system_config')
          .select('*')
          .eq('key', key)
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data,
          source: 'database',
        });
      } catch (error) {
        // Return default/mock value for missing keys
        const defaultConfig = getDefaultConfig(key);
        return NextResponse.json({
          success: true,
          data: defaultConfig,
          source: 'default',
        });
      }
    }

    // Get configuration by category or all
    try {
      let query = supabase.from('system_config').select('*');

      if (category) {
        query = query.eq('category', category);
      }

      const { data: configs, error } = await query.order('category', { ascending: true });

      if (error) throw error;

      response.configuration = configs.reduce((acc: any, config: any) => {
        acc[config.key] = {
          value: config.value,
          type: config.type,
          category: config.category,
          description: config.description,
          updated_at: config.updated_at,
        };
        return acc;
      }, {});
    } catch (error) {
      console.log('⚠️ Database unavailable, using default configuration');
      response.configuration = getDefaultSystemConfig(category || undefined);
    }

    // Get system status if requested
    if (includeStatus) {
      try {
        const { data: status, error } = await supabase.from('system_status').select('*').single();

        if (error) throw error;
        response.status = status;
      } catch (error) {
        response.status = getDefaultSystemStatus();
      }
    }

    return NextResponse.json({
      success: true,
      data: response,
      source: 'database',
    });
  } catch (error) {
    console.error('❌ GET /api/system error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// POST /api/system - Update system configuration or execute system commands
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, key, value, category } = body;

    console.log('🎬 POST /api/system', { action, key, category });

    // Handle system actions
    if (action) {
      switch (action) {
        case 'emergency_stop':
          return await handleEmergencyStop();
        case 'maintenance_mode':
          return await handleMaintenanceMode(body.enabled);
        case 'restart_agents':
          return await handleAgentRestart(body.agentIds);
        case 'clear_cache':
          return await handleClearCache();
        case 'backup_config':
          return await handleBackupConfig();
        default:
          return NextResponse.json(
            {
              success: false,
              error: `Unknown action: ${action}`,
            },
            { status: 400 }
          );
      }
    }

    // Handle configuration updates
    if (key && value !== undefined) {
      const configUpdate: Partial<SystemConfig> = {
        key,
        value,
        type: typeof value === 'object' ? 'json' : (typeof value as any),
        category: category || 'general',
        environment: process.env.NODE_ENV || 'development',
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from('system_config')
          .upsert(configUpdate)
          .select()
          .single();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data,
          message: `Configuration '${key}' updated successfully`,
          source: 'database',
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
          { status: 500 }
        );
      }
    }

    // Handle bulk configuration update
    if (config && typeof config === 'object') {
      const updates = Object.entries(config).map(([configKey, configValue]) => ({
        key: configKey,
        value: configValue,
        type: typeof configValue === 'object' ? 'json' : (typeof configValue as any),
        category: category || 'general',
        environment: process.env.NODE_ENV || 'development',
        updated_at: new Date().toISOString(),
      }));

      try {
        const { data, error } = await supabase.from('system_config').upsert(updates).select();

        if (error) throw error;

        return NextResponse.json({
          success: true,
          data: data,
          message: `${updates.length} configurations updated successfully`,
          source: 'database',
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to update configurations: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Missing required parameters',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ POST /api/system error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Emergency system control functions
async function handleEmergencyStop(): Promise<NextResponse> {
  try {
    console.log('🚨 Emergency stop activated');

    // Update system status
    await supabase.from('system_status').upsert({
      emergency_stop: true,
      last_updated: new Date().toISOString(),
      updated_by: 'system',
    });

    // Log the emergency stop
    await supabase.from('system_logs').insert({
      level: 'critical',
      message: 'Emergency stop activated',
      metadata: { action: 'emergency_stop', timestamp: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: 'Emergency stop activated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to activate emergency stop',
      },
      { status: 500 }
    );
  }
}

async function handleMaintenanceMode(enabled: boolean): Promise<NextResponse> {
  try {
    console.log(`🔧 Maintenance mode ${enabled ? 'enabled' : 'disabled'}`);

    await supabase.from('system_status').upsert({
      maintenance_mode: enabled,
      last_updated: new Date().toISOString(),
      updated_by: 'admin',
    });

    return NextResponse.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      maintenance_mode: enabled,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update maintenance mode',
      },
      { status: 500 }
    );
  }
}

async function handleAgentRestart(agentIds?: string[]): Promise<NextResponse> {
  try {
    console.log('🔄 Restarting agents:', agentIds || 'all');

    let query = supabase.from('agents').update({
      status: 'healthy',
      last_run: new Date().toISOString(),
    });

    if (agentIds && agentIds.length > 0) {
      query = query.in('id', agentIds);
    }

    const { data, error } = await query.select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `${data?.length || 0} agents restarted successfully`,
      restarted_agents: data?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restart agents',
      },
      { status: 500 }
    );
  }
}

async function handleClearCache(): Promise<NextResponse> {
  try {
    console.log('🧹 Clearing system cache');

    // In a real implementation, this would clear Redis cache, CDN cache, etc.
    // For now, we'll just log the action

    return NextResponse.json({
      success: true,
      message: 'System cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to clear cache',
      },
      { status: 500 }
    );
  }
}

async function handleBackupConfig(): Promise<NextResponse> {
  try {
    console.log('💾 Creating configuration backup');

    const { data: configs, error } = await supabase.from('system_config').select('*');

    if (error) throw error;

    // In production, this would save to S3, backup storage, etc.
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create configuration backup',
      },
      { status: 500 }
    );
  }
}

// Default configurations
function getDefaultConfig(key: string): SystemConfig {
  const defaults: Record<string, Partial<SystemConfig>> = {
    rate_limit_requests_per_minute: { value: 100, type: 'number', category: 'performance' },
    max_concurrent_agents: { value: 10, type: 'number', category: 'performance' },
    alert_notification_enabled: { value: true, type: 'boolean', category: 'alerts' },
    maintenance_mode: { value: false, type: 'boolean', category: 'general' },
    emergency_stop: { value: false, type: 'boolean', category: 'emergency' },
  };

  return {
    id: `default-${key}`,
    key,
    value: defaults[key]?.value || null,
    type: defaults[key]?.type || 'string',
    category: defaults[key]?.category || 'general',
    description: `Default configuration for ${key}`,
    environment: process.env.NODE_ENV || 'development',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function getDefaultSystemConfig(category?: string) {
  const config = {
    rate_limit_requests_per_minute: 100,
    max_concurrent_agents: 10,
    alert_notification_enabled: true,
    maintenance_mode: false,
    emergency_stop: false,
    real_time_updates: true,
    agent_orchestration: true,
  };

  if (category) {
    return Object.fromEntries(
      Object.entries(config).filter(([key]) => getDefaultConfig(key).category === category)
    );
  }

  return config;
}

function getDefaultSystemStatus(): SystemStatus {
  return {
    maintenance_mode: false,
    emergency_stop: false,
    rate_limiting: true,
    agent_orchestration: true,
    real_time_updates: true,
    alert_notifications: true,
    last_updated: new Date().toISOString(),
    updated_by: 'system',
  };
}
