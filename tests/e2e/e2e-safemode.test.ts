import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_KEY || 'test-service-key'
);

test.describe('Safe Mode Triggering and Behavior', () => {
  let originalData: any[] = [];

  test.beforeAll(async () => {
    // Store original feed data for restoration
    const { data } = await supabase
      .from('raw_props')
      .select('*')
      .limit(10);
    originalData = data || [];
  });

  test.afterAll(async () => {
    // Restore data and clear safe mode
    await supabase.from('system_config').update({ 
      safe_mode: false,
      safe_mode_reason: null,
      safe_mode_triggered_at: null 
    }).eq('key', 'global_settings');
  });

  test('Ingestion gap >2 hours triggers SAFE_MODE', async () => {
    // Simulate ingestion gap by updating last_ingested timestamp
    const twoHoursAgo = new Date(Date.now() - 2.5 * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('feed_health')
      .update({ last_ingested_at: twoHoursAgo })
      .eq('feed_name', 'primary');

    // Wait for monitoring cycle (usually 1 minute)
    await new Promise(resolve => setTimeout(resolve, 65000));

    // Check if safe mode was triggered
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(true);
    expect(config.safe_mode_reason).toContain('Ingestion gap detected');
    expect(config.safe_mode_triggered_at).toBeTruthy();
  });

  test('Data inconsistency >5% triggers SAFE_MODE', async () => {
    // Create inconsistent data between raw and scored
    await supabase
      .from('raw_props')
      .insert([
        { id: 'test-1', player_name: 'Test Player', line: 25.5, stat_type: 'Points' },
        { id: 'test-2', player_name: 'Test Player', line: 25.5, stat_type: 'Points' },
        { id: 'test-3', player_name: 'Test Player', line: 25.5, stat_type: 'Points' },
        { id: 'test-4', player_name: 'Test Player', line: 25.5, stat_type: 'Points' },
        { id: 'test-5', player_name: 'Test Player', line: 25.5, stat_type: 'Points' },
      ]);

    // Only score 2 out of 5 (40% scored = 60% inconsistency)
    await supabase
      .from('scored_props')
      .insert([
        { raw_prop_id: 'test-1', confidence_score: 0.85 },
        { raw_prop_id: 'test-2', confidence_score: 0.90 },
      ]);

    // Trigger consistency check
    const response = await fetch(`${process.env.API_URL}/api/health/consistency-check`, {
      method: 'POST'
    });

    expect(response.status).toBe(200);
    
    // Verify safe mode triggered
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(true);
    expect(config.safe_mode_reason).toContain('Data inconsistency');
  });

  test('Error rate >10% triggers SAFE_MODE', async () => {
    // Simulate high error rate
    const errors = [];
    for (let i = 0; i < 15; i++) {
      errors.push({
        service: 'grading_agent',
        error_type: 'PROCESSING_ERROR',
        error_message: `Test error ${i}`,
        created_at: new Date().toISOString()
      });
    }

    await supabase.from('error_logs').insert(errors);

    // Also insert some successful operations
    const successes = [];
    for (let i = 0; i < 100; i++) {
      successes.push({
        service: 'grading_agent',
        operation: 'grade_pick',
        status: 'success',
        created_at: new Date().toISOString()
      });
    }

    await supabase.from('operation_logs').insert(successes);

    // Trigger error rate check
    const response = await fetch(`${process.env.API_URL}/api/monitoring/error-rate`, {
      method: 'GET'
    });

    const data = await response.json();
    expect(data.error_rate).toBeGreaterThan(0.1);

    // Verify safe mode triggered
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(true);
    expect(config.safe_mode_reason).toContain('High error rate');
  });

  test('External service failure triggers SAFE_MODE', async () => {
    // Simulate external service failures
    const failures = [];
    for (let i = 0; i < 5; i++) {
      failures.push({
        service: 'odds_api',
        status: 'failed',
        response_time: null,
        error: 'Connection timeout',
        checked_at: new Date().toISOString()
      });
    }

    await supabase.from('health_checks').insert(failures);

    // Run health check
    const response = await fetch(`${process.env.API_URL}/api/health/external-services`, {
      method: 'GET'
    });

    const data = await response.json();
    expect(data.odds_api.status).toBe('failed');

    // Verify safe mode triggered
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(true);
    expect(config.safe_mode_reason).toContain('External service failure');
  });

  test('Safe mode prevents Discord publishing', async () => {
    // Enable safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Test mode' 
    }).eq('key', 'global_settings');

    // Attempt to publish to Discord
    const response = await fetch(`${process.env.API_URL}/api/discord/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: 'test-channel',
        message: 'Test message'
      })
    });

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toContain('Safe mode active');
    expect(data.safe_mode_reason).toBe('Test mode');
  });

  test('Safe mode blocks grading operations', async () => {
    // Enable safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Data integrity check' 
    }).eq('key', 'global_settings');

    // Attempt to grade picks
    const response = await fetch(`${process.env.API_URL}/api/grading/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pick_ids: ['pick-1', 'pick-2']
      })
    });

    expect(response.status).toBe(503);
    const data = await response.json();
    expect(data.error).toContain('Safe mode active');
    expect(data.operations_blocked).toContain('grading');
  });

  test('Safe mode allows read operations', async () => {
    // Enable safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Read-only mode' 
    }).eq('key', 'global_settings');

    // Read operations should work
    const response = await fetch(`${process.env.API_URL}/api/picks/list`, {
      method: 'GET'
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.safe_mode_warning).toBe('System in safe mode - read-only');
    expect(Array.isArray(data.picks)).toBe(true);
  });

  test('Safe mode auto-recovery after issue resolution', async () => {
    // Enable safe mode with auto-recovery condition
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Ingestion gap',
      safe_mode_auto_recovery: true,
      safe_mode_recovery_condition: 'ingestion_resumed'
    }).eq('key', 'global_settings');

    // Fix the issue (resume ingestion)
    await supabase
      .from('feed_health')
      .update({ last_ingested_at: new Date().toISOString() })
      .eq('feed_name', 'primary');

    // Wait for recovery check
    await new Promise(resolve => setTimeout(resolve, 65000));

    // Verify safe mode cleared
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(false);
    expect(config.safe_mode_cleared_at).toBeTruthy();
    expect(config.safe_mode_cleared_reason).toContain('Auto-recovery');
  });

  test('Manual safe mode override with admin auth', async () => {
    // Enable safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Manual intervention required' 
    }).eq('key', 'global_settings');

    // Attempt override without auth (should fail)
    let response = await fetch(`${process.env.API_URL}/api/admin/safe-mode/override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Issue resolved' })
    });

    expect(response.status).toBe(401);

    // Override with admin auth
    response = await fetch(`${process.env.API_URL}/api/admin/safe-mode/override`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_API_KEY}`
      },
      body: JSON.stringify({ 
        reason: 'Issue resolved manually',
        admin_id: 'admin-123'
      })
    });

    expect(response.status).toBe(200);

    // Verify safe mode cleared
    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(false);
    expect(config.safe_mode_cleared_by).toBe('admin-123');
  });

  test('Safe mode notifications sent to Discord', async () => {
    // Mock Discord webhook
    const webhookCalls: any[] = [];
    const mockWebhook = jest.fn((payload) => {
      webhookCalls.push(payload);
      return Promise.resolve({ status: 204 });
    });

    // Trigger safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'Critical: Database connection lost',
      safe_mode_triggered_at: new Date().toISOString()
    }).eq('key', 'global_settings');

    // Wait for notification
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify Discord notification sent
    const { data: notifications } = await supabase
      .from('notification_logs')
      .select('*')
      .eq('type', 'safe_mode_alert')
      .order('created_at', { ascending: false })
      .limit(1);

    expect(notifications?.[0]).toBeTruthy();
    expect(notifications?.[0].channel).toBe('alerts');
    expect(notifications?.[0].message).toContain('SAFE MODE ACTIVATED');
    expect(notifications?.[0].severity).toBe('critical');
  });

  test('Safe mode dashboard indicators', async ({ page }) => {
    // Enable safe mode
    await supabase.from('system_config').update({ 
      safe_mode: true,
      safe_mode_reason: 'System maintenance' 
    }).eq('key', 'global_settings');

    // Check command center
    await page.goto(process.env.COMMAND_CENTER_URL || 'http://localhost:3001');
    
    const safeModeAlert = page.locator('[data-testid="safe-mode-alert"]');
    await expect(safeModeAlert).toBeVisible();
    await expect(safeModeAlert).toHaveCSS('background-color', 'rgb(239, 68, 68)'); // Red
    await expect(safeModeAlert).toContainText('SAFE MODE ACTIVE');

    // Check main dashboard
    await page.goto(process.env.FRONTEND_URL || 'http://localhost:3000');
    
    const banner = page.locator('[data-testid="safe-mode-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('System in Safe Mode');
    
    // All action buttons should be disabled
    const actionButtons = page.locator('button[data-action]');
    const count = await actionButtons.count();
    
    for (let i = 0; i < count; i++) {
      await expect(actionButtons.nth(i)).toBeDisabled();
    }
  });

  test('Safe mode metrics and reporting', async () => {
    // Trigger safe mode multiple times for metrics
    const triggers = [
      { reason: 'Ingestion gap', duration: 300000 },
      { reason: 'High error rate', duration: 600000 },
      { reason: 'Data inconsistency', duration: 450000 }
    ];

    for (const trigger of triggers) {
      await supabase.from('safe_mode_history').insert({
        triggered_at: new Date(Date.now() - trigger.duration).toISOString(),
        cleared_at: new Date().toISOString(),
        reason: trigger.reason,
        duration_ms: trigger.duration,
        auto_recovered: false
      });
    }

    // Get metrics
    const response = await fetch(`${process.env.API_URL}/api/metrics/safe-mode`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.API_KEY}`
      }
    });

    expect(response.status).toBe(200);
    const metrics = await response.json();

    expect(metrics.total_triggers).toBe(3);
    expect(metrics.average_duration_minutes).toBeCloseTo(7.5, 1);
    expect(metrics.most_common_reason).toBe('Ingestion gap');
    expect(metrics.mttr_minutes).toBeLessThan(10);
  });

  test('Safe mode prevents cascade failures', async () => {
    // Simulate cascade failure scenario
    await supabase.from('system_config').update({ 
      safe_mode: false 
    }).eq('key', 'global_settings');

    // Create failing service chain
    const services = ['feed_agent', 'grading_agent', 'promoter_agent'];
    
    for (const service of services) {
      // Simulate service failure
      await supabase.from('agent_health').insert({
        agent_name: service,
        status: 'unhealthy',
        last_heartbeat: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        error_count: 50
      });
    }

    // Check if safe mode triggered to prevent cascade
    await new Promise(resolve => setTimeout(resolve, 30000));

    const { data: config } = await supabase
      .from('system_config')
      .select('*')
      .eq('key', 'global_settings')
      .single();

    expect(config.safe_mode).toBe(true);
    expect(config.safe_mode_reason).toContain('Multiple service failures');
    
    // Verify downstream services protected
    const { data: protected } = await supabase
      .from('agent_health')
      .select('*')
      .in('agent_name', ['alert_agent', 'recap_agent', 'settlement_agent']);

    protected?.forEach(agent => {
      expect(agent.status).toBe('paused');
      expect(agent.pause_reason).toContain('Safe mode');
    });
  });
});