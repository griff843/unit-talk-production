import { SupabaseClient } from '@supabase/supabase-js';
import { LeaderboardManager } from '../leaderboards';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../../../utils/getEnv';
import { Leaderboard, Participant } from '../types';

describe('LeaderboardManager Integration Tests', () => {
  let supabase: SupabaseClient;
  let leaderboardManager: LeaderboardManager;
  let testContestId: string;
  let testLeaderboardId: string;
  let testParticipants: Participant[];

  beforeAll(async () => {
    const env = getEnv();
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    leaderboardManager = new LeaderboardManager(supabase, {
      name: 'LeaderboardManager',
      enabled: true,
      updateInterval: 1000 // Fast updates for testing
    });

    // Create test contest
    const { data: contest } = await supabase
      .from('contests')
      .insert({
        id: crypto.randomUUID(),
        name: 'Test Contest',
        status: 'active'
      })
      .select()
      .single();

    testContestId = contest.id;

    // Create test participants
    testParticipants = [
      {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        contestId: testContestId,
        status: 'active',
        score: 100,
        rank: 1,
        achievements: [
          { type: 'first_win', timestamp: new Date(), value: 1, details: {} }
        ],
        fairPlayScore: 100
      },
      {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        contestId: testContestId,
        status: 'active',
        score: 100, // Tied score for testing tiebreakers
        rank: 2,
        achievements: [], // Fewer achievements for tiebreaker testing
        fairPlayScore: 90
      },
      {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        contestId: testContestId,
        status: 'active',
        score: 80,
        rank: 3,
        achievements: [],
        fairPlayScore: 100
      }
    ];

    await supabase
      .from('contest_participants')
      .insert(testParticipants);

    await leaderboardManager.initialize();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testLeaderboardId) {
      await supabase.from('leaderboards').delete().eq('id', testLeaderboardId);
    }
    if (testContestId) {
      await supabase.from('contests').delete().eq('id', testContestId);
      await supabase.from('contest_participants').delete().eq('contestId', testContestId);
      await supabase.from('participant_history').delete().eq('contestId', testContestId);
    }
    await leaderboardManager.cleanup();
  });

  describe('Leaderboard Creation and Updates', () => {
    it('should create a new leaderboard for a contest', async () => {
      const leaderboard = await leaderboardManager.createLeaderboard(testContestId, 'global');
      testLeaderboardId = leaderboard.id;

      expect(leaderboard).toMatchObject({
        id: expect.any(String),
        contestId: testContestId,
        type: 'global',
        rankings: [],
        lastUpdated: expect.any(Date),
        stats: expect.objectContaining({
          totalParticipants: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          scoreDistribution: {}
        })
      });

      // Verify leaderboard was created in database
      const { data, error } = await supabase
        .from('leaderboards')
        .select('*')
        .eq('id', leaderboard.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
    });

    it('should handle score updates and apply tiebreakers', async () => {
      // Trigger a score update
      await supabase
        .from('contest_participants')
        .update({ score: 110 })
        .eq('id', testParticipants[0].id);

      // Wait for update to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get updated leaderboard
      const leaderboard = await leaderboardManager.getLeaderboard(testLeaderboardId);

      expect(leaderboard.rankings).toHaveLength(3);
      expect(leaderboard.rankings[0]).toMatchObject({
        rank: 1,
        participantId: testParticipants[0].id,
        score: 110,
        trend: 'stable' // First update, so trend should be stable
      });

      // Verify tiebreaker handling for participants[1] and [2]
      const secondPlace = leaderboard.rankings[1];
      expect(secondPlace.participantId).toBe(testParticipants[1].id);
      expect(secondPlace.score).toBe(100);
    });

    it('should calculate accurate statistics', async () => {
      const leaderboard = await leaderboardManager.getLeaderboard(testLeaderboardId);

      expect(leaderboard.stats).toMatchObject({
        totalParticipants: 3,
        averageScore: expect.any(Number),
        highestScore: 110,
        lowestScore: 80,
        scoreDistribution: expect.any(Object)
      });

      // Verify average score calculation
      const expectedAverage = (110 + 100 + 80) / 3;
      expect(leaderboard.stats.averageScore).toBe(expectedAverage);

      // Verify score distribution buckets
      expect(leaderboard.stats.scoreDistribution).toMatchObject({
        '110': 1,
        '100': 1,
        '80': 1
      });
    });

    it('should handle rapid score updates efficiently', async () => {
      const updates = [95, 97, 99, 101].map(score => 
        supabase
          .from('contest_participants')
          .update({ score })
          .eq('id', testParticipants[2].id)
      );

      await Promise.all(updates);

      // Wait for updates to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      const leaderboard = await leaderboardManager.getLeaderboard(testLeaderboardId);
      const updatedParticipant = leaderboard.rankings.find(
        r => r.participantId === testParticipants[2].id
      );

      expect(updatedParticipant).toBeTruthy();
      expect(updatedParticipant?.score).toBe(101);
      expect(updatedParticipant?.trend).toBe('up');
    });
  });

  describe('Health Checks and Metrics', () => {
    it('should report healthy status when system is operational', async () => {
      const health = await leaderboardManager.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details).toMatchObject({
        queueSize: expect.any(Number),
        oldestUpdate: expect.any(Number),
        queueHealth: expect.any(Boolean),
        activeLeaderboards: expect.any(Number),
        updateLatency: expect.any(Number)
      });
    });

    it('should track metrics accurately', async () => {
      const metrics = await leaderboardManager.getMetrics();
      expect(metrics).toMatchObject({
        errors: expect.any(Number),
        warnings: expect.any(Number),
        successes: expect.any(Number)
      });
      expect(metrics.successes).toBeGreaterThan(0); // Should have processed updates
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid leaderboard IDs gracefully', async () => {
      await expect(
        leaderboardManager.getLeaderboard('invalid-id')
      ).rejects.toThrow();
    });

    it('should handle database connection issues', async () => {
      // Simulate database error by using invalid credentials
      const invalidSupabase = createClient('invalid-url', 'invalid-key');
      const invalidManager = new LeaderboardManager(invalidSupabase, {
        name: 'InvalidManager',
        enabled: true
      });

      const health = await invalidManager.checkHealth();
      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBeTruthy();
    });
  });
}); 