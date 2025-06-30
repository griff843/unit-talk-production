import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  Contest,
  ContestEvent,
  Participant,
  Sponsorship
} from './types';
import { BaseAgentConfig } from '../BaseAgent/types/index';
import { Logger } from '../BaseAgent/types/index';
import { ErrorHandler } from '../../utils/errorHandling';

// Validation schemas
const contestRuleSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  conditions: z.record(z.any()),
  points: z.number(),
  bonuses: z.record(z.number()).optional(),
  penalties: z.record(z.number()).optional()
});

const prizePoolSchema = z.object({
  totalAmount: z.number().positive(),
  totalValue: z.number().positive(),
  currency: z.string(),
  distribution: z.array(z.object({
    rank: z.union([z.number(), z.string()]),
    value: z.number().positive(),
    type: z.enum(['cash', 'credit', 'item', 'custom']),
    conditions: z.record(z.any()).optional()
  })),
  winners: z.array(z.string()).default([]),
  specialPrizes: z.array(z.object({
    id: z.string().uuid().default(() => crypto.randomUUID()),
    name: z.string(),
    value: z.number().positive(),
    type: z.enum(['bonus', 'achievement', 'milestone']).default('bonus'),
    criteria: z.record(z.any()).default({})
  })).optional(),
  sponsorships: z.array(z.object({
    id: z.string().default(''),
    sponsor: z.string(),
    value: z.number().positive(),
    type: z.string().default('cash'),
    terms: z.record(z.any()).default({}),
    requirements: z.record(z.any()),
    benefits: z.record(z.any())
  })).optional()
});

const contestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  type: z.enum(['daily', 'weekly', 'monthly', 'season', 'tournament', 'special']).optional(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.enum(['draft', 'active', 'completed', 'cancelled']),
  rules: z.array(contestRuleSchema),
  prizePool: prizePoolSchema.optional(),
  participants: z.array(z.string()).default([]),
  metrics: z.object({
    participation: z.object({
      registered: z.number().default(0),
      active: z.number().default(0),
      completed: z.number().default(0),
      disqualified: z.number().default(0)
    }),
    engagement: z.object({
      averageActiveDays: z.number().default(0),
      completionRate: z.number().default(0),
      retentionRate: z.number().default(0)
    }),
    performance: z.object({
      averageScore: z.number().default(0),
      highestScore: z.number().default(0),
      fairPlayRate: z.number().default(1)
    }),
    financial: z.object({
      totalPrizeValue: z.number().default(0),
      averagePrize: z.number().default(0),
      revenueGenerated: z.number().optional()
    })
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export class ContestManager {
  private supabase: SupabaseClient;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private realtimeChannel: any;

  // Internal metrics tracking
  private metrics: {
    activeContests: number;
    completedContests: number;
    prizeValueDistributed: number;
    errorCount: number;
    processingTime: number[];
    lastUpdate: Date;
  };

  constructor(
    supabase: SupabaseClient,
    logger: Logger,
    errorHandler: ErrorHandler,
    _config: BaseAgentConfig
  ) {
    this.supabase = supabase;
    this.logger = logger;
    this.errorHandler = errorHandler;

    this.metrics = {
      activeContests: 0,
      completedContests: 0,
      prizeValueDistributed: 0,
      errorCount: 0,
      processingTime: [],
      lastUpdate: new Date()
    };
  }

  private async logContestEvent(event: ContestEvent): Promise<void> {
    try {
      // Log contest event to database
      const { error } = await this.supabase
        .from('contest_events')
        .insert([event]);

      if (error) {
        this.logger.error('Failed to log contest event', {
          error: error.message,
          code: error.code,
          details: error.details
        });
      }
    } catch (error) {
      this.logger.error('Error logging contest event:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async initialize(): Promise<void> {
    try {
      // Load existing contests and initialize metrics
      const { data: contests, error } = await this.supabase
        .from('contests')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      this.metrics.activeContests = contests?.length || 0;
      this.metrics.lastUpdate = new Date();

      // Set up real-time subscriptions
      this.realtimeChannel = this.supabase
        .channel('contest-updates')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'contests' },
          (payload) => this.handleContestUpdate(payload)
        )
        .subscribe();

      this.logger.info('ContestManager initialized', {
        activeContests: this.metrics.activeContests
      });

    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Failed to initialize ContestManager', {
          error: error.message
        });
        this.errorHandler.handleError(error);
      } else {
        const err = new Error(String(error));
        this.logger.error('Failed to initialize ContestManager', {
          error: err.message
        });
        this.errorHandler.handleError(err);
      }
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Archive completed contests older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await this.supabase
        .from('contests')
        .update({ status: 'archived' })
        .eq('status', 'completed')
        .lt('endDate', thirtyDaysAgo.toISOString());

      if (error) throw error;

      // Clean up real-time subscriptions
      if (this.realtimeChannel) {
        await this.supabase.removeChannel(this.realtimeChannel);
      }

    } catch (err) {
      if (err instanceof Error) {
        this.logger.error('Failed to cleanup ContestManager', {
          error: err.message
        });
        this.errorHandler.handleError(err);
      } else {
        const errorObj = new Error(String(err));
        this.logger.error('Failed to cleanup ContestManager', {
          error: errorObj.message
        });
        this.errorHandler.handleError(errorObj);
      }
    }
  }

  async createContest(payload: Omit<Contest, 'id' | 'metrics'>): Promise<Contest> {
    const startTime = Date.now();

    try {
      // Use a more flexible validation approach
      const validatedPayload = await contestSchema.partial().parseAsync(payload);

      // Validate prize pool if provided
      if (validatedPayload.prizePool) {
        // Add basic prize pool validation here instead of calling missing method
        if (!validatedPayload.prizePool.totalAmount || validatedPayload.prizePool.totalAmount <= 0) {
          throw new Error('Prize pool must have a positive total amount');
        }
      }

      // Fix rules to match ContestRule interface
      const fixedRules = (validatedPayload.rules || []).map((rule: any) => ({
        id: rule.id || crypto.randomUUID(),
        name: rule.type,
        description: `Rule for ${rule.type}`,
        type: rule.type,
        parameters: rule.conditions || {},
        active: true
      }));

      // Fix sponsorships to match expected structure and participants to Participant[]
      const mapSponsorships = (sponsorships: any[] | undefined): Sponsorship[] | undefined => {
        if (!sponsorships) return undefined;
        return sponsorships.map((sponsor: any, index: number): Sponsorship => ({
          id: typeof sponsor.id === 'string' && sponsor.id.length > 0 ? sponsor.id : `sponsorship-${index}`,
          sponsor: sponsor.sponsor,
          value: typeof sponsor.value === 'number' ? sponsor.value : 0,
          type: sponsor.type === 'cash' || sponsor.type === 'product' || sponsor.type === 'service' ? sponsor.type : 'cash',
          terms: sponsor.terms ?? {}
        }));
      };

      const fixedSponsorships = mapSponsorships(validatedPayload.prizePool?.sponsorships);

      // Fix participants to Participant[]
      const fixedParticipants: Participant[] = (validatedPayload.participants || []).map((participant: any) => ({
        ...participant,
        id: participant.id || crypto.randomUUID(),
      }));

      // Construct the contest object to insert
      const contestToInsert: Omit<Contest, 'metrics'> & { id?: string } = {
        id: validatedPayload.id || crypto.randomUUID(),
        name: validatedPayload.name || 'Untitled Contest',
        description: validatedPayload.description || 'No description provided',
        startDate: validatedPayload.startDate || new Date().toISOString(),
        endDate: validatedPayload.endDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        status: validatedPayload.status || 'draft',
        type: validatedPayload.type || 'daily',
        rules: fixedRules,
        ...(validatedPayload.prizePool && {
          prizePool: {
            totalAmount: validatedPayload.prizePool.totalAmount || 0,
            totalValue: validatedPayload.prizePool.totalValue || validatedPayload.prizePool.totalAmount || 0,
            currency: validatedPayload.prizePool.currency || 'USD',
            distribution: (validatedPayload.prizePool.distribution || []).map((dist, index) => ({
              rank: dist.rank || (index + 1),
              value: dist.value || 0,
              type: dist.type || 'cash' as const,
              ...(dist.conditions !== undefined && { conditions: dist.conditions })
            })),
            winners: validatedPayload.prizePool.winners || [],
            specialPrizes: (validatedPayload.prizePool.specialPrizes || []).map((prize, index) => ({
              id: prize.id || crypto.randomUUID(),
              name: prize.name || `Special Prize ${index + 1}`,
              value: prize.value || 0,
              type: prize.type || 'bonus' as const,
              criteria: prize.criteria || {}
            })),
            ...(fixedSponsorships !== undefined && { sponsorships: fixedSponsorships })
          }
        }),
        participants: fixedParticipants,
        metadata: validatedPayload.metadata || {}
      };

      // Insert into database
      const { data, error } = await this.supabase
        .from('contests')
        .insert([contestToInsert])
        .select()
        .single();

      if (error) {
        throw error;
      }

      this.logger.info(`Created contest with ID: ${data.id}`);

      // Log contest creation event
      await this.logContestEvent({
        type: 'contest_created',
        timestamp: new Date().toISOString(),
        contestId: data.id,
        details: { name: data.name },
        severity: 'info',
        correlationId: crypto.randomUUID()
      });

      return data;
    } catch (err) {
      this.logger.error('Failed to create contest', {
        error: err instanceof Error ? err.message : String(err)
      });
      this.errorHandler.handleError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      const duration = Date.now() - startTime;
      this.logger.info(`createContest took ${duration}ms`);
    }
  }

  async checkHealth(): Promise<{ status: string; timestamp: string; details: any }> {
    try {
      // Check database connectivity
      const { error } = await this.supabase.from('contests').select('count').limit(1);
      if (error) throw error;

      // Check metrics freshness
      const metricsFresh = (Date.now() - this.metrics.lastUpdate.getTime()) < 5 * 60 * 1000; // 5 minutes

      // Calculate health metrics
      const averageProcessingTime = this.metrics.processingTime.length > 0 ?
        this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length : 0;
      const errorRate = (this.metrics.activeContests + this.metrics.completedContests) > 0 ?
        this.metrics.errorCount / (this.metrics.activeContests + this.metrics.completedContests) : 0;

      const status = metricsFresh && errorRate < 0.1 ? 'healthy' : 'degraded';

      return {
        status,
        timestamp: new Date().toISOString(),
        details: {
          activeContests: this.metrics.activeContests,
          completedContests: this.metrics.completedContests,
          errorRate,
          averageProcessingTime,
          metricsFresh
        }
      };

    } catch (error) {
      this.logger.error('Health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: { error: error instanceof Error ? error : new Error(String(error)) }
      };
    }
  }

  getMetrics() {
    return {
      contests: {
        active: this.metrics.activeContests,
        completed: this.metrics.completedContests,
        totalParticipants: 0, // Would need to query database
        prizeValueDistributed: this.metrics.prizeValueDistributed
      },
      fairPlay: {
        checksPerformed: 0, // Would need to implement
        violationsDetected: 0, // Would need to implement
        appealRate: 0, // Would need to implement
        averageFairPlayScore: 1.0 // Would need to calculate
      },
      performance: {
        processingTime: this.metrics.processingTime.length > 0 ? 
          this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length : 0,
        updateFrequency: 0, // Would need to implement
        errorRate: (this.metrics.activeContests + this.metrics.completedContests) > 0 ? 
          this.metrics.errorCount / (this.metrics.activeContests + this.metrics.completedContests) : 0,
        uptime: 1.0 // Would need to implement
      },
      healthStatus: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        details: {}
      }
    };
  }

  private async handleContestUpdate(payload: any): Promise<void> {
    // Handle real-time contest updates
    this.logger.debug('Contest update received', { payload });
  }
}

