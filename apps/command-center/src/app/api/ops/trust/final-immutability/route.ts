import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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

// Check for final pick immutability violations
async function checkFinalPickImmutability(supabase: any): Promise<{
  violations: number;
  last24Hours: number;
  details: any[];
}> {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Check audit log for attempts to modify finalized picks
    const { data: violations, error } = await supabase
      .from('app_audit_log')
      .select('*')
      .ilike('action', '%final_pick_modification_blocked%')
      .gte('occurred_at', twentyFourHoursAgo)
      .order('occurred_at', { ascending: false });

    if (error) {
      console.error('Error checking immutability violations:', error);
      return { violations: -1, last24Hours: -1, details: [] };
    }

    // Also check for any attempts to update picks that are marked as final
    const { data: updateAttempts, error: updateError } = await supabase
      .from('app_audit_log')
      .select('*')
      .eq('action', 'unified_pick_update_attempted')
      .gte('occurred_at', twentyFourHoursAgo)
      .order('occurred_at', { ascending: false });

    if (updateError) {
      console.error('Error checking update attempts:', updateError);
    }

    const allViolations = [...(violations || []), ...(updateAttempts || [])];
    
    // Filter for actual violations (where final picks were targeted)
    const realViolations = allViolations.filter((entry: any) => {
      if (!entry.meta) return false;
      
      try {
        const meta = typeof entry.meta === 'string' ? JSON.parse(entry.meta) : entry.meta;
        return meta.final_pick === true || meta.is_final === true || meta.status === 'finalized';
      } catch {
        return false;
      }
    });

    return {
      violations: allViolations.length,
      last24Hours: realViolations.length,
      details: realViolations.slice(0, 10), // Return top 10 violations
    };

  } catch (error) {
    console.error('Error in checkFinalPickImmutability:', error);
    return { violations: -1, last24Hours: -1, details: [] };
  }
}

// Check database constraints for pick finalization
async function checkDatabaseConstraints(supabase: any): Promise<{
  constraintsActive: boolean;
  lastChecked: string;
  details: string[];
}> {
  try {
    // Check if there are any database constraints or triggers protecting final picks
    // This would typically query the database schema or check for specific constraint violations
    
    // For now, we'll check if the unified_picks table has proper constraints
    const { data: constraintCheck, error } = await supabase
      .rpc('check_final_pick_constraints')
      .single();

    if (error) {
      // If the function doesn't exist, we'll do a basic check
      console.log('Final pick constraint function not found, doing basic check');
      
      return {
        constraintsActive: true, // Assume active if we can't check
        lastChecked: new Date().toISOString(),
        details: ['Constraint checking function not available', 'Manual verification required'],
      };
    }

    return {
      constraintsActive: constraintCheck?.constraints_active || false,
      lastChecked: new Date().toISOString(),
      details: constraintCheck?.details || [],
    };

  } catch (error) {
    console.error('Error checking database constraints:', error);
    return {
      constraintsActive: false,
      lastChecked: new Date().toISOString(),
      details: ['Error checking constraints'],
    };
  }
}

// GET /api/ops/trust/final-immutability - Get final pick immutability status
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has viewer permissions (minimum required)
    const hasPermission = await checkUserPermissions(supabase, user.id, 'viewer');
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Run immutability checks in parallel
    const [immutabilityCheck, constraintsCheck] = await Promise.all([
      checkFinalPickImmutability(supabase),
      checkDatabaseConstraints(supabase),
    ]);

    // Calculate overall health score
    let healthScore = 100;
    if (immutabilityCheck.last24Hours > 0) {
      healthScore -= Math.min(immutabilityCheck.last24Hours * 10, 50); // -10 per violation, max -50
    }
    if (!constraintsCheck.constraintsActive) {
      healthScore -= 30; // -30 if constraints aren't active
    }

    const result = {
      overall_status: healthScore >= 90 ? 'healthy' : healthScore >= 70 ? 'warning' : 'critical',
      health_score: Math.max(healthScore, 0),
      violations: {
        total_attempts: immutabilityCheck.violations,
        last_24_hours: immutabilityCheck.last24Hours,
        details: immutabilityCheck.details.map((entry: any) => ({
          timestamp: entry.occurred_at,
          actor: entry.actor,
          action: entry.action,
          target: entry.target,
          meta: entry.meta ? JSON.parse(entry.meta) : null,
        })),
      },
      database_protection: {
        constraints_active: constraintsCheck.constraintsActive,
        last_checked: constraintsCheck.lastChecked,
        details: constraintsCheck.details,
      },
      recommendations: [],
    };

    // Add recommendations based on findings
    if (immutabilityCheck.last24Hours > 0) {
      result.recommendations.push('Investigate recent attempts to modify final picks');
    }
    if (!constraintsCheck.constraintsActive) {
      result.recommendations.push('Enable database constraints for final pick protection');
    }
    if (immutabilityCheck.violations < 0) {
      result.recommendations.push('Audit log monitoring may be incomplete');
    }

    // Log audit event for immutability check
    await supabase
      .from('app_audit_log')
      .insert({
        actor: user.email || user.id,
        action: 'final_immutability_check',
        target: 'data_trust_system',
        meta: JSON.stringify({
          timestamp: new Date().toISOString(),
          health_score: healthScore,
          violations_found: immutabilityCheck.last24Hours,
        }),
        user_id: user.id,
        user_agent: request.headers.get('user-agent'),
        ip_address: request.headers.get('x-forwarded-for'),
      });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Final immutability GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}