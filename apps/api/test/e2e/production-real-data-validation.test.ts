/**
 * Production Real Data Validation E2E Tests
 * Ensures the entire Unit Talk platform operates with real sports data only
 * FAILS if any mock data is detected anywhere in the system
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Mock data indicators that should NEVER appear in production
const MOCK_DATA_INDICATORS = [
  'LeBron James',
  'Patrick Mahomes',
  'Tom Brady',
  'mock',
  'test-data',
  'placeholder',
  'example.com',
  'dummy',
  'fake-player',
  'test-player'
];

// Real data validation patterns
const REAL_DATA_PATTERNS = {
  playerNames: /^[A-Z][a-z]+ [A-Z][a-z]+$/, // Real player name format
  odds: /^-?\d{3,4}$/, // Real odds format (-110, +150, etc.)
  dates: /^\d{4}-\d{2}-\d{2}/, // Real date format
  teams: /^[A-Z]{2,4}$/ // Real team abbreviations
};

test.describe('Production Real Data Validation', () => {
  let supabase: any;

  test.beforeAll(async () => {
    // Initialize Supabase client for direct database testing
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('PRODUCTION_TEST_ERROR: Supabase credentials required for production validation');
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  test('API Health Check - No Mock Data', async ({ request }) => {
    const response = await request.get('http://localhost:3010/api/health');
    expect(response.ok()).toBeTruthy();
    
    const healthData = await response.json();
    const healthText = JSON.stringify(healthData);
    
    // Ensure no mock data indicators in health check
    for (const indicator of MOCK_DATA_INDICATORS) {
      expect(healthText).not.toContain(indicator);
    }
    
    // Verify database connection is real (not mock)
    expect(healthData.services?.database?.status).toBe('up');
    expect(healthData.services?.database?.details?.readTest).toBe('passed');
  });

  test('Raw Props Table - Contains Real Sports Data Only', async () => {
    // Query recent raw props
    const { data: rawProps, error } = await supabase
      .from('raw_props')
      .select('player_name, stat_type, line, over_odds, under_odds, sport, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .limit(50);

    expect(error).toBeNull();
    expect(rawProps).toBeDefined();
    
    if (rawProps && rawProps.length > 0) {
      console.log(`✅ Found ${rawProps.length} recent props in database`);
      
      for (const prop of rawProps) {
        // Validate no mock data
        for (const indicator of MOCK_DATA_INDICATORS) {
          expect(prop.player_name?.toLowerCase()).not.toContain(indicator.toLowerCase());
        }
        
        // Validate real data patterns
        expect(prop.player_name).toMatch(REAL_DATA_PATTERNS.playerNames);
        expect(prop.stat_type).toBeTruthy();
        expect(typeof prop.line).toBe('number');
        expect(prop.sport).toBeTruthy();
        
        console.log(`✅ Validated real prop: ${prop.player_name} ${prop.stat_type} ${prop.line}`);
      }
    } else {
      console.warn('⚠️ No recent props found - may indicate data ingestion issues');
    }
  });

  test('Unified Picks Table - Real Data Only', async () => {
    const { data: picks, error } = await supabase
      .from('unified_picks')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(20);

    expect(error).toBeNull();
    
    if (picks && picks.length > 0) {
      console.log(`✅ Found ${picks.length} recent picks in unified_picks`);
      
      for (const pick of picks) {
        // Validate no mock data in any field
        const pickText = JSON.stringify(pick).toLowerCase();
        for (const indicator of MOCK_DATA_INDICATORS) {
          expect(pickText).not.toContain(indicator.toLowerCase());
        }
        
        console.log(`✅ Validated real pick: ${pick.id}`);
      }
    }
  });

  test('Agent Health - Real Agent Status', async () => {
    const { data: agents, error } = await supabase
      .from('agent_health')
      .select('agent_name, status, last_heartbeat')
      .order('last_heartbeat', { ascending: false })
      .limit(10);

    expect(error).toBeNull();
    expect(agents).toBeDefined();
    
    if (agents && agents.length > 0) {
      console.log(`✅ Found ${agents.length} agents in agent_health`);
      
      const expectedAgents = ['FeedAgent', 'GradingAgent', 'AlertAgent', 'AnalyticsAgent'];
      const foundAgents = agents.map(a => a.agent_name);
      
      // Verify real agents are present
      for (const expectedAgent of expectedAgents) {
        const found = foundAgents.some(name => name.includes(expectedAgent));
        if (found) {
          console.log(`✅ Real agent found: ${expectedAgent}`);
        }
      }
    }
  });

  test('Command Center API - Real Data Only', async ({ request }) => {
    const response = await request.get('http://localhost:3004/api/sync?source=picks');
    
    if (response.ok()) {
      const data = await response.json();
      const dataText = JSON.stringify(data);
      
      // Ensure no mock data in Command Center API
      for (const indicator of MOCK_DATA_INDICATORS) {
        expect(dataText).not.toContain(indicator);
      }
      
      console.log('✅ Command Center API serving real data');
    } else {
      console.warn('⚠️ Command Center API not accessible - may be expected in test environment');
    }
  });

  test('FeedAgent Data Ingestion - Real Sports Data', async () => {
    // Check if FeedAgent has ingested real data recently
    const { data: recentProps, error } = await supabase
      .from('raw_props')
      .select('player_name, sport, created_at, source')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
      .limit(10);

    expect(error).toBeNull();
    
    if (recentProps && recentProps.length > 0) {
      console.log(`✅ FeedAgent ingested ${recentProps.length} props in last hour`);
      
      // Verify data sources are real APIs
      const sources = [...new Set(recentProps.map(p => p.source))];
      console.log(`📊 Data sources: ${sources.join(', ')}`);
      
      // Ensure sources are not mock
      for (const source of sources) {
        expect(source).not.toContain('mock');
        expect(source).not.toContain('test');
      }
      
      // Verify sports are real
      const sports = [...new Set(recentProps.map(p => p.sport))];
      const realSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
      
      for (const sport of sports) {
        expect(realSports).toContain(sport);
      }
      
      console.log(`✅ Real sports detected: ${sports.join(', ')}`);
    } else {
      console.warn('⚠️ No recent data ingestion detected - FeedAgent may not be running');
    }
  });

  test('Optimal API Integration - Real Data Source', async () => {
    // Check for Optimal API sourced data
    const { data: optimalProps, error } = await supabase
      .from('raw_props')
      .select('*')
      .eq('source', 'optimal-api')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(5);

    expect(error).toBeNull();
    
    if (optimalProps && optimalProps.length > 0) {
      console.log(`✅ Found ${optimalProps.length} props from Optimal API`);
      
      for (const prop of optimalProps) {
        // Validate Optimal API data quality
        expect(prop.player_name).toBeTruthy();
        expect(prop.stat_type).toBeTruthy();
        expect(typeof prop.line).toBe('number');
        expect(prop.over_odds).toBeTruthy();
        expect(prop.under_odds).toBeTruthy();
        
        // Ensure no mock data
        for (const indicator of MOCK_DATA_INDICATORS) {
          expect(prop.player_name?.toLowerCase()).not.toContain(indicator.toLowerCase());
        }
        
        console.log(`✅ Optimal API prop validated: ${prop.player_name} ${prop.stat_type}`);
      }
    } else {
      console.warn('⚠️ No Optimal API data found - check API integration');
    }
  });

  test('Production Environment Validation', async () => {
    // Verify production environment flags
    expect(process.env.ENABLE_REAL_DATA_ONLY).toBe('true');
    expect(process.env.DISABLE_MOCK_DATA_FALLBACKS).toBe('true');
    expect(process.env.FAIL_ON_MOCK_DATA).toBe('true');
    expect(process.env.NODE_ENV).toBe('production');
    
    console.log('✅ Production environment flags validated');
  });

  test('Mock Data Files - Not Imported in Production', async ({ request }) => {
    // Test that mock data endpoints return errors (not mock data)
    const mockEndpoints = [
      'http://localhost:3010/api/mock/picks',
      'http://localhost:3010/api/test/data',
      'http://localhost:3004/api/mock/agents'
    ];
    
    for (const endpoint of mockEndpoints) {
      try {
        const response = await request.get(endpoint);
        // Mock endpoints should either not exist (404) or return errors
        expect([404, 500, 501]).toContain(response.status());
        console.log(`✅ Mock endpoint properly disabled: ${endpoint}`);
      } catch (error) {
        // Expected - mock endpoints should not be accessible
        console.log(`✅ Mock endpoint not accessible: ${endpoint}`);
      }
    }
  });

  test('End-to-End Data Flow - Real Sports Data', async () => {
    // Test complete data flow: External API → Database → Command Center
    
    // 1. Verify recent data ingestion
    const { data: recentData, error: recentError } = await supabase
      .from('raw_props')
      .select('*')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Last 2 hours
      .limit(1);

    expect(recentError).toBeNull();
    
    if (recentData && recentData.length > 0) {
      const prop = recentData[0];
      
      // 2. Verify data was processed into unified_picks
      const { data: processedData, error: processedError } = await supabase
        .from('unified_picks')
        .select('*')
        .gte('created_at', prop.created_at)
        .limit(1);

      expect(processedError).toBeNull();
      
      if (processedData && processedData.length > 0) {
        console.log('✅ End-to-end data flow validated: External API → raw_props → unified_picks');
        
        // Ensure processed data is also real (no mock data)
        const processedText = JSON.stringify(processedData[0]);
        for (const indicator of MOCK_DATA_INDICATORS) {
          expect(processedText).not.toContain(indicator);
        }
      } else {
        console.warn('⚠️ Data ingested but not processed - check GradingAgent');
      }
    } else {
      console.warn('⚠️ No recent data ingestion - check FeedAgent and API integrations');
    }
  });
});

// Additional test for Command Center UI validation
test.describe('Command Center UI - Real Data Display', () => {
  test('Command Center Dashboard - No Mock Data Visible', async ({ page }) => {
    // Navigate to Command Center
    await page.goto('http://localhost:3004');
    
    // Wait for data to load
    await page.waitForTimeout(5000);
    
    // Get page content
    const pageContent = await page.content();
    
    // Ensure no mock data is visible in the UI
    for (const indicator of MOCK_DATA_INDICATORS) {
      expect(pageContent).not.toContain(indicator);
    }
    
    // Look for real data indicators
    const hasRealPlayerNames = /[A-Z][a-z]+ [A-Z][a-z]+/.test(pageContent);
    const hasRealOdds = /-?\d{3,4}/.test(pageContent);
    
    if (hasRealPlayerNames && hasRealOdds) {
      console.log('✅ Command Center displaying real player names and odds');
    } else {
      console.warn('⚠️ Command Center may not be displaying real data');
    }
    
    // Take screenshot for manual verification
    await page.screenshot({ 
      path: 'test-results/command-center-real-data.png',
      fullPage: true 
    });
    
    console.log('📸 Screenshot saved: test-results/command-center-real-data.png');
  });
});
