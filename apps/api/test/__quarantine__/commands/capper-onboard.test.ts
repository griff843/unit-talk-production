import { jest } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';

import { execute } from '../../src/commands/capper-onboard';
import { handleCapperInteraction } from '../../src/handlers/capperInteractionHandler';
import { createMockInteraction } from '../mocks/discord-mocks';

jest.mock('../../src/handlers/capperInteractionHandler', () => ({
  handleCapperInteraction: jest.fn(),
}));

describe('capper-onboard command', () => {
  let interaction: Partial<ChatInputCommandInteraction>;

  beforeEach(() => {
    interaction = createMockInteraction() as any;
    (handleCapperInteraction as jest.Mock).mockReset();
  });

  it('should delegate to capperInteractionHandler', async () => {
    await execute(interaction as ChatInputCommandInteraction);

    expect(handleCapperInteraction).toHaveBeenCalledWith(interaction);
  });

  it('should handle handler errors gracefully', async () => {
    (handleCapperInteraction as jest.Mock).mockImplementation(() => {
      throw new Error('Handler error');
    });

    await execute(interaction as ChatInputCommandInteraction);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('error occurred'),
        ephemeral: true,
      })
    );
  });
});
