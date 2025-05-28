import { HealthCheckResult } from '../../types/agent';

export interface Contest {
  id: string;
  name: string;
  type: ContestType;
  status: ContestStatus;
  startDate: Date;
  endDate: Date;
  rules: ContestRule[];
  prizePool: PrizePool;
  participants: Participant[];
  metrics: ContestMetrics;
  fairPlayConfig: FairPlayConfig;
}

export type ContestType =
  | 'tournament'
  | 'league'
  | 'challenge'
  | 'season'
  | 'special'
  | 'custom';

export type ContestStatus =
  | 'draft'
  | 'registration'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'under_review';

export interface ContestRule {
  id: string;
  type: string;
  conditions: Record<string, any>;
  points: number;
  bonuses?: Record<string, number>;
  penalties?: Record<string, number>;
}

export interface PrizePool {
  totalValue: number;
  currency: string;
  distribution: PrizeDistribution[];
  specialPrizes?: SpecialPrize[];
  sponsorships?: Sponsorship[];
}

export interface PrizeDistribution {
  rank: number | string; // string for ranges like "4-10"
  value: number;
  type: 'cash' | 'credit' | 'item' | 'custom';
  conditions?: Record<string, any>;
}

export interface SpecialPrize {
  name: string;
  value: number;
  criteria: Record<string, any>;
  winner?: string;
}

export interface Sponsorship {
  sponsor: string;
  contribution: number;
  requirements: Record<string, any>;
  benefits: Record<string, any>;
}

export interface Participant {
  id: string;
  userId: string;
  contestId: string;
  status: ParticipantStatus;
  score: number;
  rank: number;
  achievements: Achievement[];
  fairPlayScore: number;
  disqualified?: boolean;
}

export type ParticipantStatus =
  | 'registered'
  | 'active'
  | 'suspended'
  | 'disqualified'
  | 'completed';

export interface Achievement {
  type: string;
  timestamp: Date;
  value: number;
  details: Record<string, any>;
}

export interface Leaderboard {
  id: string;
  contestId: string;
  type: 'global' | 'regional' | 'division';
  rankings: LeaderboardEntry[];
  lastUpdated: Date;
  stats: LeaderboardStats;
}

export interface LeaderboardEntry {
  rank: number;
  participantId: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  achievements: string[];
  fairPlayScore: number;
}

export interface LeaderboardStats {
  totalParticipants: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  scoreDistribution: Record<string, number>;
}

export interface FairPlayConfig {
  rules: FairPlayRule[];
  thresholds: Record<string, number>;
  penalties: Record<string, any>;
  appeals: AppealConfig;
}

export interface FairPlayRule {
  id: string;
  type: string;
  criteria: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'warn' | 'suspend' | 'disqualify';
}

export interface AppealConfig {
  allowAppeals: boolean;
  timeLimit: number;
  reviewProcess: string[];
  requiredEvidence: string[];
}

export interface FairPlayReport {
  contestId: string;
  timestamp: Date;
  violations: FairPlayViolation[];
  summary: {
    totalChecks: number;
    violations: number;
    severity: Record<string, number>;
  };
  recommendations: string[];
}

export interface FairPlayViolation {
  ruleId: string;
  participantId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: Record<string, any>;
  action: string;
  status: 'pending' | 'resolved' | 'appealed';
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