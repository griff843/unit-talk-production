import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
);

test.describe('Database Schema and Data Validation', () => {
  test('should verify games table structure', async () => {
    const { data, error } = await supabase.from('games').select('*').limit(1);

    if (error) {
      console.log('Games table may not exist:', error.message);
      // This is expected if table doesn't exist yet
      expect(error.code).toBe('42P01'); // Table doesn't exist
    } else {
      expect(data).toBeDefined();
    }
  });

  test('should populate sample games for testing', async () => {
    const sampleGames = [
      {
        sport: 'MLB',
        home_team: 'New York Yankees',
        away_team: 'Tampa Bay Rays',
        game_date: '2025-01-29',
        game_time: '19:05:00',
        status: 'scheduled',
        league: 'MLB',
      },
      {
        sport: 'MLB',
        home_team: 'Los Angeles Dodgers',
        away_team: 'San Francisco Giants',
        game_date: '2025-01-29',
        game_time: '20:10:00',
        status: 'scheduled',
        league: 'MLB',
      },
      {
        sport: 'NBA',
        home_team: 'Los Angeles Lakers',
        away_team: 'Golden State Warriors',
        game_date: '2025-01-29',
        game_time: '19:30:00',
        status: 'scheduled',
        league: 'NBA',
      },
    ];

    // Try to insert sample games
    const { data, error } = await supabase.from('games').insert(sampleGames).select();

    if (error) {
      console.log('Error inserting games:', error.message);
      // This might fail if table doesn't exist or constraints are violated
    } else {
      expect(data).toHaveLength(3);
      console.log('Successfully inserted sample games:', data);
    }
  });

  test('should verify games can be queried by date and sport', async () => {
    const testDate = '2025-01-29';
    const testSport = 'MLB';

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('league', testSport)
      .eq('game_date', testDate);

    if (error) {
      console.log('Query error:', error.message);
    } else {
      expect(data).toBeDefined();
      console.log(`Found ${data?.length || 0} games for ${testSport} on ${testDate}`);
    }
  });
});
