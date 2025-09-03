import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick } from '../utils/testData';

describe('Database Recovery', () => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  describe('Connection Failures', () => {
    it('should handle connection timeouts', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      // Simulate slow connection
      const slowClient = createClient<Database>(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!,
        {
          db: {
            schema: 'public',
            timeout: 1 // 1ms timeout to force failure
          }
        }
      );

      try {
        await slowClient.from('users').insert(testUser);
      } catch (error) {
        // Should retry with normal client
        const { data, error: insertError } = await supabase
          .from('users')
          .insert(testUser);

        expect(insertError).toBeNull();
        expect(data).toBeTruthy();
      }
    });

    it('should handle connection drops', async () => {
      // Create test data
      const testUser = createMockUser();
      
      // Simulate connection drop
      const unstableClient = createClient<Database>(
        'http://non-existent-url',
        process.env.SUPABASE_ANON_KEY!
      );

      try {
        await unstableClient.from('users').insert(testUser);
      } catch (error) {
        // Should retry with normal client
        const { data, error: insertError } = await supabase
          .from('users')
          .insert(testUser);

        expect(insertError).toBeNull();
        expect(data).toBeTruthy();
      }
    });

    it('should handle connection pool exhaustion', async () => {
      // Create many concurrent connections
      const connections = Array(100).fill(null).map(() =>
        createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        )
      );

      // Execute concurrent queries
      const results = await Promise.allSettled(
        connections.map(client =>
          client.from('users').select().limit(1)
        )
      );

      // Some queries should succeed
      const succeeded = results.filter(r => r.status === 'fulfilled');
      expect(succeeded.length).toBeGreaterThan(0);

      // Failed queries should be retryable
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        const retryResults = await Promise.all(
          failed.map(() =>
            supabase.from('users').select().limit(1)
          )
        );

        expect(retryResults.every(r => !r.error)).toBe(true);
      }
    });
  });

  describe('Transaction Recovery', () => {
    it('should handle transaction rollbacks', async () => {
      // Start transaction
      const { data: { user_id }, error: beginError } = await supabase.rpc(
        'begin_transaction'
      );

      expect(beginError).toBeNull();

      try {
        // Execute multiple operations
        const testUser = createMockUser();
        const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

        await supabase.from('users')
          .insert(testUser)
          .select()
          .single();

        // Force error in second operation
        await supabase.from('daily_picks')
          .insert({ ...testPick, id: 'invalid-id' });
      } catch (error) {
        // Rollback should succeed
        const { error: rollbackError } = await supabase.rpc(
          'rollback_transaction',
          { user_id }
        );

        expect(rollbackError).toBeNull();

        // Verify data was rolled back
        const { data: user } = await supabase
          .from('users')
          .select()
          .eq('discord_id', testUser.discord_id)
          .single();

        expect(user).toBeNull();
      }
    });

    it('should recover partial transactions', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({ capper_discord_id: testUser.discord_id })
      );

      // Start transaction
      const { data: { user_id }, error: beginError } = await supabase.rpc(
        'begin_transaction'
      );

      expect(beginError).toBeNull();

      try {
        // Insert user
        await supabase.from('users')
          .insert(testUser)
          .select()
          .single();

        // Insert picks with some failures
        const results = await Promise.allSettled(
          testPicks.map((pick, i) =>
            supabase.from('daily_picks').insert(
              i === 2 ? { ...pick, id: 'invalid-id' } : pick
            )
          )
        );

        // Should have mix of success and failure
        expect(results.some(r => r.status === 'fulfilled')).toBe(true);
        expect(results.some(r => r.status === 'rejected')).toBe(true);

        // Rollback failed operations
        const failedPicks = results
          .map((result, index) => result.status === 'rejected' ? testPicks[index] : null)
          .filter(Boolean);

        for (const pick of failedPicks) {
          const { error: deleteError } = await supabase
            .from('daily_picks')
            .delete()
            .eq('id', pick!.id);

          expect(deleteError).toBeNull();
        }

        // Commit successful operations
        const { error: commitError } = await supabase.rpc(
          'commit_transaction',
          { user_id }
        );

        expect(commitError).toBeNull();

        // Verify partial success
        const { data: picks } = await supabase
          .from('daily_picks')
          .select()
          .eq('capper_discord_id', testUser.discord_id);

        expect(picks).toHaveLength(testPicks.length - failedPicks.length);
      } catch (error) {
        // Rollback on unexpected error
        await supabase.rpc('rollback_transaction', { user_id });
      }
    });

    it('should handle deadlock recovery', async () => {
      // Create test data
      const user1 = createMockUser();
      const user2 = createMockUser();
      const pick1 = createMockPick({ capper_discord_id: user1.discord_id });
      const pick2 = createMockPick({ capper_discord_id: user2.discord_id });

      await supabase.from('users').insert([user1, user2]);
      await supabase.from('daily_picks').insert([pick1, pick2]);

      // Simulate deadlock with concurrent updates
      const results = await Promise.allSettled([
        // Transaction 1: Update pick1 then pick2
        (async () => {
          const { data: { user_id } } = await supabase.rpc('begin_transaction');
          
          await supabase.from('daily_picks')
            .update({ status: 'graded' })
            .eq('id', pick1.id);

          await new Promise(resolve => setTimeout(resolve, 100));

          await supabase.from('daily_picks')
            .update({ status: 'graded' })
            .eq('id', pick2.id);

          return supabase.rpc('commit_transaction', { user_id });
        })(),

        // Transaction 2: Update pick2 then pick1
        (async () => {
          const { data: { user_id } } = await supabase.rpc('begin_transaction');
          
          await supabase.from('daily_picks')
            .update({ status: 'graded' })
            .eq('id', pick2.id);

          await supabase.from('daily_picks')
            .update({ status: 'graded' })
            .eq('id', pick1.id);

          return supabase.rpc('commit_transaction', { user_id });
        })()
      ]);

      // One transaction should succeed
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);

      // Failed transaction should be retryable
      const failedTransaction = results.find(r => r.status === 'rejected');
      if (failedTransaction) {
        const { error } = await supabase.from('daily_picks')
          .update({ status: 'graded' })
          .in('id', [pick1.id, pick2.id]);

        expect(error).toBeNull();
      }

      // Verify final state
      const { data: picks } = await supabase
        .from('daily_picks')
        .select()
        .in('id', [pick1.id, pick2.id]);

      expect(picks).toHaveLength(2);
      expect(picks!.every(p => p.status === 'graded')).toBe(true);
    });
  });

  describe('Data Consistency', () => {
    it('should handle constraint violations', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Try to insert duplicate user
      const { error: duplicateError } = await supabase
        .from('users')
        .insert(testUser);

      expect(duplicateError?.code).toBe('23505'); // Unique violation

      // Should be able to update instead
      const { error: updateError } = await supabase
        .from('users')
        .upsert(testUser);

      expect(updateError).toBeNull();
    });

    it('should maintain referential integrity', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      // Try to insert pick before user
      const { error: pickError } = await supabase
        .from('daily_picks')
        .insert(testPick);

      expect(pickError?.code).toBe('23503'); // Foreign key violation

      // Insert user then pick
      await supabase.from('users').insert(testUser);
      const { error: validPickError } = await supabase
        .from('daily_picks')
        .insert(testPick);

      expect(validPickError).toBeNull();

      // Try to delete user with picks
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('discord_id', testUser.discord_id);

      expect(deleteError?.code).toBe('23503'); // Foreign key violation

      // Delete picks then user
      await supabase.from('daily_picks')
        .delete()
        .eq('capper_discord_id', testUser.discord_id);

      const { error: validDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('discord_id', testUser.discord_id);

      expect(validDeleteError).toBeNull();
    });

    it('should handle race conditions', async () => {
      // Create test data
      const testUser = createMockUser();
      await supabase.from('users').insert(testUser);

      // Simulate concurrent updates
      const results = await Promise.all(
        Array(10).fill(null).map(() =>
          supabase.from('users')
            .update({ points: 100 })
            .eq('discord_id', testUser.discord_id)
        )
      );

      // Some updates should succeed
      expect(results.some(r => !r.error)).toBe(true);

      // Final state should be consistent
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testUser.discord_id)
        .single();

      expect(user?.points).toBe(100);
    });
  });

  describe('Backup Recovery', () => {
    it('should recover from backup on data loss', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPick = createMockPick({ capper_discord_id: testUser.discord_id });

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPick);

      // Simulate data loss
      await supabase.from('daily_picks')
        .delete()
        .eq('id', testPick.id);

      // Recover from backup
      const { data: backup } = await supabase.rpc('restore_from_backup', {
        table_name: 'daily_picks',
        record_id: testPick.id
      });

      expect(backup).toBeTruthy();

      // Verify recovered data
      const { data: recoveredPick } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(recoveredPick).toEqual(testPick);
    });

    it('should handle partial backup recovery', async () => {
      // Create test data
      const testUser = createMockUser();
      const testPicks = Array(5).fill(null).map(() =>
        createMockPick({ capper_discord_id: testUser.discord_id })
      );

      await supabase.from('users').insert(testUser);
      await supabase.from('daily_picks').insert(testPicks);

      // Simulate partial data loss
      await supabase.from('daily_picks')
        .delete()
        .in('id', testPicks.map(p => p.id));

      // Recover each pick
      const recoveryResults = await Promise.allSettled(
        testPicks.map(pick =>
          supabase.rpc('restore_from_backup', {
            table_name: 'daily_picks',
            record_id: pick.id
          })
        )
      );

      // Some recoveries should succeed
      expect(recoveryResults.some(r => r.status === 'fulfilled')).toBe(true);

      // Verify recovered data
      const { data: recoveredPicks } = await supabase
        .from('daily_picks')
        .select()
        .in('id', testPicks.map(p => p.id));

      expect(recoveredPicks).toBeTruthy();
      expect(recoveredPicks!.length).toBeGreaterThan(0);
    });
  });
}); 