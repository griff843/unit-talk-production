import { test as base, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Test Setup for Smart Form V3.0.0 Tests
 *
 * Provides database connection and test utilities for validating
 * Smart Form integration with v3.0.0 unified tables
 */

// Extend base test with custom fixtures
export const test = base.extend<{
  dbClient: any;
  testData: TestData;
}>({
  // Database client fixture
  dbClient: async (_ctx: unknown, use: any) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️  Supabase credentials not found - database tests will be limited');
      await use(null);
      return;
    }

    const client = createClient(supabaseUrl, supabaseKey);

    // Test database connection
    try {
      const { data, error } = await client.from('games').select('count').limit(1);
      if (error) {
        console.warn('⚠️  Database connection test failed:', error.message);
      } else {
        console.log('✅ Database connection established for testing');
      }
    } catch (err) {
      console.warn('⚠️  Database connection error:', err);
    }

    await use(client);
  },

  // Test data fixture
  testData: async ({ dbClient }, use) => {
    const testData = new TestData(dbClient);
    await testData.initialize();
    await use(testData);
    await testData.cleanup();
  },
});

export { expect };

// Test data management class
export class TestData {
  private dbClient: any;
  private createdRecords: { table: string; id: string }[] = [];

  constructor(dbClient: any) {
    this.dbClient = dbClient;
  }

  async initialize() {
    console.log('🔧 Initializing test data...');

    if (!this.dbClient) {
      console.log('⚠️  No database client - skipping test data initialization');
      return;
    }

    try {
      // Verify v3.0.0 tables exist
      await this.verifyV3Tables();

      // Ensure test data exists
      await this.ensureTestCappers();
      await this.ensureTestGames();
      await this.ensureTestProps();

      console.log('✅ Test data initialization completed');
    } catch (error) {
      console.warn('⚠️  Test data initialization failed:', error);
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up test data...');

    if (!this.dbClient) {
      return;
    }

    // Clean up created test records in reverse order
    for (const record of this.createdRecords.reverse()) {
      try {
        await this.dbClient.from(record.table).delete().eq('id', record.id);
      } catch (error) {
        console.warn(`Failed to cleanup ${record.table}:${record.id}:`, error);
      }
    }

    console.log('✅ Test data cleanup completed');
  }

  private async verifyV3Tables() {
    console.log('🔍 Verifying v3.0.0 table structure...');

    const tables = ['games', 'teams', 'players', 'raw_props', 'users', 'smart_tickets'];

    for (const table of tables) {
      try {
        const { data, error } = await this.dbClient.from(table).select('*').limit(1);
        if (error) {
          console.warn(`⚠️  Table ${table} may not exist or is not accessible:`, error.message);
        } else {
          console.log(`✅ Table ${table} verified`);
        }
      } catch (err) {
        console.warn(`⚠️  Error checking table ${table}:`, err);
      }
    }
  }

  private async ensureTestCappers() {
    console.log('👤 Ensuring test cappers exist...');

    try {
      // Check if test cappers exist in users table
      const { data: existingCappers } = await this.dbClient
        .from('users')
        .select('id, username')
        .like('username', 'test_%')
        .limit(5);

      if (!existingCappers || existingCappers.length === 0) {
        console.log('📝 Creating test cappers...');

        const testCappers = [
          { username: 'test_capper_001', tier: 'vip_plus', active: true },
          { username: 'test_capper_002', tier: 'vip', active: true },
          { username: 'test_capper_003', tier: 'free', active: true },
        ];

        for (const capper of testCappers) {
          const { data, error } = await this.dbClient
            .from('users')
            .insert([capper])
            .select()
            .single();

          if (!error && data) {
            this.createdRecords.push({ table: 'users', id: data.id });
            console.log(`✅ Created test capper: ${capper.username}`);
          } else {
            console.warn(`Failed to create capper ${capper.username}:`, error);
          }
        }
      } else {
        console.log(`✅ Found ${existingCappers.length} existing test cappers`);
      }
    } catch (error) {
      console.warn('Failed to ensure test cappers:', error);
    }
  }

  private async ensureTestGames() {
    console.log('🏟️ Ensuring test games exist...');

    try {
      // Check if test games exist
      const { data: existingGames } = await this.dbClient
        .from('games')
        .select('id, sport')
        .eq('sport', 'MLB')
        .limit(3);

      if (!existingGames || existingGames.length < 3) {
        console.log('📝 Test games may be limited - this is expected in a test environment');
        console.log('ℹ️  Real game data should be populated by the feed agents');
      } else {
        console.log(`✅ Found ${existingGames.length} MLB games for testing`);
      }
    } catch (error) {
      console.warn('Failed to check test games:', error);
    }
  }

  private async ensureTestProps() {
    console.log('🎲 Ensuring test props exist...');

    try {
      // Check if test props exist
      const { data: existingProps } = await this.dbClient
        .from('raw_props')
        .select('id, prop_type')
        .limit(5);

      if (!existingProps || existingProps.length === 0) {
        console.log(
          "📝 No props found - this may be expected if feed agents haven't populated data"
        );
        console.log('ℹ️  For full testing, ensure feed agents have run to populate props');
      } else {
        console.log(`✅ Found ${existingProps.length} props for testing`);
      }
    } catch (error) {
      console.warn('Failed to check test props:', error);
    }
  }

  // Utility methods for test data access
  async getTestCapper() {
    if (!this.dbClient) return null;

    try {
      const { data } = await this.dbClient
        .from('users')
        .select('id, username, tier')
        .eq('active', true)
        .limit(1)
        .single();

      return data;
    } catch (error) {
      console.warn('Failed to get test capper:', error);
      return null;
    }
  }

  async getTestGame() {
    if (!this.dbClient) return null;

    try {
      const { data } = await this.dbClient
        .from('games')
        .select(
          `
          id, 
          sport, 
          game_date, 
          home_team_id,
          away_team_id,
          home_team:teams!home_team_id(name, abbreviation),
          away_team:teams!away_team_id(name, abbreviation)
        `
        )
        .eq('sport', 'MLB')
        .limit(1)
        .single();

      return data;
    } catch (error) {
      console.warn('Failed to get test game:', error);
      return null;
    }
  }

  async getTestProp() {
    if (!this.dbClient) return null;

    try {
      const { data } = await this.dbClient
        .from('raw_props')
        .select(
          `
          id,
          game_id,
          prop_type,
          market_type,
          line,
          odds,
          player:players(name, position),
          team:teams(name, abbreviation)
        `
        )
        .limit(1)
        .single();

      return data;
    } catch (error) {
      console.warn('Failed to get test prop:', error);
      return null;
    }
  }

  // Validation helpers
  async validateTicketSubmission(ticketId: string) {
    if (!this.dbClient) return false;

    try {
      const { data, error } = await this.dbClient
        .from('smart_tickets')
        .select('*')
        .eq('bet_slip_id', ticketId)
        .single();

      if (error || !data) {
        console.warn(`Ticket ${ticketId} not found in database:`, error);
        return false;
      }

      console.log(`✅ Ticket ${ticketId} found in database:`, {
        status: data.status,
        capper: data.capper,
        sport: data.sport,
        selectionsCount: data.game_selections?.length || 0,
      });

      return true;
    } catch (error) {
      console.warn(`Failed to validate ticket ${ticketId}:`, error);
      return false;
    }
  }
}

// Utility functions for common test operations
export const TestUtils = {
  // Generate test ticket data
  generateTestTicket: (overrides: any = {}) => ({
    capper: 'test_capper_001',
    ticket_type: 'single',
    unit_size: 2.5,
    odds_format: 'AMERICAN',
    auto_parlay: false,
    sport: 'MLB',
    game_date: new Date().toISOString().split('T')[0],
    confidence_level: 7,
    user_tier: 'vip_plus',
    bet_type: 'player_props',
    market_type: 'over',
    game_selections: [
      {
        game_id: 'test_game_001',
        selection: 'Test Player Hits Over 2.5',
        odds: -110,
        line: 2.5,
      },
    ],
    notes: 'Test submission',
    ...overrides,
  }),

  // Wait for API response with timeout
  waitForApiResponse: async (page: any, urlPattern: string, timeout = 10000) => {
    try {
      const response = await page.waitForResponse(
        (response: any) => response.url().includes(urlPattern) && response.status() === 200,
        { timeout }
      );
      return await response.json();
    } catch (error) {
      console.warn(`API response timeout for ${urlPattern}:`, error);
      return null;
    }
  },

  // Validate form step completion
  validateFormStep: async (page: any, stepNumber: number) => {
    const stepSelector = `[data-testid="step-${stepNumber}"]`;
    await expect(page.locator(stepSelector)).toBeVisible({ timeout: 5000 });

    // Check that previous steps are marked as completed
    for (let i = 1; i < stepNumber; i++) {
      const completedStep = page.locator(`[data-testid="step-${i}-completed"]`);
      await expect(completedStep).toBeVisible();
    }
  },
};
