/**
 * Discord Sender Channel Routing Regression Tests
 *
 * Ensures that explicit discord_channel_id from pick_publish table
 * takes priority over environment fallbacks like ALERTS_CHANNEL_ID
 *
 * Bug fixed: Channel routing was ignoring pick_publish.discord_channel_id
 * and always using env.alertsChannelId
 */

import { describe, it, expect, vi, beforeEach } from 'jest';

// Mock the logger before importing discord-sender
vi.mock('../../../src/shared/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock the env config
vi.mock('../../../src/config/env', () => ({
  env: {
    alertsChannelId: '1289720383767056405', // Alerts channel (should NOT be used when explicit ID provided)
    capperThreads: {},
  },
}));

describe('Discord Sender - Channel Routing Priority', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should use explicit discordChannelId when provided (CANARY channel)', async () => {
    // Arrange
    const CANARY_CHANNEL_ID = '1296531122234327100';
    const ALERTS_CHANNEL_ID = '1289720383767056405';

    // Mock Discord API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-message-id-123' }),
    });

    // Mock DISCORD_BOT_TOKEN
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token';

    // Import after mocks are set up
    const { sendEmbed } = await import('../../../src/publish/discord-sender');

    const testEmbed = {
      title: 'Test Pick',
      description: 'Test Description',
      color: 0x00ff00,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: 'Unit Talk' },
    };

    // Act
    const result = await sendEmbed(testEmbed, {
      discordChannelId: CANARY_CHANNEL_ID,
      dedupeKey: 'test-dedupe-key',
      tenantId: 'test-tenant',
      pickId: 'test-pick-id',
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('test-message-id-123');

    // Verify fetch was called with CANARY channel, NOT alerts channel
    expect(global.fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${CANARY_CHANNEL_ID}/messages`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bot test-bot-token',
          'Content-Type': 'application/json',
          'X-Idempotency-Key': 'test-dedupe-key',
        }),
      })
    );

    // Verify it was NOT called with alerts channel
    expect(global.fetch).not.toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${ALERTS_CHANNEL_ID}/messages`,
      expect.anything()
    );
  });

  it('should fallback to alerts channel when NO explicit discordChannelId provided', async () => {
    // Arrange
    const ALERTS_CHANNEL_ID = '1289720383767056405';

    // Mock Discord API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-message-id-456' }),
    });

    // Mock DISCORD_BOT_TOKEN
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token';

    // Import after mocks are set up
    const { sendEmbed } = await import('../../../src/publish/discord-sender');

    const testEmbed = {
      title: 'Test Alert',
      description: 'Test Description',
      color: 0xff0000,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: 'Unit Talk' },
    };

    // Act - NO discordChannelId provided
    const result = await sendEmbed(testEmbed, {
      dedupeKey: 'test-dedupe-key-2',
      tenantId: 'test-tenant',
      pickId: 'test-pick-id',
    });

    // Assert
    expect(result.success).toBe(true);

    // Verify fetch was called with alerts channel as fallback
    expect(global.fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${ALERTS_CHANNEL_ID}/messages`,
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('should NEVER override explicit discordChannelId with env.alertsChannelId', async () => {
    // Arrange
    const EXPLICIT_CHANNEL_ID = '9999999999999999999'; // Any explicit channel
    const ALERTS_CHANNEL_ID = '1289720383767056405';

    // Mock Discord API
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'test-message-id-789' }),
    });

    // Mock DISCORD_BOT_TOKEN
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token';

    // Import after mocks are set up
    const { sendEmbed } = await import('../../../src/publish/discord-sender');

    const testEmbed = {
      title: 'Test Pick',
      description: 'Test Description',
      color: 0x00ff00,
      fields: [],
      timestamp: new Date().toISOString(),
      footer: { text: 'Unit Talk' },
    };

    // Act
    const result = await sendEmbed(testEmbed, {
      discordChannelId: EXPLICIT_CHANNEL_ID, // Explicit channel provided
      dedupeKey: 'test-dedupe-key-3',
    });

    // Assert
    expect(result.success).toBe(true);

    // Verify explicit channel was used
    expect(global.fetch).toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${EXPLICIT_CHANNEL_ID}/messages`,
      expect.anything()
    );

    // CRITICAL: Verify alerts channel was NOT used (this is the bug we fixed)
    expect(global.fetch).not.toHaveBeenCalledWith(
      `https://discord.com/api/v10/channels/${ALERTS_CHANNEL_ID}/messages`,
      expect.anything()
    );

    // Additional verification: Check call count (should be exactly 1)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
