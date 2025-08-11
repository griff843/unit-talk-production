import { createClient } from '@supabase/supabase-js';
import { Client, GuildMember } from 'discord.js';
import { Browser, Page, chromium } from 'playwright';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick, createMockCapper } from '../utils/testData';

describe('Advanced Feature Usage E2E', () => {
  let browser: Browser;
  let page: Page;
  let discordClient: Client;
  let testMember: GuildMember;
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  beforeAll(async () => {
    // Set up browser
    browser = await chromium.launch();

    // Set up Discord client
    discordClient = new Client({
      intents: ['GuildMessages', 'GuildMembers', 'MessageContent']
    });
    await discordClient.login(process.env.DISCORD_TOKEN);

    // Get test member
    const testChannel = await discordClient.channels.fetch(process.env.TEST_CHANNEL_ID!);
    testMember = await testChannel.guild.members.fetch(process.env.TEST_USER_ID!);
  });

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage();

    // Create VIP+ user
    const testUser = createMockUser({
      discord_id: testMember.id,
      discord_username: testMember.user.username,
      tier: 'vip_plus'
    });
    await supabase.from('users').insert(testUser);

    // Log in
    await page.goto(process.env.APP_URL!);
    await page.evaluate((token) => {
      localStorage.setItem('auth_token', token);
    }, 'test-token');
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from('daily_picks').delete().eq('capper_discord_id', testMember.id);
    await supabase.from('cappers').delete().eq('discord_id', testMember.id);
    await supabase.from('users').delete().eq('discord_id', testMember.id);
    await page.close();
  });

  afterAll(async () => {
    await browser.close();
    await discordClient.destroy();
  });

  describe('AI Coaching System', () => {
    beforeEach(async () => {
      // Create capper profile
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'pro'
      });
      await supabase.from('cappers').insert(testCapper);
    });

    it('should analyze pick with AI', async () => {
      // Navigate to pick submission
      await page.goto(`${process.env.APP_URL}/submit-pick`);

      // Fill pick details
      await page.click('[data-testid="pick-type-single"]');
      await page.fill('[data-testid="game-input"]', 'Lakers vs Warriors');
      await page.fill('[data-testid="selection-input"]', 'Lakers -5.5');
      await page.fill('[data-testid="odds-input"]', '-110');

      // Request AI analysis
      await page.click('[data-testid="request-analysis"]');

      // Wait for analysis
      await page.waitForSelector('[data-testid="ai-analysis"]');
      const analysis = await page.textContent('[data-testid="ai-analysis"]');
      expect(analysis).toBeTruthy();

      // Verify analysis stored
      const { data: storedAnalysis } = await supabase
        .from('pick_analysis')
        .select()
        .eq('capper_discord_id', testMember.id)
        .single();

      expect(storedAnalysis).toBeTruthy();
    });

    it('should provide betting insights', async () => {
      // Navigate to insights page
      await page.goto(`${process.env.APP_URL}/insights`);

      // Request insights
      await page.click('[data-testid="request-insights"]');

      // Wait for insights
      await page.waitForSelector('[data-testid="betting-insights"]');
      const insights = await page.textContent('[data-testid="betting-insights"]');
      expect(insights).toBeTruthy();

      // Verify insights categories
      const categories = await page.$$('[data-testid="insight-category"]');
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should provide personalized coaching', async () => {
      // Navigate to coaching page
      await page.goto(`${process.env.APP_URL}/coaching`);

      // Start coaching session
      await page.click('[data-testid="start-coaching"]');

      // Answer questions
      await page.fill('[data-testid="experience-level"]', 'Intermediate');
      await page.fill('[data-testid="preferred-sports"]', 'NBA, NFL');
      await page.fill('[data-testid="risk-tolerance"]', 'Medium');
      await page.click('[data-testid="submit-preferences"]');

      // Wait for recommendations
      await page.waitForSelector('[data-testid="coaching-recommendations"]');
      const recommendations = await page.textContent('[data-testid="coaching-recommendations"]');
      expect(recommendations).toBeTruthy();
    });
  });

  describe('Advanced Analytics', () => {
    beforeEach(async () => {
      // Create capper with picks
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('cappers').insert(testCapper);

      const picks = Array(20).fill(null).map(() =>
        createMockPick({
          capper_id: testCapper.id,
          capper_discord_id: testCapper.discord_id,
          status: 'finalized',
          result: Math.random() > 0.5 ? 'win' : 'loss'
        })
      );

      await supabase.from('daily_picks').insert(picks);
    });

    it('should view advanced metrics', async () => {
      // Navigate to advanced analytics
      await page.goto(`${process.env.APP_URL}/analytics/advanced`);

      // Verify advanced metrics displayed
      const metrics = [
        'roi-by-sport',
        'win-rate-by-odds',
        'units-by-bet-type',
        'profit-by-day'
      ];

      for (const metric of metrics) {
        const element = await page.waitForSelector(`[data-testid="${metric}"]`);
        expect(element).toBeTruthy();
      }
    });

    it('should generate custom reports', async () => {
      // Navigate to reports
      await page.goto(`${process.env.APP_URL}/analytics/reports`);

      // Configure report
      await page.click('[data-testid="custom-report"]');
      await page.click('[data-testid="metric-win-rate"]');
      await page.click('[data-testid="metric-roi"]');
      await page.click('[data-testid="dimension-sport"]');
      await page.click('[data-testid="dimension-odds-range"]');

      // Generate report
      await page.click('[data-testid="generate-report"]');

      // Wait for report
      await page.waitForSelector('[data-testid="report-content"]');
      const reportContent = await page.textContent('[data-testid="report-content"]');
      expect(reportContent).toBeTruthy();
    });

    it('should perform trend analysis', async () => {
      // Navigate to trends
      await page.goto(`${process.env.APP_URL}/analytics/trends`);

      // Select analysis period
      await page.fill('[data-testid="date-from"]', '2024-01-01');
      await page.fill('[data-testid="date-to"]', '2024-12-31');

      // Run analysis
      await page.click('[data-testid="analyze-trends"]');

      // Wait for trends
      await page.waitForSelector('[data-testid="trend-results"]');
      const trends = await page.textContent('[data-testid="trend-results"]');
      expect(trends).toBeTruthy();

      // Verify trend categories
      const categories = await page.$$('[data-testid="trend-category"]');
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('Custom Chart Generation', () => {
    it('should create custom chart', async () => {
      // Navigate to chart builder
      await page.goto(`${process.env.APP_URL}/analytics/charts`);

      // Configure chart
      await page.selectOption('[data-testid="chart-type"]', 'line');
      await page.selectOption('[data-testid="data-metric"]', 'win-rate');
      await page.selectOption('[data-testid="time-period"]', '30d');
      await page.click('[data-testid="include-trend-line"]');

      // Generate chart
      await page.click('[data-testid="generate-chart"]');

      // Wait for chart
      await page.waitForSelector('[data-testid="chart-canvas"]');
      const chart = await page.$('[data-testid="chart-canvas"]');
      expect(chart).toBeTruthy();
    });

    it('should customize chart appearance', async () => {
      // Navigate to chart builder
      await page.goto(`${process.env.APP_URL}/analytics/charts`);

      // Create basic chart
      await page.selectOption('[data-testid="chart-type"]', 'bar');
      await page.selectOption('[data-testid="data-metric"]', 'roi');
      await page.click('[data-testid="generate-chart"]');

      // Customize appearance
      await page.click('[data-testid="customize-chart"]');
      await page.fill('[data-testid="chart-title"]', 'Custom ROI Analysis');
      await page.fill('[data-testid="color-primary"]', '#00ff00');
      await page.selectOption('[data-testid="font-family"]', 'Arial');
      await page.click('[data-testid="apply-customization"]');

      // Verify customization
      const title = await page.textContent('[data-testid="chart-title-text"]');
      expect(title).toBe('Custom ROI Analysis');
    });

    it('should export chart', async () => {
      // Navigate to chart builder
      await page.goto(`${process.env.APP_URL}/analytics/charts`);

      // Create chart
      await page.selectOption('[data-testid="chart-type"]', 'pie');
      await page.selectOption('[data-testid="data-metric"]', 'picks-by-sport');
      await page.click('[data-testid="generate-chart"]');

      // Export chart
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-chart"]')
      ]);

      // Verify download
      expect(download.suggestedFilename()).toContain('chart');
    });
  });

  describe('Data Export System', () => {
    it('should export custom data sets', async () => {
      // Navigate to data export
      await page.goto(`${process.env.APP_URL}/data/export`);

      // Configure export
      await page.click('[data-testid="select-picks"]');
      await page.click('[data-testid="select-analytics"]');
      await page.fill('[data-testid="date-from"]', '2024-01-01');
      await page.fill('[data-testid="date-to"]', '2024-12-31');
      await page.selectOption('[data-testid="format"]', 'csv');

      // Generate export
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="generate-export"]')
      ]);

      // Verify download
      expect(download.suggestedFilename()).toContain('export');
    });

    it('should schedule automated exports', async () => {
      // Navigate to export settings
      await page.goto(`${process.env.APP_URL}/data/export/schedule`);

      // Configure schedule
      await page.click('[data-testid="schedule-export"]');
      await page.selectOption('[data-testid="frequency"]', 'weekly');
      await page.selectOption('[data-testid="day"]', 'monday');
      await page.fill('[data-testid="email"]', 'test@example.com');
      await page.click('[data-testid="save-schedule"]');

      // Verify schedule saved
      const { data: schedule } = await supabase
        .from('export_schedules')
        .select()
        .eq('user_id', testMember.id)
        .single();

      expect(schedule).toBeTruthy();
      expect(schedule?.frequency).toBe('weekly');
    });
  });

  describe('API Access', () => {
    it('should manage API keys', async () => {
      // Navigate to API settings
      await page.goto(`${process.env.APP_URL}/settings/api`);

      // Generate API key
      await page.click('[data-testid="generate-key"]');
      await page.fill('[data-testid="key-name"]', 'Test Key');
      await page.click('[data-testid="create-key"]');

      // Wait for key
      await page.waitForSelector('[data-testid="api-key"]');
      const apiKey = await page.textContent('[data-testid="api-key"]');
      expect(apiKey).toBeTruthy();

      // Verify key created
      const { data: keys } = await supabase
        .from('api_keys')
        .select()
        .eq('user_id', testMember.id);

      expect(keys).toHaveLength(1);
    });

    it('should view API usage', async () => {
      // Navigate to API usage
      await page.goto(`${process.env.APP_URL}/settings/api/usage`);

      // View usage metrics
      const metrics = [
        'total-requests',
        'requests-by-endpoint',
        'average-latency',
        'error-rate'
      ];

      for (const metric of metrics) {
        const element = await page.waitForSelector(`[data-testid="${metric}"]`);
        expect(element).toBeTruthy();
      }
    });

    it('should set API restrictions', async () => {
      // Navigate to API settings
      await page.goto(`${process.env.APP_URL}/settings/api`);

      // Configure restrictions
      await page.click('[data-testid="api-restrictions"]');
      await page.fill('[data-testid="rate-limit"]', '1000');
      await page.click('[data-testid="restrict-ip"]');
      await page.fill('[data-testid="allowed-ips"]', '192.168.1.1');
      await page.click('[data-testid="save-restrictions"]');

      // Verify restrictions saved
      const { data: settings } = await supabase
        .from('api_settings')
        .select()
        .eq('user_id', testMember.id)
        .single();

      expect(settings?.rate_limit).toBe(1000);
      expect(settings?.allowed_ips).toContain('192.168.1.1');
    });
  });
}); 