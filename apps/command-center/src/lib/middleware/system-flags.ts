import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export interface SystemFlags {
  SAFE_MODE: boolean;
  SYSTEM_FREEZE: boolean;
  SHADOW_MODE: boolean;
  PUBLISH_TO_DISCORD: boolean;
  PUBLISH_TO_NOTION: boolean;
}

export class SystemFlagsError extends Error {
  constructor(
    message: string,
    public flag: keyof SystemFlags,
    public value: boolean
  ) {
    super(message);
    this.name = 'SystemFlagsError';
  }
}

// Cache for system flags to avoid repeated DB calls
let flagsCache: { flags: SystemFlags; timestamp: number } | null = null;
const CACHE_TTL = 10000; // 10 seconds

/**
 * Get current system flags with caching
 */
export async function getSystemFlags(): Promise<SystemFlags> {
  // Return cached flags if still valid
  if (flagsCache && Date.now() - flagsCache.timestamp < CACHE_TTL) {
    return flagsCache.flags;
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    const { data: configData, error } = await supabase
      .from('app_system_config')
      .select('key, value');

    if (error) {
      console.error('Failed to fetch system flags:', error);
      // Return safe defaults if we can't fetch flags
      return {
        SAFE_MODE: true, // Default to safe mode if we can't check
        SYSTEM_FREEZE: false,
        SHADOW_MODE: true,
        PUBLISH_TO_DISCORD: false,
        PUBLISH_TO_NOTION: false,
      };
    }

    // Convert config data to SystemFlags object
    const flags = configData?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {}) as SystemFlags;

    // Ensure all flags are present with defaults
    const systemFlags: SystemFlags = {
      SAFE_MODE: flags?.SAFE_MODE ?? false,
      SYSTEM_FREEZE: flags?.SYSTEM_FREEZE ?? false,
      SHADOW_MODE: flags?.SHADOW_MODE ?? true,
      PUBLISH_TO_DISCORD: flags?.PUBLISH_TO_DISCORD ?? false,
      PUBLISH_TO_NOTION: flags?.PUBLISH_TO_NOTATION ?? false,
    };

    // Cache the result
    flagsCache = {
      flags: systemFlags,
      timestamp: Date.now(),
    };

    return systemFlags;
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
 * Clear the system flags cache
 */
export function clearSystemFlagsCache(): void {
  flagsCache = null;
}

/**
 * Check if promotion/publishing operations are allowed
 */
export async function checkPromotionAllowed(): Promise<void> {
  const flags = await getSystemFlags();

  if (flags.SAFE_MODE) {
    throw new SystemFlagsError(
      'Promotions are blocked - Safe Mode is active',
      'SAFE_MODE',
      true
    );
  }

  if (flags.SYSTEM_FREEZE) {
    throw new SystemFlagsError(
      'All operations are blocked - System Freeze is active',
      'SYSTEM_FREEZE',
      true
    );
  }
}

/**
 * Check if ingestion operations are allowed
 */
export async function checkIngestionAllowed(): Promise<void> {
  const flags = await getSystemFlags();

  if (flags.SYSTEM_FREEZE) {
    throw new SystemFlagsError(
      'Ingestion is blocked - System Freeze is active',
      'SYSTEM_FREEZE',
      true
    );
  }
}

/**
 * Check if Discord publishing is allowed
 */
export async function checkDiscordPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();

  if (flags.SAFE_MODE || flags.SYSTEM_FREEZE) {
    return false;
  }

  return flags.PUBLISH_TO_DISCORD;
}

/**
 * Check if Notion publishing is allowed
 */
export async function checkNotionPublishingAllowed(): Promise<boolean> {
  const flags = await getSystemFlags();

  if (flags.SAFE_MODE || flags.SYSTEM_FREEZE) {
    return false;
  }

  return flags.PUBLISH_TO_NOTION;
}

/**
 * Check if we're in shadow mode
 */
export async function isInShadowMode(): Promise<boolean> {
  const flags = await getSystemFlags();
  return flags.SHADOW_MODE;
}

/**
 * Middleware to check system flags before processing requests
 */
export function withSystemFlagsCheck(operation: 'promotion' | 'ingestion' | 'publishing') {
  return async function middleware() {
    try {
      switch (operation) {
        case 'promotion':
          await checkPromotionAllowed();
          break;
        case 'ingestion':
          await checkIngestionAllowed();
          break;
        case 'publishing':
          // Publishing checks are done individually for Discord/Notion
          break;
      }
    } catch (error) {
      if (error instanceof SystemFlagsError) {
        // Log the blocked operation
        const supabase = createRouteHandlerClient({ cookies });
        await supabase
          .from('app_audit_log')
          .insert({
            actor: 'system/flags',
            action: 'operation_blocked',
            target: operation,
            meta: JSON.stringify({
              flag: error.flag,
              value: error.value,
              message: error.message,
              timestamp: new Date().toISOString(),
            }),
          });
      }
      throw error;
    }
  };
}

/**
 * Helper to wrap publishing operations with shadow mode check
 */
export async function wrapWithShadowMode<T>(
  operation: () => Promise<T>,
  shadowOperation?: () => Promise<void>
): Promise<T | null> {
  const inShadowMode = await isInShadowMode();

  if (inShadowMode) {
    // Execute shadow operation if provided
    if (shadowOperation) {
      await shadowOperation();
    }

    // Log shadow operation
    const supabase = createRouteHandlerClient({ cookies });
    await supabase
      .from('app_audit_log')
      .insert({
        actor: 'system/shadow',
        action: 'shadow_operation_executed',
        target: 'publishing',
        meta: JSON.stringify({
          timestamp: new Date().toISOString(),
          shadow_mode: true,
        }),
      });

    return null; // Don't execute real operation
  }

  // Execute real operation
  return await operation();
}

/**
 * Helper to safely publish with all checks
 */
export async function safePublish(
  destination: 'discord' | 'notion',
  operation: () => Promise<any>,
  payload?: any
): Promise<{ published: boolean; reason?: string }> {
  try {
    // Check if publishing is allowed for this destination
    const isAllowed = destination === 'discord' 
      ? await checkDiscordPublishingAllowed()
      : await checkNotionPublishingAllowed();

    if (!isAllowed) {
      const flags = await getSystemFlags();
      let reason = 'Publishing disabled';
      
      if (flags.SAFE_MODE) reason = 'Safe Mode active';
      else if (flags.SYSTEM_FREEZE) reason = 'System Freeze active';
      else if (!flags[destination === 'discord' ? 'PUBLISH_TO_DISCORD' : 'PUBLISH_TO_NOTION']) {
        reason = `${destination} publishing disabled`;
      }

      return { published: false, reason };
    }

    // Check shadow mode and wrap operation
    const result = await wrapWithShadowMode(operation);

    if (result === null) {
      return { published: false, reason: 'Shadow Mode active' };
    }

    return { published: true };

  } catch (error) {
    console.error(`Error in safePublish for ${destination}:`, error);
    
    if (error instanceof SystemFlagsError) {
      return { published: false, reason: error.message };
    }
    
    throw error;
  }
}