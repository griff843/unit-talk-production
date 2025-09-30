import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { routeSchemas } from '../schemas/api-routes';
import { enhancedValidateRequest, auditMiddleware, cacheAwareMiddleware } from '../middleware/enhanced-validation';
import { requireAuth, requireRole, optionalAuth } from '../middleware/auth';
import { createLogger } from '../utils/logger';
import { RedisEnhancedCache } from '../cache/enhanced-cache';
import { createUnifiedPick, patchUnifiedPick, findUnifiedPick, UnifiedPick } from '../db/unifiedPicksRepo';

const router = Router();
const logger = createLogger('UnifiedPicksRoutes');
const cache = new RedisEnhancedCache();

// Cache-First Unified Picks Service
class CacheFirstUnifiedPicksService {
  async createPick(pickData: any): Promise<UnifiedPick> {
    try {
      // Create pick in database
      const newPick = await createUnifiedPick(pickData);

      // Cache the new pick
      const cacheKey = `unified_pick:${newPick.id}`;
      await cache.set(cacheKey, JSON.stringify(newPick), 3600); // 1 hour

      // Invalidate related cache entries
      await this.invalidateUserCache(newPick.userId);
      await this.invalidateListCaches(newPick);

      logger.info('Unified pick created and cached', { pickId: newPick.id, userId: newPick.userId });
      return newPick;
    } catch (error) {
      logger.error('Failed to create unified pick', { error, pickData });
      throw error;
    }
  }

  async updatePick(pickId: string, updateData: any, userId?: string): Promise<UnifiedPick> {
    try {
      // Check cache for existing pick
      const existingPick = await this.getPickById(pickId);
      if (!existingPick) {
        throw new Error(`Pick ${pickId} not found`);
      }

      // Authorization check - users can only update their own picks unless they're staff
      if (userId && existingPick.userId !== userId) {
        throw new Error('Unauthorized to update this pick');
      }

      // Update in database
      const updatedPick = await patchUnifiedPick(pickId, updateData);

      // Update cache
      const cacheKey = `unified_pick:${pickId}`;
      await cache.set(cacheKey, JSON.stringify(updatedPick), 3600);

      // Invalidate related caches
      await this.invalidateUserCache(updatedPick.userId);
      await this.invalidateListCaches(updatedPick);

      logger.info('Unified pick updated and cache refreshed', { pickId, userId: updatedPick.userId });
      return updatedPick;
    } catch (error) {
      logger.error('Failed to update unified pick', { error, pickId, updateData });
      throw error;
    }
  }

  async getPickById(pickId: string, useCache = true): Promise<UnifiedPick | null> {
    try {
      if (useCache) {
        const cacheKey = `unified_pick:${pickId}`;
        const cached = await cache.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }

      // Fetch from database
      const pick = await findUnifiedPick(pickId);
      if (!pick) {
        return null;
      }

      // Cache the result
      if (useCache) {
        const cacheKey = `unified_pick:${pickId}`;
        await cache.set(cacheKey, JSON.stringify(pick), 3600);
      }

      return pick;
    } catch (error) {
      logger.error('Failed to get unified pick', { error, pickId });
      throw error;
    }
  }

  async queryPicks(filters: any, page = 1, limit = 25): Promise<{ picks: UnifiedPick[], total: number, hasNextPage: boolean }> {
    try {
      // Generate cache key from filters
      const cacheKey = `unified_picks:query:${this.generateQueryHash(filters, page, limit)}`;

      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Mock query implementation - replace with actual database query
      const allPicks = await this.getMockPicks(filters);

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const picks = allPicks.slice(startIndex, endIndex);
      const hasNextPage = endIndex < allPicks.length;

      const result = {
        picks,
        total: allPicks.length,
        hasNextPage,
      };

      // Cache the query result
      await cache.set(cacheKey, JSON.stringify(result), 300); // 5 minutes

      return result;
    } catch (error) {
      logger.error('Failed to query unified picks', { error, filters });
      throw error;
    }
  }

  async bulkOperation(operation: string, pickIds: string[], updateData?: any, userId?: string): Promise<any> {
    try {
      logger.info('Bulk operation initiated', { operation, pickCount: pickIds.length, userId });

      const results = [];
      const errors = [];

      for (const pickId of pickIds) {
        try {
          let result;
          switch (operation) {
            case 'update_status':
              if (!updateData?.status) throw new Error('Status is required for update_status operation');
              result = await this.updatePick(pickId, { status: updateData.status }, userId);
              break;
            case 'bulk_publish':
              result = await this.updatePick(pickId, { published: true }, userId);
              break;
            case 'bulk_delete':
              result = await this.deletePick(pickId, userId);
              break;
            default:
              throw new Error(`Unknown operation: ${operation}`);
          }
          results.push({ pickId, status: 'success', data: result });
        } catch (error) {
          errors.push({
            pickId,
            status: 'error',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        operation,
        totalProcessed: pickIds.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors,
      };
    } catch (error) {
      logger.error('Bulk operation failed', { error, operation, pickIds });
      throw error;
    }
  }

  async deletePick(pickId: string, userId?: string): Promise<boolean> {
    try {
      // Check if pick exists and user has permission
      const existingPick = await this.getPickById(pickId);
      if (!existingPick) {
        throw new Error(`Pick ${pickId} not found`);
      }

      if (userId && existingPick.userId !== userId) {
        throw new Error('Unauthorized to delete this pick');
      }

      // In production, implement soft delete or actual deletion
      logger.info('Pick deletion requested', { pickId, userId: existingPick.userId });

      // Remove from cache
      const cacheKey = `unified_pick:${pickId}`;
      await cache.del(cacheKey);

      // Invalidate related caches
      await this.invalidateUserCache(existingPick.userId);
      await this.invalidateListCaches(existingPick);

      return true;
    } catch (error) {
      logger.error('Failed to delete unified pick', { error, pickId, userId });
      throw error;
    }
  }

  private generateQueryHash(filters: any, page: number, limit: number): string {
    const queryString = JSON.stringify({ ...filters, page, limit });
    return Buffer.from(queryString).toString('base64').slice(0, 32);
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    // Invalidate user-specific caches
    const userCachePattern = `unified_picks:user:${userId}:*`;
    // In production, use Redis pattern matching to delete keys
    logger.debug('Invalidating user cache', { userId, pattern: userCachePattern });
  }

  private async invalidateListCaches(pick: UnifiedPick): Promise<void> {
    // Invalidate list caches that might include this pick
    const patterns = [
      'unified_picks:query:*',
      `unified_picks:sport:${pick.sport || 'unknown'}:*`,
      `unified_picks:user:${pick.userId}:*`,
    ];

    for (const pattern of patterns) {
      logger.debug('Invalidating list cache', { pattern });
    }
  }

  private async getMockPicks(filters: any): Promise<UnifiedPick[]> {
    // Mock data generation - replace with actual database query
    const mockPicks: UnifiedPick[] = Array.from({ length: 50 }, (_, i) => ({
      id: randomUUID(),
      userId: filters.userId || randomUUID(),
      propId: randomUUID(),
      gameId: randomUUID(),
      pickSource: 'manual',
      pickType: ['single', 'parlay'][Math.floor(Math.random() * 2)] as 'single' | 'parlay',
      outcome: `Mock pick outcome ${i + 1}`,
      line: -110 + Math.random() * 220,
      odds: -200 + Math.random() * 400,
      stake: Math.random() * 100,
      confidence: Math.floor(Math.random() * 10) + 1,
      workflowStage: ['ingested', 'validated', 'graded', 'promoted'][Math.floor(Math.random() * 4)] as any,
      status: ['pending', 'won', 'lost'][Math.floor(Math.random() * 3)] as any,
      published: Math.random() > 0.5,
      tierWhenPlaced: ['S', 'A', 'B'][Math.floor(Math.random() * 3)] as any,
      analysis: `Analysis for pick ${i + 1}`,
      placedAt: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Apply filters
    return mockPicks.filter(pick => {
      if (filters.userId && pick.userId !== filters.userId) return false;
      if (filters.pickType && pick.pickType !== filters.pickType) return false;
      if (filters.workflowStage && pick.workflowStage !== filters.workflowStage) return false;
      if (filters.status && pick.status !== filters.status) return false;
      if (filters.published !== undefined && pick.published !== filters.published) return false;
      return true;
    });
  }
}

const unifiedPicksService = new CacheFirstUnifiedPicksService();

/**
 * GET /api/unified-picks
 * Query unified picks with filtering and pagination
 */
router.get(
  '/',
  optionalAuth, // Allow both authenticated and public access with different data
  enhancedValidateRequest(routeSchemas.unifiedPicks.query, {
    requireAuth: false, // Optional auth
    auditAction: 'query',
    auditResourceType: 'unified_pick',
    enableFeatureFlags: true,
  }),
  cacheAwareMiddleware((req) => {
    const { query } = req.validatedData as any;
    return `unified_picks:query:${JSON.stringify(query)}`;
  }, 300), // 5 minutes cache
  auditMiddleware('query_unified_picks', 'unified_pick'),
  async (req: Request, res: Response) => {
    try {
      const { query } = req.validatedData as any;

      // If user is not authenticated, only show published picks
      if (!req.user) {
        query.published = true;
      }

      // Regular users can only see their own picks unless they have elevated permissions
      if (req.user && !['admin', 'operator', 'staff'].includes(req.user.role)) {
        query.userId = req.user.id;
      }

      const result = await unifiedPicksService.queryPicks(
        query,
        query.page || 1,
        query.limit || 25
      );

      res.json({
        success: true,
        data: result.picks,
        meta: {
          total: result.total,
          page: query.page || 1,
          limit: query.limit || 25,
          hasNextPage: result.hasNextPage,
        },
      });
    } catch (error) {
      logger.error('Failed to query unified picks', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to query unified picks',
      });
    }
  }
);

/**
 * POST /api/unified-picks
 * Create a new unified pick
 */
router.post(
  '/',
  requireAuth,
  requireRole(['capper', 'staff', 'admin']),
  enhancedValidateRequest(routeSchemas.unifiedPicks.create, {
    requireAuth: true,
    requiredPermissions: ['create:picks'],
    auditAction: 'create',
    auditResourceType: 'unified_pick',
    enableFeatureFlags: true,
  }),
  auditMiddleware('create_unified_pick', 'unified_pick'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      // Ensure user can only create picks for themselves unless they have elevated permissions
      if (!['admin', 'staff'].includes(req.user!.role)) {
        body.userId = req.user!.id;
      }

      const newPick = await unifiedPicksService.createPick(body);

      res.status(201).json({
        success: true,
        data: newPick,
        message: 'Unified pick created successfully',
      });
    } catch (error) {
      logger.error('Failed to create unified pick', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create unified pick',
      });
    }
  }
);

/**
 * GET /api/unified-picks/:id
 * Get a specific unified pick by ID
 */
router.get(
  '/:id',
  optionalAuth,
  cacheAwareMiddleware((req) => `unified_pick:${req.params.id}`, 3600), // 1 hour cache
  auditMiddleware('read_unified_pick', 'unified_pick', (req) => req.params.id),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const pick = await unifiedPicksService.getPickById(id);

      if (!pick) {
        res.status(404).json({
          success: false,
          error: 'Unified pick not found',
        });
        return;
      }

      // Authorization check
      const canAccess =
        !req.user || // Public access for published picks
        req.user.id === pick.userId || // Owner access
        ['admin', 'staff', 'operator'].includes(req.user.role); // Elevated permissions

      if (!canAccess || (!pick.published && !req.user)) {
        res.status(403).json({
          success: false,
          error: 'Access denied to this pick',
        });
        return;
      }

      res.json({
        success: true,
        data: pick,
      });
    } catch (error) {
      logger.error('Failed to get unified pick', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        pickId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve unified pick',
      });
    }
  }
);

/**
 * PUT /api/unified-picks/:id
 * Update a unified pick
 */
router.put(
  '/:id',
  requireAuth,
  enhancedValidateRequest(routeSchemas.unifiedPicks.update, {
    requireAuth: true,
    requiredPermissions: ['update:picks'],
    auditAction: 'update',
    auditResourceType: 'unified_pick',
  }),
  auditMiddleware('update_unified_pick', 'unified_pick', (req) => req.params.id),
  async (req: Request, res: Response) => {
    try {
      const { params, body } = req.validatedData as any;

      const updatedPick = await unifiedPicksService.updatePick(
        params.id,
        body,
        req.user!.role === 'admin' ? undefined : req.user!.id // Admins can update any pick
      );

      res.json({
        success: true,
        data: updatedPick,
        message: 'Unified pick updated successfully',
      });
    } catch (error) {
      logger.error('Failed to update unified pick', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        pickId: req.params.id,
        userId: req.user?.id,
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update unified pick',
      });
    }
  }
);

/**
 * DELETE /api/unified-picks/:id
 * Delete a unified pick
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole(['capper', 'staff', 'admin']),
  auditMiddleware('delete_unified_pick', 'unified_pick', (req) => req.params.id),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await unifiedPicksService.deletePick(
        id,
        req.user!.role === 'admin' ? undefined : req.user!.id
      );

      res.json({
        success: true,
        message: 'Unified pick deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete unified pick', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        pickId: req.params.id,
        userId: req.user?.id,
      });

      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 :
                         error instanceof Error && error.message.includes('Unauthorized') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete unified pick',
      });
    }
  }
);

/**
 * POST /api/unified-picks/batch
 * Bulk operations on unified picks
 */
router.post(
  '/batch',
  requireAuth,
  requireRole(['staff', 'admin']),
  enhancedValidateRequest(routeSchemas.unifiedPicks.batch, {
    requireAuth: true,
    requiredPermissions: ['update:picks', 'delete:picks'],
    auditAction: 'bulk_operation',
    auditResourceType: 'unified_pick',
  }),
  auditMiddleware('bulk_operation_unified_picks', 'unified_pick'),
  async (req: Request, res: Response) => {
    try {
      const { body } = req.validatedData as any;

      const result = await unifiedPicksService.bulkOperation(
        body.operation,
        body.pickIds,
        body.updateData,
        req.user!.role === 'admin' ? undefined : req.user!.id
      );

      res.json({
        success: true,
        data: result,
        message: `Bulk operation '${body.operation}' completed`,
      });
    } catch (error) {
      logger.error('Failed to perform bulk operation', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: req.correlationId,
        userId: req.user?.id,
        operation: req.body?.operation,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk operation',
      });
    }
  }
);

export default router;