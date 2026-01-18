/**
 * Flow 1: Smart Form → TicketLifecycleWorkflow → pick_publish → Discord (Staging)
 *
 * End-to-end validation of the complete betting intelligence pipeline:
 * 1. User submits a test NFL MNF prop through Smart Form
 * 2. Ticket is written to smart_tickets and picks tables
 * 3. Event is created in bridge_outbox
 * 4. TicketLifecycleWorkflow is triggered and completes successfully
 * 5. Pick is published to pick_publish table
 * 6. DiscordPublishingWorker processes the record (staging mode)
 *
 * Target: Staging environment with test Discord channel
 */

import { test, expect } from '@playwright/test';
import {
  DatabaseHelper,
  TemporalHelper,
  SmartFormHelper,
  generateTestTicket,
  waitForCondition,
} from './utils/test-helpers';

test.describe('Flow 1: Smart Form → TicketLifecycleWorkflow → Discord', () => {
  let dbHelper: DatabaseHelper;
  let temporalHelper: TemporalHelper;
  let testBetSlipId: string;

  test.beforeAll(() => {
    const supabaseUrl = process.env.E2E_SUPABASE_URL!;
    const supabaseKey = process.env.E2E_SUPABASE_KEY!;
    const temporalUrl = process.env.E2E_TEMPORAL_URL || 'http://localhost:7233';

    dbHelper = new DatabaseHelper(supabaseUrl, supabaseKey);
    temporalHelper = new TemporalHelper(temporalUrl);
  });

  test.afterAll(async () => {
    // Cleanup test data
    if (testBetSlipId) {
      await dbHelper.cleanupTestData(testBetSlipId);
    }
  });

  test('submits NFL MNF prop and validates complete pipeline', async ({ page, request }) => {
    test.setTimeout(300000); // 5 minutes for complete flow

    console.log('🏈 Starting Flow 1: Smart Form → Discord Pipeline Test');

    // Step 1: Get active capper for testing
    console.log('📋 Step 1: Fetching active capper');
    const capper = await dbHelper.getActiveCapper();
    expect(capper).toBeTruthy();
    expect(capper!.active).toBe(true);

    console.log(`✅ Using capper: ${capper!.username} (${capper!.id})`);

    // Step 2: Navigate to Smart Form
    console.log('📋 Step 2: Navigating to Smart Form');
    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Verify form loaded
    await expect(page.locator('[data-testid="ticket-form"]')).toBeVisible();
    console.log('✅ Smart Form loaded');

    // Step 3: Fill out ticket form for NFL MNF game
    console.log('📋 Step 3: Filling out ticket form');
    const formHelper = new SmartFormHelper(page);

    const testTicket = generateTestTicket(capper!.id);
    testTicket.sport = 'NFL';
    testTicket.selections[0].stat_type = 'passing_yards';
    testTicket.selections[0].line = 285.5;
    testTicket.selections[0].leg_odds = -110;
    testTicket.selections[0].selection = 'over';

    await formHelper.fillTicketForm(testTicket);
    console.log('✅ Form filled with NFL MNF prop');

    // Step 4: Submit form
    console.log('📋 Step 4: Submitting ticket');
    const submitButton = page.locator('[data-testid="submit-button"]');
    await submitButton.click();

    // Wait for success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible({
      timeout: 30000,
    });

    // Extract bet_slip_id from UI
    const betSlipIdElement = page.locator('[data-testid="bet-slip-id"]');
    testBetSlipId = await betSlipIdElement.getAttribute('data-value') || '';

    expect(testBetSlipId).toBeTruthy();
    expect(testBetSlipId).toMatch(/^[0-9a-f-]{36}$/i); // UUID format

    console.log(`✅ Ticket submitted successfully: ${testBetSlipId}`);

    // Step 5: Verify database writes
    console.log('📋 Step 5: Verifying database writes');

    // Verify smart_tickets record
    const ticketExists = await waitForCondition(
      () => dbHelper.verifyTicketCreated(testBetSlipId),
      30000
    );
    expect(ticketExists).toBe(true);
    console.log('✅ Ticket record created in smart_tickets table');

    // Verify picks record(s)
    const picksExist = await waitForCondition(
      () => dbHelper.verifyPicksCreated(testBetSlipId),
      30000
    );
    expect(picksExist).toBe(true);
    console.log('✅ Pick record(s) created in picks table');

    // Verify bridge_outbox event
    const outboxEvent = await waitForCondition(
      async () => {
        const event = await dbHelper.getBridgeOutboxEvent(testBetSlipId);
        return event !== null;
      },
      30000
    );
    expect(outboxEvent).toBe(true);

    const event = await dbHelper.getBridgeOutboxEvent(testBetSlipId);
    expect(event.event_type).toBe('ticket_submitted');
    expect(event.status).toMatch(/pending|processed/);
    console.log(`✅ Bridge outbox event created with status: ${event.status}`);

    // Step 6: Monitor TicketLifecycleWorkflow
    console.log('📋 Step 6: Monitoring TicketLifecycleWorkflow execution');

    const workflowId = `ticket-lifecycle-${testBetSlipId}`;

    // Poll for workflow completion (up to 2 minutes)
    const workflowCompleted = await temporalHelper.waitForWorkflowCompletion(
      workflowId,
      120000
    );

    expect(workflowCompleted).toBe(true);
    console.log('✅ TicketLifecycleWorkflow completed successfully');

    // Verify workflow result
    const workflowStatus = await temporalHelper.getWorkflowStatus(workflowId);
    expect(workflowStatus).toBeTruthy();
    expect(workflowStatus!.status).toBe('COMPLETED');
    console.log('✅ Workflow status confirmed: COMPLETED');

    // Step 7: Verify pick_publish record created
    console.log('📋 Step 7: Verifying pick_publish record');

    const pickPublishExists = await waitForCondition(
      () => dbHelper.verifyPickPublishCreated(testBetSlipId),
      60000
    );
    expect(pickPublishExists).toBe(true);
    console.log('✅ Pick publish record created');

    // Step 8: Verify DiscordPublishingWorker processing (staging mode)
    console.log('📋 Step 8: Verifying Discord publishing (staging)');

    // Check publishing status via API
    const publishStatusResponse = await request.get(
      `/api/publish/status?bet_slip_id=${testBetSlipId}`
    );
    expect(publishStatusResponse.ok()).toBe(true);

    const publishStatus = await publishStatusResponse.json();
    expect(publishStatus.status).toMatch(/pending|published/);
    console.log(`✅ Discord publish status: ${publishStatus.status}`);

    // In staging, verify it was posted to test channel (if not in shadow mode)
    if (!process.env.SHADOW_MODE || process.env.SHADOW_MODE === 'false') {
      expect(publishStatus.discord_message_id).toBeTruthy();
      console.log(`✅ Discord message posted: ${publishStatus.discord_message_id}`);
    } else {
      console.log('ℹ️  Shadow mode enabled - Discord publish simulated');
    }

    console.log('🎉 Flow 1 validation completed successfully!');
  });

  test('handles validation errors gracefully', async ({ page }) => {
    console.log('🔍 Testing validation error handling');

    await page.goto('/submit-ticket');
    await page.waitForLoadState('networkidle');

    // Try to submit without filling required fields
    const submitButton = page.locator('[data-testid="submit-button"]');
    await submitButton.click();

    // Should show validation errors
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    console.log('✅ Validation errors displayed correctly');
  });

  test('prevents duplicate submissions (idempotency)', async ({ request }) => {
    console.log('🔍 Testing idempotency protection');

    const capper = await dbHelper.getActiveCapper();
    expect(capper).toBeTruthy();

    const testTicket = generateTestTicket(capper!.id);

    // Submit ticket twice with same bet_slip_id
    const response1 = await request.post('/api/submit-ticket', {
      data: testTicket,
    });
    const response2 = await request.post('/api/submit-ticket', {
      data: testTicket,
    });

    expect(response1.ok()).toBe(true);
    expect(response2.ok()).toBe(true);

    const result1 = await response1.json();
    const result2 = await response2.json();

    // Both should succeed but second should indicate duplicate
    expect(result1.bet_slip_id).toBe(result2.bet_slip_id);
    console.log('✅ Idempotency protection working correctly');

    // Cleanup
    await dbHelper.cleanupTestData(testTicket.bet_slip_id);
  });
});
