import { SupabaseClient } from '@supabase/supabase-js';
import { AgentConfig } from '../../types/agent';
import { Logger } from '../../utils/logger';
import { ErrorHandler } from '../../utils/errorHandling';
import { Leaderboard, LeaderboardEntry, LeaderboardStats, Participant } from './types';
import { z } from 'zod';
import { Counter, Gauge } from 'prom-client';

// Validation schemas
const leaderboardEntrySchema = z.object({
  rank: z.number().min(1),
  participantId: z.string().uuid(),
  score: z.number(),
  trend: z.enum(['up', 'down', 'stable']),
  achievements: z.array(z.string()),
  fairPlayScore: z.number().min(0).max(100)
});

const leaderboardSchema = z.object({
  id: z.string().uuid(),
  contestId: z.string().uuid(),
  type: z.enum(['global', 'regional', 'division']),
  rankings: z.array(leaderboardEntrySchema),
  lastUpdated: z.date(),
  stats: z.object({
    totalParticipants: z.number(),
    averageScore: z.number(),
    highestScore: z.number(),
    lowestScore: z.number(),
    scoreDistribution: z.record(z.number())
  })
});

export class LeaderboardManager {
  private supabase: SupabaseClient;
  private config: AgentConfig;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private updateQueue: Map<string, NodeJS.Timeout>;
  private metrics: {
    updateLatency: Counter;
    activeLeaderboards: Gauge;
    participantCount: Gauge;
    updateFrequency: Counter;
  };

  constructor(supabase: SupabaseClient, config: AgentConfig) {
    this.supabase = supabase;
    this.config = config;
    this.logger = new Logger('LeaderboardManager');
    this.errorHandler = new ErrorHandler('LeaderboardManager', supabase);
    this.updateQueue = new Map();

    // Initialize Prometheus metrics
    this.metrics = {
      updateLatency: new Counter({
        name: 'leaderboard_update_latency_seconds',
        help: 'Time taken to update leaderboards'
      }),
      activeLeaderboards: new Gauge({
        name: 'active_leaderboards_total',
        help: 'Number of active leaderboards'
      }),
      participantCount: new Gauge({
        name: 'leaderboard_participants_total',
        help: 'Total number of participants across all leaderboards'
      }),
      updateFrequency: new Counter({
        name: 'leaderboard_updates_total',
        help: 'Number of leaderboard updates'
      })
    };
  }

  async initialize(): Promise<void> {
    try {
      // Subscribe to participant score updates
      this.supabase
        .channel('score_updates')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'contest_participants',
          filter: 'score IS NOT NULL'
        }, this.handleScoreUpdate.bind(this))
        .subscribe();

      // Load active leaderboards
      const { data: leaderboards, error } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('status', 'active');

      if (error) throw error;

      this.metrics.activeLeaderboards.set(leaderboards?.length || 0);

      // Initialize update queues for active leaderboards
      for (const leaderboard of leaderboards || []) {
        this.scheduleUpdate(leaderboard.id);
      }

      this.logger.info('LeaderboardManager initialized successfully');
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to initialize LeaderboardManager');
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    // Clear all update timers
    for (const timer of this.updateQueue.values()) {
      clearTimeout(timer);
    }
    this.updateQueue.clear();
  }

  private async handleScoreUpdate(payload: any): Promise<void> {
    try {
      const { new: newScore, old: oldScore } = payload;
      if (!newScore || !oldScore || newScore.score === oldScore.score) return;

      const startTime = Date.now();

      // Get leaderboard for this participant's contest
      const { data: leaderboard, error } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('contestId', newScore.contestId)
        .single();

      if (error) throw error;

      // Schedule immediate update if score change is significant
      const scoreDiff = Math.abs(newScore.score - oldScore.score);
      if (scoreDiff > leaderboard.updateThreshold) {
        await this.updateLeaderboard(leaderboard.id, true);
      } else {
        this.scheduleUpdate(leaderboard.id);
      }

      this.metrics.updateLatency.inc((Date.now() - startTime) / 1000);
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to handle score update');
    }
  }

  private scheduleUpdate(leaderboardId: string): void {
    // Clear existing timer if any
    if (this.updateQueue.has(leaderboardId)) {
      clearTimeout(this.updateQueue.get(leaderboardId));
    }

    // Schedule new update
    const timer = setTimeout(
      () => this.updateLeaderboard(leaderboardId, false),
      this.config.updateInterval || 5000
    );

    this.updateQueue.set(leaderboardId, timer);
  }

  private async updateLeaderboard(leaderboardId: string, immediate: boolean): Promise<void> {
    try {
      const startTime = Date.now();

      // Get current leaderboard data
      const { data: leaderboard, error: leaderboardError } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('id', leaderboardId)
        .single();

      if (leaderboardError) throw leaderboardError;

      // Get all participants for this contest
      const { data: participants, error: participantsError } = await this.supabase
        .from('contest_participants')
        .select('*')
        .eq('contestId', leaderboard.contestId)
        .order('score', { ascending: false });

      if (participantsError) throw participantsError;

      // Calculate new rankings with tiebreakers
      const rankings = await this.calculateRankings(participants || [], leaderboard);

      // Calculate leaderboard statistics
      const stats = this.calculateStats(participants || []);

      // Update leaderboard
      const { error: updateError } = await this.supabase
        .from('leaderboards')
        .update({
          rankings,
          stats,
          lastUpdated: new Date()
        })
        .eq('id', leaderboardId);

      if (updateError) throw updateError;

      // Update metrics
      this.metrics.updateFrequency.inc();
      this.metrics.participantCount.set(participants?.length || 0);
      this.metrics.updateLatency.inc((Date.now() - startTime) / 1000);

      this.logger.info('Leaderboard updated successfully', {
        leaderboardId,
        participantCount: participants?.length,
        updateTime: Date.now() - startTime
      });

      // Schedule next update if not immediate
      if (!immediate) {
        this.scheduleUpdate(leaderboardId);
      }
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to update leaderboard');
    }
  }

  private async calculateRankings(
    participants: Participant[],
    leaderboard: Leaderboard
  ): Promise<LeaderboardEntry[]> {
    // Sort participants by primary score
    let sortedParticipants = [...participants].sort((a, b) => b.score - a.score);

    // Apply tiebreakers for equal scores
    sortedParticipants = await this.applyTiebreakers(sortedParticipants, leaderboard);

    // Get previous rankings for trend calculation
    const previousRankings = new Map(
      leaderboard.rankings.map(entry => [entry.participantId, entry.rank])
    );

    // Generate new rankings with trends
    return sortedParticipants.map((participant, index) => {
      const previousRank = previousRankings.get(participant.id) || 0;
      const currentRank = index + 1;

      return {
        rank: currentRank,
        participantId: participant.id,
        score: participant.score,
        trend: this.calculateTrend(currentRank, previousRank),
        achievements: participant.achievements.map(a => a.type),
        fairPlayScore: participant.fairPlayScore
      };
    });
  }

  private async applyTiebreakers(
    participants: Participant[],
    leaderboard: Leaderboard
  ): Promise<Participant[]> {
    // Group participants by score
    const scoreGroups = new Map<number, Participant[]>();
    participants.forEach(p => {
      const group = scoreGroups.get(p.score) || [];
      group.push(p);
      scoreGroups.set(p.score, group);
    });

    // Apply tiebreakers for each group with multiple participants
    const result: Participant[] = [];
    for (const [score, group] of scoreGroups.entries()) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }

      // Apply tiebreakers in order:
      // 1. Fair play score
      // 2. Achievement count
      // 3. Time of last score update
      // 4. Head-to-head record (if applicable)
      const tiebroken = await Promise.all(group.map(async p => {
        const { data: history } = await this.supabase
          .from('participant_history')
          .select('updated_at')
          .eq('participant_id', p.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        return {
          participant: p,
          fairPlayScore: p.fairPlayScore,
          achievementCount: p.achievements.length,
          lastUpdate: history?.[0]?.updated_at || new Date(0)
        };
      }));

      // Sort by tiebreaker criteria
      tiebroken.sort((a, b) => {
        if (a.fairPlayScore !== b.fairPlayScore) {
          return b.fairPlayScore - a.fairPlayScore;
        }
        if (a.achievementCount !== b.achievementCount) {
          return b.achievementCount - a.achievementCount;
        }
        return a.lastUpdate.getTime() - b.lastUpdate.getTime();
      });

      result.push(...tiebroken.map(t => t.participant));
    }

    return result;
  }

  private calculateTrend(currentRank: number, previousRank: number): 'up' | 'down' | 'stable' {
    if (previousRank === 0) return 'stable';
    if (currentRank < previousRank) return 'up';
    if (currentRank > previousRank) return 'down';
    return 'stable';
  }

  private calculateStats(participants: Participant[]): LeaderboardStats {
    const scores = participants.map(p => p.score);
    const totalParticipants = participants.length;

    // Calculate basic statistics
    const stats: LeaderboardStats = {
      totalParticipants,
      averageScore: scores.reduce((a, b) => a + b, 0) / totalParticipants,
      highestScore: Math.max(...scores),
      lowestScore: Math.min(...scores),
      scoreDistribution: {}
    };

    // Calculate score distribution in 10-point buckets
    scores.forEach(score => {
      const bucket = Math.floor(score / 10) * 10;
      stats.scoreDistribution[bucket] = (stats.scoreDistribution[bucket] || 0) + 1;
    });

    return stats;
  }

  async createLeaderboard(contestId: string, type: 'global' | 'regional' | 'division'): Promise<Leaderboard> {
    try {
      const leaderboard: Leaderboard = {
        id: crypto.randomUUID(),
        contestId,
        type,
        rankings: [],
        lastUpdated: new Date(),
        stats: {
          totalParticipants: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          scoreDistribution: {}
        }
      };

      // Validate leaderboard structure
      await leaderboardSchema.parseAsync(leaderboard);

      // Insert into database
      const { error } = await this.supabase
        .from('leaderboards')
        .insert(leaderboard);

      if (error) throw error;

      // Initialize update queue
      this.scheduleUpdate(leaderboard.id);

      // Update metrics
      this.metrics.activeLeaderboards.inc();

      return leaderboard;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to create leaderboard');
      throw error;
    }
  }

  async getLeaderboard(leaderboardId: string): Promise<Leaderboard> {
    try {
      const { data, error } = await this.supabase
        .from('leaderboards')
        .select('*')
        .eq('id', leaderboardId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Leaderboard not found');

      return data as Leaderboard;
    } catch (error) {
      this.errorHandler.handle(error, 'Failed to get leaderboard');
      throw error;
    }
  }

  async checkHealth(): Promise<{ status: string; details?: any }> {
    try {
      // Check database connectivity
      const { error: dbError } = await this.supabase
        .from('leaderboards')
        .select('id')
        .limit(1);

      if (dbError) throw dbError;

      // Check update queue health
      const queueSize = this.updateQueue.size;
      const oldestUpdate = Math.min(
        ...Array.from(this.updateQueue.values()).map(timer => timer[Symbol.toPrimitive]())
      );
      const queueHealth = Date.now() - oldestUpdate < 30000; // No updates older than 30 seconds

      const status = queueHealth ? 'healthy' : 'degraded';

      return {
        status,
        details: {
          queueSize,
          oldestUpdate,
          queueHealth,
          activeLeaderboards: await this.metrics.activeLeaderboards.get(),
          updateLatency: await this.metrics.updateLatency.get()
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
      errors: 0, // TODO: Implement error tracking
      warnings: 0,
      successes: await this.metrics.updateFrequency.get()
    };
  }
} 