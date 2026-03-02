import { jest } from '@jest/globals';
import { ChatInputCommandInteraction } from 'discord.js';

import { handleAskUnitTalk } from '../../src/commands/ask-unit-talk';
import { AIService } from '../../src/services/llmService';
import { createMockInteraction } from '../mocks/discord-mocks';

jest.mock('../../src/services/aiService');

describe('handleAskUnitTalk', () => {
  let interaction: Partial<ChatInputCommandInteraction>;
  let aiService: jest.Mocked<AIService>;

  beforeEach(() => {
    interaction = createMockInteraction() as any;
    aiService = {
      generateAnalysis: jest.fn(),
    } as unknown as jest.Mocked<AIService>;
  });

  it('should handle successful analysis', async () => {
    const mockResponse = {
      content: [{ text: 'Test analysis' }],
      metadata: {
        model: 'test-model',
        tokens: 100,
        latency: 500,
      },
    };

    aiService.generateAnalysis.mockResolvedValue(mockResponse);

    await handleAskUnitTalk(interaction as ChatInputCommandInteraction, aiService);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Analysis'),
            description: 'Test analysis',
          }),
        ]),
      })
    );
  });

  it('should handle AI service error', async () => {
    aiService.generateAnalysis.mockRejectedValue(new Error('AI service error'));

    await handleAskUnitTalk(interaction as ChatInputCommandInteraction, aiService);

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Error'),
        ephemeral: true,
      })
    );
  });
});
