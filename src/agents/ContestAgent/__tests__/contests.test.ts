import { SupabaseClient } from '@supabase/supabase-js';
import { ContestManager } from '../contests';
import { Contest, ContestType, ContestStatus, PrizePool } from '../types';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../../../utils/getEnv';

describe('ContestManager Integration Tests', () => {
  let supabase: SupabaseClient;
  let contestManager: ContestManager;
  let testContestId: string;

  beforeAll(async () => {
    const env = getEnv();
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    contestManager = new ContestManager(supabase, {
      name: 'ContestManager',
      enabled: true
    });
    await contestManager.initialize();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testContestId) {
      await supabase.from('contests').delete().eq('id', testContestId);
      await supabase.from('contest_participants').delete().eq('contestId', testContestId);
      await supabase.from('prize_distributions').delete().eq('contestId', testContestId);
      await supabase.from('contest_events').delete().eq('contestId', testContestId);
    }
    await contestManager.cleanup();
  });

  const mockPrizePool: PrizePool = {
    totalValue: 1000,
    currency: 'USD',
    distribution: [
      { rank: 1, value: 500, type: 'cash' },
      { rank: 2, value: 300, type: 'cash' },
      { rank: '3-5', value: 66.67, type: 'cash' }
    ],
    specialPrizes: [
      {
        name: 'Early Bird',
        value: 100,
        criteria: { type: 'early_registration' }
      }
    ],
    sponsorships: [
      {
        sponsor: 'BetCo',
        contribution: 100,
        requirements: { logo: true, mention: true },
        benefits: { visibility: 'high' }
      }
    ]
  };

  const mockContest: Omit<Contest, 'id' | 'metrics'> = {
    name: 'Test Tournament',
    type: 'tournament' as ContestType,
    status: 'draft' as ContestStatus,
    startDate: new Date(Date.now() + 86400000), // Tomorrow
    endDate: new Date(Date.now() + 172800000), // Day after tomorrow
    rules: [
      {
        id: crypto.randomUUID(),
        type: 'score_multiplier',
        conditions: { streak: 3 },
        points: 1.5,
        bonuses: { perfect: 2 }
      }
    ],
    prizePool: mockPrizePool,
    participants: [],
    fairPlayConfig: {
      rules: [
        {
          id: crypto.randomUUID(),
          type: 'multi_account',
          criteria: { threshold: 0.9 },
          severity: 'high',
          action: 'disqualify'
        }
      ],
      thresholds: { minFairPlayScore: 80 },
      penalties: { disqualification: 'permanent' },
      appeals: {
        allowAppeals: true,
        timeLimit: 48,
        reviewProcess: ['automated', 'manual'],
        requiredEvidence: ['account_data', 'betting_patterns']
      }
    }
  };

  describe('Contest Creation and Lifecycle', () => {
    it('should create a new contest with valid data', async () => {
      const contest = await contestManager.createContest(mockContest);
      testContestId = contest.id;

      expect(contest).toMatchObject({
        ...mockContest,
        id: expect.any(String),
        metrics: expect.objectContaining({
          participation: expect.any(Object),
          engagement: expect.any(Object),
          performance: expect.any(Object),
          financial: expect.any(Object)
        })
      });

      // Verify contest was created in database
      const { data, error } = await supabase
        .from('contests')
        .select('*')
        .eq('id', contest.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    it('should validate prize distribution totals', async () => {
      const invalidContest = {
        ...mockContest,
        prizePool: {
          ...mockPrizePool,
          distribution: [
            { rank: 1, value: 2000, type: 'cash' } // More than total value
          ]
        }
      };

      await expect(contestManager.createContest(invalidContest))
        .rejects
        .toThrow('Prize distribution total does not match prize pool value');
    });

    it('should handle contest lifecycle transitions', async () => {
      // Create test participants
      const participants = [
        {
          id: crypto.randomUUID(),
          userId: crypto.randomUUID(),
          contestId: testContestId,
          status: 'registered',
          score: 0,
          rank: 0,
          achievements: [],
          fairPlayScore: 100
        },
        {
          id: crypto.randomUUID(),
          userId: crypto.randomUUID(),
          contestId: testContestId,
          status: 'registered',
          score: 0,
          rank: 0,
          achievements: [],
          fairPlayScore: 100
        }
      ];

      await supabase.from('contest_participants').insert(participants);

      // Update contest to active
      await supabase
        .from('contests')
        .update({ status: 'active' })
        .eq('id', testContestId);

      // Wait for real-time updates to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify participants were activated
      const { data: activeParticipants } = await supabase
        .from('contest_participants')
        .select('status')
        .eq('contestId', testContestId);

      expect(activeParticipants).toHaveLength(2);
      expect(activeParticipants?.every(p => p.status === 'active')).toBe(true);
    });

    it('should finalize contest and distribute prizes', async () => {
      // Update participant scores
      await supabase
        .from('contest_participants')
        .update({ score: 100, status: 'completed' })
        .eq('contestId', testContestId)
        .eq('id', participants[0].id);

      await supabase
        .from('contest_participants')
        .update({ score: 80, status: 'completed' })
        .eq('contestId', testContestId)
        .eq('id', participants[1].id);

      // Complete the contest
      await supabase
        .from('contests')
        .update({ status: 'completed' })
        .eq('id', testContestId);

      // Wait for real-time updates to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify prize distributions
      const { data: prizes } = await supabase
        .from('prize_distributions')
        .select('*')
        .eq('contestId', testContestId);

      expect(prizes).toHaveLength(2);
      expect(prizes?.find(p => p.rank === 1)?.amount).toBe(500);
      expect(prizes?.find(p => p.rank === 2)?.amount).toBe(300);
    });
  });

  describe('Health Checks and Metrics', () => {
    it('should report healthy status when system is operational', async () => {
      const health = await contestManager.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details).toMatchObject({
        activeContests: expect.any(Number),
        completedContests: expect.any(Number),
        averageProcessingTime: expect.any(Number),
        errorRate: expect.any(Number),
        metricsFreshness: expect.any(Boolean)
      });
    });

    it('should track metrics accurately', async () => {
      const metrics = await contestManager.getMetrics();
      expect(metrics).toMatchObject({
        errors: expect.any(Number),
        warnings: expect.any(Number),
        successes: expect.any(Number)
      });
      expect(metrics.successes).toBeGreaterThan(0); // Should include our test contest
    });
  });
}); 