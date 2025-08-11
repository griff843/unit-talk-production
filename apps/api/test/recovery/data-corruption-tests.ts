import crypto from 'crypto';

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Data Corruption', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Corruption Detection', () => {
    it('should detect schema violations', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Attempt to corrupt schema
      const corruptData = {
        discord_id: testUser.discord_id,
        invalid_field: 'corrupt',
        points: 'not-a-number'
      };

      const { error } = await supabase.from('users')
        .upsert(corruptData as any);

      expect(error?.code).toBe('42703'); // Undefined column

      // Verify data integrity
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user).toEqual(testUser);
    });

    it('should detect data type violations', async () => {
      // Create test data
      const testPick = createMockPick();

      // Attempt to insert with wrong types
      const corruptPick = {
        ...testPick,
        odds: 'invalid' as any,
        total_units: '100' as any,
        created_at: 'not-a-date' as any
      };

      const { error } = await supabase
        .from('daily_picks')
        .insert(corruptPick);

      expect(error?.code).toBe('22P02'); // Invalid text representation

      // Verify no corrupt data was inserted
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(pick).toBeNull();
    });

    it('should detect checksum mismatches', async () => {
      // Create test data with checksum
      const testUser = createMockUser();
      const userData = JSON.stringify(testUser);
      const checksum = crypto
        .createHash('sha256')
        .update(userData)
        .digest('hex');

      await supabase.from('users').insert({
        ...testUser,
        checksum
      });

      // Verify checksum
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      const currentChecksum = crypto
        .createHash('sha256')
        .update(JSON.stringify({
          ...user,
          checksum: undefined
        }))
        .digest('hex');

      expect(currentChecksum).toBe(checksum);
    });
  });

  describe('Data Validation', () => {
    it('should validate data relationships', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Verify relationships
      const { data: picks } = await supabase
        .from('daily_picks')
        .select(`
          id,
          capper:users!daily_picks_capper_discord_id_fkey (
            discord_id,
            discord_username
          )
        `)
        .eq('id', testPick.id)
        .single();

      expect(picks?.capper.discord_id).toBe(testUser.discord_id);
    });

    it('should validate data constraints', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Verify numeric constraints
      const { error: pointsError } = await supabase
        .from('users')
        .update({ points: -1 })
        .eq('discord_id', testUser.discord_id);

      expect(pointsError?.code).toBe('23514'); // Check violation

      // Verify string length constraints
      const { error: usernameError } = await supabase
        .from('users')
        .update({ discord_username: 'a'.repeat(1000) })
        .eq('discord_id', testUser.discord_id);

      expect(usernameError?.code).toBe('22001'); // String too long
    });

    it('should validate business rules', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({
        capper_discord_id: testUser.discord_id,
        odds: -110,
        total_units: 5
      });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Verify pick rules
      const { error: invalidOddsError } = await supabase
        .from('daily_picks')
        .update({ odds: 0 })
        .eq('id', testPick.id);

      expect(invalidOddsError?.code).toBe('23514'); // Check violation

      const { error: invalidUnitsError } = await supabase
        .from('daily_picks')
        .update({ total_units: 101 })
        .eq('id', testPick.id);

      expect(invalidUnitsError?.code).toBe('23514'); // Check violation
    });
  });

  describe('Corruption Recovery', () => {
    it('should recover from schema corruption', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Simulate schema corruption
      const { error: corruptError } = await supabase.rpc('simulate_corruption', {
        table_name: 'users',
        column_name: 'points'
      });

      expect(corruptError).toBeNull();

      // Detect corruption
      const { error: validationError } = await supabase.rpc('validate_schema', {
        table_name: 'users'
      });

      expect(validationError?.message).toContain('corruption detected');

      // Recover schema
      const { error: recoveryError } = await supabase.rpc('recover_schema', {
        table_name: 'users'
      });

      expect(recoveryError).toBeNull();

      // Verify recovery
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user).toEqual(testUser);
    });

    it('should recover from data corruption', async () => {
      // Create test data
      const testPick = createMockPick();
      await supabase.from('daily_picks').insert(testPick);

      // Simulate data corruption
      const { error: corruptError } = await supabase.rpc('corrupt_data', {
        table_name: 'daily_picks',
        record_id: testPick.id,
        field: 'odds'
      });

      expect(corruptError).toBeNull();

      // Detect corruption
      const { data: validation } = await supabase.rpc('validate_record', {
        table_name: 'daily_picks',
        record_id: testPick.id
      });

      expect(validation.is_corrupt).toBe(true);

      // Recover data
      const { error: recoveryError } = await supabase.rpc('recover_record', {
        table_name: 'daily_picks',
        record_id: testPick.id
      });

      expect(recoveryError).toBeNull();

      // Verify recovery
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(pick).toEqual(testPick);
    });

    it('should recover from relationship corruption', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Simulate relationship corruption
      const { error: corruptError } = await supabase.rpc('corrupt_relationship', {
        table_name: 'daily_picks',
        record_id: testPick.id,
        foreign_key: 'capper_discord_id'
      });

      expect(corruptError).toBeNull();

      // Detect corruption
      const { data: validation } = await supabase.rpc('validate_relationships', {
        table_name: 'daily_picks'
      });

      expect(validation.corrupt_records).toContain(testPick.id);

      // Recover relationships
      const { error: recoveryError } = await supabase.rpc('recover_relationships', {
        table_name: 'daily_picks'
      });

      expect(recoveryError).toBeNull();

      // Verify recovery
      const { data: pick } = await supabase
        .from('daily_picks')
        .select(`
          id,
          capper:users!daily_picks_capper_discord_id_fkey (
            discord_id
          )
        `)
        .eq('id', testPick.id)
        .single();

      expect(pick?.capper.discord_id).toBe(testUser.discord_id);
    });
  });

  describe('Data Repair', () => {
    it('should repair inconsistent states', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({ capper_discord_id: testUser.discord_id })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Simulate inconsistent state
      await supabase.rpc('simulate_inconsistency', {
        user_id: testUser.discord_id
      });

      // Detect inconsistency
      const { data: validation } = await supabase.rpc('validate_user_state', {
        user_id: testUser.discord_id
      });

      expect(validation.is_consistent).toBe(false);

      // Repair state
      const { error: repairError } = await supabase.rpc('repair_user_state', {
        user_id: testUser.discord_id
      });

      expect(repairError).toBeNull();

      // Verify repair
      const { data: revalidation } = await supabase.rpc('validate_user_state', {
        user_id: testUser.discord_id
      });

      expect(revalidation.is_consistent).toBe(true);
    });

    it('should repair derived data', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(10).fill(null).map(() =>
        createMockPick({
          capper_discord_id: testUser.discord_id,
          result: 'win'
        })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Simulate derived data corruption
      await supabase.rpc('corrupt_derived_data', {
        user_id: testUser.discord_id
      });

      // Detect corruption
      const { data: validation } = await supabase.rpc('validate_derived_data', {
        user_id: testUser.discord_id
      });

      expect(validation.is_valid).toBe(false);

      // Repair derived data
      const { error: repairError } = await supabase.rpc('repair_derived_data', {
        user_id: testUser.discord_id
      });

      expect(repairError).toBeNull();

      // Verify repair
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.win_count).toBe(10);
      expect(user?.win_rate).toBe(1.0);
    });

    it('should repair cascading corruption', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({ capper_discord_id: testUser.discord_id })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Simulate cascading corruption
      await supabase.rpc('simulate_cascade_corruption', {
        user_id: testUser.discord_id
      });

      // Detect corruption
      const { data: validation } = await supabase.rpc('validate_data_cascade', {
        user_id: testUser.discord_id
      });

      expect(validation.corrupt_tables).toHaveLength(2); // users and daily_picks

      // Repair cascade
      const { error: repairError } = await supabase.rpc('repair_data_cascade', {
        user_id: testUser.discord_id
      });

      expect(repairError).toBeNull();

      // Verify repair
      const { data: revalidation } = await supabase.rpc('validate_data_cascade', {
        user_id: testUser.discord_id
      });

      expect(revalidation.corrupt_tables).toHaveLength(0);
    });
  });
}); 