import { jest } from '@jest/globals';
import {
  CommandInteraction,
  GuildMember,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
} from 'discord.js';

import {
  execute,
  handlePickTypeSelect,
  handleSinglePickModal,
  handleParlayPickModal,
  handlePickConfirmation,
} from '../../src/commands/submit-pick';
import { capperService } from '../../src/services/capperService';
import { createMockDiscordInteraction } from '../mocks/discord-mocks';
import { createMockSupabaseClient } from '../mocks/supabase-mock';

// Mock capperService
jest.mock('../../src/services/capperService', () => ({
  capperService: {
    getCapperByDiscordId: jest.fn(),
    getCapperPicks: jest.fn(),
    createDailyPick: jest.fn(),
  },
}));

describe('submit-pick command', () => {
  let interaction: CommandInteraction;
  let selectInteraction: StringSelectMenuInteraction;
  let modalInteraction: ModalSubmitInteraction;
  let buttonInteraction: ButtonInteraction;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock interactions
    interaction = createMockDiscordInteraction() as unknown as CommandInteraction;
    selectInteraction = createMockDiscordInteraction() as unknown as StringSelectMenuInteraction;
    modalInteraction = createMockDiscordInteraction() as unknown as ModalSubmitInteraction;
    buttonInteraction = createMockDiscordInteraction() as unknown as ButtonInteraction;

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
      username: 'TestUser',
    });
    (capperService.getCapperPicks as jest.Mock).mockResolvedValue([]);
    (capperService.createDailyPick as jest.Mock).mockResolvedValue({
      id: 'pick-123',
      status: 'pending',
    });
  });

  describe('execute', () => {
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

    it('should reject users who already have 3 picks today', async () => {
      (capperService.getCapperPicks as jest.Mock).mockResolvedValue([{}, {}, {}]);

      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('only submit up to 3 picks per day'),
        ephemeral: true,
      });
    });

    it('should show pick type selection menu', async () => {
      await execute(interaction);

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Choose the type of pick'),
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                customId: 'pick_type_select',
              }),
            ]),
          }),
        ]),
        ephemeral: true,
      });
    });
  });

  describe('handlePickTypeSelect', () => {
    beforeEach(() => {
      selectInteraction.values = ['single'];
    });

    it('should show single pick form when single is selected', async () => {
      await handlePickTypeSelect(selectInteraction);

      expect(selectInteraction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          customId: 'single_pick_modal',
        })
      );
    });

    it('should show parlay form when parlay is selected', async () => {
      selectInteraction.values = ['parlay'];

      await handlePickTypeSelect(selectInteraction);

      expect(selectInteraction.showModal).toHaveBeenCalledWith(
        expect.objectContaining({
          customId: 'parlay_pick_modal',
        })
      );
    });
  });

  describe('handleSinglePickModal', () => {
    beforeEach(() => {
      modalInteraction.fields = {
        getTextInputValue: jest.fn().mockImplementation(field => {
          const values = {
            game: 'Lakers vs Warriors',
            bet_type: 'Spread',
            selection: 'Lakers -5.5',
            odds: '-110',
            units: '2',
            analysis: 'Test analysis',
          };
          return values[field];
        }),
      };
    });

    it('should validate units input', async () => {
      modalInteraction.fields.getTextInputValue = jest
        .fn()
        .mockImplementation(field => (field === 'units' ? 'invalid' : ''));

      await handleSinglePickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Units must be a number'),
        ephemeral: true,
      });
    });

    it('should validate odds input', async () => {
      modalInteraction.fields.getTextInputValue = jest
        .fn()
        .mockImplementation(field => (field === 'odds' ? 'invalid' : ''));

      await handleSinglePickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Invalid odds format'),
        ephemeral: true,
      });
    });

    it('should show pick preview with valid input', async () => {
      await handleSinglePickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Review your pick'),
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '📝 Pick Preview',
            }),
          ]),
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({ customId: 'confirm_pick' }),
                expect.objectContaining({ customId: 'cancel_pick' }),
              ]),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });

  describe('handleParlayPickModal', () => {
    beforeEach(() => {
      modalInteraction.fields = {
        getTextInputValue: jest.fn().mockImplementation(field => {
          const values = {
            leg1: 'Lakers vs Warriors | Spread | Lakers -5.5 | -110',
            leg2: 'Celtics vs Heat | Total | Over 220.5 | +100',
            leg3: '',
            units: '2',
            analysis: 'Test parlay analysis',
          };
          return values[field];
        }),
      };
    });

    it('should validate units input', async () => {
      modalInteraction.fields.getTextInputValue = jest
        .fn()
        .mockImplementation(field => (field === 'units' ? 'invalid' : ''));

      await handleParlayPickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Units must be a number'),
        ephemeral: true,
      });
    });

    it('should validate leg format', async () => {
      modalInteraction.fields.getTextInputValue = jest
        .fn()
        .mockImplementation(field => (field === 'leg1' ? 'invalid format' : ''));

      await handleParlayPickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Leg 1 format invalid'),
        ephemeral: true,
      });
    });

    it('should show pick preview with valid input', async () => {
      await handleParlayPickModal(modalInteraction);

      expect(modalInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Review your pick'),
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '📝 Pick Preview',
            }),
          ]),
          components: expect.arrayContaining([
            expect.objectContaining({
              components: expect.arrayContaining([
                expect.objectContaining({ customId: 'confirm_pick' }),
                expect.objectContaining({ customId: 'cancel_pick' }),
              ]),
            }),
          ]),
          ephemeral: true,
        })
      );
    });
  });

  describe('handlePickConfirmation', () => {
    beforeEach(() => {
      buttonInteraction.customId = 'confirm_pick';
      buttonInteraction.user = {
        id: 'test-user-123',
        username: 'TestUser',
      };

      // Mock temp data
      const pickData = {
        capper_id: 'capper-123',
        pick_type: 'single',
        total_units: 2,
        legs: [
          {
            game: 'Lakers vs Warriors',
            bet_type: 'Spread',
            selection: 'Lakers -5.5',
            odds: -110,
          },
        ],
      };
      (global as any).tempPickData = new Map([['test-user-123', { pickData }]]);
    });

    it('should handle pick cancellation', async () => {
      buttonInteraction.customId = 'cancel_pick';

      await handlePickConfirmation(buttonInteraction);

      expect(buttonInteraction.update).toHaveBeenCalledWith({
        content: expect.stringContaining('cancelled'),
        embeds: [],
        components: [],
      });
    });

    it('should submit pick and show success message', async () => {
      await handlePickConfirmation(buttonInteraction);

      expect(capperService.createDailyPick).toHaveBeenCalled();
      expect(buttonInteraction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              title: '✅ Pick Submitted Successfully!',
            }),
          ]),
          components: [],
        })
      );
    });

    it('should handle missing pick data', async () => {
      (global as any).tempPickData = new Map();

      await handlePickConfirmation(buttonInteraction);

      expect(buttonInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Pick data not found'),
        ephemeral: true,
      });
    });
  });
});
