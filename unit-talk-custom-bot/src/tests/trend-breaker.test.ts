// @ts-nocheck
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { ChatInputCommandInteraction, GuildMember, User } from 'discord.js';

// Mock dependencies BEFORE importing the command
jest.mock('../utils/roleUtils', () => ({
  getUserTier: jest.fn()
}));

jest.mock('../services/trendAnalysisService');

jest.mock('../services/database', () => ({
  DatabaseService: jest.fn().mockImplementation(() => ({
    // Mock database methods if needed
  }))
}));

// Now import the command and other dependencies
import { execute } from '../commands/trend-breaker';
import { TrendAnalysisService, TrendAnalysisSummary } from '../services/trendAnalysisService';
import { getUserTier } from '../utils/roleUtils';

const mockGetUserTier = getUserTier as jest.MockedFunction<(member: any) => string>;
const mockTrendService = {
  performTrendAnalysis: jest.fn(),
  getStreakAnalysis: jest.fn(),
  getTrendBreakAnalysis: jest.fn(),
  getOutlierAnalysis: jest.fn(),
  getRegressionAnalysis: jest.fn()
};

// Mock TrendAnalysisService constructor
(TrendAnalysisService as jest.MockedClass<typeof TrendAnalysisService>).mockImplementation(() => mockTrendService);

describe('trend-breaker command', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;
  let mockMember: Partial<GuildMember>;
  let mockUser: Partial<User>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock user and member with proper types
    mockUser = {
      id: 'test-user-id',
      username: 'testuser',
      discriminator: '1234',
      tag: 'testuser#1234'
    } as Partial<User>;

    mockMember = {
      id: 'test-user-id',
      user: mockUser as User,
      guild: {
        id: 'test-guild-id',
        name: 'Test Guild'
      } as Partial<any>
    } as Partial<GuildMember>;

    // Create mock interaction
    mockInteraction = {
      user: mockUser as User,
      member: mockMember as GuildMember,
      guild: {
        id: 'test-guild-id',
        name: 'Test Guild',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember)
        }
      } as any,
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      reply: jest.fn().mockResolvedValue(undefined),
      options: {
        getString: jest.fn(),
        getInteger: jest.fn(),
      } as any,
    } as unknown as Partial<ChatInputCommandInteraction>;
  });

  describe('access control', () => {
    it('should deny access to non-VIP users', async () => {
      mockGetUserTier.mockReturnValue('member');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        embeds: [
          expect.objectContaining({
            data: {
              title: '🔒 VIP+ Exclusive',
              description: "This command is for VIP+ members only. Type `/vip-info` to see what you're missing.",
              color: 0xff0000
            }
          })
        ],
        ephemeral: true
      });
    });

    it('should allow access to VIP users', async () => {
      mockGetUserTier.mockReturnValue('vip');
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(createMockAnalysis());

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).not.toHaveBeenCalledWith({
        content: '❌ This command is only available to VIP members and above.',
        ephemeral: true
      });
    });

    it('should allow access to staff users', async () => {
      mockGetUserTier.mockReturnValue('staff');
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(createMockAnalysis());

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).not.toHaveBeenCalledWith({
        content: '❌ This command is only available to VIP members and above.',
        ephemeral: true
      });
    });
  });

  describe('option parsing', () => {
    beforeEach(() => {
      mockGetUserTier.mockReturnValue('vip');
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(createMockAnalysis());
    });

    it('should use default values when no options provided', async () => {
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue(null);
      (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockTrendService.performTrendAnalysis).toHaveBeenCalledWith({
        days_back: 30,
        min_sample_size: 10,
        confidence_threshold: 0.7,
        sport_filter: undefined
      });
    });

    it('should use provided analysis type', async () => {
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'streaks';
          if (name === 'sport') return null;
          return null;
        });
      (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockTrendService.performTrendAnalysis).toHaveBeenCalled();
    });

    it('should use provided sport filter', async () => {
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return null;
          if (name === 'sport') return 'nba';
          return null;
        });
      (mockInteraction.options!.getInteger as jest.Mock).mockReturnValue(null);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockTrendService.performTrendAnalysis).toHaveBeenCalledWith({
        days_back: 30,
        min_sample_size: 10,
        confidence_threshold: 0.7,
        sport_filter: 'nba'
      });
    });

    it('should use provided days parameter', async () => {
      (mockInteraction.options!.getString as jest.Mock).mockReturnValue(null);
      (mockInteraction.options!.getInteger as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'days') return 14;
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockTrendService.performTrendAnalysis).toHaveBeenCalledWith({
        days_back: 14,
        min_sample_size: 10,
        confidence_threshold: 0.7,
        sport_filter: undefined
      });
    });
  });

  describe('analysis execution', () => {
    beforeEach(() => {
      mockGetUserTier.mockReturnValue('vip');
    });

    it('should defer reply for long-running analysis', async () => {
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(createMockAnalysis());

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
    });

    it('should perform trend analysis with correct parameters', async () => {
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(createMockAnalysis());
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'sport') return 'nfl';
          return null;
        });
      (mockInteraction.options!.getInteger as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'days') return 21;
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockTrendService.performTrendAnalysis).toHaveBeenCalledWith({
        days_back: 21,
        min_sample_size: 10,
        confidence_threshold: 0.7,
        sport_filter: 'nfl'
      });
    });

    it('should handle analysis with no results', async () => {
      const emptyAnalysis = createEmptyAnalysis();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(emptyAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '📊 **Trend Analysis Complete**\n\nNo significant trends found in the analyzed data. This could mean:\n• Not enough data for the specified time period\n• No statistically significant patterns detected\n• All performance metrics are within normal ranges\n\nTry adjusting the analysis parameters or time period.',
        ephemeral: false
      });
    });

    it('should create comprehensive embed by default', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('📊 Comprehensive Trend Analysis')
              })
            })
          ])
        })
      );
    });

    it('should create streaks embed when type is streaks', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'streaks';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('🔥 Active Streaks Analysis')
              })
            })
          ])
        })
      );
    });

    it('should create trend breaks embed when type is trend-breaks', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'trend-breaks';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('📈 Trend Break Analysis')
              })
            })
          ])
        })
      );
    });

    it('should create outliers embed when type is outliers', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'outliers';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('🎯 Statistical Outliers')
              })
            })
          ])
        })
      );
    });

    it('should create regression embed when type is regression', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'regression';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: expect.stringContaining('⚖️ Regression Analysis')
              })
            })
          ])
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      mockGetUserTier.mockReturnValue('vip');
    });

    it('should handle trend analysis service errors', async () => {
      mockTrendService.performTrendAnalysis = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ An error occurred while analyzing trends. Please try again later.',
        ephemeral: true
      });
    });

    it('should handle getUserTier errors', async () => {
      mockGetUserTier.mockImplementation(() => { throw new Error('Role check failed'); });

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Unable to verify your permissions. Please try again later.',
        ephemeral: true
      });
    });

    it('should handle missing guild member', async () => {
      mockInteraction.guild!.members.fetch = jest.fn().mockResolvedValue(null);
      mockGetUserTier.mockReturnValue('vip');

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Unable to verify your server membership. Please try again.',
        ephemeral: true
      });
    });
  });

  describe('embed validation', () => {
    beforeEach(() => {
      mockGetUserTier.mockReturnValue('vip');
    });

    it('should create valid embed structure for comprehensive analysis', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      expect(editReplyCall).toHaveProperty('embeds');
      expect(editReplyCall.embeds).toHaveLength(1);
      
      const embed = editReplyCall.embeds[0];
      expect(embed.data).toHaveProperty('title');
      expect(embed.data).toHaveProperty('description');
      expect(embed.data).toHaveProperty('fields');
      expect(embed.data).toHaveProperty('color');
      expect(embed.data).toHaveProperty('timestamp');
    });

    it('should include navigation components for comprehensive view', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      expect(editReplyCall).toHaveProperty('components');
      expect(editReplyCall.components).toHaveLength(1);
      
      const actionRow = editReplyCall.components[0];
      expect(actionRow.components).toBeDefined();
      expect(actionRow.components.length).toBeGreaterThan(0);
    });

    it('should not include navigation for specific analysis types', async () => {
      const mockAnalysis = createMockAnalysisWithData();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'streaks';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      expect(editReplyCall.components).toBeUndefined();
    });

    it('should format streak data correctly in embed fields', async () => {
      const mockAnalysis = createMockAnalysisWithStreaks();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'streaks';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      const embed = editReplyCall.embeds[0];
      
      expect(embed.data.fields).toBeDefined();
      expect(embed.data.fields.length).toBeGreaterThan(0);
      
      const streakField = embed.data.fields.find((field: any) => field.name.includes('🔥'));
      expect(streakField).toBeDefined();
      expect(streakField.value).toContain('LeBron James');
      expect(streakField.value).toContain('5 game');
    });

    it('should format trend break data correctly in embed fields', async () => {
      const mockAnalysis = createMockAnalysisWithTrendBreaks();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'trend-breaks';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      const embed = editReplyCall.embeds[0];
      
      expect(embed.data.fields).toBeDefined();
      expect(embed.data.fields.length).toBeGreaterThan(0);
      
      const trendField = embed.data.fields.find((field: any) => field.name.includes('📉'));
      expect(trendField).toBeDefined();
      expect(trendField.value).toContain('Stephen Curry');
      expect(trendField.value).toContain('25%');
    });

    it('should format outlier data correctly in embed fields', async () => {
      const mockAnalysis = createMockAnalysisWithOutliers();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'outliers';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      const embed = editReplyCall.embeds[0];
      
      expect(embed.data.fields).toBeDefined();
      expect(embed.data.fields.length).toBeGreaterThan(0);
      
      const outlierField = embed.data.fields.find((field: any) => field.name.includes('⬆️'));
      expect(outlierField).toBeDefined();
      expect(outlierField.value).toContain('Jayson Tatum');
      expect(outlierField.value).toContain('2.5');
    });

    it('should format regression data correctly in embed fields', async () => {
      const mockAnalysis = createMockAnalysisWithRegression();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(mockAnalysis);
      (mockInteraction.options!.getString as jest.Mock)
        .mockImplementation((name: string) => {
          if (name === 'type') return 'regression';
          return null;
        });

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      const embed = editReplyCall.embeds[0];
      
      expect(embed.data.fields).toBeDefined();
      expect(embed.data.fields.length).toBeGreaterThan(0);
      
      const regressionField = embed.data.fields.find((field: any) => field.name.includes('📈'));
      expect(regressionField).toBeDefined();
      expect(regressionField.value).toContain('Giannis');
      expect(regressionField.value).toContain('85%');
    });
  });

  describe('performance and limits', () => {
    beforeEach(() => {
      mockGetUserTier.mockReturnValue('vip');
    });

    it('should handle large datasets efficiently', async () => {
      const largeAnalysis = createLargeAnalysisDataset();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(largeAnalysis);

      const startTime = Date.now();
      await execute(mockInteraction as ChatInputCommandInteraction);
      const endTime = Date.now();

      // Should complete within reasonable time (5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
      expect(mockInteraction.editReply).toHaveBeenCalled();
    });

    it('should limit embed field count to Discord limits', async () => {
      const largeAnalysis = createLargeAnalysisDataset();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(largeAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      const editReplyCall = (mockInteraction.editReply as jest.Mock).mock.calls[0][0];
      const embed = editReplyCall.embeds[0];
      
      // Discord embed limit is 25 fields
      expect(embed.data.fields.length).toBeLessThanOrEqual(25);
    });

    it('should handle empty analysis gracefully', async () => {
      const emptyAnalysis = createEmptyAnalysis();
      mockTrendService.performTrendAnalysis = jest.fn().mockResolvedValue(emptyAnalysis);

      await execute(mockInteraction as ChatInputCommandInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('No significant trends found'),
        ephemeral: false
      });
    });
  });
});

// Helper functions to create mock data

function createMockAnalysis(): TrendAnalysisSummary {
  return {
    streaks: [],
    trend_breaks: [],
    statistical_outliers: [],
    regression_candidates: [],
    analysis_metadata: {
      total_picks_analyzed: 0,
      date_range: {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      confidence_threshold: 0.7,
      min_sample_size: 10
    }
  };
}

function createEmptyAnalysis() {
  return createMockAnalysis();
}

function createMockAnalysisWithData() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 150;
  
  base.streaks = [
    {
      player_name: 'LeBron James',
      stat_type: 'points',
      streak_type: 'win' as const,
      current_streak: 5,
      streak_probability: 0.03125,
      historical_win_rate: 0.65,
      games_analyzed: 20,
      confidence_score: 0.85
    }
  ];

  base.trend_breaks = [
    {
      player_name: 'Stephen Curry',
      stat_type: 'threes',
      line: 4.5,
      over_under: 'over' as const,
      historical_hit_rate: 0.65,
      recent_hit_rate: 0.4,
      deviation_percentage: 38.5,
      confidence_score: 0.78,
      sample_size: 25,
      trend_break_type: 'performance_decline' as const,
      reasoning: 'Recent performance significantly below historical average'
    }
  ];

  base.statistical_outliers = [
    {
      player_name: 'Jayson Tatum',
      stat_type: 'points',
      current_line: 32.5,
      historical_average: 27.2,
      standard_deviation: 2.1,
      z_score: 2.52,
      outlier_type: 'high' as const,
      confidence_score: 0.85,
      sample_size: 18
    }
  ];

  base.regression_candidates = [
    {
      player_name: 'Giannis Antetokounmpo',
      stat_type: 'rebounds',
      current_performance: 0.85,
      expected_regression: 0.62,
      regression_confidence: 0.73,
      over_performance_streak: 6,
      under_performance_streak: 0
    }
  ];

  return base;
}

function createMockAnalysisWithStreaks() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 100;
  
  base.streaks = [
    {
      player_name: 'LeBron James',
      stat_type: 'points',
      streak_type: 'win' as const,
      current_streak: 5,
      streak_probability: 0.03125,
      historical_win_rate: 0.65,
      games_analyzed: 20,
      confidence_score: 0.85
    },
    {
      player_name: 'Kevin Durant',
      stat_type: 'points',
      streak_type: 'loss' as const,
      current_streak: 4,
      streak_probability: 0.0625,
      historical_win_rate: 0.58,
      games_analyzed: 15,
      confidence_score: 0.72
    }
  ];

  return base;
}

function createMockAnalysisWithTrendBreaks() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 120;
  
  base.trend_breaks = [
    {
      player_name: 'Stephen Curry',
      stat_type: 'threes',
      line: 4.5,
      over_under: 'over' as const,
      historical_hit_rate: 0.65,
      recent_hit_rate: 0.25,
      deviation_percentage: 61.5,
      confidence_score: 0.88,
      sample_size: 30,
      trend_break_type: 'performance_decline' as const,
      reasoning: 'Significant decline in recent performance'
    },
    {
      player_name: 'Damian Lillard',
      stat_type: 'assists',
      line: 7.5,
      over_under: 'over' as const,
      historical_hit_rate: 0.55,
      recent_hit_rate: 0.85,
      deviation_percentage: 54.5,
      confidence_score: 0.82,
      sample_size: 25,
      trend_break_type: 'performance_surge' as const,
      reasoning: 'Significant improvement in recent performance'
    }
  ];

  return base;
}

function createMockAnalysisWithOutliers() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 80;
  
  base.statistical_outliers = [
    {
      player_name: 'Jayson Tatum',
      stat_type: 'points',
      current_line: 32.5,
      historical_average: 27.2,
      standard_deviation: 2.1,
      z_score: 2.52,
      outlier_type: 'high' as const,
      confidence_score: 0.85,
      sample_size: 18
    },
    {
      player_name: 'Russell Westbrook',
      stat_type: 'assists',
      current_line: 4.5,
      historical_average: 8.2,
      standard_deviation: 1.5,
      z_score: -2.47,
      outlier_type: 'low' as const,
      confidence_score: 0.82,
      sample_size: 12
    }
  ];

  return base;
}

function createMockAnalysisWithRegression() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 90;
  
  base.regression_candidates = [
    {
      player_name: 'Giannis Antetokounmpo',
      stat_type: 'rebounds',
      current_performance: 0.85,
      expected_regression: 0.62,
      regression_confidence: 0.73,
      over_performance_streak: 6,
      under_performance_streak: 0
    },
    {
      player_name: 'Joel Embiid',
      stat_type: 'points',
      current_performance: 0.35,
      expected_regression: 0.58,
      regression_confidence: 0.68,
      over_performance_streak: 0,
      under_performance_streak: 5
    }
  ];

  return base;
}

function createLargeAnalysisDataset() {
  const base = createMockAnalysis();
  base.analysis_metadata.total_picks_analyzed = 500;
  
  // Create large datasets for each category
  base.streaks = Array.from({ length: 15 }, (_, i) => ({
    player_name: `Player ${i + 1}`,
    stat_type: ['points', 'assists', 'rebounds'][i % 3] as 'points' | 'assists' | 'rebounds',
    streak_type: (i % 2 === 0 ? 'win' : 'loss') as 'win' | 'loss',
    current_streak: 3 + (i % 5),
    streak_probability: 0.1 - (i * 0.005),
    historical_win_rate: 0.5 + (i * 0.02),
    games_analyzed: 15 + i,
    confidence_score: 0.6 + (i * 0.02)
  }));

  base.trend_breaks = Array.from({ length: 12 }, (_, i) => ({
    player_name: `TrendPlayer ${i + 1}`,
    stat_type: ['points', 'assists', 'rebounds'][i % 3] as 'points' | 'assists' | 'rebounds',
    line: 15 + i,
    over_under: (i % 2 === 0 ? 'over' : 'under') as 'over' | 'under',
    historical_hit_rate: 0.6,
    recent_hit_rate: 0.3 + (i * 0.05),
    deviation_percentage: 20 + (i * 3),
    confidence_score: 0.65 + (i * 0.02),
    sample_size: 20 + i,
    trend_break_type: (i % 2 === 0 ? 'performance_decline' : 'performance_surge') as 'performance_decline' | 'performance_surge',
    reasoning: `Analysis for ${i % 2 === 0 ? 'decline' : 'surge'} in performance`
  }));

  base.statistical_outliers = Array.from({ length: 10 }, (_, i) => ({
    player_name: `OutlierPlayer ${i + 1}`,
    stat_type: ['points', 'assists', 'rebounds'][i % 3] as 'points' | 'assists' | 'rebounds',
    current_line: 25 + i,
    historical_average: 22 + i,
    standard_deviation: 2 + (i * 0.1),
    z_score: 2 + (i * 0.1),
    outlier_type: (i % 2 === 0 ? 'high' : 'low') as 'high' | 'low',
    confidence_score: 0.7 + (i * 0.02),
    sample_size: 12 + i
  }));

  base.regression_candidates = Array.from({ length: 8 }, (_, i) => ({
    player_name: `RegressionPlayer ${i + 1}`,
    stat_type: ['points', 'assists', 'rebounds'][i % 3] as 'points' | 'assists' | 'rebounds',
    current_performance: 0.4 + (i * 0.05),
    expected_regression: 0.6,
    regression_confidence: 0.65 + (i * 0.02),
    over_performance_streak: i % 2 === 0 ? 3 + i : 0,
    under_performance_streak: i % 2 === 1 ? 2 + i : 0
  }));

  return base;
}
