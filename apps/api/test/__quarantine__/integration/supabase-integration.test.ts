import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockPick, createMockCapper, createMockUser } from '../utils/testData';
import { validatePickData, validateCapperData, validateUserData } from '../utils/testHelpers';

// Initialize Supabase client for integration tests
const supabase = createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

describe('Supabase Database Integration', () => {
  // Clean up test data after each test
  afterEach(async () => {
    // Delete test data in reverse order of dependencies
    await supabase.from('daily_picks').delete().eq('capper_discord_id', 'test-discord-id');
    await supabase.from('cappers').delete().eq('discord_id', 'test-discord-id');
    await supabase.from('users').delete().eq('discord_id', 'test-discord-id');
  });

  describe('User Operations', () => {
    it('should create and retrieve a user', async () => {
      const testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
        tier: 'vip',
      });

      // Create user
      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert(testUser)
        .select()
        .single();

      expect(createError).toBeNull();
      expect(createdUser).toBeTruthy();
      expect(validateUserData(createdUser)).toBe(true);

      // Retrieve user
      const { data: retrievedUser, error: retrieveError } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(retrieveError).toBeNull();
      expect(retrievedUser).toEqual(createdUser);
    });

    it('should update user tier', async () => {
      const testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
        tier: 'free',
      });

      // Create user
      await supabase.from('users').insert(testUser);

      // Update tier
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ tier: 'vip' })
        .eq('discord_id', testUser.discord_id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updatedUser?.tier).toBe('vip');
    });

    it('should handle duplicate discord_id correctly', async () => {
      const testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
      });

      // Create first user
      await supabase.from('users').insert(testUser);

      // Try to create duplicate
      const { error: duplicateError } = await supabase.from('users').insert(testUser);

      expect(duplicateError).toBeTruthy();
    });
  });

  describe('Capper Operations', () => {
    let testUser: any;

    beforeEach(async () => {
      // Create test user first
      testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
        tier: 'vip',
      });
      await supabase.from('users').insert(testUser);
    });

    it('should create and retrieve a capper profile', async () => {
      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        display_name: 'The Analyst',
        tier: 'pro',
      });

      // Create capper
      const { data: createdCapper, error: createError } = await supabase
        .from('cappers')
        .insert(testCapper)
        .select()
        .single();

      expect(createError).toBeNull();
      expect(createdCapper).toBeTruthy();
      expect(validateCapperData(createdCapper)).toBe(true);

      // Retrieve capper
      const { data: retrievedCapper, error: retrieveError } = await supabase
        .from('cappers')
        .select()
        .eq('discord_id', testCapper.discord_id)
        .single();

      expect(retrieveError).toBeNull();
      expect(retrievedCapper).toEqual(createdCapper);
    });

    it('should update capper specialties', async () => {
      const testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        specialties: ['NBA'],
      });

      // Create capper
      await supabase.from('cappers').insert(testCapper);

      // Update specialties
      const { data: updatedCapper, error: updateError } = await supabase
        .from('cappers')
        .update({ specialties: ['NBA', 'MLB'] })
        .eq('discord_id', testCapper.discord_id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updatedCapper?.specialties).toEqual(['NBA', 'MLB']);
    });

    it('should enforce foreign key constraint with users', async () => {
      const testCapper = createMockCapper({
        discord_id: 'non-existent-user',
        discord_username: 'NonExistentUser',
      });

      // Try to create capper without corresponding user
      const { error } = await supabase.from('cappers').insert(testCapper);

      expect(error).toBeTruthy();
    });
  });

  describe('Pick Operations', () => {
    let testUser: any;
    let testCapper: any;

    beforeEach(async () => {
      // Create test user and capper
      testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
        tier: 'vip',
      });
      await supabase.from('users').insert(testUser);

      testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        tier: 'pro',
      });
      await supabase.from('cappers').insert(testCapper);
    });

    it('should create and retrieve a pick', async () => {
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username,
      });

      // Create pick
      const { data: createdPick, error: createError } = await supabase
        .from('daily_picks')
        .insert(testPick)
        .select()
        .single();

      expect(createError).toBeNull();
      expect(createdPick).toBeTruthy();
      expect(validatePickData(createdPick)).toBe(true);

      // Retrieve pick
      const { data: retrievedPick, error: retrieveError } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(retrieveError).toBeNull();
      expect(retrievedPick).toEqual(createdPick);
    });

    it('should update pick status', async () => {
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username,
        status: 'pending',
      });

      // Create pick
      await supabase.from('daily_picks').insert(testPick);

      // Update status
      const { data: updatedPick, error: updateError } = await supabase
        .from('daily_picks')
        .update({ status: 'finalized', result: 'win' })
        .eq('id', testPick.id)
        .select()
        .single();

      expect(updateError).toBeNull();
      expect(updatedPick?.status).toBe('graded');
      expect(updatedPick?.result).toBe('win');
    });

    it('should enforce foreign key constraint with cappers', async () => {
      const testPick = createMockPick({
        capper_id: 'non-existent-capper',
        capper_discord_id: 'non-existent-discord-id',
        capper_username: 'NonExistentUser',
      });

      // Try to create pick without corresponding capper
      const { error } = await supabase.from('daily_picks').insert(testPick);

      expect(error).toBeTruthy();
    });

    it('should retrieve picks with filters', async () => {
      const testPicks = [
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'pending',
          pick_type: 'single',
        }),
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'finalized',
          pick_type: 'parlay',
          result: 'win',
        }),
      ];

      // Create picks
      await supabase.from('daily_picks').insert(testPicks);

      // Retrieve pending picks
      const { data: pendingPicks, error: pendingError } = await supabase
        .from('daily_picks')
        .select()
        .eq('status', 'pending')
        .eq('capper_discord_id', testCapper.discord_id);

      expect(pendingError).toBeNull();
      expect(pendingPicks).toHaveLength(1);
      expect(pendingPicks![0].pick_type).toBe('single');

      // Retrieve winning parlays
      const { data: winningParlays, error: parlayError } = await supabase
        .from('daily_picks')
        .select()
        .eq('pick_type', 'parlay')
        .eq('result', 'win')
        .eq('capper_discord_id', testCapper.discord_id);

      expect(parlayError).toBeNull();
      expect(winningParlays).toHaveLength(1);
      expect(winningParlays![0].status).toBe('graded');
    });
  });

  describe('Complex Queries', () => {
    let testUser: any;
    let testCapper: any;

    beforeEach(async () => {
      // Create test user and capper
      testUser = createMockUser({
        discord_id: 'test-discord-id',
        discord_username: 'TestUser',
        tier: 'vip',
      });
      await supabase.from('users').insert(testUser);

      testCapper = createMockCapper({
        discord_id: testUser.discord_id,
        discord_username: testUser.discord_username,
        tier: 'pro',
      });
      await supabase.from('cappers').insert(testCapper);
    });

    it('should join picks with capper data', async () => {
      const testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        capper_username: testCapper.discord_username,
      });

      // Create pick
      await supabase.from('daily_picks').insert(testPick);

      // Retrieve pick with capper data
      const { data: joinedData, error: joinError } = await supabase
        .from('daily_picks')
        .select(
          `
          *,
          capper:cappers(*)
        `
        )
        .eq('id', testPick.id)
        .single();

      expect(joinError).toBeNull();
      expect(joinedData).toBeTruthy();
      expect(joinedData.capper).toBeTruthy();
      expect(joinedData.capper.id).toBe(testCapper.id);
    });

    it('should calculate capper statistics', async () => {
      const testPicks = [
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'finalized',
          result: 'win',
        }),
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'finalized',
          result: 'loss',
        }),
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'finalized',
          result: 'push',
        }),
      ];

      // Create picks
      await supabase.from('daily_picks').insert(testPicks);

      // Calculate stats
      const { data: stats, error: statsError } = await supabase.rpc('calculate_capper_stats', {
        capper_id_param: testCapper.id,
      });

      expect(statsError).toBeNull();
      expect(stats).toBeTruthy();
      expect(stats.total_picks).toBe(3);
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.pushes).toBe(1);
      expect(stats.win_rate).toBe(0.5); // 1 win out of 2 (excluding push)
    });
  });
});
