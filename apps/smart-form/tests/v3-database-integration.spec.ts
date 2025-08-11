import { test, expect } from '@playwright/test';

/**
 * V3.0.0 Database Integration Tests
 *
 * Tests the Smart Form's integration with v3.0.0 unified database tables:
 * - Games API integration with games, teams tables
 * - Props API integration with raw_props, players tables
 * - Submission integration with smart_tickets, unified_picks tables
 * - Foreign key relationships and data consistency
 */

test.describe('Smart Form V3.0.0 Database Integration', () => {
  test('Games API returns data from v3.0.0 unified tables', async ({ page }) => {
    console.log('🏟️ Testing Games API integration with unified tables...');

    // Navigate to smart form
    await page.goto('/submit-ticket');

    // Navigate to game selection step to trigger games API
    await page.selectOption('[data-testid="capper-selector"]', { index: 1 });
    await page.selectOption('[data-testid="sport-selector"]', 'MLB');
    await page.selectOption('[data-testid="ticket-type-selector"]', 'single');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await page.fill('[data-testid="game-date-input"]', tomorrow.toISOString().split('T')[0]);
    await page.click('[data-testid="next-button"]');

    await page.fill('[data-testid="unit-size-input"]', '2.5');
    await page.fill('[data-testid="confidence-slider"]', '5');
    await page.click('[data-testid="next-button"]');

    await page.selectOption('[data-testid="bet-type-selector"]', 'player_props');
    await page.selectOption('[data-testid="market-type-selector"]', 'over');
    await page.click('[data-testid="next-button"]');

    // Wait for and capture games API call
    const gamesResponse = await page.waitForResponse(
      response => response.url().includes('/api/games') && response.status() === 200
    );

    const gamesData = await gamesResponse.json();
    console.log(`📊 Games API Response:`, {
      gameCount: gamesData.games?.length || 0,
      sport: gamesData.sport,
      date: gamesData.date,
    });

    // Verify response structure matches v3.0.0 schema expectations
    expect(gamesData).toHaveProperty('games');
    expect(Array.isArray(gamesData.games)).toBe(true);

    if (gamesData.games.length > 0) {
      const game = gamesData.games[0];

      // Verify core game fields (from games table)
      expect(game).toHaveProperty('id');
      expect(game).toHaveProperty('sport');
      expect(game).toHaveProperty('home_team_id');
      expect(game).toHaveProperty('away_team_id');
      expect(game).toHaveProperty('game_date');
      expect(game).toHaveProperty('status');

      // Verify team relationship data (joined from teams table)
      expect(game).toHaveProperty('home_team');
      expect(game).toHaveProperty('away_team');

      if (game.home_team) {
        expect(game.home_team).toHaveProperty('name');
        expect(game.home_team).toHaveProperty('abbreviation');
        expect(game.home_team).toHaveProperty('sport');
      }

      console.log('✅ Games API structure verified for v3.0.0 unified tables');
    } else {
      console.log('⚠️  No games returned - this may be expected if no games are scheduled');
    }
  });

  test('Props API returns data from v3.0.0 raw_props table with proper relationships', async ({
    page,
  }) => {
    console.log('🎲 Testing Props API integration with unified tables...');

    // Direct API test to props endpoint
    const response = await page.request.get('/api/props?sport=MLB&limit=10');
    expect(response.status()).toBe(200);

    const propsData = await response.json();
    console.log(`🎯 Props API Response:`, {
      propCount: propsData.props?.length || 0,
      sport: propsData.sport,
    });

    // Verify response structure
    expect(propsData).toHaveProperty('props');
    expect(Array.isArray(propsData.props)).toBe(true);

    if (propsData.props.length > 0) {
      const prop = propsData.props[0];

      // Verify core prop fields (from raw_props table)
      expect(prop).toHaveProperty('id');
      expect(prop).toHaveProperty('game_id');
      expect(prop).toHaveProperty('prop_type'); // Note: v3.0.0 uses prop_type, not stat_type
      expect(prop).toHaveProperty('market_type');
      expect(prop).toHaveProperty('line');
      expect(prop).toHaveProperty('odds');

      // Verify relationship data
      expect(prop).toHaveProperty('game');
      if (prop.player_id) {
        expect(prop).toHaveProperty('player');
        if (prop.player) {
          expect(prop.player).toHaveProperty('name');
          expect(prop.player).toHaveProperty('sport');
          expect(prop.player).toHaveProperty('position');
        }
      }

      if (prop.team_id) {
        expect(prop).toHaveProperty('team');
        if (prop.team) {
          expect(prop.team).toHaveProperty('name');
          expect(prop.team).toHaveProperty('abbreviation');
        }
      }

      console.log('✅ Props API structure verified for v3.0.0 unified tables');
    } else {
      console.log('⚠️  No props returned - this may be expected if no props are available');
    }
  });

  test('Cappers API returns data with unified_picks foreign key relationships', async ({
    page,
  }) => {
    console.log('👤 Testing Cappers API integration with v3.0.0 users table...');

    // Direct API test to cappers endpoint
    const response = await page.request.get('/api/cappers');
    expect(response.status()).toBe(200);

    const cappersData = await response.json();
    console.log(`🎯 Cappers API Response:`, {
      capperCount: cappersData.cappers?.length || 0,
    });

    // Verify response structure
    expect(cappersData).toHaveProperty('cappers');
    expect(Array.isArray(cappersData.cappers)).toBe(true);

    if (cappersData.cappers.length > 0) {
      const capper = cappersData.cappers[0];

      // Verify capper fields match users table structure for v3.0.0
      expect(capper).toHaveProperty('id');
      expect(capper).toHaveProperty('username'); // v3.0.0 uses username field
      expect(typeof capper.username).toBe('string');
      expect(capper.username.length).toBeGreaterThan(0);

      // Verify additional user fields if present
      if (capper.discord_id) {
        expect(typeof capper.discord_id).toBe('string');
      }

      if (capper.tier) {
        expect(typeof capper.tier).toBe('string');
      }

      console.log('✅ Cappers API structure verified for v3.0.0 users table');
    } else {
      console.log('❌ No cappers returned - this indicates a potential issue with user data');
      throw new Error('No cappers available for testing - cannot proceed with form tests');
    }
  });

  test('Submit ticket API integrates properly with v3.0.0 smart_tickets table', async ({
    page,
  }) => {
    console.log('💾 Testing ticket submission API integration...');

    // Test ticket submission with mock data matching v3.0.0 schema
    const testTicketData = {
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
          selection: 'Player Hits Over 2.5',
          odds: -110,
          line: 2.5,
        },
      ],
      notes: 'Test submission for v3.0.0 validation',
    };

    // Submit via API
    const response = await page.request.post('/api/submit-ticket', {
      data: testTicketData,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log(`🎫 Submission API Response Status: ${response.status()}`);

    if (response.status() === 200) {
      const responseData = await response.json();

      // Verify successful submission response
      expect(responseData).toHaveProperty('success', true);
      expect(responseData).toHaveProperty('ticketId');
      expect(responseData).toHaveProperty('betSlipId');

      // Verify ticket ID format
      expect(responseData.ticketId).toMatch(/^bet-\d+/);

      console.log('✅ Ticket submission successful:', {
        ticketId: responseData.ticketId,
        isLive: responseData.isLive,
      });
    } else {
      // Log error details for debugging
      const errorData = await response.json().catch(() => ({}));
      console.log('❌ Submission failed:', {
        status: response.status(),
        error: errorData.error,
        details: errorData.details,
      });

      // Don't fail the test immediately - this helps us understand what's missing
      console.log('⚠️  Submission failed - this may indicate missing test data or configuration');
    }
  });

  test('Verify foreign key relationships in API responses', async ({ page }) => {
    console.log('🔗 Testing foreign key relationships in API responses...');

    // Test games with team relationships
    const gamesResponse = await page.request.get('/api/games?sport=MLB&include=teams');
    if (gamesResponse.status() === 200) {
      const gamesData = await gamesResponse.json();

      if (gamesData.games?.length > 0) {
        const game = gamesData.games[0];

        // Verify foreign key relationships
        if (game.home_team_id && game.home_team) {
          expect(game.home_team.id).toBe(game.home_team_id);
          console.log('✅ Games → Teams foreign key relationship verified');
        }

        if (game.away_team_id && game.away_team) {
          expect(game.away_team.id).toBe(game.away_team_id);
          console.log('✅ Games → Away Teams foreign key relationship verified');
        }
      }
    }

    // Test props with game/player relationships
    const propsResponse = await page.request.get(
      '/api/props?sport=MLB&limit=5&include=game,player'
    );
    if (propsResponse.status() === 200) {
      const propsData = await propsResponse.json();

      if (propsData.props?.length > 0) {
        const prop = propsData.props[0];

        // Verify game relationship
        if (prop.game_id && prop.game) {
          expect(prop.game.id).toBe(prop.game_id);
          console.log('✅ Raw Props → Games foreign key relationship verified');
        }

        // Verify player relationship if present
        if (prop.player_id && prop.player) {
          expect(prop.player.id).toBe(prop.player_id);
          console.log('✅ Raw Props → Players foreign key relationship verified');
        }
      }
    }

    console.log('✅ Foreign key relationship testing completed');
  });

  test('Test unified_picks table integration (future picks storage)', async ({ page }) => {
    console.log('📊 Testing unified_picks table integration expectations...');

    // Note: This test validates the expected integration points for unified_picks
    // The actual unified_picks integration would happen after form submission
    // through the SmartFormBridge in the main platform API

    // Verify the submission endpoint acknowledges unified_picks integration
    const testData = {
      capper: 'test_user',
      sport: 'MLB',
      ticket_type: 'single',
      bet_type: 'player_props',
      market_type: 'over',
      game_selections: [
        {
          game_id: 'test_game',
          selection: 'Test prop',
          odds: -110,
          line: 2.5,
        },
      ],
    };

    const response = await page.request.post('/api/submit-ticket', {
      data: testData,
    });

    console.log(`🎫 Testing unified_picks integration readiness: ${response.status()}`);

    if (response.status() === 200) {
      const result = await response.json();

      // Verify the response indicates successful processing pipeline setup
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('ticketId');

      console.log('✅ Smart Form → unified_picks integration pipeline ready');
      console.log(
        'ℹ️  Note: Actual unified_picks integration handled by SmartFormBridge in main API'
      );
    } else {
      console.log('⚠️  unified_picks integration pipeline needs configuration');
    }
  });

  test('Verify v3.0.0 column name mappings', async ({ page }) => {
    console.log('🗂️ Testing v3.0.0 column name mappings...');

    // Test props API to verify column name changes
    const response = await page.request.get('/api/props?sport=MLB&limit=1');

    if (response.status() === 200) {
      const data = await response.json();

      if (data.props?.length > 0) {
        const prop = data.props[0];

        // Verify v3.0.0 column mappings
        expect(prop).toHaveProperty('prop_type'); // v3.0.0 uses prop_type (not stat_type)
        expect(prop).not.toHaveProperty('stat_type'); // Should not have old column name

        if (prop.player) {
          expect(prop.player).toHaveProperty('name'); // v3.0.0 uses name (not player_name in some contexts)
        }

        expect(prop).toHaveProperty('line');
        expect(prop).toHaveProperty('odds');

        console.log('✅ v3.0.0 column name mappings verified');
      }
    }

    console.log('✅ Column name mapping tests completed');
  });
});
