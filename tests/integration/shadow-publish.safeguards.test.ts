/**
 * Shadow Publish: Integration tests for shadow mode safeguards
 * Tests shadow publishing constraints, validation, and audit logging
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { ShadowModeGuard, ShadowPublishRequest } from '../../src/services/ShadowModeGuard';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

describe('Shadow Publish Safeguards', () => {
  let shadowGuard: ShadowModeGuard;
  let originalShadowMode: string;
  let originalPublishToDiscord: string;
  let testChannelId: string;

  beforeAll(async () => {
    // Verify database connection
    const { error } = await supabase.from('system_config').select('key').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    // Store original configuration
    const { data: configs } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['SHADOW_MODE', 'PUBLISH_TO_DISCORD']);

    originalShadowMode = configs?.find(c => c.key === 'SHADOW_MODE')?.value || 'false';
    originalPublishToDiscord = configs?.find(c => c.key === 'PUBLISH_TO_DISCORD')?.value || 'false';

    // Setup test configuration
    testChannelId = `test_channel_${Date.now()}`;
    await supabase.from('system_config').upsert([
      { key: 'SHADOW_PRIVATE_CHANNEL_ID', value: testChannelId },
      { key: 'SHADOW_MAX_DAYS', value: '7' },
      { key: 'SHADOW_REQUIRE_APPROVAL', value: 'false' }
    ]);

    // Initialize shadow guard
    shadowGuard = new ShadowModeGuard(supabase);
  });

  afterAll(async () => {
    // Restore original configuration
    await supabase.from('system_config').upsert([
      { key: 'SHADOW_MODE', value: originalShadowMode },
      { key: 'PUBLISH_TO_DISCORD', value: originalPublishToDiscord }
    ]);

    // Cleanup test data
    await supabase
      .from('shadow_publish_log')
      .delete()
      .like('metadata->test', 'shadow_test_%');
  });

  beforeEach(async () => {
    // Reset to known shadow mode state for each test
    await supabase.from('system_config').upsert([
      { key: 'SHADOW_MODE', value: 'true' },
      { key: 'PUBLISH_TO_DISCORD', value: 'false' }
    ]);
  });

  describe('Shadow Mode Configuration', () => {
    it('should load configuration from database', async () => {
      const config = await shadowGuard.loadConfig();

      expect(config).toBeDefined();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.allowPublicPosting).toBe('boolean');
      expect(typeof config.maxDaysRetention).toBe('number');
    });

    it('should use environment variables as fallback', async () => {
      // Temporarily remove config from database
      await supabase.from('system_config').delete().eq('key', 'SHADOW_MODE');

      const originalEnv = process.env.SHADOW_MODE;
      process.env.SHADOW_MODE = 'true';

      const guard = new ShadowModeGuard(supabase);
      const config = await guard.loadConfig();

      expect(config.enabled).toBe(true);

      // Restore
      process.env.SHADOW_MODE = originalEnv;
      await supabase.from('system_config').upsert({ key: 'SHADOW_MODE', value: 'true' });
    });

    it('should detect configuration inconsistencies', async () => {
      // Set inconsistent config: shadow mode enabled but public posting also enabled
      await supabase.from('system_config').upsert([
        { key: 'SHADOW_MODE', value: 'true' },
        { key: 'PUBLISH_TO_DISCORD', value: 'true' }
      ]);

      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: { test: 'configuration_test' },
        metadata: { test: 'shadow_test_config' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.warnings).toContain(expect.stringMatching(/double check configuration/i));
    });
  });

  describe('Publish Request Validation', () => {
    it('should allow publishing when shadow mode is enabled', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: {
          player: 'Test Player',
          stat: 'points',
          line: 25.5,
          pick: 'over'
        },
        targetChannel: 'general',
        userId: 'test-user-id',
        metadata: { test: 'shadow_test_allow' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.shadowChannelId).toBe(testChannelId);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should block publishing when shadow mode disabled and public posting disabled', async () => {
      await supabase.from('system_config').upsert([
        { key: 'SHADOW_MODE', value: 'false' },
        { key: 'PUBLISH_TO_DISCORD', value: 'false' }
      ]);

      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: { test: 'blocked_test' },
        metadata: { test: 'shadow_test_blocked' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('public posting not allowed');
    });

    it('should detect potentially sensitive content', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: {
          player: 'Test Player',
          apiKey: 'sk_test_12345678901234567890123456789012', // Looks like API key
          debug: 'secret_value_here'
        },
        metadata: { test: 'shadow_test_sensitive' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.warnings.some(w => w.includes('sensitive information'))).toBe(true);
    });

    it('should detect test data in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: {
          player: 'Test Player', // Contains 'test'
          data: 'dummy_data_here' // Contains 'dummy'
        },
        metadata: { test: 'shadow_test_production' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.warnings.some(w => w.includes('test/dummy data'))).toBe(true);

      // Restore
      process.env.NODE_ENV = originalEnv;
    });

    it('should handle approval requirements', async () => {
      await supabase.from('system_config')
        .upsert({ key: 'SHADOW_REQUIRE_APPROVAL', value: 'true' });

      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: { test: 'approval_test' },
        metadata: { test: 'shadow_test_approval' }
      };

      const result = await shadowGuard.validatePublishRequest(request);

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
      expect(result.warnings.some(w => w.includes('requires manual approval'))).toBe(true);
    });
  });

  describe('Event Logging', () => {
    it('should log shadow publish events', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: { player: 'Test Player', stat: 'points' },
        targetChannel: 'general',
        userId: 'test-user-id',
        metadata: { test: 'shadow_test_logging' }
      };

      const validation = await shadowGuard.validatePublishRequest(request);
      await shadowGuard.logShadowEvent(request, validation, true);

      // Verify log entry was created
      const { data: logEntries } = await supabase
        .from('shadow_publish_log')
        .select('*')
        .eq('content_type', 'pick')
        .like('metadata->test', 'shadow_test_logging');

      expect(logEntries).toBeDefined();
      expect(logEntries!.length).toBeGreaterThan(0);

      const logEntry = logEntries![0];
      expect(logEntry.content_type).toBe('pick');
      expect(logEntry.target_channel).toBe('general');
      expect(logEntry.user_id).toBe('test-user-id');
      expect(logEntry.success).toBe(true);
      expect(logEntry.shadow_channel).toBe(testChannelId);
    });

    it('should log errors with shadow events', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'alert',
        content: { type: 'error_test' },
        metadata: { test: 'shadow_test_error' }
      };

      const validation = await shadowGuard.validatePublishRequest(request);
      await shadowGuard.logShadowEvent(request, validation, false, 'Test error message');

      // Verify error was logged
      const { data: logEntries } = await supabase
        .from('shadow_publish_log')
        .select('*')
        .eq('success', false)
        .like('metadata->test', 'shadow_test_error');

      expect(logEntries).toBeDefined();
      expect(logEntries!.length).toBeGreaterThan(0);

      const errorEntry = logEntries![0];
      expect(errorEntry.success).toBe(false);
      expect(errorEntry.error_message).toBe('Test error message');
    });

    it('should create audit trail entries', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'recap',
        content: { summary: 'Test recap' },
        metadata: { test: 'shadow_test_audit' }
      };

      const validation = await shadowGuard.validatePublishRequest(request);
      await shadowGuard.logShadowEvent(request, validation, true);

      // Verify audit log entry exists
      const { data: auditEntries } = await supabase
        .from('audit_log')
        .select('*')
        .eq('operation', 'SHADOW_PUBLISH')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(auditEntries).toBeDefined();
      expect(auditEntries!.length).toBeGreaterThan(0);
      expect(auditEntries![0].table_name).toBe('shadow_publish_log');
    });
  });

  describe('Data Cleanup', () => {
    it('should identify cleanup needs', async () => {
      // Create old test entry (simulate old data)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

      await supabase.from('shadow_publish_log').insert({
        content_type: 'pick',
        shadow_mode_enabled: true,
        public_posting_allowed: false,
        success: true,
        created_at: oldDate.toISOString(),
        metadata: { test: 'shadow_test_cleanup_old' }
      });

      const cleanup = await shadowGuard.checkCleanupNeeded();

      expect(cleanup.needed).toBe(true);
      expect(cleanup.oldRecords).toBeGreaterThan(0);
    });

    it('should perform cleanup correctly', async () => {
      // Create old entries for cleanup
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await supabase.from('shadow_publish_log').insert([
        {
          content_type: 'pick',
          shadow_mode_enabled: true,
          public_posting_allowed: false,
          success: true,
          created_at: oldDate.toISOString(),
          metadata: { test: 'shadow_test_cleanup_1' }
        },
        {
          content_type: 'alert',
          shadow_mode_enabled: true,
          public_posting_allowed: false,
          success: true,
          created_at: oldDate.toISOString(),
          metadata: { test: 'shadow_test_cleanup_2' }
        }
      ]);

      const result = await shadowGuard.performCleanup();

      expect(result.deleted).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();

      // Verify cleanup audit log
      const { data: auditEntries } = await supabase
        .from('audit_log')
        .select('*')
        .eq('operation', 'CLEANUP')
        .eq('table_name', 'shadow_publish_log')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(auditEntries).toBeDefined();
      expect(auditEntries!.length).toBeGreaterThan(0);
    });
  });

  describe('Status Monitoring', () => {
    it('should provide comprehensive status information', async () => {
      const status = await shadowGuard.getStatus();

      expect(status).toBeDefined();
      expect(typeof status.enabled).toBe('boolean');
      expect(status.config).toBeDefined();
      expect(typeof status.recentEvents).toBe('number');
      expect(typeof status.cleanupNeeded).toBe('boolean');
      expect(typeof status.oldRecords).toBe('number');
    });

    it('should provide shadow_mode_status view', async () => {
      const { data, error } = await supabase
        .from('shadow_mode_status')
        .select('*')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(typeof data.shadow_mode_enabled).toBe('boolean');
      expect(typeof data.publish_to_discord_enabled).toBe('boolean');
      expect(typeof data.events_24h).toBe('number');
      expect(typeof data.errors_24h).toBe('number');
      expect(data.config_status).toBeDefined();
    });
  });

  describe('Emergency Controls', () => {
    it('should emergency disable shadow mode', async () => {
      // Enable shadow mode first
      await supabase.from('system_config').upsert({ key: 'SHADOW_MODE', value: 'true' });

      const result = await shadowGuard.emergencyDisable(
        'Test emergency disable',
        'test-user'
      );

      expect(result).toBe(true);

      // Verify configuration changed
      const { data: configs } = await supabase
        .from('system_config')
        .select('key, value')
        .in('key', ['SHADOW_MODE', 'PUBLISH_TO_DISCORD']);

      const shadowMode = configs?.find(c => c.key === 'SHADOW_MODE')?.value;
      const publishEnabled = configs?.find(c => c.key === 'PUBLISH_TO_DISCORD')?.value;

      expect(shadowMode).toBe('false');
      expect(publishEnabled).toBe('true');

      // Verify audit log
      const { data: auditEntries } = await supabase
        .from('audit_log')
        .select('*')
        .eq('operation', 'EMERGENCY_DISABLE')
        .order('timestamp', { ascending: false })
        .limit(1);

      expect(auditEntries).toBeDefined();
      expect(auditEntries!.length).toBeGreaterThan(0);
      expect(auditEntries![0].details.reason).toBe('Test emergency disable');
    });
  });

  describe('Database Function Integration', () => {
    it('should work with cleanup_shadow_publish_logs function', async () => {
      // Create old test data
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      await supabase.from('shadow_publish_log').insert({
        content_type: 'pick',
        shadow_mode_enabled: true,
        public_posting_allowed: false,
        success: true,
        created_at: oldDate.toISOString(),
        metadata: { test: 'shadow_test_db_cleanup' }
      });

      // Call database cleanup function
      const { data, error } = await supabase.rpc('cleanup_shadow_publish_logs');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
      if (data.length > 0) {
        expect(typeof data[0].deleted_count).toBe('number');
        expect(typeof data[0].retention_days).toBe('number');
      }
    });
  });

  describe('Integration with Shadow Publishing Flow', () => {
    it('should validate complete shadow publishing workflow', async () => {
      const request: ShadowPublishRequest = {
        contentType: 'pick',
        content: {
          player: 'Integration Test Player',
          stat: 'points',
          line: 25.5,
          pick: 'over',
          confidence: 0.85,
          expectedValue: 0.05
        },
        targetChannel: 'picks',
        userId: 'integration-test-user',
        metadata: { test: 'shadow_test_integration' }
      };

      // 1. Validate request
      const validation = await shadowGuard.validatePublishRequest(request);
      expect(validation.allowed).toBe(true);

      // 2. Log shadow event (simulating successful publish)
      await shadowGuard.logShadowEvent(request, validation, true);

      // 3. Verify in monitoring view
      const { data: status } = await supabase
        .from('shadow_mode_status')
        .select('events_24h, picks_24h')
        .single();

      expect(status).toBeDefined();
      expect(status.events_24h).toBeGreaterThan(0);
      expect(status.picks_24h).toBeGreaterThan(0);

      // 4. Check status through guard
      const guardStatus = await shadowGuard.getStatus();
      expect(guardStatus.recentEvents).toBeGreaterThan(0);
    });
  });
});