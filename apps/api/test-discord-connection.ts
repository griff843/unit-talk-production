#!/usr/bin/env tsx
import 'dotenv/config';
import { sendDiscordAlert } from './src/agents/AlertAgent/integrations/discord';
import { EmbedBuilder } from 'discord.js';
import { createLogger } from './src/utils/logger';

const logger = createLogger('discord-connection-test');

/**
 * Test Discord connection and webhook functionality
 *
 * This script tests:
 * 1. Environment variable configuration
 * 2. Discord webhook connectivity
 * 3. Message sending capability
 * 4. Embed formatting
 */
async function testDiscordConnection(): Promise<void> {
  try {
    logger.info('🔗 Testing Discord connection...');

    // Check environment variables
    const webhookUrl = process.env.DISCORD_ALERT_WEBHOOK;
    const guildId = process.env.DISCORD_GUILD_ID;
    const publishToDiscord = process.env.PUBLISH_TO_DISCORD;

    logger.info('📋 Discord Configuration:', {
      hasWebhookUrl: !!webhookUrl,
      webhookUrlLength: webhookUrl?.length || 0,
      guildId,
      publishToDiscord,
      webhookDomain: webhookUrl ? new URL(webhookUrl).hostname : 'undefined'
    });

    if (!webhookUrl) {
      throw new Error('DISCORD_ALERT_WEBHOOK environment variable is not set');
    }

    if (publishToDiscord !== 'true') {
      logger.warn('⚠️ PUBLISH_TO_DISCORD is not set to "true", Discord messages may not be sent');
    }

    // Create test embed
    const testEmbed = new EmbedBuilder()
      .setTitle('🧪 Discord Connection Test')
      .setDescription('Testing BridgeWorker Discord integration')
      .setColor(0x00FF00) // Green color
      .addFields([
        { name: '🔧 Test Type', value: 'Connection Verification', inline: true },
        { name: '⏰ Timestamp', value: new Date().toISOString(), inline: true },
        { name: '🚀 System', value: 'Unit Talk BridgeWorker', inline: true },
      ])
      .addFields([
        {
          name: '📊 Test Details',
          value: 'Verifying Discord webhook connectivity before starting BridgeWorker',
          inline: false
        }
      ])
      .setTimestamp()
      .setFooter({ text: 'Unit Talk Platform - Discord Test' });

    // Test sending the message
    logger.info('📤 Sending test message to Discord...');
    await sendDiscordAlert(testEmbed);

    logger.info('✅ Discord connection test successful!');
    logger.info('🎯 Discord integration is ready for BridgeWorker');

    // Test another message format
    const successEmbed = new EmbedBuilder()
      .setTitle('✅ Discord Test Completed')
      .setDescription('BridgeWorker Discord integration verified')
      .setColor(0x28a745) // Success green
      .addFields([
        { name: '🔗 Connection', value: 'Successful', inline: true },
        { name: '📡 Webhook', value: 'Functional', inline: true },
        { name: '🚀 Status', value: 'Ready for Production', inline: true },
      ])
      .setTimestamp();

    logger.info('📤 Sending success confirmation message...');
    await sendDiscordAlert(successEmbed);

    logger.info('🎉 All Discord tests passed! BridgeWorker can now post to Discord.');

  } catch (error) {
    logger.error('❌ Discord connection test failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Try to send error message to Discord if possible
    try {
      const errorEmbed = new EmbedBuilder()
        .setTitle('❌ Discord Connection Test Failed')
        .setDescription('BridgeWorker Discord integration test failed')
        .setColor(0xFF0000) // Red color
        .addFields([
          {
            name: '🚨 Error',
            value: error instanceof Error ? error.message : String(error),
            inline: false
          },
          { name: '⏰ Time', value: new Date().toISOString(), inline: true },
        ])
        .setTimestamp();

      await sendDiscordAlert(errorEmbed);
      logger.info('📤 Error message sent to Discord successfully');
    } catch (discordError) {
      logger.error('❌ Could not even send error message to Discord:', {
        discordError: discordError instanceof Error ? discordError.message : String(discordError)
      });
    }

    throw error;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testDiscordConnection()
    .then(() => {
      logger.info('Discord connection test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Discord connection test failed:', error);
      process.exit(1);
    });
}

export { testDiscordConnection };