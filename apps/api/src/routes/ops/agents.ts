/**
 * Phase 6: /ops/agents endpoints
 * Agent lifecycle control operations
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AgentLifecycleController } from '../../lib/AgentLifecycleController';
import { DeterministicRetryModule } from '../../lib/DeterministicRetryModule';
import { createSupabaseClient } from '../../utils/supabase';

const supabase = createSupabaseClient();
const lifecycleController = new AgentLifecycleController(supabase);
const retryModule = new DeterministicRetryModule(supabase);

interface AgentNameParams {
  name: string;
}

interface PauseAgentBody {
  reason?: string;
  drain?: boolean;
}

interface StartStopAgentBody {
  reason?: string;
}

interface RestartAgentBody {
  reason?: string;
}

/**
 * Register agent lifecycle routes
 */
export async function registerAgentOpsRoutes(fastify: FastifyInstance) {
  /**
   * GET /ops/agents
   * List all agents with health status
   */
  fastify.get('/ops/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await lifecycleController.getAllAgentHealth();

      return reply.code(200).send({
        success: true,
        data: health,
        count: health.length,
      });
    } catch (error: any) {
      fastify.log.error({ error: error.message }, 'Failed to get agent health');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get agent health',
        message: error.message,
      });
    }
  });

  /**
   * GET /ops/agents/:name
   * Get specific agent health and lifecycle state
   */
  fastify.get<{ Params: AgentNameParams }>(
    '/ops/agents/:name',
    async (request: FastifyRequest<{ Params: AgentNameParams }>, reply: FastifyReply) => {
      try {
        const { name } = request.params;

        const state = await lifecycleController.getAgentState(name);
        if (!state) {
          return reply.code(404).send({
            success: false,
            error: 'Agent not found',
          });
        }

        const health = await lifecycleController.getAgentHealth(name);

        return reply.code(200).send({
          success: true,
          data: {
            state,
            health,
          },
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to get agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/agents/:name/start
   * Start an agent
   */
  fastify.post<{ Params: AgentNameParams; Body: StartStopAgentBody }>(
    '/ops/agents/:name/start',
    async (
      request: FastifyRequest<{ Params: AgentNameParams; Body: StartStopAgentBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = request.params;
        const { reason } = request.body || {};

        const state = await lifecycleController.startAgent(name, reason);

        return reply.code(200).send({
          success: true,
          data: state,
          message: `Agent ${name} started successfully`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to start agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to start agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/agents/:name/stop
   * Stop an agent
   */
  fastify.post<{ Params: AgentNameParams; Body: StartStopAgentBody }>(
    '/ops/agents/:name/stop',
    async (
      request: FastifyRequest<{ Params: AgentNameParams; Body: StartStopAgentBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = request.params;
        const { reason } = request.body || {};

        const state = await lifecycleController.stopAgent(name, reason);

        return reply.code(200).send({
          success: true,
          data: state,
          message: `Agent ${name} stopped successfully`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to stop agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to stop agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/agents/:name/pause
   * Pause an agent with optional drain behavior
   */
  fastify.post<{ Params: AgentNameParams; Body: PauseAgentBody }>(
    '/ops/agents/:name/pause',
    async (
      request: FastifyRequest<{ Params: AgentNameParams; Body: PauseAgentBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = request.params;
        const { reason, drain = true } = request.body || {};

        const state = await lifecycleController.pauseAgent(name, reason, drain);

        return reply.code(200).send({
          success: true,
          data: state,
          message: `Agent ${name} pause initiated${drain ? ' (with drain)' : ''}`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to pause agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to pause agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/agents/:name/resume
   * Resume a paused agent
   */
  fastify.post<{ Params: AgentNameParams; Body: StartStopAgentBody }>(
    '/ops/agents/:name/resume',
    async (
      request: FastifyRequest<{ Params: AgentNameParams; Body: StartStopAgentBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = request.params;
        const { reason } = request.body || {};

        const state = await lifecycleController.resumeAgent(name, reason);

        return reply.code(200).send({
          success: true,
          data: state,
          message: `Agent ${name} resumed successfully`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to resume agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to resume agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * POST /ops/agents/:name/restart
   * Restart an agent (stop + start)
   */
  fastify.post<{ Params: AgentNameParams; Body: RestartAgentBody }>(
    '/ops/agents/:name/restart',
    async (
      request: FastifyRequest<{ Params: AgentNameParams; Body: RestartAgentBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = request.params;
        const { reason } = request.body || {};

        const state = await lifecycleController.restartAgent(name, reason);

        return reply.code(200).send({
          success: true,
          data: state,
          message: `Agent ${name} restarted successfully`,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to restart agent');
        return reply.code(500).send({
          success: false,
          error: 'Failed to restart agent',
          message: error.message,
        });
      }
    }
  );

  /**
   * GET /ops/agents/:name/retries
   * Get pending retries for an agent
   */
  fastify.get<{ Params: AgentNameParams }>(
    '/ops/agents/:name/retries',
    async (request: FastifyRequest<{ Params: AgentNameParams }>, reply: FastifyReply) => {
      try {
        const { name } = request.params;

        const retries = await retryModule.getOperationsReadyForRetry(name);

        return reply.code(200).send({
          success: true,
          data: retries,
          count: retries.length,
        });
      } catch (error: any) {
        fastify.log.error({ error: error.message }, 'Failed to get agent retries');
        return reply.code(500).send({
          success: false,
          error: 'Failed to get agent retries',
          message: error.message,
        });
      }
    }
  );
}
