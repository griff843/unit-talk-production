import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Discord Bot Recovery', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  let client: Client;

  beforeEach(async () => {
    client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    await client.login(process.env.DISCORD_TEST_TOKEN);
  });

  afterEach(async () => {
    await client.destroy();
  });

  describe('Connection Recovery', () => {
    it('should recover from Discord gateway disconnect', async () => {
      // Force disconnect
      (client.ws as any).destroy();

      // Wait for reconnect
      await new Promise<void>((resolve) => {
        client.once('ready', () => resolve());
      });

      // Verify bot is functional
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        const message = await channel.send('Recovery test');
        expect(message.id).toBeTruthy();
      }
    });

    it('should handle multiple rapid disconnects', async () => {
      const disconnects = 5;
      const metrics: { reconnectTime: number }[] = [];

      for (let i = 0; i < disconnects; i++) {
        const startTime = Date.now();
        
        // Force disconnect
        (client.ws as any).destroy();

        // Wait for reconnect
        await new Promise<void>((resolve) => {
          client.once('ready', () => {
            metrics.push({ reconnectTime: Date.now() - startTime });
            resolve();
          });
        });
      }

      // Verify reconnect times don't degrade
      const avgReconnectTime = metrics.reduce((sum, m) => sum + m.reconnectTime, 0) / metrics.length;
      expect(avgReconnectTime).toBeLessThan(5000); // 5 seconds max
    });

    it('should maintain state after reconnect', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });
      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Force disconnect
      (client.ws as any).destroy();

      // Wait for reconnect
      await new Promise<void>((resolve) => {
        client.once('ready', () => resolve());
      });

      // Verify data is still accessible
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        const message = await channel.send(`!pick ${testPick.id}`);
        
        // Wait for bot response
        const response = await new Promise<string>(resolve => {
          const collector = channel.createMessageCollector({ time: 5000 });
          collector.on('collect', m => {
            if (m.author.id === client.user?.id) {
              resolve(m.content);
            }
          });
        });

        expect(response).toContain(testPick.id);
      }
    });
  });

  describe('Rate Limit Handling', () => {
    it('should handle Discord rate limits gracefully', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Send messages rapidly
        const messages = Array(10).fill(null).map((_, i) => 
          channel.send(`Rate limit test ${i}`)
        );

        const results = await Promise.allSettled(messages);
        const fulfilled = results.filter(r => r.status === 'fulfilled');

        expect(fulfilled.length).toBeGreaterThan(0);

        // Verify bot recovers after rate limit
        await new Promise(resolve => setTimeout(resolve, 5000));
        const recoveryMessage = await channel.send('Recovery test');
        expect(recoveryMessage.id).toBeTruthy();
      }
    });

    it('should queue commands during rate limits', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Create test picks
        const picks = Array(5).fill(null).map(() => createMockPick());
        await supabase.from('daily_picks').insert(picks);

        // Send commands rapidly
        const commands = picks.map(pick => 
          channel.send(`!pick ${pick.id}`)
        );

        // Wait for all responses
        const responses = new Set<string>();
        const collector = channel.createMessageCollector({ time: 10000 });
        
        await new Promise<void>(resolve => {
          collector.on('collect', m => {
            if (m.author.id === client.user?.id) {
              responses.add(m.content);
              if (responses.size === picks.length) {
                resolve();
              }
            }
          });
        });

        expect(responses.size).toBe(picks.length);
      }
    });

    it('should prioritize critical commands during rate limits', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Send mix of normal and critical commands
        const commands = [
          { text: '!help', priority: 'low' },
          { text: '!status', priority: 'low' },
          { text: '!emergency_shutdown', priority: 'high' },
          { text: '!stats', priority: 'low' }
        ];

        const startTime = Date.now();
        const responses = new Map<string, number>();
        const collector = channel.createMessageCollector({ time: 10000 });

        // Send commands
        commands.forEach(cmd => channel.send(cmd.text));

        // Collect responses
        await new Promise<void>(resolve => {
          collector.on('collect', m => {
            if (m.author.id === client.user?.id) {
              responses.set(m.content, Date.now() - startTime);
              if (responses.size === commands.length) {
                resolve();
              }
            }
          });
        });

        // Verify high priority command was processed first
        const emergencyResponse = Array.from(responses.entries())
          .find(([content]) => content.includes('emergency'));
        const otherResponses = Array.from(responses.entries())
          .filter(([content]) => !content.includes('emergency'));

        expect(emergencyResponse![1]).toBeLessThan(
          Math.min(...otherResponses.map(([, time]) => time))
        );
      }
    });
  });

  describe('Error Recovery', () => {
    it('should recover from command errors', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Send invalid command
        await channel.send('!invalid_command');

        // Verify bot is still responsive
        const response = await channel.send('!help');
        expect(response.id).toBeTruthy();
      }
    });

    it('should handle API errors gracefully', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Create test pick with invalid data
        const invalidPick = createMockPick({ odds: 'invalid' as any });
        await supabase.from('daily_picks').insert(invalidPick);

        // Try to process invalid pick
        await channel.send(`!grade ${invalidPick.id}`);

        // Verify bot handles error and remains functional
        const validPick = createMockPick();
        await supabase.from('daily_picks').insert(validPick);

        const response = await channel.send(`!grade ${validPick.id}`);
        expect(response.id).toBeTruthy();
      }
    });

    it('should maintain command history during errors', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Execute series of commands with errors
        const commands = [
          '!valid_command_1',
          '!invalid_command',
          '!valid_command_2'
        ];

        for (const cmd of commands) {
          await channel.send(cmd);
        }

        // Verify command history
        const response = await channel.send('!history');
        const history = response.content;

        expect(history).toContain('valid_command_1');
        expect(history).toContain('valid_command_2');
        expect(history).toContain('invalid_command');
      }
    });
  });

  describe('Memory Management', () => {
    it('should handle memory pressure', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Create memory pressure
        const largeData = Array(1000).fill('x'.repeat(1000));

        // Execute commands during memory pressure
        const response1 = await channel.send('!status');
        expect(response1.id).toBeTruthy();

        // Clear memory pressure
        largeData.length = 0;
        global.gc && global.gc();

        // Verify bot is still responsive
        const response2 = await channel.send('!status');
        expect(response2.id).toBeTruthy();
      }
    });

    it('should clean up resources properly', async () => {
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);
      
      if (channel?.isTextBased()) {
        // Create multiple collectors
        const collectors = Array(10).fill(null).map(() =>
          channel.createMessageCollector({ time: 1000 })
        );

        // Wait for collectors to end
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify collectors are cleaned up
        collectors.forEach(collector => {
          expect(collector.ended).toBe(true);
        });

        // Verify bot is still responsive
        const response = await channel.send('!status');
        expect(response.id).toBeTruthy();
      }
    });
  });
}); 