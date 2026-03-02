import { jest } from '@jest/globals';
import { CommandInteraction, GuildMember } from 'discord.js';

import { execute } from '../../src/commands/capper-stats';
import { capperService } from '../../src/services/capperService';
import { createMockDiscordInteraction } from '../mocks/discord-mocks';

// Mock capperService
jest.mock('../../src/services/capperService', () => ({
  capperService: {
    getCapperByDiscordId: jest.fn(),
    getCapperStats: jest.fn(),
  },
}));

describe('capper-stats command', () => {
  let interaction: CommandInteraction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock interaction
    interaction = createMockDiscordInteraction() as unknown as CommandInteraction;

    // Mock member with role
    (interaction.member as GuildMember).roles = {
      cache: new Map([['ut-capper', { name: 'UT Capper' }]]),
    };

    // Mock user data
    interaction.user = {
      id: 'test-user-123',
      username: 'TestUser',
    };

    // Mock capper service responses
    (capperService.getCapperByDiscordId as jest.Mock).mockResolvedValue({
      id: 'capper-123',
      discord_id: 'test-user-123',
      discord_username: 'TestUser',
      display_name: 'Pro Capper',
      tier: 'expert',
      specialties: ['NBA', 'MLB'],
      bio: 'Professional sports analyst',
    });

    (capperService.getCapperStats as jest.Mock).mockResolvedValue({
      total_picks: 100,
      win_rate: 0.65,
      wins: 65,
      losses: 30,
      pushes: 5,
      roi: 0.15,
      profit_loss: 25.5,
      current_streak: 3,
    });
  });

  it('should reject users without UT Capper role', async () => {
    // Remove role
    (interaction.member as GuildMember).roles.cache.clear();

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('need the **UT Capper** role'),
      ephemeral: true,
    });
  });

  it('should reject users without capper profile', async () => {
    (capperService.getCapperByDiscordId as jest.Mock).mockResolvedValue(null);

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('complete capper onboarding'),
      ephemeral: true,
    });
  });

  it('should display capper stats with all fields', async () => {
    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          title: expect.stringContaining("Pro Capper's Stats"),
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Tier',
              value: 'EXPERT',
            }),
            expect.objectContaining({
              name: 'Total Picks',
              value: '100',
            }),
            expect.objectContaining({
              name: 'Win Rate',
              value: '65.0%',
            }),
            expect.objectContaining({
              name: 'Wins',
              value: '65',
            }),
            expect.objectContaining({
              name: 'Losses',
              value: '30',
            }),
            expect.objectContaining({
              name: 'Pushes',
              value: '5',
            }),
            expect.objectContaining({
              name: 'ROI',
              value: '15.0%',
            }),
            expect.objectContaining({
              name: 'Profit/Loss',
              value: '+25.50 units',
            }),
            expect.objectContaining({
              name: 'Current Streak',
              value: '3',
            }),
            expect.objectContaining({
              name: 'Specialties',
              value: 'NBA, MLB',
            }),
          ]),
          description: 'Professional sports analyst',
        }),
      ],
      ephemeral: true,
    });
  });

  it('should display stats without optional fields', async () => {
    (capperService.getCapperByDiscordId as jest.Mock).mockResolvedValue({
      id: 'capper-123',
      discord_id: 'test-user-123',
      discord_username: 'TestUser',
      tier: 'rookie',
    });

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          title: expect.stringContaining("TestUser's Stats"),
          fields: expect.not.arrayContaining([
            expect.objectContaining({
              name: 'Specialties',
            }),
          ]),
          description: undefined,
        }),
      ],
      ephemeral: true,
    });
  });

  it('should handle negative profit/loss', async () => {
    (capperService.getCapperStats as jest.Mock).mockResolvedValue({
      total_picks: 100,
      win_rate: 0.45,
      wins: 45,
      losses: 50,
      pushes: 5,
      roi: -0.1,
      profit_loss: -15.5,
      current_streak: -2,
    });

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Profit/Loss',
              value: '-15.50 units',
            }),
          ]),
        }),
      ],
      ephemeral: true,
    });
  });

  it('should handle errors gracefully', async () => {
    (capperService.getCapperStats as jest.Mock).mockRejectedValue(new Error('Test error'));

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('error occurred'),
      ephemeral: true,
    });
  });
});
