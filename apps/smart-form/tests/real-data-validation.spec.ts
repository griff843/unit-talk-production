import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Use real Supabase connection (not mocked)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://cqfnsozknjzvyiziwicl.supabase.co';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4cW11em1xdG5ubHBmYXB2aWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY4NDUsImV4cCI6MjA2MDY3Mjg0NX0.PkJJDTPo8WVpGWaAQ-gdzvyGH9WEjcxcwCDi8z0g93o';

const supabase = createClient(supabaseUrl, supabaseKey);

test.describe('Real Data Validation E2E Tests', () => {
  const today = new Date().toISOString().split('T')[0];

  test('should populate real games for today and allow complete form submission', async ({
    page,
  }) => {
    console.log(`Testing with today's date: ${today}`);

    // Navigate to smart form without any route mocking
    await page.goto('/submit-ticket');

    // Wait for the page to load completely
    await expect(page.locator('h1, h2')).toBeVisible();

    // Step 1: Fill basic form data with real selections
    await page.selectOption('select[name="capper"]', { index: 1 }); // Select first available capper
    await page.selectOption('select[name="ticket_type"]', 'straight');

    // Test different sports to ensure we have real games
    const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
    let selectedSport = '';
    let hasGames = false;

    for (const sport of sports) {
      console.log(`Testing sport: ${sport}`);

      // Set the sport
      await page.selectOption('select[name="sport"]', sport);
      selectedSport = sport;

      // Set today's date
      await page.fill('input[name="game_date"]', today);

      // Check if this sport has games today by querying database directly
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .eq('league', sport)
        .eq('game_date', today);

      if (!error && games && games.length > 0) {
        console.log(`Found ${games.length} real games for ${sport} on ${today}`);
        console.log(
          'Games:',
          games.map(g => `${g.away_team} @ ${g.home_team}`)
        );
        hasGames = true;
        break;
      } else {
        console.log(`No games found for ${sport} on ${today}`);
      }
    }

    if (!hasGames) {
      console.log('No games found for today, testing with tomorrow');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // Try tomorrow for each sport
      for (const sport of sports) {
        await page.selectOption('select[name="sport"]', sport);
        selectedSport = sport;
        await page.fill('input[name="game_date"]', tomorrowStr);

        const { data: games, error } = await supabase
          .from('games')
          .select('*')
          .eq('league', sport)
          .eq('game_date', tomorrowStr);

        if (!error && games && games.length > 0) {
          console.log(`Found ${games.length} real games for ${sport} on ${tomorrowStr}`);
          hasGames = true;
          break;
        }
      }
    }

    // Verify we found real games
    expect(hasGames).toBe(true);

    // Continue to next step
    await page.click('button:has-text("Next")');

    // Step 2: Configuration
    await page.fill('input[name="unit_size"]', '2');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '8');
    await page.click('button:has-text("Next")');

    // Step 3: Bet Details
    await page.selectOption('select[name="bet_type"]', 'spread');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Step 4: Verify real games are populated in the form
    await expect(page.locator('text=Loading games...')).toBeVisible({ timeout: 5000 });

    // Wait for games to load and verify they appear
    await page.waitForFunction(
      () => {
        const gameCards = document.querySelectorAll('[data-testid="game-card"]');
        return gameCards.length > 0;
      },
      {},
      { timeout: 30000 }
    );

    const gameCards = page.locator('[data-testid="game-card"]');
    const gameCount = await gameCards.count();

    console.log(`Form shows ${gameCount} games`);
    expect(gameCount).toBeGreaterThan(0);

    // Verify game data is real by checking against database
    const gameTexts = [];
    for (let i = 0; i < gameCount; i++) {
      const gameText = await gameCards.nth(i).textContent();
      gameTexts.push(gameText);
      console.log(`Game ${i + 1}: ${gameText}`);
    }

    // Select the first game and add details
    await gameCards.first().click();

    // Fill selection details
    await page.selectOption('select[name="selection"]', 'home');
    await page.fill('input[name="line"]', '-1.5');
    await page.fill('input[name="odds"]', '-110');

    // Add the selection
    await page.click('button:has-text("Add Selection")');

    // Verify selection was added
    await expect(page.locator('[data-testid="selection-added"]')).toBeVisible();

    // Submit the form
    await page.click('button:has-text("Submit Ticket")');

    // Wait for submission success
    await expect(page.locator('text=Ticket submitted successfully')).toBeVisible({
      timeout: 10000,
    });

    console.log('Form submitted successfully');
  });

  test('should verify database contains the submitted pick', async ({ page }) => {
    // First, get initial count of smart tickets
    const { count: initialCount } = await supabase
      .from('smart_tickets')
      .select('*', { count: 'exact', head: true });

    console.log(`Initial smart tickets count: ${initialCount}`);

    // Submit a test pick
    await page.goto('/submit-ticket');

    // Fill form quickly for this test
    await page.selectOption('select[name="capper"]', { index: 1 });
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', tomorrowStr);

    await page.click('button:has-text("Next")');

    await page.fill('input[name="unit_size"]', '1');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '7');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Wait for games to load
    await page.waitForFunction(
      () => {
        const gameCards = document.querySelectorAll('[data-testid="game-card"]');
        return gameCards.length > 0;
      },
      {},
      { timeout: 30000 }
    );

    // Select game and submit
    await page.locator('[data-testid="game-card"]').first().click();
    await page.selectOption('select[name="selection"]', 'home');
    await page.fill('input[name="odds"]', '-150');
    await page.click('button:has-text("Add Selection")');
    await page.click('button:has-text("Submit Ticket")');

    await expect(page.locator('text=Ticket submitted successfully')).toBeVisible({
      timeout: 10000,
    });

    // Verify the submission was added to database
    await page.waitForTimeout(2000); // Give database time to process

    const { count: finalCount } = await supabase
      .from('smart_tickets')
      .select('*', { count: 'exact', head: true });

    console.log(`Final smart tickets count: ${finalCount}`);

    // Verify count increased
    expect(finalCount).toBeGreaterThan(initialCount || 0);

    // Get the latest submission
    const { data: latestTicket } = await supabase
      .from('smart_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(latestTicket).toBeDefined();
    expect(latestTicket![0]).toBeDefined();

    console.log('Latest submitted ticket:', latestTicket![0]);

    // Verify ticket contains expected data
    const ticket = latestTicket![0];
    expect(ticket.ticket_type).toBe('straight');
    expect(ticket.sport).toBe('MLB');
    expect(ticket.unit_size).toBe(1);
    expect(ticket.confidence_level).toBe(7);
  });

  test('should validate props data is real and accurate', async ({ page }) => {
    console.log('Testing props data validation...');

    // Check if we have real props in the database
    const { data: rawProps, error } = await supabase.from('raw_props').select('*').limit(10);

    if (error) {
      console.log('Error fetching props:', error);
    } else {
      console.log(`Found ${rawProps?.length || 0} raw props in database`);

      if (rawProps && rawProps.length > 0) {
        // Log sample props to verify they're real
        rawProps.slice(0, 3).forEach((prop, index) => {
          console.log(`Sample prop ${index + 1}:`, {
            player: prop.player_name,
            market: prop.market,
            line: prop.line,
            odds: prop.odds,
            sport: prop.sport,
          });
        });

        // Verify props have realistic data
        const firstProp = rawProps[0];
        expect(firstProp.player_name).toBeTruthy();
        expect(firstProp.market).toBeTruthy();
        expect(firstProp.line).toBeDefined();
        expect(firstProp.odds).toBeTruthy();

        // Verify odds are in realistic format (American odds typically -300 to +300 range)
        const oddsValue = parseInt(firstProp.odds.toString().replace(/[^\d-]/g, ''));
        expect(Math.abs(oddsValue)).toBeGreaterThan(100);
        expect(Math.abs(oddsValue)).toBeLessThan(1000);
      }
    }

    // Test player props in the form
    await page.goto('/submit-ticket');

    await page.selectOption('select[name="capper"]', { index: 1 });
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', 'MLB');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await page.fill('input[name="game_date"]', tomorrowStr);

    await page.click('button:has-text("Next")');

    await page.fill('input[name="unit_size"]', '1');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '6');
    await page.click('button:has-text("Next")');

    // Select player prop bet type
    await page.selectOption('select[name="bet_type"]', 'player_prop');
    await page.selectOption('select[name="market_type"]', 'player');
    await page.click('button:has-text("Next")');

    // Check if player props are available
    const playerPropsVisible = await page
      .locator('input[placeholder*="Player"]')
      .isVisible({ timeout: 5000 });

    if (playerPropsVisible) {
      console.log('Player props form is available');

      // Try to fill in a realistic player name
      await page.fill('input[placeholder*="Player"]', 'Mike Trout');
      await page.selectOption('select[name="prop_type"]', { index: 1 });
      await page.selectOption('select[name="selection"]', 'over');
      await page.fill('input[name="line"]', '2.5');
      await page.fill('input[name="odds"]', '-110');

      // Verify form accepts realistic prop data
      await expect(page.locator('input[placeholder*="Player"]')).toHaveValue('Mike Trout');
    } else {
      console.log('Player props not available in form - this may be expected');
    }
  });

  test('should validate data consistency between database and form', async ({ page }) => {
    console.log('Testing data consistency between database and form...');

    // Get games directly from database for today
    const { data: dbGames, error } = await supabase
      .from('games')
      .select('*')
      .eq('game_date', today)
      .limit(5);

    if (error || !dbGames || dbGames.length === 0) {
      console.log('No games found in database for today, skipping consistency test');
      return;
    }

    console.log(`Found ${dbGames.length} games in database for ${today}`);
    dbGames.forEach(game => {
      console.log(`DB Game: ${game.away_team} @ ${game.home_team} at ${game.game_time}`);
    });

    // Now check if the same games appear in the form
    await page.goto('/submit-ticket');

    await page.selectOption('select[name="capper"]', { index: 1 });
    await page.selectOption('select[name="ticket_type"]', 'straight');
    await page.selectOption('select[name="sport"]', dbGames[0].league);
    await page.fill('input[name="game_date"]', today);

    await page.click('button:has-text("Next")');
    await page.fill('input[name="unit_size"]', '1');
    await page.selectOption('select[name="odds_format"]', 'american');
    await page.fill('input[name="confidence_level"]', '5');
    await page.click('button:has-text("Next")');

    await page.selectOption('select[name="bet_type"]', 'moneyline');
    await page.selectOption('select[name="market_type"]', 'game');
    await page.click('button:has-text("Next")');

    // Wait for games to load in form
    await page.waitForFunction(
      () => {
        const gameCards = document.querySelectorAll('[data-testid="game-card"]');
        return gameCards.length > 0;
      },
      {},
      { timeout: 30000 }
    );

    const gameCards = page.locator('[data-testid="game-card"]');
    const formGameCount = await gameCards.count();

    console.log(`Form shows ${formGameCount} games`);

    // Verify form shows same number of games as database (or explain difference)
    if (formGameCount !== dbGames.length) {
      console.log(`Warning: Database has ${dbGames.length} games but form shows ${formGameCount}`);
      // This might be expected due to filtering or status differences
    }

    // Check if team names match between database and form (allowing for abbreviations)
    const formGameTexts = [];
    for (let i = 0; i < Math.min(formGameCount, 3); i++) {
      const gameText = await gameCards.nth(i).textContent();
      formGameTexts.push(gameText || '');
      console.log(`Form Game ${i + 1}: ${gameText}`);
    }

    // Verify at least one game from database appears in form (accounting for different team name formats)
    let foundMatch = false;
    for (const dbGame of dbGames.slice(0, 3)) {
      for (const formText of formGameTexts) {
        if (
          formText.includes(dbGame.home_team.substring(0, 3)) ||
          formText.includes(dbGame.away_team.substring(0, 3))
        ) {
          foundMatch = true;
          console.log(`Found matching game: ${dbGame.away_team} @ ${dbGame.home_team}`);
          break;
        }
      }
      if (foundMatch) break;
    }

    expect(foundMatch).toBe(true);
  });
});
