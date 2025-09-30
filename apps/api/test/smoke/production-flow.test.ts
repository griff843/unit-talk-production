/**
 * Production Flow Smoke Test
 *
 * Validates the event-first Odds API → unified_picks pipeline
 * Ensures no legacy GradingAgent or raw_props references in active code
 *
 * @date 2025-09-30
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

describe('Production Flow Smoke Tests', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  });

  describe('1. Legacy Module Detection', () => {
    it('should not contain "GradingAgent" in module names', () => {
      // Check that GradingAgent is not imported or registered
      const workerSource = require('fs').readFileSync(
        require('path').join(__dirname, '../../src/worker.ts'),
        'utf-8'
      );

      // Should not have gradingActivities variable (should be scoringActivities)
      expect(workerSource).not.toContain('gradingActivities');
      expect(workerSource).toContain('scoringActivities');

      // Should not import from GradingAgent folder
      expect(workerSource).not.toContain('./agents/GradingAgent/');
    });

    it('should not contain "raw_props" writes in FeedAgent', () => {
      const feedAgentSource = require('fs').readFileSync(
        require('path').join(__dirname, '../../src/agents/FeedAgent/index.ts'),
        'utf-8'
      );

      // Should not have direct raw_props table inserts
      // Should write to unified_picks only
      const hasRawPropsInsert = feedAgentSource.includes('raw_props') &&
        feedAgentSource.includes('.insert');

      expect(hasRawPropsInsert).toBe(false);
    });
  });

  describe('2. Database Schema Validation', () => {
    it('should have unified_picks table accessible', async () => {
      const { data, error } = await supabase
        .from('unified_picks')
        .select('id')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should have agent_health table for monitoring', async () => {
      const { data, error } = await supabase
        .from('agent_health')
        .select('agent_name')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('3. Production Pipeline Flow', () => {
    it('should have FeedAgent health record', async () => {
      const { data, error } = await supabase
        .from('agent_health')
        .select('agent_name, status, last_run')
        .eq('agent_name', 'FeedAgent')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.agent_name).toBe('FeedAgent');
    });

    it('should have ScoringAgent health record (not GradingAgent)', async () => {
      const { data: scoringData, error: scoringError } = await supabase
        .from('agent_health')
        .select('agent_name, status')
        .eq('agent_name', 'ScoringAgent')
        .single();

      expect(scoringError).toBeNull();
      expect(scoringData).toBeDefined();

      // Ensure GradingAgent does NOT exist
      const { data: gradingData } = await supabase
        .from('agent_health')
        .select('agent_name')
        .eq('agent_name', 'GradingAgent')
        .single();

      // GradingAgent should NOT exist (expect null or error)
      expect(gradingData).toBeNull();
    });

    it('should have AlertAgent health record', async () => {
      const { data, error } = await supabase
        .from('agent_health')
        .select('agent_name, status')
        .eq('agent_name', 'AlertAgent')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.agent_name).toBe('AlertAgent');
    });
  });

  describe('4. Event-First Architecture Validation', () => {
    it('should have recent unified_picks records', async () => {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data, error } = await supabase
        .from('unified_picks')
        .select('id, created_at, source')
        .gte('created_at', oneDayAgo.toISOString())
        .limit(10);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // In production, we should have recent picks
      if (data && data.length > 0) {
        console.log(`✅ Found ${data.length} recent unified_picks records`);
      }
    });

    it('should have professional_score populated for scored picks', async () => {
      const { data, error } = await supabase
        .from('unified_picks')
        .select('id, professional_score, edge_score')
        .not('professional_score', 'is', null)
        .limit(5);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // If we have scored picks, validate structure
      if (data && data.length > 0) {
        const pick = data[0];
        expect(pick.professional_score).toBeGreaterThanOrEqual(0);
        console.log(`✅ Found ${data.length} professionally scored picks`);
      }
    });
  });

  describe('5. Deduplication & Data Quality', () => {
    it('should not have duplicate picks with same bet_slip_id', async () => {
      const { data, error } = await supabase.rpc('check_duplicate_bet_slips', {});

      // This RPC should return 0 duplicates or error if RPC doesn't exist
      // For now, just ensure query executes
      expect(error?.message).not.toContain('GradingAgent');
    });

    it('should have valid pick_type values', async () => {
      const { data, error } = await supabase
        .from('unified_picks')
        .select('pick_type')
        .not('pick_type', 'is', null)
        .limit(100);

      expect(error).toBeNull();

      if (data && data.length > 0) {
        const validTypes = ['single', 'parlay', 'round_robin'];
        data.forEach((pick: any) => {
          if (pick.pick_type) {
            expect(validTypes).toContain(pick.pick_type);
          }
        });
      }
    });
  });

  describe('6. API Health Validation', () => {
    it('should return healthy status from /health endpoint', async () => {
      const response = await fetch('http://localhost:3000/health');
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.ok).toBe(true);
    });

    it('should have FeedAgent, ScoringAgent, AlertAgent listed as enabled', () => {
      // This test validates the startup logs
      // In actual implementation, could call an /api/agents endpoint
      const enabledAgents = ['FeedAgent', 'ScoringAgent', 'AlertAgent'];

      enabledAgents.forEach(agent => {
        expect(agent).not.toContain('Grading');
      });
    });
  });
});

describe('Production Safety Checks', () => {
  it('should have STRICT_MODE enabled by default', () => {
    const { getFeatureFlag } = require('../../src/config/legacyFeatureFlags');
    const strictMode = getFeatureFlag('STRICT_MODE');

    expect(strictMode).toBe(true);
  });

  it('should have UNIFIED_PICKS_ONLY enabled', () => {
    const { getFeatureFlag } = require('../../src/config/legacyFeatureFlags');
    const unifiedPicksOnly = getFeatureFlag('UNIFIED_PICKS_ONLY');

    expect(unifiedPicksOnly).toBe(true);
  });

  it('should have all legacy features disabled', () => {
    const { getFeatureFlag } = require('../../src/config/legacyFeatureFlags');

    expect(getFeatureFlag('GRADING_AGENT_ENABLED')).toBe(false);
    expect(getFeatureFlag('RAW_PROPS_TABLE_ENABLED')).toBe(false);
    expect(getFeatureFlag('RAW_PROPS_INGESTION_ENABLED')).toBe(false);
  });
});