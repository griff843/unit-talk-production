// src/agents/PlayerEnrichmentAgent/__tests__/mlbEnrichment.test.ts

import { getMlbHeadshot } from '../../../agents/enrichment/mlbEnrichment';

/**
 * Basic test for MLB headshot enrichment
 * Tests with known MLB players to verify the API integration works
 */
describe('MLB Headshot Enrichment', () => {
  // Increase timeout for API calls
  jest.setTimeout(30000);

  test('should fetch headshot for known MLB player', async () => {
    // Test with a well-known MLB player
    const playerName = 'Mike Trout';
    const result = await getMlbHeadshot(playerName);
    
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    if (result) {
      expect(result).toContain('img.mlbstatic.com');
      expect(result).toContain('/headshot/');
    }
  });

  test('should return null for non-existent player', async () => {
    const playerName = 'NonExistentPlayer12345';
    const result = await getMlbHeadshot(playerName);
    
    expect(result).toBeNull();
  });

  test('should handle empty player name gracefully', async () => {
    const playerName = '';
    const result = await getMlbHeadshot(playerName);
    
    expect(result).toBeNull();
  });

  test('should handle special characters in player name', async () => {
    // Test with a player name that has special characters
    const playerName = 'José Altuve';
    const result = await getMlbHeadshot(playerName);
    
    // This might return null or a valid URL depending on the API
    // We just want to ensure it doesn't throw an error
    expect(typeof result === 'string' || result === null).toBe(true);
  });
});

/**
 * Manual test instructions:
 * 
 * To manually test the PlayerEnrichmentAgent system:
 * 
 * 1. Ensure your environment variables are set:
 *    - SUPABASE_URL
 *    - SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 * 
 * 2. Ensure you have a 'players' table in Supabase with columns:
 *    - id (string/uuid)
 *    - player (string) - player name
 *    - sport (string) - sport type (e.g., "MLB")
 *    - headshot (string, nullable) - URL to player headshot
 * 
 * 3. Add some test MLB players to your database with null headshots:
 *    INSERT INTO players (id, player, sport, headshot) VALUES 
 *    ('test-1', 'Mike Trout', 'MLB', null),
 *    ('test-2', 'Aaron Judge', 'MLB', null),
 *    ('test-3', 'Mookie Betts', 'MLB', null);
 * 
 * 4. Run the enrichment script:
 *    npm run ts-node src/scripts/enrichPlayerHeadshots.ts
 * 
 * 5. Check your database to see if the headshot URLs were populated
 * 
 * 6. For single player enrichment, you can use the enrichPlayerById function
 *    with a specific player ID from your database
 */