import { SupabaseClient } from '@supabase/supabase-js';
import { FairPlayMonitor } from '../fairplay';
import { createClient } from '@supabase/supabase-js';
import { getEnv } from '../../../utils/getEnv';
import { Participant } from '../types';

describe('FairPlayMonitor Integration Tests', () => {
  let supabase: SupabaseClient;
  let fairPlayMonitor: FairPlayMonitor;
  let testContestId: string;
  let testParticipants: Participant[];

  beforeAll(async () => {
    const env = getEnv();
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    fairPlayMonitor = new FairPlayMonitor(supabase, {
      name: 'FairPlayMonitor',
      enabled: true
    });

    // Create test contest
    const { data: contest } = await supabase
      .from('contests')
      .insert({
        id: crypto.randomUUID(),
        name: 'Test Contest',
        status: 'active',
        fairPlayConfig: {
          rules: [
            {
              id: crypto.randomUUID(),
              type: 'multi_account',
              criteria: { threshold: 0.9 },
              severity: 'high',
              action: 'disqualify'
            },
            {
              id: crypto.randomUUID(),
              type: 'betting_pattern',
              criteria: { variance_threshold: 0.1 },
              severity: 'medium',
              action: 'warn'
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
        achievements: [],
        fairPlayScore: 100
      },
      {
        id: crypto.randomUUID(),
        userId: crypto.randomUUID(),
        contestId: testContestId,
        status: 'active',
        score: 90,
        rank: 2,
        achievements: [],
        fairPlayScore: 100
      }
    ];

    await supabase
      .from('contest_participants')
      .insert(testParticipants);

    await fairPlayMonitor.initialize();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testContestId) {
      await supabase.from('contests').delete().eq('id', testContestId);
      await supabase.from('contest_participants').delete().eq('contestId', testContestId);
      await supabase.from('participant_activity').delete().eq('contestId', testContestId);
      await supabase.from('participant_bets').delete().eq('contestId', testContestId);
      await supabase.from('fairplay_violations').delete().eq('contestId', testContestId);
    }
    await fairPlayMonitor.cleanup();
  });

  describe('Multiple Account Detection', () => {
    it('should detect multiple accounts from same IP', async () => {
      // Create activity records with same IP
      const sharedIP = '192.168.1.1';
      const activities = [
        {
          participant_id: testParticipants[0].id,
          contestId: testContestId,
          ip_address: sharedIP,
          timestamp: new Date(),
          action: 'login'
        },
        {
          participant_id: testParticipants[1].id,
          contestId: testContestId,
          ip_address: sharedIP,
          timestamp: new Date(Date.now() + 1000),
          action: 'login'
        }
      ];

      await supabase.from('participant_activity').insert(activities);

      // Wait for real-time updates to process
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .eq('severity', 'high');

      expect(violations).toHaveLength(1);
      expect(violations?.[0].evidence).toHaveProperty('ipOverlap');
    });

    it('should handle legitimate shared IPs', async () => {
      // Create activity from known shared network
      const sharedNetworkIP = '10.0.0.1';
      await supabase
        .from('participant_activity')
        .insert({
          participant_id: testParticipants[0].id,
          contestId: testContestId,
          ip_address: sharedNetworkIP,
          timestamp: new Date(),
          action: 'login',
          metadata: { network_type: 'public' }
        });

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify no false positives
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toHaveLength(0);
    });
  });

  describe('Betting Pattern Detection', () => {
    it('should detect suspicious betting patterns', async () => {
      // Create series of identical bets
      const bets = Array(10).fill(null).map((_, i) => ({
        participant_id: testParticipants[0].id,
        contestId: testContestId,
        event_id: crypto.randomUUID(),
        bet_type: 'win',
        amount: 100, // Suspiciously consistent amount
        timestamp: new Date(Date.now() + i * 1000)
      }));

      await supabase.from('participant_bets').insert(bets);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .eq('severity', 'medium');

      expect(violations).toHaveLength(1);
      expect(violations?.[0].evidence).toHaveProperty('consistentSizes');
    });

    it('should detect rapid betting sequences', async () => {
      // Create rapid sequence of bets
      const bets = Array(5).fill(null).map((_, i) => ({
        participant_id: testParticipants[0].id,
        contestId: testContestId,
        event_id: crypto.randomUUID(),
        bet_type: 'win',
        amount: 100 + i * 10, // Varying amounts
        timestamp: new Date(Date.now() + i * 100) // Very short intervals
      }));

      await supabase.from('participant_bets').insert(bets);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toBeTruthy();
      expect(violations?.[0].evidence).toHaveProperty('rapidSequences');
    });
  });

  describe('Collusion Detection', () => {
    it('should detect complementary betting patterns', async () => {
      const eventId = crypto.randomUUID();
      const bets = [
        {
          participant_id: testParticipants[0].id,
          contestId: testContestId,
          event_id: eventId,
          bet_type: 'win',
          amount: 100,
          timestamp: new Date()
        },
        {
          participant_id: testParticipants[1].id,
          contestId: testContestId,
          event_id: eventId,
          bet_type: 'lose', // Complementary bet
          amount: 100,
          timestamp: new Date(Date.now() + 1000) // Shortly after
        }
      ];

      await supabase.from('participant_bets').insert(bets);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .in('participantId', testParticipants.map(p => p.id))
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toHaveLength(2); // Both participants should be flagged
      expect(violations?.every(v => v.evidence.complementaryBetting)).toBe(true);
    });

    it('should detect profit sharing patterns', async () => {
      // Create series of correlated profits
      const bets = [];
      for (let i = 0; i < 10; i++) {
        const eventId = crypto.randomUUID();
        const timestamp = new Date(Date.now() + i * 60000);
        const profit1 = Math.random() * 100;
        const profit2 = -profit1; // Perfect negative correlation

        bets.push(
          {
            participant_id: testParticipants[0].id,
            contestId: testContestId,
            event_id: eventId,
            bet_type: 'win',
            amount: 100,
            profit: profit1,
            timestamp
          },
          {
            participant_id: testParticipants[1].id,
            contestId: testContestId,
            event_id: eventId,
            bet_type: 'lose',
            amount: 100,
            profit: profit2,
            timestamp: new Date(timestamp.getTime() + 1000)
          }
        );
      }

      await supabase.from('participant_bets').insert(bets);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .in('participantId', testParticipants.map(p => p.id))
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toBeTruthy();
      expect(violations?.some(v => v.evidence.profitSharing)).toBe(true);
    });
  });

  describe('Time Anomaly Detection', () => {
    it('should detect unusual activity hours', async () => {
      // Create activity during unusual hours
      const activities = Array(10).fill(null).map((_, i) => ({
        participant_id: testParticipants[0].id,
        contestId: testContestId,
        action: 'bet_placed',
        timestamp: new Date(new Date().setHours(2, i * 5, 0, 0)) // 2 AM activities
      }));

      await supabase.from('participant_activity').insert(activities);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toBeTruthy();
      expect(violations?.[0].evidence).toHaveProperty('unusualHours');
    });

    it('should detect inhuman reaction times', async () => {
      // Create activities with suspiciously fast reactions
      const activities = Array(5).fill(null).map((_, i) => ({
        participant_id: testParticipants[0].id,
        contestId: testContestId,
        action: 'bet_response',
        timestamp: new Date(),
        metadata: { reaction_time: 50 } // 50ms reaction time
      }));

      await supabase.from('participant_activity').insert(activities);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check for violations
      const { data: violations } = await supabase
        .from('fairplay_violations')
        .select('*')
        .eq('participantId', testParticipants[0].id)
        .gt('timestamp', new Date(Date.now() - 5000));

      expect(violations).toBeTruthy();
      expect(violations?.[0].evidence).toHaveProperty('inhumanReactions');
    });
  });

  describe('Health Checks and Metrics', () => {
    it('should report healthy status when system is operational', async () => {
      const health = await fairPlayMonitor.checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details).toMatchObject({
        totalChecks: expect.any(Number),
        violationsDetected: expect.any(Number),
        falsePositiveRate: expect.any(Number),
        averageLatency: expect.any(Number)
      });
    });

    it('should track metrics accurately', async () => {
      const metrics = await fairPlayMonitor.getMetrics();
      expect(metrics).toMatchObject({
        errors: expect.any(Number),
        warnings: expect.any(Number),
        successes: expect.any(Number)
      });
      expect(metrics.warnings).toBeGreaterThan(0); // Should have detected violations
    });
  });
}); 