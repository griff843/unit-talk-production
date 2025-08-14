import { getAdminClient } from './db';

export interface AuditParams {
  actor: string;
  action: string;
  target: string;
  meta?: Record<string, any>;
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
}

export interface AuditResult {
  success: boolean;
  audit_id?: number;
  error?: string;
}

/**
 * Write audit log entry to database
 */
export async function writeAudit(params: AuditParams): Promise<AuditResult> {
  try {
    const client = getAdminClient();
    
    const { data, error } = await client.rpc('write_audit_log', {
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

    return { success: true, audit_id: data as number };
  } catch (error) {
    console.error('Error writing audit log:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Extract IP address from request
 */
export function extractIpAddress(request: Request): string {
  // Try various headers in order of preference
  const headers = request.headers;
  
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-client-ip') ||
    'unknown'
  );
}

/**
 * Create audit context from request
 */
export function createAuditContext(
  request: Request,
  user: { id: string; email?: string }
): Pick<AuditParams, 'user_id' | 'ip_address' | 'user_agent' | 'actor'> {
  return {
    user_id: user.id,
    actor: user.email || user.id,
    ip_address: extractIpAddress(request),
    user_agent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Audit middleware wrapper for API routes
 */
export function withAudit(
  handler: (request: Request, auditContext: ReturnType<typeof createAuditContext>) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    // Extract user from headers (in production, this would come from session/JWT)
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const userEmail = request.headers.get('x-user-email');
    
    const user = { id: userId, email: userEmail || undefined };
    const auditContext = createAuditContext(request, user);
    
    try {
      return await handler(request, auditContext);
    } catch (error) {
      // Log the error to audit trail
      await writeAudit({
        ...auditContext,
        action: 'api_error',
        target: request.url,
        meta: {
          error: error instanceof Error ? error.message : 'Unknown error',
          method: request.method,
        },
      });
      
      throw error;
    }
  };
}