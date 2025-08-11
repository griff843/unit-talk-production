import { createClient } from '@supabase/supabase-js';
import { Client, GuildMember } from 'discord.js';
import { Browser, Page, chromium } from 'playwright';

import { Database } from '../../src/db/types/supabase';
import { createMockUser, createMockPick, createMockCapper } from '../utils/testData';

describe('Daily User Workflows E2E', () => {
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

    // Create test user
    const testUser = createMockUser({
      discord_id: testMember.id,
      discord_username: testMember.user.username,
      tier: 'vip'
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

  describe('Pick Submission Flow', () => {
    beforeEach(async () => {
      // Create capper profile
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'pro'
      });
      await supabase.from('cappers').insert(testCapper);
    });

    it('should submit single pick', async () => {
      // Navigate to pick submission
      await page.goto(`${process.env.APP_URL}/submit-pick`);

      // Select single pick type
      await page.click('[data-testid="pick-type-single"]');

      // Fill pick details
      await page.fill('[data-testid="game-input"]', 'Lakers vs Warriors');
      await page.fill('[data-testid="selection-input"]', 'Lakers -5.5');
      await page.fill('[data-testid="odds-input"]', '-110');
      await page.fill('[data-testid="units-input"]', '2');

      // Add analysis
      await page.fill('[data-testid="analysis-input"]', 'Strong home team advantage');

      // Submit pick
      await page.click('[data-testid="submit-pick"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify pick created
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('capper_discord_id', testMember.id)
        .single();

      expect(pick).toBeTruthy();
      expect(pick?.pick_type).toBe('single');
      expect(pick?.status).toBe('pending');

      // Verify Discord notification
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const notification = messages.first();
      expect(notification?.embeds[0].title).toBe('🎯 New Pick Submitted');
    });

    it('should submit parlay pick', async () => {
      // Navigate to pick submission
      await page.goto(`${process.env.APP_URL}/submit-pick`);

      // Select parlay pick type
      await page.click('[data-testid="pick-type-parlay"]');

      // Add first leg
      await page.click('[data-testid="add-leg"]');
      await page.fill('[data-testid="game-input-0"]', 'Lakers vs Warriors');
      await page.fill('[data-testid="selection-input-0"]', 'Lakers -5.5');
      await page.fill('[data-testid="odds-input-0"]', '-110');

      // Add second leg
      await page.click('[data-testid="add-leg"]');
      await page.fill('[data-testid="game-input-1"]', 'Celtics vs Heat');
      await page.fill('[data-testid="selection-input-1"]', 'Celtics -3');
      await page.fill('[data-testid="odds-input-1"]', '-105');

      // Fill units
      await page.fill('[data-testid="units-input"]', '1');

      // Add analysis
      await page.fill('[data-testid="analysis-input"]', 'Strong home teams parlay');

      // Submit pick
      await page.click('[data-testid="submit-pick"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify pick created
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('capper_discord_id', testMember.id)
        .single();

      expect(pick).toBeTruthy();
      expect(pick?.pick_type).toBe('parlay');
      expect(pick?.legs).toHaveLength(2);
    });

    it('should validate pick details', async () => {
      // Navigate to pick submission
      await page.goto(`${process.env.APP_URL}/submit-pick`);

      // Select single pick type
      await page.click('[data-testid="pick-type-single"]');

      // Submit without details
      await page.click('[data-testid="submit-pick"]');

      // Verify validation errors
      const errors = await page.$$('[data-testid="validation-error"]');
      expect(errors.length).toBeGreaterThan(0);

      // Verify no pick created
      const { data: picks } = await supabase
        .from('daily_picks')
        .select()
        .eq('capper_discord_id', testMember.id);

      expect(picks).toHaveLength(0);
    });
  });

  describe('Pick Tracking Flow', () => {
    let testPick: any;

    beforeEach(async () => {
      // Create capper profile
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('cappers').insert(testCapper);

      // Create test pick
      testPick = createMockPick({
        capper_id: testCapper.id,
        capper_discord_id: testCapper.discord_id,
        status: 'pending'
      });
      await supabase.from('daily_picks').insert(testPick);
    });

    it('should view pending picks', async () => {
      // Navigate to picks page
      await page.goto(`${process.env.APP_URL}/picks`);

      // Filter by pending
      await page.click('[data-testid="filter-pending"]');

      // Verify pick displayed
      const pickElement = await page.waitForSelector(`[data-testid="pick-${testPick.id}"]`);
      expect(pickElement).toBeTruthy();

      // Verify pick details
      const gameText = await pickElement.textContent();
      expect(gameText).toContain(testPick.legs[0].game);
    });

    it('should grade pick', async () => {
      // Navigate to pick details
      await page.goto(`${process.env.APP_URL}/picks/${testPick.id}`);

      // Click grade button
      await page.click('[data-testid="grade-pick"]');

      // Select result
      await page.click('[data-testid="result-win"]');

      // Submit grading
      await page.click('[data-testid="submit-grade"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify pick updated
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(pick?.status).toBe('graded');
      expect(pick?.result).toBe('win');

      // Verify Discord notification
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const notification = messages.first();
      expect(notification?.embeds[0].title).toBe('✅ Pick Graded');
    });

    it('should delete pick', async () => {
      // Navigate to pick details
      await page.goto(`${process.env.APP_URL}/picks/${testPick.id}`);

      // Click delete button
      await page.click('[data-testid="delete-pick"]');

      // Confirm deletion
      await page.click('[data-testid="confirm-delete"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify pick deleted
      const { data: pick } = await supabase
        .from('daily_picks')
        .select()
        .eq('id', testPick.id)
        .single();

      expect(pick).toBeNull();
    });
  });

  describe('Analytics Review Flow', () => {
    beforeEach(async () => {
      // Create capper with picks
      const testCapper = createMockCapper({
        discord_id: testMember.id,
        discord_username: testMember.user.username
      });
      await supabase.from('cappers').insert(testCapper);

      const picks = [
        createMockPick({ result: 'win', status: 'finalized' }),
        createMockPick({ result: 'loss', status: 'finalized' }),
        createMockPick({ result: 'win', status: 'finalized' })
      ];

      await supabase.from('daily_picks').insert(picks);
    });

    it('should view performance metrics', async () => {
      // Navigate to analytics
      await page.goto(`${process.env.APP_URL}/analytics`);

      // Verify win rate displayed
      const winRate = await page.textContent('[data-testid="win-rate"]');
      expect(winRate).toContain('66.7%');

      // Verify ROI displayed
      const roi = await page.textContent('[data-testid="roi"]');
      expect(roi).toBeTruthy();
    });

    it('should filter analytics by date', async () => {
      // Navigate to analytics
      await page.goto(`${process.env.APP_URL}/analytics`);

      // Select date range
      await page.fill('[data-testid="date-from"]', '2024-01-01');
      await page.fill('[data-testid="date-to"]', '2024-12-31');
      await page.click('[data-testid="apply-filter"]');

      // Verify filtered data
      const filteredWins = await page.textContent('[data-testid="total-wins"]');
      expect(filteredWins).toBeTruthy();
    });

    it('should export analytics data', async () => {
      // Navigate to analytics
      await page.goto(`${process.env.APP_URL}/analytics`);

      // Click export button
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('[data-testid="export-data"]')
      ]);

      // Verify file downloaded
      expect(download.suggestedFilename()).toContain('analytics');
    });
  });

  describe('Account Management Flow', () => {
    it('should update profile', async () => {
      // Navigate to settings
      await page.goto(`${process.env.APP_URL}/settings`);

      // Update display name
      await page.fill('[data-testid="display-name"]', 'New Name');

      // Update bio
      await page.fill('[data-testid="bio"]', 'Updated bio');

      // Save changes
      await page.click('[data-testid="save-profile"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify profile updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.display_name).toBe('New Name');
      expect(user?.bio).toBe('Updated bio');
    });

    it('should update notification preferences', async () => {
      // Navigate to settings
      await page.goto(`${process.env.APP_URL}/settings`);

      // Update preferences
      await page.click('[data-testid="notifications-tab"]');
      await page.click('[data-testid="email-notifications"]');
      await page.click('[data-testid="discord-notifications"]');

      // Save changes
      await page.click('[data-testid="save-preferences"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify preferences updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.preferences.notifications).toEqual({
        email: true,
        discord: true,
        sms: false
      });
    });

    it('should manage subscription', async () => {
      // Navigate to settings
      await page.goto(`${process.env.APP_URL}/settings`);

      // Click subscription tab
      await page.click('[data-testid="subscription-tab"]');

      // Update payment method
      await page.click('[data-testid="update-payment"]');
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');
      await page.click('[data-testid="save-card"]');

      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');

      // Verify payment method updated
      const cardLast4 = await page.textContent('[data-testid="card-last4"]');
      expect(cardLast4).toContain('4242');
    });
  });
}); 