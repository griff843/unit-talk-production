import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ChatInputCommandInteraction, User } from 'discord.js';
import { execute } from '../commands/ev-report';
import { DatabaseService } from '../services/database';
import { EVService } from '../services/evService';

// Mock the services
jest.mock('../services/database');
jest.mock('../services/evService');

describe('EV Report Command', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockEVService: jest.Mocked<EVService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();


    // Mock interaction
    mockInteraction = {
      options: {
        getString: jest.fn(),
        getUser: jest.fn(),
        getInteger: jest.fn()
      } as any,
      member: null, // Set to null to avoid type issues
      reply: jest.fn(),
      editReply: jest.fn(),
      followUp: jest.fn(),
      deferReply: jest.fn(),
      user: {
        id: 'test-user-id'
      } as Partial<User>
    } as unknown as Partial<ChatInputCommandInteraction>;

    // Mock database service
    mockDatabaseService = {
      getUserProfile: jest.fn(),
      getEVAnalysis: jest.fn(),
      getUserEVStats: jest.fn(),
      getEVSummary: jest.fn(),
      trackUserActivity: jest.fn()
    } as any;

    // Mock EV service
    mockEVService = {
      generateEVReport: jest.fn(),
      getTopEVPicks: jest.fn(),
      getUserEVStats: jest.fn(),
      getEVSummary: jest.fn()
    } as any;

    // Setup default mocks
    mockDatabaseService.getUserProfile.mockResolvedValue({
      id: 'test-user-id',
      discord_id: 'test-user-id',
      username: 'testuser',
      discriminator: '1234',
      avatar: null,
      tier: 'vip',
      subscription_tier: 'VIP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      metadata: {}
    });

  });

  describe('Access Control', () => {
    it('should deny access to non-VIP users', async () => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'member',
        subscription_tier: 'FREE',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ This command is only available to VIP+ members.',
        ephemeral: true
      });
    });

    it('should allow access to VIP users', async () => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip',
        subscription_tier: 'VIP',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });

      mockEVService.getTopEVPicks.mockResolvedValue([]);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('today');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip',
        subscription_tier: 'VIP',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });
    });

    it('should generate today EV report', async () => {
      const mockPicks = [
        {
          pickId: 'pick-1',
          playerName: 'Test Player',
          statType: 'points',
          line: 25.5,
          overUnder: 'over' as const,
          odds: -110,
          impliedProbability: 0.524,
          trueProbability: 0.6,
          expectedValue: 9.09,
          evPercentage: 14.5,
          stake: 100,
          expectedProfit: 9.09,
          sport: 'NFL',
          confidence: 75,
          createdAt: '2024-01-01T12:00:00Z',
          discordId: 'test-user-id',
          username: 'testuser'
        }
      ];

      mockEVService.getTopEVPicks.mockResolvedValue(mockPicks);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('today');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getTopEVPicks).toHaveBeenCalledWith({
        timeRange: 'today',
        limit: 10,
        minEV: undefined
      });
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should generate weekly EV report', async () => {
      const mockAnalysis = [
        {
          pickId: 'pick-1',
          playerName: 'Test Player',
          statType: 'points',
          line: 25.5,
          overUnder: 'over' as const,
          odds: -110,
          impliedProbability: 0.524,
          trueProbability: 0.6,
          expectedValue: 9.09,
          evPercentage: 14.5,
          stake: 100,
          expectedProfit: 9.09,
          sport: 'NFL',
          confidence: 75,
          createdAt: '2024-01-01T12:00:00Z',
          discordId: 'test-user-id',
          username: 'testuser'
        }
      ];

      mockEVService.getEVAnalysis.mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('weekly');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getEVAnalysis).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should generate monthly EV report', async () => {
      const mockAnalysis = [
        {
          pickId: 'pick-1',
          playerName: 'Test Player',
          statType: 'points',
          line: 25.5,
          overUnder: 'over' as const,
          odds: -110,
          impliedProbability: 0.524,
          trueProbability: 0.6,
          expectedValue: 9.09,
          evPercentage: 14.5,
          stake: 100,
          expectedProfit: 9.09,
          sport: 'NFL',
          confidence: 75,
          createdAt: '2024-01-01T12:00:00Z',
          discordId: 'test-user-id',
          username: 'testuser'
        }
      ];

      mockEVService.getEVAnalysis.mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('monthly');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getEVAnalysis).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should generate user leaderboard', async () => {
      const mockLeaderboard = [
        {
          discordId: 'user-1',
          username: 'User1',
          totalPicks: 25,
          positiveEVPicks: 17,
          averageEV: 6.02,
          totalExpectedProfit: 150.5,
          winRate: 0.68,
          actualProfit: 125.0,
          roi: 0.15
        }
      ];

      mockEVService.getUserEVLeaderboard.mockResolvedValue(mockLeaderboard);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('leaderboard');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getUserEVLeaderboard).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should generate sport breakdown', async () => {
      const mockSummary = {
        totalPicks: 100,
        positiveEVPicks: 65,
        negativeEVPicks: 35,
        averageEV: 2.51,
        totalExpectedProfit: 250.5,
        bestEVPick: null,
        worstEVPick: null,
        evByUser: {},
        evBySport: {
          'NFL': {
            sport: 'NFL',
            totalPicks: 50,
            averageEV: 3.0,
            totalExpectedProfit: 150.0,
            bestEVPick: null
          }
        },
        evByTimeRange: []
      };

      mockEVService.getEVSummary.mockResolvedValue(mockSummary);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('sports');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getEVSummary).toHaveBeenCalled();
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should generate user-specific analysis', async () => {
      const mockUser = { id: 'target-user-id' } as User;
      const mockAnalysis = [
        {
          pickId: 'pick-1',
          playerName: 'Test Player',
          statType: 'points',
          line: 25.5,
          overUnder: 'over' as const,
          odds: -110,
          impliedProbability: 0.524,
          trueProbability: 0.6,
          expectedValue: 9.09,
          evPercentage: 14.5,
          stake: 100,
          expectedProfit: 9.09,
          sport: 'NFL',
          confidence: 75,
          createdAt: '2024-01-01T12:00:00Z',
          discordId: 'test-user-id',
          username: 'testuser'
        }
      ];

      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('user');
      (mockInteraction.options!.getUser as jest.Mock).mockReturnValue(mockUser);
      mockEVService.getEVAnalysis.mockResolvedValue(mockAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getEVAnalysis).toHaveBeenCalledWith({
        discordId: 'target-user-id',
        startDate: expect.any(String),
        limit: 50
      });
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });
  });

  describe('VIP+ Features', () => {
    beforeEach(() => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip_plus',
        subscription_tier: 'VIP_PLUS',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });
    });

    it('should show navigation buttons for VIP+ users', async () => {
      mockEVService.getTopEVPicks.mockResolvedValue([]);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('today');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          components: expect.any(Array)
        })
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip',
        subscription_tier: 'VIP',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockEVService.getTopEVPicks.mockRejectedValue(error);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('today');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '❌ Error'
              })
            })
          ])
        })
      );
    });
  });

  describe('Filtering Options', () => {
    beforeEach(() => {
      mockDatabaseService.getUserProfile.mockResolvedValue({
        id: 'user-1',
        discord_id: 'test-user-id',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip',
        subscription_tier: 'VIP',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        last_active: '2024-01-01T00:00:00Z',
        metadata: {}
      });
    });

    it('should apply sport filter', async () => {
      mockEVService.getTopEVPicks.mockResolvedValue([]);
      (mockInteraction.options!.getString as jest.Mock)
        .mockReturnValueOnce('today')
        .mockReturnValueOnce('NFL');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getTopEVPicks).toHaveBeenCalledWith({
        timeRange: 'today',
        limit: 10,
        minEV: undefined
      });
    });

    it('should apply minimum EV filter', async () => {
      mockEVService.getTopEVPicks.mockResolvedValue([]);
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue('today');
      (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(5);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockEVService.getTopEVPicks).toHaveBeenCalledWith({
        timeRange: 'today',
        limit: 10,
        minEV: 5
      });
    });
  });
  });