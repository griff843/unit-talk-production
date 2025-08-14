import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/server/db';
import { isConfigured, createNotConfiguredResponse } from '@/server/env';

// Utility function to check user permissions
async function checkUserPermissions(supabase: any, userId: string, requiredRole: string) {
  const { data, error } = await supabase
    .rpc('user_has_permission', {
      user_uuid: userId,
      required_role: requiredRole
    });

  if (error) {
    console.error('Failed to check user permissions:', error);
    return false;
  }

  return data === true;
}

// Get picks that would have been published if not in shadow mode
async function getShadowModePicksPreview(supabase: any): Promise<{
  totalPicks: number;
  discordPicks: number;
  notionPicks: number;
  details: any[];
}> {
  try {
    // Check current system configuration
    const { data: config, error: configError } = await supabase
      .from('app_system_config')
      .select('key, value')
      .in('key', ['SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION']);

    if (configError) {
      console.error('Error fetching system config:', configError);
      return { totalPicks: 0, discordPicks: 0, notionPicks: 0, details: [] };
    }

    const systemConfig = config?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    // If not in shadow mode, return empty diff
    if (!systemConfig?.SHADOW_MODE) {
      return { totalPicks: 0, discordPicks: 0, notionPicks: 0, details: [] };
    }

    // Get picks that meet promotion criteria but haven't been published
    // This simulates what would be published if shadow mode was disabled
    const { data: promotablePicksQuery, error: picksError } = await supabase
      .from('unified_picks')
      .select(`
        id,
        user_id,
        sport,
        prop_type,
        player_name,
        pick,
        confidence,
        created_at,
        graded_at,
        outcome,
        users!unified_picks_user_id_fkey (username, tier)
      `)
      .not('graded_at', 'is', null)
      .eq('outcome', 'win')
      .gte('confidence', 70) // Assuming 70% confidence threshold for promotion
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('created_at', { ascending: false })
      .limit(100);

    if (picksError) {
      console.error('Error fetching promotable picks:', picksError);
      return { totalPicks: 0, discordPicks: 0, notionPicks: 0, details: [] };
    }

    const promotablePicks = promotablePicksQuery || [];

    // Check which picks are already in the outbox as shadow_only
    const { data: shadowOutbox, error: outboxError } = await supabase
      .from('notifications_outbox')
      .select('payload')
      .eq('shadow_only', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (outboxError) {
      console.error('Error fetching shadow outbox:', outboxError);
    }

    // Filter picks that would be published
    const wouldPublishPicks = promotablePicks.filter((pick: any) => {
      // Apply business logic for what gets published
      // This is a simplified version - you would use your actual promotion criteria
      
      const user = pick.users;
      if (!user) return false;

      // High-tier users or high-confidence picks get published
      return (
        user.tier === 'elite' || 
        user.tier === 'professional' ||
        pick.confidence >= 85
      );
    });

    // Categorize by destination
    const discordPicks = wouldPublishPicks.filter((pick: any) => {
      // Discord gets most picks
      return systemConfig?.PUBLISH_TO_DISCORD !== false;
    });

    const notionPicks = wouldPublishPicks.filter((pick: any) => {
      // Notion gets only high-tier picks
      const user = pick.users;
      return (
        systemConfig?.PUBLISH_TO_NOTION !== false &&
        (user?.tier === 'elite' || pick.confidence >= 90)
      );
    });

    return {
      totalPicks: wouldPublishPicks.length,
      discordPicks: discordPicks.length,
      notionPicks: notionPicks.length,
      details: wouldPublishPicks.slice(0, 20).map((pick: any) => ({
        id: pick.id,
        user: pick.users?.username || 'Unknown',
        tier: pick.users?.tier || 'standard',
        sport: pick.sport,
        player: pick.player_name,
        pick: pick.pick,
        confidence: pick.confidence,
        outcome: pick.outcome,
        created_at: pick.created_at,
        destinations: {
          discord: systemConfig?.PUBLISH_TO_DISCORD !== false,
          notion: (
            systemConfig?.PUBLISH_TO_NOTION !== false &&
            (pick.users?.tier === 'elite' || pick.confidence >= 90)
          ),
        },
      })),
    };

  } catch (error) {
    console.error('Error in getShadowModePicksPreview:', error);
    return { totalPicks: 0, discordPicks: 0, notionPicks: 0, details: [] };
  }
}

// Get summary of shadow mode activity
async function getShadowModeStats(supabase: any): Promise<{
  shadowModeActiveSince: string | null;
  totalShadowEvents: number;
  lastShadowActivity: string | null;
}> {
  try {
    // Find when shadow mode was last enabled
    const { data: shadowModeEvent, error: eventError } = await supabase
      .from('app_audit_log')
      .select('occurred_at')
      .eq('action', 'system_config_toggle')
      .eq('target', 'SHADOW_MODE')
      .order('occurred_at', { ascending: false })
      .limit(1);

    const shadowModeActiveSince = shadowModeEvent?.[0]?.occurred_at || null;

    // Count total shadow events
    const { data: shadowEvents, error: countError } = await supabase
      .from('notifications_outbox')
      .select('id', { count: 'exact' })
      .eq('shadow_only', true);

    const totalShadowEvents = shadowEvents?.length || 0;

    // Get last shadow activity
    const { data: lastActivity, error: lastError } = await supabase
      .from('notifications_outbox')
      .select('created_at')
      .eq('shadow_only', true)
      .order('created_at', { ascending: false })
      .limit(1);

    const lastShadowActivity = lastActivity?.[0]?.created_at || null;

    return {
      shadowModeActiveSince,
      totalShadowEvents,
      lastShadowActivity,
    };

  } catch (error) {
    console.error('Error getting shadow mode stats:', error);
    return {
      shadowModeActiveSince: null,
      totalShadowEvents: 0,
      lastShadowActivity: null,
    };
  }
}

// GET /api/ops/trust/shadow-diff - Get shadow vs live diff
export async function GET(request: NextRequest) {
  try {
    // Check if system is configured
    if (!isConfigured) {
      return createNotConfiguredResponse();
    }

    const supabase = getAdminClient();

    // Get current system status
    const { data: systemConfig, error: configError } = await supabase
      .from('app_system_config')
      .select('key, value')
      .in('key', ['SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION', 'SAFE_MODE']);

    if (configError) {
      console.error('Failed to fetch system config:', configError);
      return NextResponse.json({ error: 'Failed to fetch system configuration' }, { status: 500 });
    }

    const config = systemConfig?.reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    // Run analysis in parallel
    const [shadowPicksPreview, shadowStats] = await Promise.all([
      getShadowModePicksPreview(supabase),
      getShadowModeStats(supabase),
    ]);

    const result = {
      shadow_mode_active: config?.SHADOW_MODE || false,
      safe_mode_active: config?.SAFE_MODE || false,
      publishing_enabled: {
        discord: config?.PUBLISH_TO_DISCORD !== false,
        notion: config?.PUBLISH_TO_NOTION !== false,
      },
      would_publish: {
        total_picks: shadowPicksPreview.totalPicks,
        discord_picks: shadowPicksPreview.discordPicks,
        notion_picks: shadowPicksPreview.notionPicks,
        details: shadowPicksPreview.details,
      },
      shadow_stats: {
        active_since: shadowStats.shadowModeActiveSince,
        total_shadow_events: shadowStats.totalShadowEvents,
        last_shadow_activity: shadowStats.lastShadowActivity,
      },
      impact_assessment: {
        potential_discord_messages: shadowPicksPreview.discordPicks,
        potential_notion_updates: shadowPicksPreview.notionPicks,
        estimated_daily_volume: shadowPicksPreview.totalPicks * 2, // Rough estimate
      },
      recommendations: [],
    };

    // Add recommendations based on analysis
    if (config?.SHADOW_MODE && shadowPicksPreview.totalPicks > 0) {
      result.recommendations.push(
        `${shadowPicksPreview.totalPicks} picks ready for publishing when shadow mode is disabled`
      );
    }

    if (config?.SHADOW_MODE && shadowPicksPreview.totalPicks === 0) {
      result.recommendations.push('No picks would be published - may indicate system issues');
    }

    if (!config?.SHADOW_MODE) {
      result.recommendations.push('Shadow mode is disabled - picks are being published live');
    }

    if (config?.SAFE_MODE) {
      result.recommendations.push('Safe mode is active - publishing may be restricted');
    }

    // Skip audit logging for now to avoid auth dependencies

    return NextResponse.json(result);

  } catch (error) {
    console.error('Shadow diff GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}