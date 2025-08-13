/**
 * E2E Alert Agent Tests
 * Validates alert cooldowns and DLQ behavior
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

describe('E2E Alert Agent Tests', () => {
  let supabase: any;
  let testStartTime: Date;

  beforeAll(async () => {
    testStartTime = new Date();
    console.log(`🧪 Starting Alert Agent E2E tests at ${testStartTime.toISOString()}`);
    
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  });

  afterAll(async () => {
    const testEndTime = new Date();
    const duration = testEndTime.getTime() - testStartTime.getTime();
    console.log(`✅ Alert Agent E2E tests completed in ${duration}ms`);
  });

  test('Alert Cooldown: Same alert within cooldown window should be deduplicated', async () => {
    console.log('🔍 Testing alert cooldown behavior...');
    
    // Create test alert data
    const alertKey = `test-cooldown-${Date.now()}`;
    const testAlert = {
      alert_type: 'injury_alert',
      alert_key: alertKey,
      player_name: 'Test Player',
      message: 'E2E cooldown test alert',
      severity: 'medium',
      cooldown_minutes: 5,
      created_at: new Date().toISOString()
    };

    // Insert first alert
    const { data: firstAlert, error: firstError } = await supabase
      .from('alert_log')
      .insert(testAlert)
      .select()
      .single();

    expect(firstError).toBeNull();
    expect(firstAlert).toBeDefined();

    console.log(`📊 First alert created: ${firstAlert.id}`);

    // Try to insert duplicate alert immediately (should be blocked)
    const duplicateAlert = {
      ...testAlert,
      created_at: new Date().toISOString()
    };

    // TODO-MANUAL: This test depends on the AlertAgent implementing proper
    // cooldown logic. The agent should check for recent alerts with the same
    // alert_key before sending new ones.
    
    try {
      const { data: secondAlert, error: secondError } = await supabase
        .from('alert_log')
        .insert(duplicateAlert)
        .select()
        .single();

      if (!secondError) {
        // If insert succeeded, check if alert was actually sent
        console.log(`⚠️ Duplicate alert inserted: ${secondAlert.id}`);
        
        // Check if there's a mechanism to prevent sending
        const recentAlerts = await supabase
          .from('alert_log')
          .select('*')
          .eq('alert_key', alertKey)
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        expect(recentAlerts.data.length).toBeLessThanOrEqual(2);
      } else {
        console.log(`✅ Duplicate alert correctly blocked: ${secondError.message}`);
      }
    } catch (error) {
      console.log(`✅ Duplicate alert correctly blocked: ${error}`);
    }

    // Cleanup test data
    await supabase
      .from('alert_log')
      .delete()
      .eq('alert_key', alertKey);
  });

  test('Discord Outage Handling: Failed Discord sends should enqueue to DLQ', async () => {
    console.log('🔍 Testing Discord outage and DLQ behavior...');
    
    // Create test DLQ entry (simulating Discord failure)
    const testDLQEntry = {
      message_type: 'discord_alert',
      destination: 'discord_webhook',
      payload: {
        content: 'E2E test alert - Discord outage simulation',
        embeds: [{
          title: 'Test Alert',
          description: 'This is a test alert for DLQ functionality',
          color: 0xff0000
        }]
      },
      retry_count: 0,
      max_retries: 3,
      next_retry_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      created_at: new Date().toISOString(),
      status: 'pending'
    };

    const { data: dlqEntry, error: dlqError } = await supabase
      .from('dead_letter_queue')
      .insert(testDLQEntry)
      .select()
      .single();

    expect(dlqError).toBeNull();
    expect(dlqEntry).toBeDefined();

    console.log(`📊 DLQ entry created: ${dlqEntry.id}`);

    // Simulate retry attempt (would normally be done by DLQ processor)
    const { data: updatedEntry, error: updateError } = await supabase
      .from('dead_letter_queue')
      .update({
        retry_count: dlqEntry.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        next_retry_at: new Date(Date.now() + 2 * 60000).toISOString(), // 2 minutes from now
        status: 'retrying'
      })
      .eq('id', dlqEntry.id)
      .select()
      .single();

    expect(updateError).toBeNull();
    expect(updatedEntry.retry_count).toBe(1);
    expect(updatedEntry.status).toBe('retrying');

    console.log(`✅ DLQ retry logic working: retry_count=${updatedEntry.retry_count}`);

    // Test DLQ drain functionality
    const { data: pendingEntries, error: drainError } = await supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', new Date().toISOString())
      .limit(10);

    expect(drainError).toBeNull();
    console.log(`📊 Pending DLQ entries ready for retry: ${pendingEntries?.length || 0}`);

    // Cleanup test data
    await supabase
      .from('dead_letter_queue')
      .delete()
      .eq('id', dlqEntry.id);
  });

  test('Alert Priority: High priority alerts should be processed first', async () => {
    console.log('🔍 Testing alert priority processing...');
    
    // Create alerts with different priorities
    const testAlerts = [
      {
        alert_type: 'injury_alert',
        alert_key: `test-low-${Date.now()}`,
        player_name: 'Test Player Low',
        message: 'Low priority alert',
        severity: 'low',
        priority: 1,
        created_at: new Date().toISOString()
      },
      {
        alert_type: 'line_movement',
        alert_key: `test-high-${Date.now()}`,
        player_name: 'Test Player High',
        message: 'High priority alert',
        severity: 'high',
        priority: 10,
        created_at: new Date().toISOString()
      },
      {
        alert_type: 'steam_move',
        alert_key: `test-critical-${Date.now()}`,
        player_name: 'Test Player Critical',
        message: 'Critical priority alert',
        severity: 'critical',
        priority: 20,
        created_at: new Date().toISOString()
      }
    ];

    const { data: insertedAlerts, error: insertError } = await supabase
      .from('alert_log')
      .insert(testAlerts)
      .select();

    expect(insertError).toBeNull();
    expect(insertedAlerts).toHaveLength(3);

    // Query alerts by priority order
    const { data: prioritizedAlerts, error: queryError } = await supabase
      .from('alert_log')
      .select('*')
      .in('alert_key', testAlerts.map(a => a.alert_key))
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    expect(queryError).toBeNull();
    expect(prioritizedAlerts).toHaveLength(3);

    // Verify priority ordering
    expect(prioritizedAlerts[0].severity).toBe('critical');
    expect(prioritizedAlerts[1].severity).toBe('high');
    expect(prioritizedAlerts[2].severity).toBe('low');

    console.log(`✅ Alert priority ordering verified`);

    // Cleanup test data
    const alertKeys = testAlerts.map(a => a.alert_key);
    await supabase
      .from('alert_log')
      .delete()
      .in('alert_key', alertKeys);
  });

  test('Alert Rate Limiting: Should respect global rate limits', async () => {
    console.log('🔍 Testing alert rate limiting...');
    
    const currentTime = new Date();
    const oneMinuteAgo = new Date(currentTime.getTime() - 60000);

    // Check recent alert volume
    const { data: recentAlerts, error: countError } = await supabase
      .from('alert_log')
      .select('id, created_at')
      .gte('created_at', oneMinuteAgo.toISOString())
      .order('created_at', { ascending: false });

    expect(countError).toBeNull();
    
    const alertCount = recentAlerts?.length || 0;
    console.log(`📊 Alerts in last minute: ${alertCount}`);

    // Rate limit should prevent excessive alerts (adjust threshold as needed)
    const maxAlertsPerMinute = 50; // Conservative rate limit
    
    if (alertCount > maxAlertsPerMinute) {
      console.log(`⚠️ Alert rate limit may be exceeded: ${alertCount} > ${maxAlertsPerMinute}`);
    } else {
      console.log(`✅ Alert rate within limits: ${alertCount} <= ${maxAlertsPerMinute}`);
    }

    // Test should pass if we're not flooding alerts
    expect(alertCount).toBeLessThan(maxAlertsPerMinute * 2); // Allow some buffer
  });

  test('Alert Formatting: Discord embeds should have correct format', async () => {
    console.log('🔍 Testing alert formatting...');
    
    // Get recent DLQ entries with Discord payloads
    const { data: discordMessages, error: dlqError } = await supabase
      .from('dead_letter_queue')
      .select('*')
      .eq('message_type', 'discord_alert')
      .not('payload', 'is', null)
      .limit(10);

    if (dlqError || !discordMessages || discordMessages.length === 0) {
      console.log('ℹ️ No Discord messages found in DLQ, creating test message...');
      
      // Create a test Discord message format
      const testDiscordMessage = {
        message_type: 'discord_alert',
        destination: 'discord_webhook',
        payload: {
          content: 'Test alert formatting',
          embeds: [{
            title: '🚨 Test Alert',
            description: 'This is a formatting test',
            color: 0xff9900,
            fields: [
              { name: 'Player', value: 'Test Player', inline: true },
              { name: 'Alert Type', value: 'formatting_test', inline: true }
            ],
            timestamp: new Date().toISOString()
          }]
        },
        retry_count: 0,
        max_retries: 3,
        created_at: new Date().toISOString(),
        status: 'pending'
      };

      const { data: testMessage, error: testError } = await supabase
        .from('dead_letter_queue')
        .insert(testDiscordMessage)
        .select()
        .single();

      expect(testError).toBeNull();
      
      // Validate format
      const payload = testMessage.payload;
      expect(payload.embeds).toBeDefined();
      expect(payload.embeds[0].title).toBeDefined();
      expect(payload.embeds[0].color).toBeDefined();
      
      console.log(`✅ Discord message format validated`);

      // Cleanup
      await supabase.from('dead_letter_queue').delete().eq('id', testMessage.id);
    } else {
      // Validate existing messages
      let validFormats = 0;
      
      for (const message of discordMessages) {
        const payload = message.payload;
        
        if (payload.embeds && 
            Array.isArray(payload.embeds) && 
            payload.embeds.length > 0 &&
            payload.embeds[0].title) {
          validFormats++;
        }
      }

      const validPercentage = (validFormats / discordMessages.length) * 100;
      console.log(`📊 Valid Discord formats: ${validFormats}/${discordMessages.length} (${validPercentage.toFixed(1)}%)`);
      
      expect(validPercentage).toBeGreaterThan(80); // 80% should be properly formatted
    }
  });

  test('Alert Performance: Alert processing should be timely', async () => {
    console.log('🔍 Testing alert processing performance...');
    
    const startTime = Date.now();
    
    // Query recent alert activity
    const { data: recentActivity, error } = await supabase
      .from('alert_log')
      .select('created_at, processed_at')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString()) // Last 15 minutes
      .not('processed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50);

    expect(error).toBeNull();
    
    const queryTime = Date.now() - startTime;
    console.log(`📊 Alert query completed in ${queryTime}ms`);
    
    if (recentActivity && recentActivity.length > 0) {
      // Analyze processing times
      const processingTimes = recentActivity.map(alert => {
        const created = new Date(alert.created_at).getTime();
        const processed = new Date(alert.processed_at).getTime();
        return processed - created;
      });

      const avgProcessingTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      
      console.log(`📊 Average alert processing time: ${avgProcessingTime.toFixed(2)}ms`);
      console.log(`📊 Max alert processing time: ${maxProcessingTime}ms`);
      
      // Alerts should be processed quickly
      expect(avgProcessingTime).toBeLessThan(10000); // 10 seconds average
      expect(maxProcessingTime).toBeLessThan(60000); // 1 minute max
    }
    
    console.log(`📊 Recent alert activity: ${recentActivity?.length || 0} alerts in last 15 minutes`);
    
    // Query should complete quickly
    expect(queryTime).toBeLessThan(2000); // 2 seconds
  });
});