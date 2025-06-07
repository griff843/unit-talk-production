import { DataAgent } from '../index';
import { createClient } from '@supabase/supabase-js';
import { Logger } from '../../../utils/logger';
import { ErrorHandler } from '../../../utils/errorHandling';
import { BaseAgentConfig, BaseAgentDependencies } from '@shared/types/baseAgent';

const mockConfig: BaseAgentConfig = {
  name: 'DataAgent',
  version: '1.0.0',
  enabled: true,
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  health: { enabled: true, interval: 30 },
  retry: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000
  }
};

const mockSupabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue({ data: [], error: null })
    }),
    insert: jest.fn().mockResolvedValue({ data: null, error: null })
  })
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockErrorHandler = {
  withRetry: jest.fn((fn: any) => fn())
};

describe('DataAgent', () => {
  let agent: DataAgent;
  let mockDeps: BaseAgentDependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDeps = {
      supabase: mockSupabase as any,
      logger: mockLogger as any,
      errorHandler: mockErrorHandler as any
    };
    
    agent = new DataAgent(mockConfig, mockDeps);
  });

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing DataAgent...');
      expect(mockLogger.info).toHaveBeenCalledWith('DataAgent initialized successfully');
    });

    it('should support test metrics collection', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.successCount).toBeDefined();
      expect(metrics.errorCount).toBeDefined();
      expect(metrics.warningCount).toBeDefined();
      expect(metrics.processingTimeMs).toBeDefined();
      expect(metrics.memoryUsageMb).toBeGreaterThan(0);
    });

    it('should support test health checks', async () => {
      const health = await agent.__test__checkHealth();
      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeDefined();
      expect(health.details).toBeDefined();
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow();
    });

    it('should handle database connectivity errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: null, error: new Error('Connection failed') })
        })
      });

      await expect(agent.__test__initialize()).resolves.not.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Data agent events table not accessible:',
        expect.any(Error)
      );
    });
  });

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      await agent.__test__initialize();  // Initialize first to set up workflows
      const health = await agent.__test__checkHealth();
      expect(health.status).toBe('healthy');
      expect(health.details.activeWorkflows).toEqual(['user-data-sync', 'analytics-etl']);
      expect(health.details.activePipelines).toEqual(['user-enrichment']);
    });

    it('should include workflow and pipeline counts', async () => {
      await agent.__test__initialize();  // Initialize first to set up workflows
      const health = await agent.__test__checkHealth();
      expect(health.details.runningWorkflows).toBe(0);
      expect(health.details.runningPipelines).toBe(0);
      expect(health.details.errorWorkflows).toBe(0);
      expect(health.details.errorPipelines).toBe(0);
    });
  });

  describe('metrics collection', () => {
    it('should return base metrics', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics.successCount).toBe(0);
      expect(metrics.errorCount).toBe(0);
      expect(metrics.warningCount).toBe(0);
      expect(metrics.processingTimeMs).toBe(0);
      expect(metrics.memoryUsageMb).toBeGreaterThan(0);
    });

    it('should include custom metrics', async () => {
      const metrics = await agent.__test__collectMetrics();
      expect(metrics['custom.etl.total']).toBe(0);
      expect(metrics['custom.etl.success']).toBe(0);
      expect(metrics['custom.etl.failed']).toBe(0);
      expect(metrics['custom.enrichment.total']).toBe(0);
      expect(metrics['custom.quality.passed']).toBe(0);
    });
  });

  describe('command handling', () => {
    it('should handle RUN_QUALITY_CHECK command', async () => {
      await expect(agent.handleCommand({
        type: 'RUN_QUALITY_CHECK',
        payload: {
          table: 'users',
          checks: ['completeness', 'accuracy']
        }
      })).resolves.not.toThrow();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Processing command: RUN_QUALITY_CHECK');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Running quality check:'));
    });

    it('should handle RUN_ETL command', async () => {
      await expect(agent.handleCommand({
        type: 'RUN_ETL',
        payload: {
          source: 'external_api',
          target: 'users',
          transform: 'enrich_user_data'
        }
      })).resolves.not.toThrow();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Processing command: RUN_ETL');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Running ETL workflow:'));
    });

    it('should handle RUN_ENRICHMENT command', async () => {
      await expect(agent.handleCommand({
        type: 'RUN_ENRICHMENT',
        payload: {
          dataSource: 'users'
        }
      })).resolves.not.toThrow();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Processing command: RUN_ENRICHMENT');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Running enrichment pipeline:'));
    });

    it('should throw error for unknown command', async () => {
      await expect(agent.handleCommand({
        type: 'UNKNOWN_COMMAND',
        payload: {}
      })).rejects.toThrow('Unknown command type: UNKNOWN_COMMAND');
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources properly', async () => {
      await agent.__test__initialize();
      await agent.cleanup();
      
      expect(mockLogger.info).toHaveBeenCalledWith('Cleaning up DataAgent resources...');
      expect(mockLogger.info).toHaveBeenCalledWith('DataAgent cleanup completed');
    });
  });
}); 