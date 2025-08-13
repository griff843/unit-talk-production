import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { 
  getSystemFlags, 
  checkPromotionAllowed, 
  checkIngestionAllowed,
  safePublish,
  SystemFlagsError,
  wrapWithShadowMode
} from '@/lib/middleware/system-flags';

// Example: Protected promotion endpoint
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    const { action, payload } = body;

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    switch (action) {
      case 'promote_pick':
        return await handlePromotePick(supabase, user, payload);
      
      case 'start_ingestion':
        return await handleStartIngestion(supabase, user, payload);
      
      case 'publish_to_discord':
        return await handlePublishToDiscord(supabase, user, payload);
      
      case 'publish_to_notion':
        return await handlePublishToNotion(supabase, user, payload);
      
      case 'system_status':
        return await handleSystemStatus(supabase, user);
      
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Enforcement example error:', error);
    
    if (error instanceof SystemFlagsError) {
      return NextResponse.json({
        error: 'Operation blocked by system flags',
        flag: error.flag,
        value: error.value,
        message: error.message,
      }, { status: 423 }); // 423 Locked
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePromotePick(supabase: any, user: any, payload: any) {
  try {
    // Check if promotions are allowed
    await checkPromotionAllowed();

    // Simulate pick promotion logic
    const pickId = payload.pickId;
    
    // In real implementation, this would:
    // 1. Validate the pick
    // 2. Update pick status to promoted
    // 3. Queue for publishing

    console.log(`Promoting pick ${pickId} by ${user.email}`);

    // Log audit event
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'pick_promoted',
        target: `pick_${pickId}`,
        meta: JSON.stringify({
          pick_id: pickId,
          timestamp: new Date().toISOString(),
        }),
        user_id: user.id,
      });

    return NextResponse.json({
      success: true,
      message: 'Pick promoted successfully',
      pick_id: pickId,
    });

  } catch (error) {
    if (error instanceof SystemFlagsError) {
      // Log blocked promotion
      await supabase
        .from('app_audit_log')
        .insert({
          actor: user.email || user.id,
          action: 'pick_promotion_blocked',
          target: `pick_${payload.pickId}`,
          meta: JSON.stringify({
            pick_id: payload.pickId,
            blocked_by: error.flag,
            reason: error.message,
            timestamp: new Date().toISOString(),
          }),
          user_id: user.id,
        });
    }
    throw error;
  }
}

async function handleStartIngestion(supabase: any, user: any, payload: any) {
  try {
    // Check if ingestion is allowed
    await checkIngestionAllowed();

    // Simulate ingestion start logic
    const source = payload.source || 'default';
    
    console.log(`Starting ingestion from ${source} by ${user.email}`);

    // Log audit event
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'ingestion_started',
        target: `ingestion_${source}`,
        meta: JSON.stringify({
          source,
          timestamp: new Date().toISOString(),
        }),
        user_id: user.id,
      });

    return NextResponse.json({
      success: true,
      message: `Ingestion started for ${source}`,
      source,
    });

  } catch (error) {
    if (error instanceof SystemFlagsError) {
      // Log blocked ingestion
      await supabase
        .from('app_audit_log')
        .insert({
          actor: user.email || user.id,
          action: 'ingestion_blocked',
          target: `ingestion_${payload.source}`,
          meta: JSON.stringify({
            source: payload.source,
            blocked_by: error.flag,
            reason: error.message,
            timestamp: new Date().toISOString(),
          }),
          user_id: user.id,
        });
    }
    throw error;
  }
}

async function handlePublishToDiscord(supabase: any, user: any, payload: any) {
  const publishOperation = async () => {
    // Simulate Discord publishing
    console.log(`Publishing to Discord: ${JSON.stringify(payload)}`);
    
    // In real implementation, this would:
    // 1. Format the message
    // 2. Send to Discord API
    // 3. Update pick status
    
    return { messageId: 'discord_123', channel: payload.channel };
  };

  const shadowOperation = async () => {
    // Add to outbox with shadow flag
    await supabase
      .from('notifications_outbox')
      .insert({
        sink: 'discord',
        payload: JSON.stringify(payload),
        shadow_only: true,
        status: 'pending',
      });
  };

  const result = await safePublish('discord', publishOperation, payload);

  // Log audit event
  await supabase
    .from('app_audit_log')
    .insert({
      actor: user.email || user.id,
      action: result.published ? 'discord_published' : 'discord_publish_blocked',
      target: 'discord_channel',
      meta: JSON.stringify({
        payload,
        published: result.published,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      }),
      user_id: user.id,
    });

  return NextResponse.json({
    success: true,
    published: result.published,
    reason: result.reason,
    message: result.published 
      ? 'Published to Discord successfully'
      : `Discord publishing blocked: ${result.reason}`,
  });
}

async function handlePublishToNotion(supabase: any, user: any, payload: any) {
  const publishOperation = async () => {
    // Simulate Notion publishing
    console.log(`Publishing to Notion: ${JSON.stringify(payload)}`);
    
    // In real implementation, this would:
    // 1. Format the content
    // 2. Send to Notion API
    // 3. Update pick status
    
    return { pageId: 'notion_456', database: payload.database };
  };

  const shadowOperation = async () => {
    // Add to outbox with shadow flag
    await supabase
      .from('notifications_outbox')
      .insert({
        sink: 'notion',
        payload: JSON.stringify(payload),
        shadow_only: true,
        status: 'pending',
      });
  };

  const result = await safePublish('notion', publishOperation, payload);

  // Log audit event
  await supabase
    .from('app_audit_log')
    .insert({
      actor: user.email || user.id,
      action: result.published ? 'notion_published' : 'notion_publish_blocked',
      target: 'notion_database',
      meta: JSON.stringify({
        payload,
        published: result.published,
        reason: result.reason,
        timestamp: new Date().toISOString(),
      }),
      user_id: user.id,
    });

  return NextResponse.json({
    success: true,
    published: result.published,
    reason: result.reason,
    message: result.published 
      ? 'Published to Notion successfully'
      : `Notion publishing blocked: ${result.reason}`,
  });
}

async function handleSystemStatus(supabase: any, user: any) {
  const flags = await getSystemFlags();

  // Log audit event for status check
  await supabase
    .from('app_audit_log')
    .insert({
      actor: user.email || user.id,
      action: 'system_status_checked',
      target: 'system_flags',
      meta: JSON.stringify({
        flags,
        timestamp: new Date().toISOString(),
      }),
      user_id: user.id,
    });

  return NextResponse.json({
    success: true,
    system_flags: flags,
    operational_status: {
      promotions_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE,
      ingestion_allowed: !flags.SYSTEM_FREEZE,
      discord_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_DISCORD,
      notion_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_NOTION,
      shadow_mode_active: flags.SHADOW_MODE,
    },
  });
}

// GET endpoint to check system status
export async function GET(request: NextRequest) {
  try {
    const flags = await getSystemFlags();

    return NextResponse.json({
      system_flags: flags,
      operational_status: {
        promotions_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE,
        ingestion_allowed: !flags.SYSTEM_FREEZE,
        discord_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_DISCORD,
        notion_publishing_allowed: !flags.SAFE_MODE && !flags.SYSTEM_FREEZE && flags.PUBLISH_TO_NOTION,
        shadow_mode_active: flags.SHADOW_MODE,
      },
      cache_info: {
        last_updated: new Date().toISOString(),
        ttl_seconds: 10,
      },
    });

  } catch (error) {
    console.error('System status error:', error);
    return NextResponse.json({ error: 'Failed to get system status' }, { status: 500 });
  }
}