import { HealthCheckResult } from '../../types/agent';
import { BaseAgentConfig } from '../BaseAgent/types';

export interface ContestAgentConfig extends BaseAgentConfig {
  fairPlay: {
    enabled: boolean;
    maxViolations: number;
    checkInterval: number;
    autoban: boolean;
  };
  leaderboard: {
    updateInterval: number;
    cacheTimeout: number;
    maxEntries: number;
  };
  prizePool: {
    enabled: boolean;
    distribution: number[];
    minPrize: number;
  };
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  rules: string[];
  prizePool?: PrizePool;
  participants: string[];
  metadata?: Record<string, any>;
}

export interface Leaderboard {
  contestId: string;
  entries: LeaderboardEntry[];
  lastUpdated: string;
  metadata?: Record<string, any>;
}

export interface LeaderboardEntry {
  userId: string;
  rank: number;
  score: number;
  achievements: string[];
  metadata?: Record<string, any>;
}

export interface PrizePool {
  totalAmount: number;
  distribution: number[];
  currency: string;
  winners: string[];
  metadata?: Record<string, any>;
}

export interface FairPlayReport {
  userId: string;
  contestId: string;
  violations: FairPlayViolation[];
  timestamp: string;
  status: 'pending' | 'reviewed' | 'cleared' | 'banned';
  metadata?: Record<string, any>;
}

export interface FairPlayViolation {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  evidence: string[];
  timestamp: string;
}

export interface ContestEvent {
  type: 'contest_created' | 'contest_started' | 'contest_ended' | 'participant_joined' | 'score_updated' | 'violation_detected';
  contestId: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface ContestMetrics {
  participation: {
    registered: number;
    active: number;
    completed: number;
    disqualified: number;
  };
  engagement: {
    averageActiveDays: number;
    completionRate: number;
    retentionRate: number;
  };
  performance: {
    averageScore: number;
    highestScore: number;
    fairPlayRate: number;
  };
  financial: {
    totalPrizeValue: number;
    averagePrize: number;
    revenueGenerated?: number;
  };
}

// Event types for logging and monitoring
export type ContestEventType =
  | 'contest_created'
  | 'contest_started'
  | 'contest_ended'
  | 'participant_registered'
  | 'score_updated'
  | 'prize_distributed'
  | 'violation_detected'
  | 'appeal_submitted'
  | 'system_error';

export interface ContestEvent {
  type: ContestEventType;
  timestamp: Date;
  contestId: string;
  participantId?: string;
  details: Record<string, any>;
  severity: 'info' | 'warn' | 'error';
  correlationId: string;
}

export interface ContestAgentMetrics {
  contests: {
    active: number;
    completed: number;
    totalParticipants: number;
    prizeValueDistributed: number;
  };
  fairPlay: {
    checksPerformed: number;
    violationsDetected: number;
    appealRate: number;
    averageFairPlayScore: number;
  };
  performance: {
    processingTime: number;
    updateFrequency: number;
    errorRate: number;
    uptime: number;
  };
  healthStatus: HealthCheckResult;
}

// Missing types that are imported in contests.ts
export type ContestType = 'daily' | 'weekly' | 'monthly' | 'season' | 'tournament' | 'special';

export type ContestStatus = 'draft' | 'active' | 'completed' | 'cancelled' | 'paused';

export interface ContestRule {
  id: string;
  name: string;
  description: string;
  type: 'eligibility' | 'scoring' | 'behavior' | 'payout';
  parameters: Record<string, any>;
  active: boolean;
}

export interface Participant {
  id: string;
  userId: string;
  contestId: string;
  joinedAt: string;
  status: 'active' | 'disqualified' | 'withdrawn';
  score: number;
  rank?: number;
  metadata?: Record<string, any>;
} 