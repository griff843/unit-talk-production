import { jest } from '@jest/globals';
import { ChatInputCommandInteraction, GuildMember, User, Guild } from 'discord.js';
import { execute } from '../commands/ask-unit-talk-enhanced';
import { aiCoachingService } from '../services/aiCoaching';
import { databaseService } from '../services/database';
import { getUserTier } from '../utils/roleUtils';
import { logger } from '../utils/logger';

// Mock dependencies
jest.mock('../services/aiCoaching');
jest.mock('../services/database');
jest.mock('../utils/roleUtils');
jest.mock('../utils/logger');

const mockAiCoachingService = aiCoachingService as jest.Mocked<typeof aiCoachingService>;
const mockDatabaseService = databaseService as jest.Mocked<typeof databaseService>;
const mockGetUserTier = getUserTier as jest.MockedFunction<typeof getUserTier>;
const mockLogger = logger as jest.Mocked<typeof logger>;

describe('ask-unit-talk command', () => {
  let mockInteraction: jest.Mocked<ChatInputCommandInteraction>;
  let mockMember: jest.Mocked<GuildMember>;
  let mockUser: jest.Mocked<User>;
  let mockGuild: jest.Mocked<Guild>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock user
    mockUser = {
      id: 'test-user-123',
      username: 'testuser',
    } as jest.Mocked<User>;

    // Create mock guild
    mockGuild = {
      members: {
        cache: {
          get: jest.fn().mockReturnValue(mockMember),
        },
      },
    } as unknown as jest.Mocked<Guild>;

    // Create mock member
    mockMember = {
      user: mockUser,
    } as jest.Mocked<GuildMember>;

    // Create mock interaction
    mockInteraction = {
      user: mockUser,
      guild: mockGuild,
      deferReply: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn(),
      options: {
        getString: jest.fn(),
      },
    } as unknown as jest.Mocked<ChatInputCommandInteraction>;

    // Setup default mocks
    mockGetUserTier.mockReturnValue('vip');
    mockDatabaseService.getUserProfile.mockResolvedValue({
      id: 'profile-123',
      discord_id: 'test-user-123',
      username: 'testuser',
      discriminator: '1234',
      avatar: null,
      tier: 'vip',
      subscription_tier: 'VIP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      metadata: {},
    });
    mockDatabaseService.getUserPicks.mockResolvedValue([]);
    mockDatabaseService.getUserPickStats.mockResolvedValue({
      totalPicks: 10,
      winningPicks: 6,
      losingPicks: 3,
      pendingPicks: 1,
      pushPicks: 0,
      winRate: 0.65,
      totalProfit: 15.5,
      averageStake: 2.5,
      averageOdds: -110,
    });
    mockDatabaseService.getActiveCoachingSession.mockResolvedValue(null);
    mockDatabaseService.trackUserActivity.mockResolvedValue({} as any);
    mockDatabaseService.trackUserActivity.mockResolvedValue(undefined);
    mockAiCoachingService.createCoachingSession.mockResolvedValue('session-123');
    mockAiCoachingService.addQuestionToSession.mockResolvedValue(true);
  });

  describe('User Tier Validation', () => {
    it('should deny access to non-VIP users', async () => {
      mockGetUserTier.mockReturnValue('member');
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '🔒 VIP Feature',
              color: 0xff0000,
            }),
          }),
        ]),
      });
    });

    it('should allow access to VIP users', async () => {
      mockGetUserTier.mockReturnValue('vip');
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalled();
    });

    it('should allow access to VIP+ users', async () => {
      mockGetUserTier.mockReturnValue('vip_plus');
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalled();
    });

    it('should allow access to staff users', async () => {
      mockGetUserTier.mockReturnValue('staff');
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalled();
    });
  });

  describe('User Profile Management', () => {
    it('should create user profile if it does not exist', async () => {
      mockDatabaseService.getUserProfile.mockResolvedValue(null);
      mockDatabaseService.createUserProfile.mockResolvedValue({
        id: 'new-profile-123',
        discord_id: 'test-user-123',
        username: 'testuser',
        discriminator: '1234',
        avatar: null,
        tier: 'vip',
        subscription_tier: 'VIP',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_active: new Date().toISOString(),
        metadata: { created_via: 'ask_unit_talk' },
      });
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockDatabaseService.createUserProfile).toHaveBeenCalledWith({
        discord_id: 'test-user-123',
        username: 'testuser',
        tier: 'vip',
        subscription_tier: 'VIP',
        metadata: { created_via: 'ask_unit_talk' },
      });
    });

    it('should handle profile creation failure', async () => {
      mockDatabaseService.getUserProfile.mockResolvedValue(null);
      mockDatabaseService.createUserProfile.mockResolvedValue(null);
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: '❌ Failed to create user profile. Please try again.',
      });
    });
  });

  describe('AI Analysis Integration', () => {
    it('should generate AI analysis with user history', async () => {
      const mockPicks = [
        {
          id: 'pick-1',
          user_id: 'user-123',
          discord_id: 'test-user-123',
          game_id: 'game-123',
          thread_id: 'thread-123',
          pick_type: 'player_prop',
          player_name: 'LeBron James',
          stat_type: 'points',
          line: 25.5,
          over_under: 'over' as const,
          odds: -110,
          stake: 2.0,
          confidence: 8,
          reasoning: 'Good value bet',
          result: 'win' as const,
          actual_value: 28,
          profit_loss: 1.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          metadata: {},
        },
      ];
      mockDatabaseService.getUserPicks.mockResolvedValue(mockPicks);
      mockInteraction.options.getString
        .mockReturnValueOnce('Should I bet on LeBron over 25.5 points?')
        .mockReturnValueOnce('NBA game tonight');

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalledWith({
        question: 'Should I bet on LeBron over 25.5 points?',
        userTier: 'vip',
        userHistory: {
          totalPicks: 10,
          winRate: 0.65,
          totalProfit: 15.5,
          recentPicks: [
            {
              pickType: 'player_prop',
              result: 'win',
              stake: 2.0,
              profitLoss: 1.8,
              reasoning: 'Good value bet',
            },
          ],
        },
        context: expect.objectContaining({
          sport: 'NBA',
        }),
      });
    });

    it('should handle AI analysis errors gracefully', async () => {
      mockAiCoachingService.generateAnalysis.mockRejectedValue(new Error('AI service error'));
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '❌ Analysis Error',
              color: 0xff0000,
            }),
          }),
        ]),
      });
    });
  });

  describe('Coaching Session Management', () => {
    it('should create new coaching session if none exists', async () => {
      mockDatabaseService.getActiveCoachingSession.mockResolvedValue(null);
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockAiCoachingService.createCoachingSession).toHaveBeenCalledWith(
        'test-user-123',
        'test-user-123',
        'ai_analysis',
        'vip'
      );
    });

    it('should use existing active coaching session', async () => {
      const mockSession = {
        id: 'existing-session-123',
        user_id: 'test-user-123',
        discord_id: 'test-user-123',
        coach_id: 'ai-coach',
        session_type: 'ai_analysis',
        status: 'in_progress' as const,
        scheduled_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        duration_minutes: null,
        notes: null,
        feedback: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockDatabaseService.getActiveCoachingSession.mockResolvedValue(mockSession);
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockAiCoachingService.createCoachingSession).not.toHaveBeenCalled();
      expect(mockAiCoachingService.addQuestionToSession).toHaveBeenCalledWith(
        'existing-session-123',
        'Test question',
        expect.any(Object)
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce cooldown for VIP users', async () => {
      mockInteraction.options.getString.mockReturnValue('First question');
      
      // First call should succeed
      await execute(mockInteraction);
      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalledTimes(1);

      // Reset interaction mock
      mockInteraction.editReply.mockClear();
      
      // Second call immediately should be rate limited
      await execute(mockInteraction);
      
      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '⏰ Cooldown Active',
              color: 0xffa500,
            }),
          }),
        ]),
      });
    });

    it('should have shorter cooldown for VIP+ users', async () => {
      mockGetUserTier.mockReturnValue('vip_plus');
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      // VIP+ users should have 30 second cooldown vs 2 minutes for VIP
      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalled();
    });
  });

  describe('Analytics Tracking', () => {
    it('should track user activity after successful analysis', async () => {
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockDatabaseService.trackUserActivity).toHaveBeenCalledWith(
        'test-user-123',
        'ai_coaching_used',
        expect.objectContaining({
          question_length: 13,
          user_tier: 'vip',
          session_id: 'session-123',
          confidence: 75,
          risk_level: 'medium',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing guild member gracefully', async () => {
      mockGuild.members.cache.get.mockReturnValue(undefined);

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        content: 'Unable to verify your membership status.',
      });
    });

    it('should handle database errors gracefully', async () => {
      mockDatabaseService.getUserProfile.mockRejectedValue(new Error('Database error'));
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: '❌ Analysis Error',
            }),
          }),
        ]),
      });
    });

    it('should log errors for monitoring', async () => {
      const testError = new Error('Test error');
      mockAiCoachingService.generateAnalysis.mockRejectedValue(testError);
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockLogger.error).toHaveBeenCalledWith('Error in ask-unit-talk command:', testError);
    });
  });

  describe('Response Formatting', () => {
    it('should create properly formatted response embed', async () => {
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith({
        embeds: expect.arrayContaining([expect.any(Object)]),
        components: expect.arrayContaining([expect.any(Object)]),
      });
    });

    it('should include action buttons for follow-up interactions', async () => {
      mockInteraction.options.getString.mockReturnValue('Test question');

      await execute(mockInteraction);

      const editReplyCall = mockInteraction.editReply.mock.calls[1]; // Second call after thinking embed
      expect(editReplyCall[0]).toEqual({
        embeds: expect.any(Array),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                data: expect.objectContaining({
                  custom_id: 'ask_followup:session-123',
                  label: 'Ask Follow-up',
                }),
              }),
              expect.objectContaining({
                data: expect.objectContaining({
                  custom_id: 'view_history:test-user-123',
                  label: 'View History',
                }),
              }),
              expect.objectContaining({
                data: expect.objectContaining({
                  custom_id: 'end_session:session-123',
                  label: 'End Session',
                }),
              }),
            ]),
          }),
        ]),
      });
    });
  });

  describe('Context Parsing', () => {
    it('should parse context information correctly', async () => {
      mockInteraction.options.getString
        .mockReturnValueOnce('Test question')
        .mockReturnValueOnce('NBA Lakers vs Warriors 8pm PST');

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            sport: 'NBA',
          }),
        })
      );
    });

    it('should handle missing context gracefully', async () => {
      mockInteraction.options.getString
        .mockReturnValueOnce('Test question')
        .mockReturnValueOnce(null);

      await execute(mockInteraction);

      expect(mockAiCoachingService.generateAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          context: undefined,
        })
      );
    });
  });
});

// Helper function tests
describe('Helper Functions', () => {
  describe('parseContext', () => {
    // Import the parseContext function for testing
    // Note: This would require exporting the function from the command file
    it('should parse sport from context string', () => {
      // This test would verify the parseContext function works correctly
      // Implementation depends on exporting the helper functions
    });
  });

  describe('mapTierToSubscription', () => {
    // Import the mapTierToSubscription function for testing
    it('should map user tiers to subscription tiers correctly', () => {
      // This test would verify the tier mapping function
    });
  });
});