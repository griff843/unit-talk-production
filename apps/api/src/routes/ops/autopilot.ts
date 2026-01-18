/**
 * Phase 6: /ops/autopilot endpoints
 * Autopilot mode control and monitoring
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AutopilotController, AutopilotMode } from '../../lib/AutopilotController';
import { createSupabaseClient } from '../../utils/supabase';

const supabase = createSupabaseClient();

// Singleton autopilot controller instance
let autopilotController: AutopilotController | null = null;

function getAutopilotController(): AutopilotController {
  if (!autopilotController) {
    // Initialize with mode from environment or default to 'off'
    const initialMode = (process.env.AUTOPILOT_MODE as AutopilotMode) || 'off';
    autopilotController = new AutopilotController(supabase, initialMode);
  }
  return autopilotController;
}

interface SetModeBody {
  mode: AutopilotMode;
  operator: string;
  reason: string;
}

interface EvaluateBody {
  pick_id?: string;
  pick_data: Record<string, any>;
  slo_snapshot?: Record<string, any>;
}

interface PromotionCheckParams {
  from_mode: AutopilotMode;
  to_mode: AutopilotMode;
}

/**
 * Register autopilot ops routes
 */
export async function registerAutopilotOpsRoutes(fastify: FastifyInstance) {
  /**
   * GET /ops/autopilot
   * Get current autopilot mode and summary
   */
  fastify.get('/ops/autopilot', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const controller = getAutopilotController();
      const currentMode = controller.getMode();

      // Get recent decisions summary
      const { data: recentDecisions } = await supabase
        .from('autopilot_decisions')
        .select('*')
        .gte('evaluated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('evaluated_at', { ascending: false })
        .limit(100);

      const total = recentDecisions?.length || 0;
      const approved = recentDecisions?.filter((d) => d.decision === 'approved').length || 0;
      const rejected = recentDecisions?.filter((d) => d.decision === 'rejected').length || 0;
      const would_publish = recentDecisions?.filter((d) => d.would_publish).length || 0;

      return reply.code(200).send({
        success: true,
        data: {
          mode: currentMode,
          summary_24h: {
            total_evaluated: total,
            approved_count: approved,
            rejected_count: rejected,
            would_publish_count: would_publish,
            approval_rate: total > 0 ? Math.round((approved / total) * 100) : 0,
          },
        },
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Failed to get autopilot status');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get autopilot status',
        message: error.message,
      });
    }
  });

  /**
   * POST /ops/autopilot/mode
   * Set autopilot mode (requires admin authorization)
   */
  fastify.post<{ Body: SetModeBody }>(
    '/ops/autopilot/mode',
    async (request: FastifyRequest<{ Body: SetModeBody }>, reply: FastifyReply) => {
      try {
        const { mode, operator, reason } = request.body;

        // Validate mode
        const validModes: AutopilotMode[] = ['off', 'log_only', 'canary', 'prod'];
        if (!validModes.includes(mode)) {
          return reply.code(400).send({
            success: false,
            error: 'Invalid mode',
            message: `Mode must be one of: ${validModes.join(', ')}`,
          });
        }

        // Require operator and reason
        if (!operator || !reason) {
          return reply.code(400).send({
            success: false,
            error: 'Missing required fields',
            message: 'operator and reason are required',
          });
        }

        // TODO: Add RBAC check here
        // For now, require service role key in Authorization header
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '')) {
          return reply.code(403).send({
            success: false,
            error: 'Unauthorized',
            message: 'Service role key required for mode changes',
          });
        }

        const controller = getAutopilotController();
        await controller.setMode(mode, operator, reason);

        return reply.code(200).send({
          success: true,
          data: {
            mode,
            operator,
            reason,
            changed_at: new Date().toISOString(),
          },
          message: `Autopilot mode changed to ${mode}`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to set autopilot mode');
        return reply.code(500).send({
          success: false,
          error: 'Failed to set autopilot mode',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/autopilot/evaluate
   * Evaluate a pick through autopilot (for testing)
   */
  fastify.post<{ Body: EvaluateBody }>(
    '/ops/autopilot/evaluate',
    async (request: FastifyRequest<{ Body: EvaluateBody }>, reply: FastifyReply) => {
      try {
        const { pick_id, pick_data, slo_snapshot } = request.body;

        if (!pick_data) {
          return reply.code(400).send({
            success: false,
            error: 'Missing pick_data',
          });
        }

        const controller = getAutopilotController();
        const decision = await controller.evaluate({
          pick_id,
          pick_data,
          mode: controller.getMode(),
          slo_snapshot,
        });

        return reply.code(200).send({
          success: true,
          data: decision,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to evaluate pick');
        return reply.code(500).send({
          success: false,
          error: 'Failed to evaluate pick',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /ops/autopilot/decisions
   * Get recent autopilot decisions
   */
  fastify.get('/ops/autopilot/decisions', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data, error } = await supabase
        .from('autopilot_decisions')
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

      return reply.code(200).send({
        success: true,
        data: data || [],
        count: data?.length || 0,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Failed to get autopilot decisions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get autopilot decisions',
        message: error.message,
      });
    }
  });

  /**
   * GET /ops/autopilot/promotion/:from_mode/:to_mode
   * Check promotion gate status
   */
  fastify.get<{ Params: PromotionCheckParams }>(
    '/ops/autopilot/promotion/:from_mode/:to_mode',
    async (request: FastifyRequest<{ Params: PromotionCheckParams }>, reply: FastifyReply) => {
      try {
        const { from_mode, to_mode } = request.params;

        const controller = getAutopilotController();
        const status = await controller.getPromotionGateStatus(from_mode, to_mode);

        return reply.code(200).send({
          success: true,
          data: status,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to check promotion gate');
        return reply.code(500).send({
          success: false,
          error: 'Failed to check promotion gate',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/autopilot/emergency-stop
   * Emergency stop autopilot (set mode to OFF)
   */
  fastify.post('/ops/autopilot/emergency-stop', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Require service role key
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || '')) {
        return reply.code(403).send({
          success: false,
          error: 'Unauthorized',
          message: 'Service role key required for emergency stop',
        });
      }

      const controller = getAutopilotController();
      await controller.setMode('off', 'emergency-stop', 'Emergency stop triggered via API');

      fastify.log.warn('🚨 AUTOPILOT EMERGENCY STOP TRIGGERED');

      return reply.code(200).send({
        success: true,
        data: {
          mode: 'off',
          stopped_at: new Date().toISOString(),
        },
        message: 'Autopilot emergency stop executed',
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Failed to execute emergency stop');
      return reply.code(500).send({
        success: false,
        error: 'Failed to execute emergency stop',
        message: error.message,
      });
    }
  });
}

// Export controller getter for use in other modules
export { getAutopilotController };
