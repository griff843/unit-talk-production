import { createClient } from '@supabase/supabase-js';
import { Client, GuildMember, TextChannel } from 'discord.js';

import { Database } from '../../src/db/types/supabase';
import { createMockPick, createMockCapper, createMockUser } from '../utils/testData';

// Initialize clients
const discordClient = new Client({
  intents: ['GuildMessages', 'GuildMembers', 'MessageContent']
});

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

describe('Discord Bot ↔ Database Integration', () => {
  let testChannel: TextChannel;
  let testMember: GuildMember;

  beforeAll(async () => {
    // Connect to Discord
    await discordClient.login(process.env.DISCORD_TOKEN);

    // Get test channel and member
    testChannel = await discordClient.channels.fetch(process.env.TEST_CHANNEL_ID!) as TextChannel;
    testMember = await testChannel.guild.members.fetch(process.env.TEST_USER_ID!);
  });

  afterAll(async () => {
    // Disconnect from Discord
    await discordClient.destroy();
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('daily_picks').delete().eq('capper_discord_id', testMember.id);
    await supabase.from('cappers').delete().eq('discord_id', testMember.id);
    await supabase.from('users').delete().eq('discord_id', testMember.id);
  });

  describe('User Onboarding Flow', () => {
    it('should create user record on server join', async () => {
      // Simulate member join
      await testChannel.guild.members.add(testMember);

      // Verify user record created
      const { data: user, error } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(error).toBeNull();
      expect(user).toBeTruthy();
      expect(user.discord_username).toBe(testMember.user.username);
    });

    it('should update user record on role change', async () => {
      // Create initial user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'free'
      });
      await supabase.from('users').insert(testUser);

      // Simulate role update
      await testMember.roles.add('vip-role-id');

      // Verify user record updated
      const { data: user, error } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(error).toBeNull();
      expect(user?.tier).toBe('vip');
    });

    it('should handle user leave/ban', async () => {
      // Create test user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('users').insert(testUser);

      // Simulate member leave
      await testChannel.guild.members.remove(testMember.id);

      // Verify user record updated
      const { data: user, error } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(error).toBeNull();
      expect(user?.status).toBe('inactive');
    });
  });

  describe('Capper Registration Flow', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create test user
      testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'vip'
      });
      await supabase.from('users').insert(testUser);
    });

    it('should create capper record on registration', async () => {
      // Simulate capper registration
      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        display_name: 'The Analyst',
        tier: 'pro'
      });

      // Create capper record
      const { data: capper, error } = await supabase
        .from('cappers')
        .insert(testCapper)
        .select()
        .single();

      expect(error).toBeNull();
      expect(capper).toBeTruthy();

      // Verify Discord role added
      const hasRole = testMember.roles.cache.some(role => role.name === 'UT Capper');
      expect(hasRole).toBe(true);
    });

    it('should update capper record on tier change', async () => {
      // Create initial capper
      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        tier: 'basic'
      });
      await supabase.from('cappers').insert(testCapper);

      // Simulate tier upgrade
      await testMember.roles.add('pro-capper-role-id');

      // Verify capper record updated
      const { data: capper, error } = await supabase
        .from('cappers')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(error).toBeNull();
      expect(capper?.tier).toBe('pro');
    });

    it('should handle capper deactivation', async () => {
      // Create test capper
      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username
      });
      await supabase.from('cappers').insert(testCapper);

      // Simulate role removal
      await testMember.roles.remove('ut-capper-role-id');

      // Verify capper record updated
      const { data: capper, error } = await supabase
        .from('cappers')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(error).toBeNull();
      expect(capper?.status).toBe('inactive');
    });
  });

  describe('Pick Submission Flow', () => {
    let testUser: any;
    let testCapper: any;

    beforeEach(async () => {
      // Create test user and capper
      testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'vip'
      });
      await supabase.from('users').insert(testUser);

      testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        tier: 'pro'
      });
      await supabase.from('cappers').insert(testCapper);
    });

    it('should create pick record on submission', async () => {
      // Create test pick
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username
      });

      // Submit pick
      const { data: pick, error } = await supabase
        .from('daily_picks')
        .insert(testPick)
        .select()
        .single();

      expect(error).toBeNull();
      expect(pick).toBeTruthy();

      // Verify Discord notification sent
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const notification = messages.first();
      expect(notification?.embeds[0].title).toBe('🎯 New Pick Submitted');
    });

    it('should update pick record on grading', async () => {
      // Create test pick
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username,
        status: 'pending'
      });
      await supabase.from('daily_picks').insert(testPick);

      // Grade pick
      const { data: pick, error } = await supabase
        .from('daily_picks')
        .update({ status: 'finalized', result: 'win' })
        .eq('id', testPick.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(pick?.status).toBe('graded');
      expect(pick?.result).toBe('win');

      // Verify Discord notification sent
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const notification = messages.first();
      expect(notification?.embeds[0].title).toBe('✅ Pick Graded');
    });

    it('should handle pick deletion', async () => {
      // Create test pick
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username
      });
      await supabase.from('daily_picks').insert(testPick);

      // Delete pick
      const { error } = await supabase
        .from('daily_picks')
        .delete()
        .eq('id', testPick.id);

      expect(error).toBeNull();

      // Verify Discord notification sent
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const notification = messages.first();
      expect(notification?.embeds[0].title).toBe('🗑️ Pick Deleted');
    });
  });

  describe('Error Handling', () => {
    it('should handle Discord connection errors', async () => {
      const invalidClient = new Client({
        intents: ['GuildMessages', 'GuildMembers']
      });

      try {
        await invalidClient.login('invalid-token');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle database connection errors', async () => {
      const invalidSupabase = createClient(
        'invalid-url',
        'invalid-key'
      );

      try {
        await invalidSupabase.from('users').select();
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle concurrent operations', async () => {
      // Create test user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });

      // Perform concurrent operations
      const results = await Promise.allSettled([
        // Create user
        supabase.from('users').insert(testUser),
        // Try to create duplicate user
        supabase.from('users').insert(testUser),
        // Try to update non-existent user
        supabase.from('users').update({ tier: 'vip' }).eq('discord_id', 'invalid-id')
      ]);

      // First operation should succeed
      expect(results[0].status).toBe('fulfilled');
      // Duplicate should fail
      expect(results[1].status).toBe('rejected');
      // Update should fail
      expect(results[2].status).toBe('rejected');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain referential integrity', async () => {
      // Try to create capper without user
      const testCapper = createMockCapper({
        discord_id: 'non-existent-user',
        discord_username: 'NonExistentUser'
      });

      const { error } = await supabase
        .from('cappers')
        .insert(testCapper);

      expect(error).toBeTruthy();
    });

    it('should handle cascading deletes', async () => {
      // Create test user and capper
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('users').insert(testUser);

      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username
      });
      await supabase.from('cappers').insert(testCapper);

      // Delete user
      await supabase
        .from('users')
        .delete()
        .eq('discord_id', testUser.discord_id);

      // Verify capper also deleted
      const { data: capper } = await supabase
        .from('cappers')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(capper).toBeNull();
    });

    it('should maintain data sync', async () => {
      // Create test user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('users').insert(testUser);

      // Update Discord username
      await testMember.setNickname('NewUsername');

      // Verify database updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.discord_username).toBe('NewUsername');
    });
  });
}); 