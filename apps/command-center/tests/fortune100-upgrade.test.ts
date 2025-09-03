/**
 * @fileoverview Comprehensive test suite for Fortune-100 Command Center upgrade
 * Tests all new functionality: SLO monitoring, exposure tracking, admin controls, etc.
 */

// Simple Node.js test runner (compatible with existing Playwright setup)
import { getSupabaseClient } from '../src/lib/supabase';
import { RBACService, Role, Permission } from '../src/lib/rbac';
import { metricsAggregator } from '../src/services/MetricsAggregator';

// =============================================================================
// TEST SETUP & UTILITIES
// =============================================================================

const TEST_USER_ID = 'test-user-admin';
const TEST_PICK_ID = 'test-pick-123';

// Test helper functions
function describe(name: string, fn: () => void) {
  console.log(`\n📋 ${name}`);
  fn();
}

function test(name: string, fn: () => Promise<void> | void) {
  console.log(`  ➤ ${name}`);
  return fn();
}

function expect(actual: any) {
  return {
    toBe: (expected: any) => {
      if (actual !== expected) throw new Error(`Expected ${actual} to be ${expected}`);
    },
    toBeTruthy: () => {
      if (!actual) throw new Error(`Expected ${actual} to be truthy`);
    },
    toBeNull: () => {
      if (actual !== null) throw new Error(`Expected ${actual} to be null`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error(`Expected ${actual} to be defined`);
    },
    toBeGreaterThan: (expected: number) => {
      if (actual <= expected) throw new Error(`Expected ${actual} to be greater than ${expected}`);
    },
    toBeLessThan: (expected: number) => {
      if (actual >= expected) throw new Error(`Expected ${actual} to be less than ${expected}`);
    },
    toContain: (expected: any) => {
      if (!actual.includes(expected)) throw new Error(`Expected ${actual} to contain ${expected}`);
    }
  };
}

async function setupTests() {
  try {
    // Grant admin role for testing
    await RBACService.grantRole(TEST_USER_ID, Role.ADMIN, 'test-system');
    
    // Start metrics aggregator for integration tests
    metricsAggregator.start();
    console.log('✅ Test setup completed');
  } catch (error) {
    console.error('❌ Test setup failed:', error);
  }
}

async function teardownTests() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.error('❌ Supabase client not initialized for teardown');
      return;
    }
    
    // Cleanup test data
    await supabase.from('roles').delete().eq('user_id', TEST_USER_ID);
    await supabase.from('audit_log').delete().eq('actor', TEST_USER_ID);
    await supabase.from('exposure_snapshots').delete().eq('unified_pick_id', TEST_PICK_ID);
    
    // Stop metrics aggregator
    metricsAggregator.stop();
    console.log('✅ Test teardown completed');
  } catch (error) {
    console.error('❌ Test teardown failed:', error);
  }
}

// =============================================================================
// DATABASE SCHEMA TESTS
// =============================================================================

describe('Database Schema Migration Tests', () => {
  test('should have all required tables created', async () => {
    const tables = [
      'system_metrics',
      'slos', 
      'slo_incidents',
      'exposure_snapshots',
      'audit_log',
      'roles',
      'temporal_workflow_health',
      'temporal_schedule_health'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }
  });

  test('should have all required views created', async () => {
    const views = [
      'vw_queue_backlog',
      'vw_grading_lag', 
      'vw_clv_cohorts',
      'vw_post_window_reco',
      'vw_exposure_summary',
      'vw_slo_status'
    ];

    for (const view of views) {
      const { data, error } = await supabase
        .from(view)
        .select('*')
        .limit(1);
      
      expect(error).toBeNull();
      expect(data).toBeDefined();
    }
  });

  test('should have proper indexes for performance', async () => {
    // Test that queries execute quickly with proper indexing
    const start = Date.now();
    
    await supabase
      .from('system_metrics')
      .select('*')
      .eq('metric', 'test_metric')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(500); // Should be fast with proper indexing
  });

  test('should enforce foreign key constraints', async () => {
    // Test SLO incident FK constraint
    const { error } = await supabase
      .from('slo_incidents')
      .insert({
        slo_id: 'non-existent-slo-id',
        burn_rate: 2.5,
        window: '1h',
        status: 'open',
        severity: 'high'
      });

    expect(error).toBeTruthy();
    expect(error?.message).toContain('foreign key constraint');
  });
});

// =============================================================================
// RBAC & SECURITY TESTS
// =============================================================================

describe('RBAC & Security Tests', () => {
  test('should grant and verify role permissions', async () => {
    const testUserId = 'test-rbac-user';
    
    // Grant OPS role
    await RBACService.grantRole(testUserId, Role.OPS, TEST_USER_ID);
    
    // Verify permissions
    const hasViewPermission = await RBACService.hasPermission(testUserId, Permission.VIEW_DASHBOARD);
    const hasControlPermission = await RBACService.hasPermission(testUserId, Permission.CONTROL_AGENTS);
    const hasAdminPermission = await RBACService.hasPermission(testUserId, Permission.SAFE_MODE);
    
    expect(hasViewPermission).toBe(true);
    expect(hasControlPermission).toBe(true);
    expect(hasAdminPermission).toBe(false);
    
    // Cleanup
    await RBACService.revokeRole(testUserId, TEST_USER_ID);
  });

  test('should log audit events for all admin actions', async () => {
    const beforeCount = await getAuditLogCount();
    
    await RBACService.logAudit({
      actor: TEST_USER_ID,
      actor_type: 'user',
      action: 'TEST_ADMIN_ACTION',
      resource_type: 'system',
      resource_id: 'test',
      status: 'success'
    });
    
    const afterCount = await getAuditLogCount();
    expect(afterCount).toBe(beforeCount + 1);
  });

  test('should require permissions for protected endpoints', async () => {
    // Test admin endpoint without proper role
    const response = await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'unauthorized-user'
      },
      body: JSON.stringify({ enable: true })
    });
    
    expect(response.status).toBe(403);
  });
});

// =============================================================================
// SLO MONITORING TESTS
// =============================================================================

describe('SLO Monitoring Tests', () => {
  test('should create and track SLO violations', async () => {
    // Create test SLO
    const { data: slo } = await supabase
      .from('slos')
      .insert({
        name: 'test_slo',
        title: 'Test SLO',
        objective: 1000,
        window: '1h',
        sli_metric: 'test_metric',
        error_budget: 0.1
      })
      .select()
      .single();

    expect(slo).toBeTruthy();
    
    // Create metrics that violate SLO
    await supabase
      .from('system_metrics')
      .insert([
        {
          metric: 'test_metric',
          value: 2000, // Above objective
          source: 'test'
        },
        {
          metric: 'test_metric', 
          value: 1500, // Above objective
          source: 'test'
        }
      ]);

    // Test burn rate calculation
    const { data: burnRate } = await supabase
      .rpc('calculate_slo_burn_rate', {
        slo_name: 'test_slo',
        window_duration: '1 hour'
      });

    expect(burnRate).toBeGreaterThan(0);
    
    // Cleanup
    await supabase.from('slos').delete().eq('name', 'test_slo');
    await supabase.from('system_metrics').delete().eq('metric', 'test_metric');
  });

  test('should create incidents for burn rate violations', async () => {
    // This would test the MetricsAggregator SLO burn rate checking
    // For now, test the manual incident creation
    const { data: slo } = await supabase
      .from('slos')
      .insert({
        name: 'test_incident_slo',
        title: 'Test Incident SLO', 
        objective: 100,
        window: '1h',
        sli_metric: 'test_incident_metric',
        error_budget: 0.05
      })
      .select()
      .single();

    const { data: incident } = await supabase
      .from('slo_incidents')
      .insert({
        slo_id: slo.id,
        burn_rate: 15.0, // High burn rate
        window: '1h',
        status: 'open',
        severity: 'critical'
      })
      .select()
      .single();

    expect(incident).toBeTruthy();
    expect(incident.severity).toBe('critical');
    
    // Cleanup
    await supabase.from('slo_incidents').delete().eq('slo_id', slo.id);
    await supabase.from('slos').delete().eq('id', slo.id);
  });
});

// =============================================================================
// EXPOSURE TRACKING TESTS
// =============================================================================

describe('Exposure Tracking Tests', () => {
  test('should create exposure snapshots with correct risk tiers', async () => {
    const exposureData = {
      unified_pick_id: TEST_PICK_ID,
      sport: 'NBA',
      league: 'NBA',
      event_id: 'test-event-123',
      team: 'Lakers',
      opponent: 'Warriors',
      market: 'player_props',
      stat_type: 'points',
      kelly_fraction: 0.15, // High Kelly fraction
      units: 3.0,
      published: true
    };

    const response = await fetch('/api/exposure/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify(exposureData)
    });

    expect(response.ok).toBe(true);
    
    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.data.risk_tier).toBeDefined();
    expect(['low', 'medium', 'high', 'critical']).toContain(result.data.risk_tier);
  });

  test('should calculate correlation clusters correctly', async () => {
    // Create multiple picks in same game
    const gamePicks = [
      {
        unified_pick_id: 'test-pick-corr-1',
        sport: 'NBA',
        game_id: 'test-game-123',
        team: 'Lakers',
        opponent: 'Warriors',
        market: 'player_props',
        kelly_fraction: 0.05,
        units: 2.0,
        published: true
      },
      {
        unified_pick_id: 'test-pick-corr-2', 
        sport: 'NBA',
        game_id: 'test-game-123',
        team: 'Warriors',
        opponent: 'Lakers', 
        market: 'player_props',
        kelly_fraction: 0.06,
        units: 2.5,
        published: true
      }
    ];

    for (const pick of gamePicks) {
      const response = await fetch('/api/exposure/snapshot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': TEST_USER_ID
        },
        body: JSON.stringify(pick)
      });
      expect(response.ok).toBe(true);
    }

    // Get exposure analysis
    const analysisResponse = await fetch('/api/exposure/snapshot', {
      headers: { 'x-user-id': TEST_USER_ID }
    });

    const analysisResult = await analysisResponse.json();
    expect(analysisResult.success).toBe(true);
    expect(analysisResult.data.correlation_clusters.length).toBeGreaterThan(0);
    
    // Cleanup
    await supabase.from('exposure_snapshots').delete().in('unified_pick_id', ['test-pick-corr-1', 'test-pick-corr-2']);
  });

  test('should generate risk alerts for limit violations', async () => {
    // Create high exposure pick to trigger alerts
    const highExposurePick = {
      unified_pick_id: 'test-pick-high-exposure',
      sport: 'NBA',
      market: 'game_totals',
      kelly_fraction: 0.30, // High Kelly
      units: 10.0, // High units
      published: true
    };

    await fetch('/api/exposure/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify(highExposurePick)
    });

    const analysisResponse = await fetch('/api/exposure/snapshot', {
      headers: { 'x-user-id': TEST_USER_ID }
    });

    const result = await analysisResponse.json();
    expect(result.data.risk_alerts.length).toBeGreaterThan(0);
    
    // Should have Kelly risk alert
    const kellyAlert = result.data.risk_alerts.find(alert => alert.type === 'kelly');
    expect(kellyAlert).toBeDefined();
    
    // Cleanup
    await supabase.from('exposure_snapshots').delete().eq('unified_pick_id', 'test-pick-high-exposure');
  });
});

// =============================================================================
// TEMPORAL HEALTH TESTS
// =============================================================================

describe('Temporal Health Tests', () => {
  test('should track workflow health metrics', async () => {
    // Insert test workflow health data
    const workflowData = {
      workflow_id: 'test-workflow-123',
      workflow_type: 'TestWorkflow',
      task_queue: 'test-queue',
      status: 'completed',
      duration_ms: 5000,
      retry_count: 0,
      started_at: new Date(Date.now() - 10000).toISOString(),
      completed_at: new Date().toISOString()
    };

    const { data } = await supabase
      .from('temporal_workflow_health')
      .insert(workflowData)
      .select()
      .single();

    expect(data).toBeTruthy();
    expect(data.status).toBe('completed');
    
    // Test summary API
    const summaryResponse = await fetch('/api/temporal/summary', {
      headers: { 'x-user-id': TEST_USER_ID }
    });

    const summaryResult = await summaryResponse.json();
    expect(summaryResult.success).toBe(true);
    expect(summaryResult.data.by_workflow.length).toBeGreaterThan(0);
    
    // Cleanup
    await supabase.from('temporal_workflow_health').delete().eq('workflow_id', 'test-workflow-123');
  });

  test('should detect missed schedules', async () => {
    // Create missed schedule
    const missedScheduleData = {
      schedule_id: 'test-schedule-missed',
      workflow_type: 'TestScheduledWorkflow',
      expected_frequency_minutes: 10,
      last_scheduled_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      is_missing: true,
      missing_since: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      enabled: true
    };

    await supabase
      .from('temporal_schedule_health')
      .insert(missedScheduleData);

    const missedResponse = await fetch('/api/temporal/missed-schedules?threshold=10', {
      headers: { 'x-user-id': TEST_USER_ID }
    });

    const missedResult = await missedResponse.json();
    expect(missedResult.success).toBe(true);
    expect(missedResult.data.missed_schedules).toBeGreaterThan(0);
    
    // Should have the test schedule in missed list
    const testSchedule = missedResult.data.schedules.find(s => s.schedule_id === 'test-schedule-missed');
    expect(testSchedule).toBeDefined();
    expect(testSchedule.severity).toBeDefined();
    
    // Cleanup
    await supabase.from('temporal_schedule_health').delete().eq('schedule_id', 'test-schedule-missed');
  });
});

// =============================================================================
// ADMIN CONTROLS TESTS  
// =============================================================================

describe('Admin Controls Tests', () => {
  test('should enable and disable safe mode', async () => {
    // Test enabling safe mode
    const enableResponse = await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        enable: true,
        reason: 'Test safe mode activation'
      })
    });

    expect(enableResponse.ok).toBe(true);
    const enableResult = await enableResponse.json();
    expect(enableResult.success).toBe(true);
    expect(enableResult.data.enabled).toBe(true);

    // Test disabling safe mode
    const disableResponse = await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        enable: false,
        reason: 'Test safe mode deactivation'
      })
    });

    expect(disableResponse.ok).toBe(true);
    const disableResult = await disableResponse.json();
    expect(disableResult.success).toBe(true);
    expect(disableResult.data.enabled).toBe(false);
  });

  test('should enable and disable system freeze', async () => {
    // Test enabling freeze
    const enableResponse = await fetch('/api/admin/freeze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        enable: true,
        reason: 'Test system freeze',
        estimated_duration: '1 hour'
      })
    });

    expect(enableResponse.ok).toBe(true);
    const enableResult = await enableResponse.json();
    expect(enableResult.success).toBe(true);
    expect(enableResult.data.status.enabled).toBe(true);

    // Test disabling freeze
    const disableResponse = await fetch('/api/admin/freeze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        enable: false,
        reason: 'Test system unfreeze'
      })
    });

    expect(disableResponse.ok).toBe(true);
    const disableResult = await disableResponse.json();
    expect(disableResult.success).toBe(true);
    expect(disableResult.data.status.enabled).toBe(false);
  });

  test('should log all admin actions in audit trail', async () => {
    const beforeCount = await getAuditLogCount();
    
    // Perform admin action
    await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({ enable: true, reason: 'Audit test' })
    });

    const afterCount = await getAuditLogCount();
    expect(afterCount).toBeGreaterThan(beforeCount);
    
    // Verify audit entry details
    const { data: auditEntry } = await supabase
      .from('audit_log')
      .select('*')
      .eq('actor', TEST_USER_ID)
      .eq('action', 'ENABLE_SAFE_MODE')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(auditEntry).toBeTruthy();
    expect(auditEntry.resource_type).toBe('system');
    expect(auditEntry.status).toBe('success');
  });
});

// =============================================================================
// METRICS AGGREGATOR TESTS
// =============================================================================

describe('Metrics Aggregator Tests', () => {
  test('should collect and store system metrics', async () => {
    // Let metrics aggregator run for a bit
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if metrics were collected
    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .eq('source', 'metrics_aggregator')
      .order('created_at', { ascending: false })
      .limit(5);

    expect(metrics.length).toBeGreaterThan(0);
    
    // Should have various metric types
    const metricTypes = metrics.map(m => m.metric);
    expect(metricTypes).toContain('system_uptime_pct');
  });

  test('should cleanup expired metrics', async () => {
    // Insert test metric with past expiration
    const expiredMetric = {
      metric: 'test_expired_metric',
      value: 100,
      source: 'test',
      expires_at: new Date(Date.now() - 1000).toISOString() // Expired 1 second ago
    };

    await supabase.from('system_metrics').insert(expiredMetric);
    
    // Run cleanup function
    const { data: cleanupCount } = await supabase.rpc('cleanup_expired_metrics');
    
    expect(cleanupCount).toBeGreaterThan(0);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('End-to-End Integration Tests', () => {
  test('should handle complete exposure workflow', async () => {
    // 1. Create exposure snapshot
    const exposureResponse = await fetch('/api/exposure/snapshot', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({
        unified_pick_id: 'e2e-test-pick',
        sport: 'NBA',
        market: 'player_props',
        kelly_fraction: 0.20,
        units: 5.0,
        published: true
      })
    });

    expect(exposureResponse.ok).toBe(true);

    // 2. Get exposure analysis with remediation
    const analysisResponse = await fetch('/api/exposure/snapshot?include_remediation=true', {
      headers: { 'x-user-id': TEST_USER_ID }
    });

    const analysisResult = await analysisResponse.json();
    expect(analysisResult.success).toBe(true);
    expect(analysisResult.data.total_exposure).toBeGreaterThan(0);
    
    // 3. Should have risk alerts for high Kelly
    expect(analysisResult.data.risk_alerts.length).toBeGreaterThan(0);
    
    // Cleanup
    await supabase.from('exposure_snapshots').delete().eq('unified_pick_id', 'e2e-test-pick');
  });

  test('should handle complete admin workflow with audit trail', async () => {
    const beforeAuditCount = await getAuditLogCount();
    
    // 1. Enable safe mode
    await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({ enable: true, reason: 'E2E test' })
    });

    // 2. Enable freeze mode
    await fetch('/api/admin/freeze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({ enable: true, reason: 'E2E test freeze' })
    });

    // 3. Verify audit trail
    const afterAuditCount = await getAuditLogCount();
    expect(afterAuditCount).toBe(beforeAuditCount + 2);
    
    // 4. Disable both
    await fetch('/api/admin/safe-mode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({ enable: false })
    });

    await fetch('/api/admin/freeze', {
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': TEST_USER_ID
      },
      body: JSON.stringify({ enable: false })
    });
  });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('Performance Tests', () => {
  test('should handle high volume metric insertion', async () => {
    const metrics = Array.from({ length: 100 }, (_, i) => ({
      metric: `perf_test_metric_${i}`,
      value: Math.random() * 1000,
      source: 'performance_test',
      created_at: new Date().toISOString()
    }));

    const start = Date.now();
    const { error } = await supabase.from('system_metrics').insert(metrics);
    const duration = Date.now() - start;

    expect(error).toBeNull();
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    // Cleanup
    await supabase.from('system_metrics').delete().eq('source', 'performance_test');
  });

  test('should handle concurrent API requests', async () => {
    const requests = Array.from({ length: 10 }, () =>
      fetch('/api/temporal/summary', {
        headers: { 'x-user-id': TEST_USER_ID }
      })
    );

    const start = Date.now();
    const responses = await Promise.all(requests);
    const duration = Date.now() - start;

    expect(responses.every(r => r.ok)).toBe(true);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getAuditLogCount(): Promise<number> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return 0;
  }
  
  const { count } = await supabase
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('actor', TEST_USER_ID);
  
  return count || 0;
}

// Export for test runner or run directly
if (require.main === module) {
  console.log('🧪 Running Fortune-100 Command Center Tests...\n');
  
  setupTests().then(() => {
    console.log('✅ Tests can be run - basic setup works');
  }).catch(error => {
    console.error('❌ Test setup failed:', error);
  }).finally(() => {
    teardownTests();
  });
}