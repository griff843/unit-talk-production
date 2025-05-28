import { execSync } from 'child_process';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { TestHarness } from '../testHarness';
import { GradingAgent } from '../../agents/GradingAgent';
import { DataAgent } from '../../agents/DataAgent';
import { ContestAgent } from '../../agents/ContestAgent';

const DOCKER_COMPOSE_FILE = join(__dirname, '../../../docker-compose.test.yml');

export async function setupTestEnvironment() {
  // Start dependencies with Docker Compose
  execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} up -d`);

  // Wait for services to be ready
  await waitForServices();

  // Create Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Initialize test database
  await initializeTestDatabase(supabase);

  return supabase;
}

export async function teardownTestEnvironment() {
  // Stop Docker Compose services
  execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} down -v`);
}

async function waitForServices() {
  const services = ['supabase', 'redis', 'prometheus'];
  const maxAttempts = 30;
  const interval = 1000;

  for (const service of services) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      try {
        execSync(`docker-compose -f ${DOCKER_COMPOSE_FILE} exec ${service} true`);
        break;
      } catch (error) {
        attempts++;
        if (attempts === maxAttempts) {
          throw new Error(`Service ${service} failed to start`);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  }
}

async function initializeTestDatabase(supabase: any) {
  // Run migrations
  execSync('npm run migrate:test');

  // Clear existing test data
  const tables = [
    'picks',
    'contests',
    'grading_results',
    'agent_health',
    'agent_metrics',
    'agent_errors',
    'dead_letter_queue'
  ];

  for (const table of tables) {
    await supabase.from(table).delete().neq('id', '');
  }
}

export function createTestAgents(supabase: any) {
  const gradingAgent = new GradingAgent({
    id: 'test-grading-agent',
    name: 'Test Grading Agent',
    version: '1.0.0',
    enabled: true,
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 1000
    },
    metricsConfig: {
      port: 9002,
      path: '/metrics',
      interval: 1000
    },
    alertConfig: {
      enabled: true,
      thresholds: {
        errorRate: 0.1,
        latency: 1000
      },
      channels: ['test']
    }
  }, supabase);

  const dataAgent = new DataAgent({
    id: 'test-data-agent',
    name: 'Test Data Agent',
    version: '1.0.0',
    enabled: true,
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 1000
    },
    metricsConfig: {
      port: 9003,
      path: '/metrics',
      interval: 1000
    },
    alertConfig: {
      enabled: true,
      thresholds: {
        errorRate: 0.1,
        latency: 1000
      },
      channels: ['test']
    }
  }, supabase);

  const contestAgent = new ContestAgent({
    id: 'test-contest-agent',
    name: 'Test Contest Agent',
    version: '1.0.0',
    enabled: true,
    retryConfig: {
      maxAttempts: 3,
      backoffMs: 100,
      maxBackoffMs: 1000
    },
    metricsConfig: {
      port: 9004,
      path: '/metrics',
      interval: 1000
    },
    alertConfig: {
      enabled: true,
      thresholds: {
        errorRate: 0.1,
        latency: 1000
      },
      channels: ['test']
    }
  }, supabase);

  return {
    gradingAgent,
    dataAgent,
    contestAgent
  };
}

export function createTestHarness(name: string) {
  return new TestHarness({
    name,
    timeout: 10000,
    setupHooks: {
      before: async () => {
        await setupTestEnvironment();
      },
      after: async () => {
        await teardownTestEnvironment();
      }
    }
  });
} 