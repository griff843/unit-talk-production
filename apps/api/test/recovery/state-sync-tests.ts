import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Client, GatewayIntentBits } from 'discord.js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('State Synchronization', () => {
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

  describe('Discord State Sync', () => {
    it('should sync user roles', async () => {
      // Create test data
      const testUser = createMockUser({ tier: 'vip' });
      await supabase.from('users').insert(testUser);

      // Get Discord guild and member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);

      // Verify initial state
      const vipRole = guild.roles.cache.find(r => r.name === 'VIP');
      expect(member.roles.cache.has(vipRole!.id)).toBe(true);

      // Update user tier
      await supabase
        .from('users')
        .update({ tier: 'vip_plus' })
        .eq('discord_id', testUser.discord_id);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify roles updated
      await member.fetch(true); // Force refresh
      const vipPlusRole = guild.roles.cache.find(r => r.name === 'VIP+');
      expect(member.roles.cache.has(vipPlusRole!.id)).toBe(true);
      expect(member.roles.cache.has(vipRole!.id)).toBe(false);
    });

    it('should sync pick notifications', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Get Discord channel
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);

      if (channel?.isTextBased()) {
        // Verify pick notification
        const messages = await channel.messages.fetch({ limit: 1 });
        const notification = messages.first();

        expect(notification?.content).toContain(testPick.id);
        expect(notification?.content).toContain(testUser.discord_username);
      }
    });

    it('should sync user stats', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({
          capper_discord_id: testUser.discord_id,
          result: 'win'
        })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Get Discord member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);

      // Verify nickname updated with stats
      expect(member.nickname).toContain('5-0');
      expect(member.nickname).toContain('100%');
    });
  });

  describe('Database State Sync', () => {
    it('should sync Discord role changes', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Get Discord guild and member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);
      const vipRole = guild.roles.cache.find(r => r.name === 'VIP');

      // Add role in Discord
      await member.roles.add(vipRole!);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify database updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.tier).toBe('vip');
    });

    it('should sync Discord username changes', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Get Discord member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);

      // Change username in Discord
      const newUsername = 'NewUsername#1234';
      await member.setNickname(newUsername);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify database updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.discord_username).toBe(newUsername);
    });

    it('should sync Discord message edits', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Get Discord channel
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const channel = await guild.channels.fetch(process.env.TEST_CHANNEL_ID!);

      if (channel?.isTextBased()) {
        // Get pick message
        const messages = await channel.messages.fetch({ limit: 10 });
        const pickMessage = messages.find(m =>
          m.content.includes(testPick.id)
        );

        // Edit message
        await pickMessage?.edit('Updated pick details');

        // Wait for sync
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verify database updated
        const { data: pick } = await supabase
          .from('daily_picks')
          .select()
          .eq('id', testPick.id)
          .single();

        expect(pick?.message_id).toBe(pickMessage?.id);
        expect(pick?.last_edited_at).toBeTruthy();
      }
    });
  });

  describe('Real-time Updates', () => {
    it('should handle concurrent state changes', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Get Discord member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);
      const vipRole = guild.roles.cache.find(r => r.name === 'VIP');

      // Make concurrent changes
      await Promise.all([
        // Discord change
        member.roles.add(vipRole!),
        // Database change
        supabase
          .from('users')
          .update({ points: 100 })
          .eq('discord_id', testUser.discord_id)
      ]);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify final state
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.tier).toBe('vip');
      expect(user?.points).toBe(100);
    });

    it('should handle rapid state changes', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Get Discord member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);
      const roles = ['VIP', 'VIP+', 'Pro Capper'].map(name =>
        guild.roles.cache.find(r => r.name === name)!
      );

      // Make rapid role changes
      for (const role of roles) {
        await member.roles.add(role);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for final sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify final state
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.tier).toBe('pro');
    });

    it('should handle websocket reconnection', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Subscribe to changes
      const changes: any[] = [];
      const subscription = supabase
        .channel('db-changes')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `discord_id=eq.${testUser.discord_id}`
        }, payload => {
          changes.push(payload.new);
        })
        .subscribe();

      // Force websocket disconnect
      await subscription.unsubscribe();

      // Make changes during disconnect
      await supabase
        .from('users')
        .update({ points: 100 })
        .eq('discord_id', testUser.discord_id);

      // Reconnect
      await subscription.subscribe();

      // Make another change
      await supabase
        .from('users')
        .update({ points: 200 })
        .eq('discord_id', testUser.discord_id);

      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify changes captured
      expect(changes).toHaveLength(1);
      expect(changes[0].points).toBe(200);

      // Cleanup
      await subscription.unsubscribe();
    });
  });

  describe('State Recovery', () => {
    it('should recover from sync failures', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Simulate sync failure
      await supabase.rpc('simulate_sync_failure', {
        user_id: testUser.discord_id
      });

      // Verify sync error recorded
      const { data: syncErrors } = await supabase
        .from('sync_errors')
        .select()
        .eq('user_id', testUser.discord_id);

      expect(syncErrors).toHaveLength(1);

      // Trigger recovery
      await supabase.rpc('recover_sync_state', {
        user_id: testUser.discord_id
      });

      // Verify recovery
      const { data: recoveredErrors } = await supabase
        .from('sync_errors')
        .select()
        .eq('user_id', testUser.discord_id);

      expect(recoveredErrors).toHaveLength(0);
    });

    it('should handle partial sync recovery', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({ capper_discord_id: testUser.discord_id })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Simulate multiple sync failures
      await Promise.all(
        testPicks.map((pick, i) =>
          supabase.rpc('simulate_sync_failure', {
            user_id: testUser.discord_id,
            pick_id: pick.id,
            should_fail: i % 2 === 0
          })
        )
      );

      // Verify some syncs failed
      const { data: syncErrors } = await supabase
        .from('sync_errors')
        .select()
        .eq('user_id', testUser.discord_id);

      expect(syncErrors).toHaveLength(3);

      // Attempt recovery
      const { data: recovery } = await supabase.rpc('recover_sync_state', {
        user_id: testUser.discord_id
      });

      expect(recovery.recovered_count).toBe(2);
      expect(recovery.failed_count).toBe(1);

      // Verify partial recovery
      const { data: remainingErrors } = await supabase
        .from('sync_errors')
        .select()
        .eq('user_id', testUser.discord_id);

      expect(remainingErrors).toHaveLength(1);
    });

    it('should maintain consistency during recovery', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Get Discord member
      const guild = await client.guilds.fetch(process.env.TEST_GUILD_ID!);
      const member = await guild.members.fetch(testUser.discord_id);

      // Simulate sync failure
      await supabase.rpc('simulate_sync_failure', {
        user_id: testUser.discord_id
      });

      // Make concurrent changes during recovery
      const recovery = supabase.rpc('recover_sync_state', {
        user_id: testUser.discord_id
      });

      const roleChange = member.roles.add(
        guild.roles.cache.find(r => r.name === 'VIP')!
      );

      await Promise.all([recovery, roleChange]);

      // Verify final state is consistent
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.tier).toBe('vip');
      expect(user?.sync_status).toBe('synced');
    });
  });
}); 