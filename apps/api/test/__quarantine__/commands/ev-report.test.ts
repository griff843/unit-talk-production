import { jest } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';

import { execute } from '../../src/commands/ev-report';
import { createTestDependencies, createTestConfig } from '../helpers/testHelpers';
import { createMockInteraction } from '../mocks/discord-mocks';
import { EVReport } from '../types/test-types';

describe('ev-report command', () => {
  let mockInteraction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    mockInteraction = createMockInteraction() as any;
    (mockInteraction.options?.getString as jest.Mock).mockReturnValue('daily');
    (mockInteraction.options?.getNumber as jest.Mock).mockReturnValue(null);
  });

  it('should generate daily EV report for VIP users', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock EV calculation results
    deps.evService = {
      calculateDailyEV: jest.fn().mockResolvedValue({
        totalEV: 150.5,
        picks: [
          {
            id: 'pick-1',
            ev: 75.25,
            confidence: 0.85,
            details: 'LeBron James Over 25.5 points',
          },
          {
            id: 'pick-2',
            ev: 75.25,
            confidence: 0.82,
            details: 'Stephen Curry Over 5.5 3PM',
          },
        ],
      } as EVReport) as jest.Mock<Promise<EVReport>>,
    };

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.deferReply).toHaveBeenCalled();
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Daily EV Report'),
          }),
        ]),
      })
    );
  });

  it('should handle no available picks', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock empty EV results
    deps.evService = {
      calculateDailyEV: jest.fn().mockResolvedValue({
        totalEV: 0,
        picks: [],
      } as EVReport) as jest.Mock<Promise<EVReport>>,
    };

    await execute(mockInteraction as ChatInputCommandInteraction, deps, config);

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No picks available'),
      })
    );
  });

  it('should handle service errors gracefully', async () => {
    const deps = createTestDependencies();
    const config = createTestConfig();

    // Mock service error
    deps.evService = {
      calculateDailyEV: jest.fn().mockRejectedValue(new Error('Service error')) as jest.Mock<
        Promise<EVReport>
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
