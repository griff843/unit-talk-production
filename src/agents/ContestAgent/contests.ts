import { SupabaseClient } from '@supabase/supabase-js';
import { AgentConfig } from '../../types/agent';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { z } from 'zod';
import {
  Contest,
  ContestType,
  ContestStatus,
  ContestRule,
  PrizePool,
  Participant,
  ContestMetrics,
  ContestEvent,
  ContestEventType
} from './types';

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
  totalValue: z.number().positive(),
  currency: z.string(),
  distribution: z.array(z.object({
    rank: z.union([z.number(), z.string()]),
    value: z.number().positive(),
    type: z.enum(['cash', 'credit', 'item', 'custom']),
    conditions: z.record(z.any()).optional()
  })),
  specialPrizes: z.array(z.object({
    name: z.string(),
    value: z.number().positive(),
    criteria: z.record(z.any()),
    winner: z.string().optional()
  })).optional(),
  sponsorships: z.array(z.object({
    sponsor: z.string(),
    contribution: z.number().positive(),
    requirements: z.record(z.any()),
    benefits: z.record(z.any())
  })).optional()
});

const contestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  type: z.enum(['tournament', 'league', 'challenge', 'season', 'special', 'custom']),
  status: z.enum(['draft', 'registration', 'active', 'paused', 'completed', 'cancelled', 'under_review']),
  startDate: z.date(),
  endDate: z.date(),
  rules: z.array(contestRuleSchema),
  prizePool: prizePoolSchema,
  participants: z.array(z.object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    contestId: z.string().uuid(),
    status: z.enum(['registered', 'active', 'suspended', 'disqualified', 'completed']),
    score: z.number(),
    rank: z.number(),
    achievements: z.array(z.object({
      type: z.string(),
      timestamp: z.date(),
      value: z.number(),
      details: z.record(z.any())
    })),
    fairPlayScore: z.number(),
    disqualified: z.boolean().optional()
  })),
  metrics: z.object({
    participation: z.object({
      registered: z.number(),
      active: z.number(),
      completed: z.number(),
      disqualified: z.number()
    }),
    engagement: z.object({
      averageActiveDays: z.number(),
      completionRate: z.number(),
      retentionRate: z.number()
    }),
    performance: z.object({
      averageScore: z.number(),
      highestScore: z.number(),
      fairPlayRate: z.number()
    }),
    financial: z.object({
      totalPrizeValue: z.number(),
      averagePrize: z.number(),
      revenueGenerated: z.number().optional()
    })
  }),
  fairPlayConfig: z.object({
    rules: z.array(z.object({
      id: z.string().uuid(),
      type: z.string(),
      criteria: z.record(z.any()),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      action: z.enum(['warn', 'suspend', 'disqualify'])
    })),
    thresholds: z.record(z.number()),
    penalties: z.record(z.any()),
    appeals: z.object({
      allowAppeals: z.boolean(),
      timeLimit: z.number(),
      reviewProcess: z.array(z.string()),
      requiredEvidence: z.array(z.string())
    })
  })
});

export class ContestManager {
  private supabase: SupabaseClient;
  private config: AgentConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private metrics: {
    activeContests: number;
    completedContests: number;
    totalParticipants: number;
    prizeValueDistributed: number;
    processingTime: number[];
    errorCount: number;
    lastUpdate: Date;
  };

  constructor(supabase: SupabaseClient, config: AgentConfig) {
    this.supabase = supabase;
    this.config = config;
    this.logger = new Logger('ContestManager');
    this.errorHandler = new ErrorHandler('ContestManager', supabase);
    this.metrics = {
      activeContests: 0,
      completedContests: 0,
      totalParticipants: 0,
      prizeValueDistributed: 0,
      processingTime: [],
      errorCount: 0,
      lastUpdate: new Date()
    };
  }

  async initialize(): Promise<void> {
    try {
      // Load existing contests and initialize metrics
      const { data: contests, error } = await this.supabase
        .from('contests')
        .select('*')
        .in('status', ['active', 'registration']);

      if (error) throw error;

      this.metrics.activeContests = contests?.length || 0;
      this.metrics.lastUpdate = new Date();

      // Set up real-time subscriptions for contest updates
      this.supabase
        .channel('contest_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'contests'
        }, this.handleContestUpdate.bind(this))
        .subscribe();

      this.logger.info('ContestManager initialized successfully', {
        activeContests: this.metrics.activeContests
      });
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to initialize ContestManager');
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

      this.logger.info('ContestManager cleanup completed');
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to cleanup ContestManager');
      throw error;
    }
  }

  async createContest(payload: Omit<Contest, 'id' | 'metrics'>): Promise<Contest> {
    const startTime = Date.now();
    try {
      // Validate contest payload
      const validatedPayload = await contestSchema.omit({ id: true, metrics: true }).parseAsync(payload);

      // Validate prize pool distribution
      this.validatePrizeDistribution(validatedPayload.prizePool);

      // Create contest with initial metrics
      const contest: Contest = {
        ...validatedPayload,
        id: crypto.randomUUID(),
        metrics: {
          participation: {
            registered: 0,
            active: 0,
            completed: 0,
            disqualified: 0
          },
          engagement: {
            averageActiveDays: 0,
            completionRate: 0,
            retentionRate: 0
          },
          performance: {
            averageScore: 0,
            highestScore: 0,
            fairPlayRate: 100
          },
          financial: {
            totalPrizeValue: validatedPayload.prizePool.totalValue,
            averagePrize: validatedPayload.prizePool.totalValue,
            revenueGenerated: 0
          }
        }
      };

      // Insert contest into database
      const { error } = await this.supabase
        .from('contests')
        .insert(contest);

      if (error) throw error;

      // Log contest creation event
      await this.logContestEvent({
        type: 'contest_created',
        timestamp: new Date(),
        contestId: contest.id,
        details: {
          name: contest.name,
          type: contest.type,
          prizePool: contest.prizePool.totalValue
        },
        severity: 'info',
        correlationId: crypto.randomUUID()
      });

      // Update metrics
      this.metrics.activeContests++;
      this.metrics.processingTime.push(Date.now() - startTime);
      if (this.metrics.processingTime.length > 100) this.metrics.processingTime.shift();

      this.logger.info('Contest created successfully', {
        contestId: contest.id,
        name: contest.name
      });

      return contest;
    } catch (error) {
      this.metrics.errorCount++;
      this.errorHandler.handle(error, 'Failed to create contest');
      throw error;
    }
  }

  private validatePrizeDistribution(prizePool: PrizePool): void {
    // Ensure total distribution matches pool value
    const totalDistributed = prizePool.distribution.reduce((sum, dist) => sum + dist.value, 0);
    const specialPrizesTotal = (prizePool.specialPrizes || []).reduce((sum, prize) => sum + prize.value, 0);
    const sponsorshipsTotal = (prizePool.sponsorships || []).reduce((sum, sponsor) => sum + sponsor.contribution, 0);

    if (Math.abs(totalDistributed + specialPrizesTotal - (prizePool.totalValue + sponsorshipsTotal)) > 0.01) {
      throw new Error('Prize distribution total does not match prize pool value');
    }

    // Validate rank coverage
    const ranks = new Set<number>();
    prizePool.distribution.forEach(dist => {
      if (typeof dist.rank === 'number') {
        ranks.add(dist.rank);
      } else {
        const [start, end] = dist.rank.split('-').map(Number);
        for (let i = start; i <= end; i++) ranks.add(i);
      }
    });

    // Ensure continuous ranking from 1 to max rank
    const maxRank = Math.max(...ranks);
    for (let i = 1; i <= maxRank; i++) {
      if (!ranks.has(i)) {
        throw new Error(`Missing prize distribution for rank ${i}`);
      }
    }
  }

  private async handleContestUpdate(payload: any): Promise<void> {
    try {
      const { new: newRecord, old: oldRecord } = payload;

      if (newRecord.status === 'active' && oldRecord.status === 'registration') {
        await this.startContest(newRecord.id);
      } else if (newRecord.status === 'completed' && oldRecord.status === 'active') {
        await this.finalizeContest(newRecord.id);
      }

      await this.updateMetrics();
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to handle contest update');
    }
  }

  private async startContest(contestId: string): Promise<void> {
    try {
      // Update participant statuses
      const { error } = await this.supabase
        .from('contest_participants')
        .update({ status: 'active' })
        .eq('contestId', contestId)
        .eq('status', 'registered');

      if (error) throw error;

      await this.logContestEvent({
        type: 'contest_started',
        timestamp: new Date(),
        contestId,
        details: {},
        severity: 'info',
        correlationId: crypto.randomUUID()
      });
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to start contest');
      throw error;
    }
  }

  private async finalizeContest(contestId: string): Promise<void> {
    try {
      // Get final rankings
      const { data: participants, error: rankError } = await this.supabase
        .from('contest_participants')
        .select('*')
        .eq('contestId', contestId)
        .order('score', { ascending: false });

      if (rankError) throw rankError;

      // Get contest details
      const { data: contest, error: contestError } = await this.supabase
        .from('contests')
        .select('*')
        .eq('id', contestId)
        .single();

      if (contestError) throw contestError;

      // Distribute prizes
      for (const [index, participant] of (participants || []).entries()) {
        const rank = index + 1;
        const prize = this.calculatePrize(rank, contest.prizePool);
        
        if (prize > 0) {
          const { error: prizeError } = await this.supabase
            .from('prize_distributions')
            .insert({
              contestId,
              participantId: participant.id,
              userId: participant.userId,
              rank,
              amount: prize,
              currency: contest.prizePool.currency,
              status: 'pending'
            });

          if (prizeError) throw prizeError;
        }
      }

      // Update contest metrics
      const metrics = this.calculateFinalMetrics(participants || [], contest);
      const { error: metricsError } = await this.supabase
        .from('contests')
        .update({ metrics })
        .eq('id', contestId);

      if (metricsError) throw metricsError;

      await this.logContestEvent({
        type: 'contest_ended',
        timestamp: new Date(),
        contestId,
        details: { metrics },
        severity: 'info',
        correlationId: crypto.randomUUID()
      });

      this.metrics.completedContests++;
      this.metrics.prizeValueDistributed += contest.prizePool.totalValue;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to finalize contest');
      throw error;
    }
  }

  private calculatePrize(rank: number, prizePool: PrizePool): number {
    const distribution = prizePool.distribution.find(dist => {
      if (typeof dist.rank === 'number') {
        return dist.rank === rank;
      } else {
        const [start, end] = dist.rank.split('-').map(Number);
        return rank >= start && rank <= end;
      }
    });

    return distribution?.value || 0;
  }

  private calculateFinalMetrics(participants: Participant[], contest: Contest): ContestMetrics {
    const totalParticipants = participants.length;
    const activeParticipants = participants.filter(p => p.status === 'active').length;
    const completedParticipants = participants.filter(p => p.status === 'completed').length;
    const disqualifiedParticipants = participants.filter(p => p.status === 'disqualified').length;

    const scores = participants.map(p => p.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / totalParticipants;
    const highestScore = Math.max(...scores);

    const fairPlayScores = participants.map(p => p.fairPlayScore);
    const averageFairPlayScore = fairPlayScores.reduce((a, b) => a + b, 0) / totalParticipants;

    // Calculate engagement metrics
    const contestDuration = contest.endDate.getTime() - contest.startDate.getTime();
    const daysActive = contestDuration / (1000 * 60 * 60 * 24);

    return {
      participation: {
        registered: totalParticipants,
        active: activeParticipants,
        completed: completedParticipants,
        disqualified: disqualifiedParticipants
      },
      engagement: {
        averageActiveDays: daysActive,
        completionRate: completedParticipants / totalParticipants * 100,
        retentionRate: activeParticipants / totalParticipants * 100
      },
      performance: {
        averageScore,
        highestScore,
        fairPlayRate: averageFairPlayScore
      },
      financial: {
        totalPrizeValue: contest.prizePool.totalValue,
        averagePrize: contest.prizePool.totalValue / totalParticipants,
        revenueGenerated: contest.metrics.financial.revenueGenerated
      }
    };
  }

  private async logContestEvent(event: ContestEvent): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('contest_events')
        .insert(event);

      if (error) throw error;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to log contest event');
    }
  }

  async checkHealth(): Promise<{ status: string; details?: any }> {
    try {
      // Check database connectivity
      const { error: dbError } = await this.supabase
        .from('contests')
        .select('id')
        .limit(1);

      if (dbError) throw dbError;

      // Check metrics freshness
      const metricsFresh = (Date.now() - this.metrics.lastUpdate.getTime()) < 5 * 60 * 1000; // 5 minutes

      // Calculate error rate
      const averageProcessingTime = this.metrics.processingTime.reduce((a, b) => a + b, 0) / this.metrics.processingTime.length;
      const errorRate = this.metrics.errorCount / (this.metrics.activeContests + this.metrics.completedContests);

      const status = metricsFresh && errorRate < 0.1 ? 'healthy' : 'degraded';

      return {
        status,
        details: {
          activeContests: this.metrics.activeContests,
          completedContests: this.metrics.completedContests,
          averageProcessingTime,
          errorRate,
          metricsFreshness: metricsFresh
        }
      };
    } catch (error) {
      this.errorHandler.handle(error, 'Health check failed');
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  async getMetrics(): Promise<{ errors: number; warnings: number; successes: number }> {
    return {
      errors: this.metrics.errorCount,
      warnings: 0,
      successes: this.metrics.activeContests + this.metrics.completedContests
    };
  }
} 