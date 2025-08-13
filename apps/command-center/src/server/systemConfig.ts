import { createClient } from '@supabase/supabase-js';

// System flag types
export type FlagKey = 'SAFE_MODE' | 'SYSTEM_FREEZE' | 'SHADOW_MODE' | 'PUBLISH_TO_DISCORD' | 'PUBLISH_TO_NOTION';

export interface SystemFlags {
  SAFE_MODE: boolean;
  SYSTEM_FREEZE: boolean;
  SHADOW_MODE: boolean;
  PUBLISH_TO_DISCORD: boolean;
  PUBLISH_TO_NOTION: boolean;
}

// Create Supabase client for server-side operations
function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration for server operations');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Get all system flags from database
 */
export async function getSystemFlags(): Promise<SystemFlags> {
  const supabase = createServerClient();
  
  try {
    const { data, error } = await supabase
      .from('app_system_config')
      .select('key, value');

    if (error) {
      console.error('Failed to fetch system flags:', error);
      // Return safe defaults if database fetch fails
      return {
        SAFE_MODE: true, // Default to safe mode if we can't fetch
        SYSTEM_FREEZE: false,
        SHADOW_MODE: true,
        PUBLISH_TO_DISCORD: false,
        PUBLISH_TO_NOTION: false,
      };
    }

    // Convert array to object
    const flags = data?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {}) as SystemFlags;

    // Ensure all flags are present with defaults
    return {
      SAFE_MODE: flags?.SAFE_MODE ?? false,
      SYSTEM_FREEZE: flags?.SYSTEM_FREEZE ?? false,
      SHADOW_MODE: flags?.SHADOW_MODE ?? true,
      PUBLISH_TO_DISCORD: flags?.PUBLISH_TO_DISCORD ?? false,
      PUBLISH_TO_NOTION: flags?.PUBLISH_TO_NOTION ?? false,
    };
  } catch (error) {
    console.error('Error fetching system flags:', error);
    // Return safe defaults
    return {
      SAFE_MODE: true,
      SYSTEM_FREEZE: false,
      SHADOW_MODE: true,
      PUBLISH_TO_DISCORD: false,
      PUBLISH_TO_NOTION: false,
    };
  }
}

/**
 * Set a system flag and write audit log
 */
export async function setSystemFlag(
  key: FlagKey,
  value: boolean,
  actor: string,
  metadata?: {
    user_id?: string;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<{ success: boolean; audit_id?: number; error?: string }> {
  const supabase = createServerClient();
  
  try {
    // Use the database function to set flag and write audit
    const { data, error } = await supabase.rpc('set_system_flag', {
      flag_key: key,
      flag_value: value,
      p_actor: actor,
      p_user_id: metadata?.user_id || null,
      p_ip_address: metadata?.ip_address || null,
      p_user_agent: metadata?.user_agent || null,
    });

    if (error) {
      console.error('Failed to set system flag:', error);
      return { success: false, error: error.message };
    }

    return { success: true, audit_id: data };
  } catch (error) {
    console.error('Error setting system flag:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get a single system flag value
 */
export async function getSystemFlag(key: FlagKey): Promise<boolean> {
  const supabase = createServerClient();
  
  try {
    const { data, error } = await supabase.rpc('get_system_flag', {
      flag_key: key,
    });

    if (error) {
      console.error(`Failed to get system flag ${key}:`, error);
      return false; // Safe default
    }

    return data ?? false;
  } catch (error) {
    console.error(`Error getting system flag ${key}:`, error);
    return false; // Safe default
  }
}

/**
 * Check if promotions are allowed
 */
export async function isPromotionAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && !flags.SYSTEM_FREEZE;
}

/**
 * Check if ingestion is allowed
 */
export async function isIngestionAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SYSTEM_FREEZE;
}

/**
 * Check if Discord publishing is allowed
 */
export async function isDiscordPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_DISCORD && !flags.SHADOW_MODE;
}

/**
 * Check if Notion publishing is allowed
 */
export async function isNotionPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();
  return !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_NOTION && !flags.SHADOW_MODE;
}

/**
 * Check if we're in shadow mode (should not publish externally)
 */
export async function isInShadowMode(): Promise<boolean> {
  const flags = await getSystemFlags();
  return flags.SHADOW_MODE;
}

/**
 * Write audit log entry
 */
export async function writeAudit(params: {
  actor: string;
  action: string;
  target: string;
  meta?: Record<string, any>;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}): Promise<{ success: boolean; audit_id?: number; error?: string }> {
  const supabase = createServerClient();
  
  try {
    const { data, error } = await supabase.rpc('write_audit_log', {
      p_actor: params.actor,
      p_action: params.action,
      p_target: params.target,
      p_meta: params.meta ? JSON.stringify(params.meta) : '{}',
      p_user_id: params.user_id || null,
      p_ip_address: params.ip_address || null,
      p_user_agent: params.user_agent || null,
    });

    if (error) {
      console.error('Failed to write audit log:', error);
      return { success: false, error: error.message };
    }

    return { success: true, audit_id: data };
  } catch (error) {
    console.error('Error writing audit log:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Create incident and optionally activate safe mode for critical alerts
 */
export async function createIncidentAutoSafeMode(params: {
  title: string;
  description?: string;
  severity: 'warning' | 'critical';
  source: string;
  actor?: string;
  meta?: Record<string, any>;
}): Promise<{ success: boolean; incident_id?: number; safe_mode_activated?: boolean; error?: string }> {
  const supabase = createServerClient();
  
  try {
    const { data, error } = await supabase.rpc('create_incident_auto_safemode', {
      p_title: params.title,
      p_description: params.description || '',
      p_severity: params.severity,
      p_source: params.source,
      p_actor: params.actor || 'alertmanager',
      p_meta: params.meta ? JSON.stringify(params.meta) : '{}',
    });

    if (error) {
      console.error('Failed to create incident:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      incident_id: data,
      safe_mode_activated: params.severity === 'critical'
    };
  } catch (error) {
    console.error('Error creating incident:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}