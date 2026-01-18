/**
 * Feedback API Routes - Phase 21 Production Ramp
 *
 * REST endpoints for model feedback ingestion:
 * - POST /api/feedback/submit - Submit pick outcome feedback
 * - GET /api/feedback/history - Get feedback history
 * - GET /api/feedback/health - Health check
 *
 * @module routes/feedback
 * @since Phase 21 - Production Ramp & Stabilization
 * @reference Production Charter v3.0
 */

import { Router, Request, Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from '../shared/logger/types';
import { FeedbackLoopService } from '../services/feedback/FeedbackLoopService';

/**
 * Feedback submission payload
 */
interface FeedbackPayload {
  pickId: string;
  outcome: 'win' | 'loss' | 'push' | 'void';
  correctness: number; // 0-1, confidence in outcome
  clvChange?: number; // Change in CLV from this pick
  notes?: string;
}

/**
 * Create feedback routes
 */
export function createFeedbackRoutes(
  logger: Logger,
  supabase: SupabaseClient,
  feedbackLoopService: FeedbackLoopService
): Router {
  const router = Router();

  /**
   * POST /api/feedback/submit
   *
   * Submit pick outcome feedback for model training
   *
   * Body:
   * {
   *   pickId: string (required),
   *   outcome: 'win' | 'loss' | 'push' | 'void' (required),
   *   correctness: number 0-1 (required),
   *   clvChange?: number,
   *   notes?: string
   * }
   *
   * Response:
   * {
   *   success: boolean,
   *   feedbackId: string,
   *   message: string,
   *   timestamp: ISO8601
   * }
   */
  router.post('/submit', async (req: Request, res: Response) => {
    const startTime = Date.now();
    const correlationId = (req as any).correlationId || 'unknown';

    try {
      const payload: FeedbackPayload = req.body;

      // Validate required fields
      if (!payload.pickId || !payload.outcome || payload.correctness === undefined) {
        logger.warn('[Feedback API] Invalid feedback submission', {
          correlationId,
          missing: {
            pickId: !payload.pickId,
            outcome: !payload.outcome,
            correctness: payload.correctness === undefined
          }
        });

        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'pickId, outcome, and correctness are required',
          correlationId
        });
      }

      // Validate outcome enum
      if (!['win', 'loss', 'push', 'void'].includes(payload.outcome)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'outcome must be one of: win, loss, push, void',
          correlationId
        });
      }

      // Validate correctness range
      if (payload.correctness < 0 || payload.correctness > 1) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'correctness must be between 0 and 1',
          correlationId
        });
      }

      // Get user from request context (assumes auth middleware sets this)
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required',
          correlationId
        });
      }

      // Store feedback in database with RLS enforcement
      const { data, error } = await supabase
        .from('feedback_submissions')
        .insert({
          pick_id: payload.pickId,
          user_id: userId,
          outcome: payload.outcome,
          correctness: payload.correctness,
          clv_change: payload.clvChange || null,
          notes: payload.notes || null,
          submitted_at: new Date().toISOString(),
          processed: false
        })
        .select('id')
        .single();

      if (error) {
        logger.error('[Feedback API] Database error storing feedback', {
          correlationId,
          error: error.message,
          code: error.code
        });

        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to store feedback',
          correlationId
        });
      }

      logger.info('[Feedback API] Feedback submitted successfully', {
        correlationId,
        feedbackId: data.id,
        pickId: payload.pickId,
        outcome: payload.outcome,
        latencyMs: Date.now() - startTime
      });

      return res.status(201).json({
        success: true,
        feedbackId: data.id,
        message: 'Feedback submitted successfully',
        timestamp: new Date().toISOString(),
        correlationId
      });
    } catch (error) {
      logger.error('[Feedback API] Unexpected error', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        correlationId
      });
    }
  });

  /**
   * GET /api/feedback/history
   *
   * Get feedback submission history for current user
   *
   * Query params:
   * - limit: number (default: 100)
   * - offset: number (default: 0)
   * - days: number (default: 30, filter to last N days)
   *
   * Response:
   * {
   *   success: boolean,
   *   data: FeedbackSubmission[],
   *   total: number,
   *   limit: number,
   *   offset: number
   * }
   */
  router.get('/history', async (req: Request, res: Response) => {
    const correlationId = (req as any).correlationId || 'unknown';

    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User authentication required',
          correlationId
        });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);
      const offset = parseInt(req.query.offset as string) || 0;
      const days = parseInt(req.query.days as string) || 30;

      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Query with RLS enforcement (user_id filter)
      const { data, error, count } = await supabase
        .from('feedback_submissions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .gte('submitted_at', cutoffDate)
        .order('submitted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('[Feedback API] Database error fetching history', {
          correlationId,
          error: error.message
        });

        return res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to fetch feedback history',
          correlationId
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        total: count || 0,
        limit,
        offset,
        correlationId
      });
    } catch (error) {
      logger.error('[Feedback API] Unexpected error fetching history', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        correlationId
      });
    }
  });

  /**
   * GET /api/feedback/health
   *
   * Health check for feedback service
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      // Check database connectivity
      const { error } = await supabase
        .from('feedback_submissions')
        .select('count(*)', { count: 'exact', head: true });

      if (error) {
        return res.status(503).json({
          status: 'unhealthy',
          message: 'Database connectivity issue',
          error: error.message
        });
      }

      return res.status(200).json({
        status: 'healthy',
        service: 'feedback-api',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(503).json({
        status: 'unhealthy',
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

export default createFeedbackRoutes;

