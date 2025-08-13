import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSystemFlags, setSystemFlag, FlagKey } from '@/server/systemConfig';
import { requirePermission, getClientMetadata, auditApiAction, createUnauthorizedResponse } from '@/app/api/_lib/rbac';

const ToggleRequestSchema = z.object({
  key: z.enum(['SAFE_MODE', 'SYSTEM_FREEZE', 'SHADOW_MODE', 'PUBLISH_TO_DISCORD', 'PUBLISH_TO_NOTION']),
  value: z.boolean(),
});

// GET /api/ops/system-config - Get current system configuration
export async function GET(request: NextRequest) {
  try {
    // Check user permissions
    const { success, user, error } = await requirePermission(request, 'read');
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 401);
    }

    // Fetch all system flags
    const flags = await getSystemFlags();

    // Log audit event for config read
    await auditApiAction(user, 'system_config_read', 'system_configuration', {}, request);

    return NextResponse.json(flags);
  } catch (error) {
    console.error('System config GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/ops/system-config/toggle - Toggle system configuration setting
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { key, value } = ToggleRequestSchema.parse(body);

    // Check permissions based on the config key being toggled
    let requiredAction = 'toggle';
    
    // Admin-only operations
    if (['SYSTEM_FREEZE'].includes(key)) {
      requiredAction = 'rollback'; // Admin-level permission
    }

    const { success, user, error } = await requirePermission(request, requiredAction);
    
    if (!success || !user) {
      return createUnauthorizedResponse(error || 'Authentication required', 403);
    }

    // Get client metadata for audit
    const clientMeta = getClientMetadata(request);

    // Set the system flag (includes audit logging)
    const result = await setSystemFlag(key as FlagKey, value, user.email, {
      user_id: user.id,
      ...clientMeta,
    });

    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to update system flag' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      key, 
      value,
      audit_id: result.audit_id,
      message: `${key.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}`,
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