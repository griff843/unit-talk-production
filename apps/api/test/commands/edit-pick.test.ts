import { jest } from '@jest/globals';
import { CommandInteraction, GuildMember } from 'discord.js';

import { execute } from '../../src/commands/edit-pick';
import { capperService } from '../../src/services/capperService';
import { createMockDiscordInteraction } from '../mocks/discord-mocks';

// Mock capperService
jest.mock('../../src/services/capperService', () => ({
  capperService: {
    getCapperByDiscordId: jest.fn(),
    getCapperPicks: jest.fn()
  }
}));

describe('edit-pick command', () => {
  let interaction: CommandInteraction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock interaction
    interaction = createMockDiscordInteraction() as unknown as CommandInteraction;

    // Mock member with role
    (interaction.member as GuildMember).roles = {
      cache: new Map([['ut-capper', { name: 'UT Capper' }]])
    };

    // Mock user data
    interaction.user = {
      id: 'test-user-123',
      username: 'TestUser'
    };

    // Mock capper service responses
    (capperService.getCapperByDiscordId as jest.Mock).mockResolvedValue({
      id: 'capper-123',
      discord_id: 'test-user-123',
      username: 'TestUser'
    });
  });

  it('should reject users without UT Capper role', async () => {
    // Remove role
    (interaction.member as GuildMember).roles.cache.clear();

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('need the **UT Capper** role'),
      ephemeral: true
    });
  });

  it('should reject users without capper profile', async () => {
    (capperService.getCapperByDiscordId as jest.Mock).mockResolvedValue(null);

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('complete capper onboarding'),
      ephemeral: true
    });
  });

  it('should handle no pending picks', async () => {
    (capperService.getCapperPicks as jest.Mock).mockResolvedValue([]);

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('no pending picks'),
      ephemeral: true
    });
  });

  it('should show list of pending picks', async () => {
    const mockPicks = [
      {
        id: 'pick-1',
        pick_type: 'single',
        total_units: 2,
        legs: [{
          selection: 'Lakers -5.5',
          odds: -110
        }]
      },
      {
        id: 'pick-2',
        pick_type: 'parlay',
        total_units: 1,
        legs: [
          {
            selection: 'Warriors ML',
            odds: +150
          },
          {
            selection: 'Over 220.5',
            odds: -105
          }
        ]
      }
    ];

    (capperService.getCapperPicks as jest.Mock).mockResolvedValue(mockPicks);

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      embeds: [
        expect.objectContaining({
          title: '📝 Your Pending Picks',
          fields: expect.arrayContaining([
            expect.objectContaining({
              name: 'Pick 1 - SINGLE',
              value: expect.stringContaining('Lakers -5.5 (-110)')
            }),
            expect.objectContaining({
              name: 'Pick 2 - PARLAY',
              value: expect.stringContaining('Warriors ML (+150)')
            })
          ])
        })
      ],
      ephemeral: true
    });
  });

  it('should handle errors gracefully', async () => {
    (capperService.getCapperPicks as jest.Mock).mockRejectedValue(new Error('Test error'));

    await execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('error occurred'),
      ephemeral: true
    });
  });
}); 