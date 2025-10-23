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
    type?: ContestType;
    rules: ContestRule[];
    prizePool?: PrizePool;
    participants: Participant[];
    metrics?: ContestMetrics;
    metadata?: Record<string, any>;
}
export interface Leaderboard {
    id: string;
    contestId: string;
    type?: 'global' | 'regional' | 'division';
    entries: LeaderboardEntry[];
    rankings?: LeaderboardEntry[];
    lastUpdated: string;
    stats?: any;
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
    totalValue: number;
    distribution: PrizeDistribution[];
    currency: string;
    winners: string[];
    specialPrizes?: SpecialPrize[];
    sponsorships?: Sponsorship[];
    metadata?: Record<string, any>;
}
export interface PrizeDistribution {
    rank: string | number;
    value: number;
    type: 'cash' | 'credit' | 'item' | 'custom';
    conditions?: Record<string, any>;
}
export interface SpecialPrize {
    id: string;
    name: string;
    value: number;
    type: 'bonus' | 'achievement' | 'milestone';
    criteria: Record<string, any>;
}
export interface Sponsorship {
    id: string;
    sponsor: string;
    value: number;
    type: 'cash' | 'product' | 'service';
    terms: Record<string, any>;
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
export type ContestEventType = 'contest_created' | 'contest_started' | 'contest_ended' | 'participant_registered' | 'participant_joined' | 'score_updated' | 'prize_distributed' | 'violation_detected' | 'appeal_submitted' | 'system_error';
export interface ContestEvent {
    type: ContestEventType;
    timestamp: string;
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
    status: 'active' | 'disqualified' | 'withdrawn' | 'completed';
    score: number;
    professional_score?: number;
    rank?: number;
    fairPlayScore?: number;
    metadata?: Record<string, any>;
}
//# sourceMappingURL=types.d.ts.map