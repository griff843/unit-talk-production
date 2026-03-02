import { createClient } from '@supabase/supabase-js';
import { Client, GuildMember } from 'discord.js';
import { Browser, Page, chromium } from 'playwright';

import { Database } from '../../src/db/types/supabase';
import { createMockUser } from '../utils/testData';

describe('New User Onboarding E2E', () => {
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
      intents: ['GuildMessages', 'GuildMembers', 'MessageContent'],
    });
    await discordClient.login(process.env.DISCORD_TOKEN);

    // Get test member
    const testChannel = await discordClient.channels.fetch(process.env.TEST_CHANNEL_ID!);
    testMember = await testChannel.guild.members.fetch(process.env.TEST_USER_ID!);
  });

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage();
    await page.goto(process.env.APP_URL!);
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

  describe('Discord OAuth Flow', () => {
    it('should complete Discord authentication', async () => {
      // Click login button
      await page.click('[data-testid="discord-login-button"]');

      // Fill Discord credentials
      await page.fill('#uid_7', process.env.TEST_USERNAME!);
      await page.fill('#uid_9', process.env.TEST_PASSWORD!);
      await page.click('[type="submit"]');

      // Accept OAuth permissions
      await page.click('[data-testid="oauth-authorize-button"]');

      // Verify redirect to dashboard
      await page.waitForURL('**/dashboard');
      expect(page.url()).toContain('/dashboard');

      // Verify user record created
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user).toBeTruthy();
      expect(user?.discord_username).toBe(testMember.user.username);
    });

    it('should handle OAuth failures gracefully', async () => {
      // Click login button
      await page.click('[data-testid="discord-login-button"]');

      // Fill invalid credentials
      await page.fill('#uid_7', 'invalid');
      await page.fill('#uid_9', 'invalid');
      await page.click('[type="submit"]');

      // Verify error message
      const errorText = await page.textContent('[data-testid="error-message"]');
      expect(errorText).toContain('Invalid');

      // Verify no user record created
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', 'invalid')
        .single();

      expect(user).toBeNull();
    });
  });

  describe('Initial Setup Flow', () => {
    beforeEach(async () => {
      // Create authenticated user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
      });
      await supabase.from('users').insert(testUser);

      // Log in
      await page.evaluate(token => {
        localStorage.setItem('auth_token', token);
      }, 'test-token');
      await page.goto(`${process.env.APP_URL}/onboarding`);
    });

    it('should complete preference setup', async () => {
      // Select notification preferences
      await page.click('[data-testid="email-notifications"]');
      await page.click('[data-testid="discord-notifications"]');

      // Select theme
      await page.click('[data-testid="theme-dark"]');

      // Select timezone
      await page.selectOption('[data-testid="timezone-select"]', 'America/New_York');

      // Click continue
      await page.click('[data-testid="continue-button"]');

      // Verify preferences saved
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.preferences).toEqual({
        notifications: {
          email: true,
          discord: true,
          sms: false,
        },
        theme: 'dark',
        timezone: 'America/New_York',
      });
    });

    it('should complete tier selection', async () => {
      // Select VIP tier
      await page.click('[data-testid="tier-vip"]');

      // Fill payment details
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');

      // Submit payment
      await page.click('[data-testid="submit-payment"]');

      // Wait for processing
      await page.waitForSelector('[data-testid="payment-success"]');

      // Verify tier updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.tier).toBe('vip');

      // Verify Discord role added
      const hasRole = testMember.roles.cache.some(role => role.name === 'VIP');
      expect(hasRole).toBe(true);
    });

    it('should handle payment failures', async () => {
      // Select VIP tier
      await page.click('[data-testid="tier-vip"]');

      // Fill invalid payment details
      await page.fill('[data-testid="card-number"]', '4000000000000002');
      await page.fill('[data-testid="card-expiry"]', '12/25');
      await page.fill('[data-testid="card-cvc"]', '123');

      // Submit payment
      await page.click('[data-testid="submit-payment"]');

      // Verify error message
      const errorText = await page.textContent('[data-testid="payment-error"]');
      expect(errorText).toContain('declined');

      // Verify tier not updated
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.tier).toBe('free');
    });
  });

  describe('Welcome Tutorial', () => {
    beforeEach(async () => {
      // Create VIP user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'vip',
      });
      await supabase.from('users').insert(testUser);

      // Log in
      await page.evaluate(token => {
        localStorage.setItem('auth_token', token);
      }, 'test-token');
      await page.goto(`${process.env.APP_URL}/tutorial`);
    });

    it('should complete dashboard tutorial', async () => {
      // Start tutorial
      await page.click('[data-testid="start-tutorial"]');

      // Complete each step
      const steps = [
        'dashboard-overview',
        'pick-submission',
        'analytics-overview',
        'settings-overview',
      ];

      for (const step of steps) {
        await page.click(`[data-testid="${step}-next"]`);
        // Verify step completion saved
        const { data: progress } = await supabase
          .from('tutorial_progress')
          .select()
          .eq('user_id', testMember.id)
          .single();

        expect(progress?.completed_steps).toContain(step);
      }

      // Verify tutorial completed
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.tutorial_completed).toBe(true);
    });

    it('should allow tutorial skip', async () => {
      // Skip tutorial
      await page.click('[data-testid="skip-tutorial"]');

      // Confirm skip
      await page.click('[data-testid="confirm-skip"]');

      // Verify tutorial marked as completed
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.tutorial_completed).toBe(true);
      expect(user?.tutorial_skipped).toBe(true);
    });
  });

  describe('Discord Server Integration', () => {
    beforeEach(async () => {
      // Create VIP user
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        tier: 'vip',
      });
      await supabase.from('users').insert(testUser);
    });

    it('should join Discord server', async () => {
      // Click join server button
      await page.click('[data-testid="join-discord"]');

      // Accept server invite
      await page.click('[data-testid="accept-invite"]');

      // Verify server joined
      const isMember = await testMember.guild.members.fetch(testMember.id);
      expect(isMember).toBeTruthy();

      // Verify welcome message sent
      const messages = await testChannel.messages.fetch({ limit: 1 });
      const welcomeMsg = messages.first();
      expect(welcomeMsg?.content).toContain('Welcome');
    });

    it('should sync Discord roles', async () => {
      // Add VIP role in database
      await supabase.from('users').update({ tier: 'vip' }).eq('discord_id', testMember.id);

      // Trigger role sync
      await page.click('[data-testid="sync-roles"]');

      // Verify Discord roles updated
      const hasRole = testMember.roles.cache.some(role => role.name === 'VIP');
      expect(hasRole).toBe(true);
    });
  });

  describe('Email Verification', () => {
    beforeEach(async () => {
      // Create user with email
      const testUser = createMockUser({
        discord_id: testMember.id,
        discord_username: testMember.user.username,
        email: 'test@example.com',
      });
      await supabase.from('users').insert(testUser);
    });

    it('should verify email address', async () => {
      // Get verification email
      const { data: email } = await supabase
        .from('email_queue')
        .select()
        .eq('user_id', testMember.id)
        .single();

      // Click verification link
      await page.goto(email?.verification_link);

      // Verify email marked as verified
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.email_verified).toBe(true);
    });

    it('should handle invalid verification links', async () => {
      // Try invalid link
      await page.goto(`${process.env.APP_URL}/verify-email?token=invalid`);

      // Verify error message
      const errorText = await page.textContent('[data-testid="error-message"]');
      expect(errorText).toContain('Invalid or expired');

      // Verify email not verified
      const { data: user } = await supabase
        .from('users')
        .select()
        .eq('discord_id', testMember.id)
        .single();

      expect(user?.email_verified).toBe(false);
    });
  });
});
