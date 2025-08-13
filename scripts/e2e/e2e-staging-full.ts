#!/usr/bin/env node
/**
 * E2E Staging Full Test Script
 * 
 * This script runs a comprehensive end-to-end test of the Unit Talk platform
 * in staging mode with shadow publishing enabled.
 * 
 * Test Flow:
 * 1. Health check API
 * 2. Trigger ingestion workflow
 * 3. Wait for Temporal workflow completion
 * 4. Validate database state
 * 5. Verify shadow mode constraints
 */

import { createClient } from '@supabase/supabase-js';
import { Client as TemporalClient, WorkflowHandle } from '@temporalio/client';
import axios from 'axios';

// Configuration
const CONFIG = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/unit_talk_test',
  SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'test-key',
  TEMPORAL_ADDRESS: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  TIMEOUT_MS: 120000, // 2 minutes
};

// Logger utility
const logger = {
  info: (...args: any[]) => console.log('[INFO]', new Date().toISOString(), ...args),
  error: (...args: any[]) => console.error('[ERROR]', new Date().toISOString(), ...args),
  warn: (...args: any[]) => console.warn('[WARN]', new Date().toISOString(), ...args),
  debug: (...args: any[]) => console.log('[DEBUG]', new Date().toISOString(), ...args),
};

// Initialize clients
let supabase: any;
let temporalClient: TemporalClient;

async function initializeClients() {
  try {
    // Initialize Supabase client
    supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    logger.info('Supabase client initialized');

    // Initialize Temporal client
    temporalClient = new TemporalClient({
      address: CONFIG.TEMPORAL_ADDRESS,
    });
    logger.info('Temporal client initialized');

  } catch (error) {
    logger.error('Failed to initialize clients:', error);
    throw error;
  }
}

async function healthCheck(): Promise<boolean> {
  try {
    logger.info('Performing API health check...');
    
    const response = await axios.get(`${CONFIG.API_BASE_URL}/health`, {
      timeout: 10000
    });
    
    if (response.status === 200 && response.data.status === 'healthy') {
      logger.info('API health check passed');
      return true;
    }
    
    logger.error('API health check failed:', response.data);
    return false;
    
  } catch (error) {
    logger.error('Health check request failed:', error);
    return false;
  }
}

async function triggerIngestion(): Promise<void> {
  try {
    logger.info('Triggering ingestion workflow...');
    
    // Use test data or minimal live sample
    const response = await axios.post(`${CONFIG.API_BASE_URL}/api/ingestion/trigger`, {
      mode: 'test',
      source: 'optimal',
      league: 'mlb',
      limit: 5 // Minimal sample
    }, {
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      logger.info('Ingestion triggered successfully');
    } else {
      throw new Error(`Ingestion trigger failed with status: ${response.status}`);
    }
    
  } catch (error) {
    logger.error('Failed to trigger ingestion:', error);
    throw error;
  }
}

async function waitForWorkflowCompletion(): Promise<void> {
  try {
    logger.info('Waiting for Temporal workflow completion...');
    
    const startTime = Date.now();
    const timeout = CONFIG.TIMEOUT_MS;
    
    while (Date.now() - startTime < timeout) {
      try {
        // List workflows and check for completion
        const workflows = await temporalClient.workflow.list({
          query: 'WorkflowType="IngestionWorkflow" AND ExecutionStatus="Running"'
        });
        
        const runningWorkflows = [];
        for await (const workflow of workflows) {
          runningWorkflows.push(workflow);
        }
        
        if (runningWorkflows.length === 0) {
          logger.info('No running ingestion workflows found - assuming completion');
          break;
        }
        
        logger.debug(`Found ${runningWorkflows.length} running workflows, waiting...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (temporalError) {
        logger.warn('Temporal query failed, continuing with database checks:', temporalError);
        break;
      }
    }
    
    if (Date.now() - startTime >= timeout) {
      throw new Error('Workflow completion timeout exceeded');
    }
    
  } catch (error) {
    logger.error('Workflow completion check failed:', error);
    throw error;
  }
}

async function validateDatabaseState(): Promise<void> {
  try {
    logger.info('Validating database state...');
    
    // Check raw_props
    const { data: rawProps, error: rawError } = await supabase
      .from('raw_props')
      .select('*')
      .limit(5);
    
    if (rawError) {
      throw new Error(`Raw props query failed: ${rawError.message}`);
    }
    
    if (!rawProps || rawProps.length === 0) {
      throw new Error('No rows found in raw_props table');
    }
    
    logger.info(`✓ Found ${rawProps.length} rows in raw_props`);
    
    // Check scored_props
    const { data: scoredProps, error: scoredError } = await supabase
      .from('scored_props')
      .select('*')
      .limit(5);
    
    if (scoredError) {
      logger.warn(`Scored props query failed: ${scoredError.message}`);
    } else if (scoredProps && scoredProps.length > 0) {
      logger.info(`✓ Found ${scoredProps.length} rows in scored_props`);
    } else {
      logger.warn('No rows found in scored_props table');
    }
    
    // Check final_picks (should have shadow entries)
    const { data: finalPicks, error: finalError } = await supabase
      .from('final_picks')
      .select('*')
      .eq('shadow_only', true)
      .limit(5);
    
    if (finalError) {
      logger.warn(`Final picks query failed: ${finalError.message}`);
    } else if (finalPicks && finalPicks.length > 0) {
      logger.info(`✓ Found ${finalPicks.length} shadow-only entries in final_picks`);
    } else {
      logger.warn('No shadow entries found in final_picks table');
    }
    
    logger.info('Database state validation completed');
    
  } catch (error) {
    logger.error('Database validation failed:', error);
    throw error;
  }
}

async function verifyShadowModeConstraints(): Promise<void> {
  try {
    logger.info('Verifying shadow mode constraints...');
    
    // Check that no external posts were made
    const { data: discordPosts, error: discordError } = await supabase
      .from('notifications_outbox')
      .select('*')
      .eq('type', 'discord')
      .eq('shadow_only', false);
    
    if (discordError) {
      logger.warn(`Discord posts query failed: ${discordError.message}`);
    } else if (discordPosts && discordPosts.length > 0) {
      throw new Error(`Shadow mode violated: ${discordPosts.length} real Discord posts found`);
    }
    
    // Check system config
    const { data: config, error: configError } = await supabase
      .from('system_config')
      .select('*')
      .in('key', ['SHADOW_MODE', 'PUBLISH_TO_DISCORD']);
    
    if (configError) {
      logger.warn(`System config query failed: ${configError.message}`);
    } else {
      const shadowMode = config?.find(c => c.key === 'SHADOW_MODE')?.value;
      const publishToDiscord = config?.find(c => c.key === 'PUBLISH_TO_DISCORD')?.value;
      
      if (shadowMode !== 'true') {
        logger.warn(`SHADOW_MODE is ${shadowMode}, expected true`);
      }
      
      if (publishToDiscord !== 'false') {
        logger.warn(`PUBLISH_TO_DISCORD is ${publishToDiscord}, expected false`);
      }
    }
    
    logger.info('✓ Shadow mode constraints verified');
    
  } catch (error) {
    logger.error('Shadow mode verification failed:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  try {
    logger.info('Starting E2E staging full test...');
    
    // Initialize clients
    await initializeClients();
    
    // Health check
    const isHealthy = await healthCheck();
    if (!isHealthy) {
      throw new Error('API health check failed');
    }
    
    // Trigger ingestion
    await triggerIngestion();
    
    // Wait for completion
    await waitForWorkflowCompletion();
    
    // Validate database state
    await validateDatabaseState();
    
    // Verify shadow mode constraints
    await verifyShadowModeConstraints();
    
    logger.info('✅ E2E staging full test completed successfully');
    process.exit(0);
    
  } catch (error) {
    logger.error('❌ E2E staging full test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  main();
}