import { jest } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';

import { execute } from '../../src/commands/trend-breaker';
import { createTestDependencies, createTestConfig } from '../helpers/testHelpers';
import { createMockInteraction } from '../mocks/discord-mocks';
import { TrendAnalysis } from '../types/test-types';

describe('trend-breaker command', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    mockInteraction = createMockInteraction() as any;
    (mockInteraction.options?.getString as jest.Mock).mockReturnValue('nba');
    (mockInteraction.options?.getNumber as jest.Mock).mockReturnValue(5);
  });

  it('should identify trend breaks for VIP users', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock trend analysis results
    deps.trendService = {
      analyzeTrends: jest.fn().mockResolvedValue({
        trendBreaks: [
          {
            id: 'trend-1',
            player: 'LeBron James',
            stat: 'points',
            line: 25.5,
            confidence: 0.89,
            historicalData: {
              totalGames: 50,
              hitRate: 0.73,
            },
          },
        ],
      } as TrendAnalysis) as jest.Mock<Promise<TrendAnalysis>>,
    };

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Trend Break Analysis'),
          }),
        ]),
      })
    );
  });

  it('should handle no trend breaks found', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock empty trend results
    deps.trendService = {
      analyzeTrends: jest.fn().mockResolvedValue({
        trendBreaks: [],
      } as TrendAnalysis) as jest.Mock<Promise<TrendAnalysis>>,
    };

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No significant trend breaks'),
      })
    );
  });

  it('should handle invalid sport selection', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Set invalid sport
    (mockInteraction.options?.getString as jest.Mock).mockReturnValue('invalid');

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('valid sport'),
        ephemeral: true,
      })
    );
  });

  it('should handle service errors gracefully', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock service error
    deps.trendService = {
      analyzeTrends: jest.fn().mockRejectedValue(new Error('Service error')) as jest.Mock<
        Promise<TrendAnalysis>
      >,
    };

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('error'),
      })
    );
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it('should validate user permissions', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Remove VIP role
    mockInteraction.member!.roles.cache.clear();

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('VIP'),
        ephemeral: true,
      })
    );
  });
});
