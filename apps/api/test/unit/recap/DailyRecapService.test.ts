/**
 * Unit Tests for DailyRecapService
 *
 * Tests recap computation logic, CLV distribution, sport breakdown,
 * and idempotency guarantees.
 *
 * Phase 2 Step 5 - Daily Recap Automation
 */

import { DailyRecapService, DailyRecap, CLVDistribution, SportBreakdown } from '../../../src/services/recap/DailyRecapService';

// Mock Supabase client
jest.mock('../../../src/services/supabaseClient', () => ({
  supabaseClient: {
    from: jest.fn(),
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

import { supabaseClient } from '../../../src/services/supabaseClient';

describe('DailyRecapService', () => {
  let service: DailyRecapService;

  beforeEach(() => {
    service = DailyRecapService.getInstance();
    jest.clearAllMocks();
  });

  describe('computeDailyRecap', () => {
    it('should compute basic recap metrics from picks', async () => {
      // Mock picks data
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }],
        },
        {
          id: 'pick-2',
          status: 'lost',
          stake: 1.0,
          profit_loss: -1.0,
          selection: 'under',
          professional_score: 65.0,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NBA' },
          clv_tracking: [{ clv_percentage: -1.5, clv_cents: -150 }],
        },
        {
          id: 'pick-3',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 90.0,
          user_id: 'user-2',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 3.0, clv_cents: 300 }],
        },
      ];

      // Mock Supabase response
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockPicks,
          error: null,
        }),
      });

      // Mock users query for capper breakdown
      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 'user-1', username: 'Griff843' },
                { id: 'user-2', username: 'MoneyReef' },
              ],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: mockPicks,
            error: null,
          }),
        };
      });

      const recapDate = new Date('2025-12-01');
      const recap = await service.computeDailyRecap(recapDate);

      // Assert basic metrics
      expect(recap.total_picks).toBe(3);
      expect(recap.wins).toBe(2);
      expect(recap.losses).toBe(1);
      expect(recap.pushes).toBe(0);
      expect(recap.pending).toBe(0);

      // Win rate = 2/3 = 0.6667
      expect(recap.win_rate).toBeCloseTo(0.6667, 4);

      // Total units = 0.91 - 1.0 + 0.91 = 0.82
      expect(recap.total_units).toBeCloseTo(0.82, 2);

      // ROI = 0.82 / 3.0 = 0.2733
      expect(recap.roi).toBeCloseTo(0.2733, 4);

      // Average CLV = (2.5 - 1.5 + 3.0) / 3 = 1.333% = 133.33 bps
      expect(recap.avg_clv_bps).toBeCloseTo(133, 0);
    });

    it('should calculate CLV distribution buckets correctly', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: -1.8, clv_cents: -180 }], // [-200,-100)
        },
        {
          id: 'pick-2',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: -0.8, clv_cents: -80 }], // [-100,-50)
        },
        {
          id: 'pick-3',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: -0.2, clv_cents: -20 }], // [-50,0)
        },
        {
          id: 'pick-4',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 0.3, clv_cents: 30 }], // [0,50)
        },
        {
          id: 'pick-5',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 0.7, clv_cents: 70 }], // [50,100)
        },
        {
          id: 'pick-6',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 1.5, clv_cents: 150 }], // [100,200)
        },
        {
          id: 'pick-7',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }], // [200,+)
        },
      ];

      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockPicks,
          error: null,
        }),
      });

      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: mockPicks,
            error: null,
          }),
        };
      });

      const recapDate = new Date('2025-12-01');
      const recap = await service.computeDailyRecap(recapDate);

      expect(recap.clv_distribution['[-200,-100)']).toBe(1);
      expect(recap.clv_distribution['[-100,-50)']).toBe(1);
      expect(recap.clv_distribution['[-50,0)']).toBe(1);
      expect(recap.clv_distribution['[0,50)']).toBe(1);
      expect(recap.clv_distribution['[50,100)']).toBe(1);
      expect(recap.clv_distribution['[100,200)']).toBe(1);
      expect(recap.clv_distribution['[200,+)']).toBe(1);
    });

    it('should calculate sport breakdown correctly', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.0, clv_cents: 200 }],
        },
        {
          id: 'pick-2',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.5,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 3.0, clv_cents: 300 }],
        },
        {
          id: 'pick-3',
          status: 'lost',
          stake: 1.0,
          profit_loss: -1.0,
          selection: 'under',
          professional_score: 65.0,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NBA' },
          clv_tracking: [{ clv_percentage: -1.0, clv_cents: -100 }],
        },
      ];

      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockPicks,
          error: null,
        }),
      });

      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: mockPicks,
            error: null,
          }),
        };
      });

      const recapDate = new Date('2025-12-01');
      const recap = await service.computeDailyRecap(recapDate);

      // NFL: 2 picks, 2 wins, 0 losses
      expect(recap.sport_breakdown.NFL.total_picks).toBe(2);
      expect(recap.sport_breakdown.NFL.wins).toBe(2);
      expect(recap.sport_breakdown.NFL.losses).toBe(0);
      expect(recap.sport_breakdown.NFL.win_rate).toBe(1.0);
      expect(recap.sport_breakdown.NFL.avg_clv_bps).toBeCloseTo(250, 0); // (200 + 300) / 2

      // NBA: 1 pick, 0 wins, 1 loss
      expect(recap.sport_breakdown.NBA.total_picks).toBe(1);
      expect(recap.sport_breakdown.NBA.wins).toBe(0);
      expect(recap.sport_breakdown.NBA.losses).toBe(1);
      expect(recap.sport_breakdown.NBA.win_rate).toBe(0.0);
      expect(recap.sport_breakdown.NBA.avg_clv_bps).toBeCloseTo(-100, 0);
    });

    it('should identify top picks by professional_score', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 95.0,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.5, clv_cents: 250 }],
        },
        {
          id: 'pick-2',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 85.0,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 2.0, clv_cents: 200 }],
        },
        {
          id: 'pick-3',
          status: 'won',
          stake: 1.0,
          profit_loss: 0.91,
          selection: 'over',
          professional_score: 90.0,
          user_id: 'user-1',
          created_at: new Date(),
          props: { sport: 'NFL' },
          clv_tracking: [{ clv_percentage: 3.0, clv_cents: 300 }],
        },
      ];

      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: mockPicks,
          error: null,
        }),
      });

      (supabaseClient.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({
              data: [{ id: 'user-1', username: 'Griff843' }],
              error: null,
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: mockPicks,
            error: null,
          }),
        };
      });

      const recapDate = new Date('2025-12-01');
      const recap = await service.computeDailyRecap(recapDate);

      // Top picks should be ordered by professional_score: pick-1 (95), pick-3 (90), pick-2 (85)
      expect(recap.top_picks[0]).toBe('pick-1');
      expect(recap.top_picks[1]).toBe('pick-3');
      expect(recap.top_picks[2]).toBe('pick-2');
    });

    it('should handle empty picks gracefully', async () => {
      (supabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      const recapDate = new Date('2025-12-01');
      const recap = await service.computeDailyRecap(recapDate);

      expect(recap.total_picks).toBe(0);
      expect(recap.wins).toBe(0);
      expect(recap.losses).toBe(0);
      expect(recap.win_rate).toBeNull();
      expect(recap.avg_clv_bps).toBeNull();
      expect(recap.total_units).toBeNull();
      expect(recap.roi).toBeNull();
    });
  });

  describe('saveDailyRecap', () => {
    it('should upsert recap to database', async () => {
      const mockUpsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      (supabaseClient.from as jest.Mock).mockReturnValue({
        upsert: mockUpsert,
      });

      const recap: DailyRecap = {
        recap_date: new Date('2025-12-01'),
        total_picks: 10,
        win_rate: 0.6,
        avg_clv_bps: 150,
        clv_distribution: {
          '[-200,-100)': 0,
          '[-100,-50)': 1,
          '[-50,0)': 2,
          '[0,50)': 3,
          '[50,100)': 2,
          '[100,200)': 1,
          '[200,+)': 1,
        },
        sport_breakdown: {
          NFL: {
            total_picks: 10,
            wins: 6,
            losses: 4,
            pushes: 0,
            win_rate: 0.6,
            avg_clv_bps: 150,
            total_units: 2.0,
          },
        },
        capper_breakdown: {},
        top_picks: ['pick-1', 'pick-2', 'pick-3'],
        total_units: 2.0,
        roi: 0.2,
        wins: 6,
        losses: 4,
        pushes: 0,
        pending: 0,
        metadata: {},
      };

      await service.saveDailyRecap(recap);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          recap_date: '2025-12-01',
          total_picks: 10,
          win_rate: 0.6,
          avg_clv_bps: 150,
        }),
        expect.objectContaining({
          onConflict: 'recap_date',
        })
      );
    });
  });

  describe('getYesterdayET', () => {
    it('should return yesterday in ET timezone', () => {
      const yesterday = service.getYesterdayET();

      expect(yesterday).toBeInstanceOf(Date);
      expect(yesterday.getHours()).toBe(0);
      expect(yesterday.getMinutes()).toBe(0);
      expect(yesterday.getSeconds()).toBe(0);
    });
  });
});
