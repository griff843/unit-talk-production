import { ReferralAgent, ReferralPayload, ReferralStatus } from '../index';
import { BaseAgentConfig, BaseAgentDependencies } from '../../BaseAgent/types';
import { jest } from '@jest/globals';

// Mock dependencies
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis()
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  config: {}
};

const mockErrorHandler = {
  handleError: jest.fn()
};

// Mock Counter and Gauge from prom-client
jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn()
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn()
  }))
}));

// Mock metricsServer
jest.mock('../../../services/metricsServer', () => ({
  startMetricsServer: jest.fn(),
  errorCounter: {
    inc: jest.fn()
  },
  durationHistogram: {
    startTimer: jest.fn().mockReturnValue(jest.fn())
  }
}));

describe('ReferralAgent', () => {
  let agent: ReferralAgent;
  let mockDeps: BaseAgentDependencies;
  let mockConfig: BaseAgentConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock dependencies
    mockDeps = {
      supabase: mockSupabase as any,
      logger: mockLogger as any,
      errorHandler: mockErrorHandler as any
    };
    
    // Setup mock config
    mockConfig = {
      name: 'ReferralAgent',
      version: '1.0.0',
      enabled: true,
      logLevel: 'info',
      metrics: {
        enabled: true,
        interval: 60
      },
      health: {
        enabled: true,
        interval: 30
      },
      retry: {
        maxRetries: 3,
        backoffMs: 200,
        maxBackoffMs: 5000
      }
    };
    
    // Create agent instance
    agent = new ReferralAgent(mockConfig, mockDeps);
  });

  // Test BaseAgent extension and lifecycle methods
  describe('BaseAgent Extension', () => {
    it('should extend BaseAgent', () => {
      expect(agent).toBeInstanceOf(ReferralAgent);
    });
    
    it('should have all required lifecycle methods', () => {
      expect(agent['initialize']).toBeDefined();
      expect(agent['process']).toBeDefined();
      expect(agent['cleanup']).toBeDefined();
      expect(agent['checkHealth']).toBeDefined();
      expect(agent['collectMetrics']).toBeDefined();
    });
  });
  
  // Test initialize method
  describe('initialize', () => {
    it('should start metrics server and validate dependencies', async () => {
      // Mock successful dependency validation
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ error: null })
        })
      });
      
      await agent['initialize']();
      
      // Check if metrics server was started
      expect(require('../../../services/metricsServer').startMetricsServer).toHaveBeenCalledWith(9005);
      
      // Check if dependencies were validated
      expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
      expect(mockLogger.info).toHaveBeenCalledWith('ReferralAgent initialized successfully');
    });
    
    it('should throw error if dependency validation fails', async () => {
      // Mock failed dependency validation
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ error: { message: 'Database error' } })
        })
      });
      
      await expect(agent['initialize']()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  // Test process method
  describe('process', () => {
    it('should check pending referrals and process rewards', async () => {
      // Mock agent methods
      agent['checkPendingReferrals'] = jest.fn().mockResolvedValue(undefined);
      agent['processRewards'] = jest.fn().mockResolvedValue(undefined);
      
      await agent['process']();
      
      expect(agent['checkPendingReferrals']).toHaveBeenCalled();
      expect(agent['processRewards']).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('ReferralAgent processing cycle completed', expect.any(Object));
    });
    
    it('should handle errors during processing', async () => {
      // Mock agent methods with error
      const testError = new Error('Process error');
      agent['checkPendingReferrals'] = jest.fn().mockRejectedValue(testError);
      
      await expect(agent['process']()).rejects.toThrow('Process error');
      expect(mockLogger.error).toHaveBeenCalled();
      expect(require('../../../services/metricsServer').errorCounter.inc).toHaveBeenCalled();
    });
  });
  
  // Test cleanup method
  describe('cleanup', () => {
    it('should clean up stale referrals', async () => {
      // Mock successful update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({ data: [{ id: '123' }], error: null })
            })
          })
        })
      });
      
      await agent['cleanup']();
      
      expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
      expect(mockLogger.info).toHaveBeenCalled();
    });
    
    it('should handle errors during cleanup', async () => {
      // Mock error during update
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              select: jest.fn().mockRejectedValue(new Error('Cleanup error'))
            })
          })
        })
      });
      
      await expect(agent['cleanup']()).rejects.toThrow('Cleanup error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  // Test checkHealth method
  describe('checkHealth', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock successful database check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ error: null })
        })
      });
      
      // Set recent run timestamp
      agent['lastRunTimestamp'] = Date.now();
      
      const result = await agent['checkHealth']();
      
      expect(result.status).toBe('healthy');
      expect(result.timestamp).toBeDefined();
      expect(result.details).toBeDefined();
    });
    
    it('should return unhealthy status when database check fails', async () => {
      // Mock failed database check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ error: { message: 'Database error' } })
        })
      });
      
      const result = await agent['checkHealth']();
      
      expect(result.status).toBe('unhealthy');
      expect(result.details).toHaveProperty('errors');
    });
    
    it('should return degraded status when no recent run', async () => {
      // Mock successful database check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({ error: null })
        })
      });
      
      // Set old run timestamp (more than 24 hours ago)
      agent['lastRunTimestamp'] = Date.now() - (25 * 60 * 60 * 1000);
      
      const result = await agent['checkHealth']();
      
      expect(result.status).toBe('degraded');
      expect(result.details).toHaveProperty('warnings');
    });
  });
  
  // Test collectMetrics method
  describe('collectMetrics', () => {
    it('should collect and return metrics', async () => {
      // Mock successful rpc call
      mockSupabase.rpc.mockReturnValue({
        data: {
          total_referrals: 100,
          completed_referrals: 50
        },
        error: null
      });
      
      const metrics = await agent['collectMetrics']();
      
      expect(metrics.successCount).toBe(50);
      expect(metrics).toHaveProperty('custom.totalReferrals');
      expect(metrics).toHaveProperty('custom.completedReferrals');
      expect(metrics).toHaveProperty('custom.conversionRate');
    });
    
    it('should handle errors during metrics collection', async () => {
      // Mock error during rpc call
      mockSupabase.rpc.mockReturnValue({
        data: null,
        error: new Error('Metrics error')
      });
      
      const metrics = await agent['collectMetrics']();
      
      // Should return basic metrics even on error
      expect(metrics).toHaveProperty('successCount');
      expect(metrics).toHaveProperty('errorCount');
      expect(metrics).toHaveProperty('memoryUsageMb');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
  
  // Test API methods
  describe('API Methods', () => {
    describe('getOrCreateReferralCode', () => {
      it('should return existing code if found', async () => {
        // Mock existing referral code
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                data: [{ referral_code: 'TEST123' }],
                error: null
              })
            })
          })
        });
        
        const code = await agent.getOrCreateReferralCode('user123');
        
        expect(code).toBe('TEST123');
        expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
        expect(mockSupabase.from().select).toHaveBeenCalledWith('referral_code');
      });
      
      it('should create new code if not found', async () => {
        // Mock no existing referral code, then successful insert
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                data: [],
                error: null
              })
            })
          })
        }).mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            error: null
          })
        });
        
        // Mock the generateReferralCode method
        const originalGenerateMethod = agent['generateReferralCode'];
        agent['generateReferralCode'] = jest.fn().mockReturnValue('NEW123');
        
        const code = await agent.getOrCreateReferralCode('user123');
        
        expect(code).toBe('NEW123');
        expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
        expect(mockSupabase.from().insert).toHaveBeenCalled();
        
        // Restore original method
        agent['generateReferralCode'] = originalGenerateMethod;
      });
    });
    
    describe('recordReferral', () => {
      it('should detect duplicate referrals', async () => {
        // Mock existing referral
        mockSupabase.from.mockReturnValue({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                data: [{ id: '123' }],
                error: null
              })
            })
          })
        });
        
        const payload: ReferralPayload = {
          inviterId: 'user1',
          inviteeId: 'user2',
          channel: 'web'
        };
        
        const result = await agent.recordReferral(payload);
        
        expect(result.success).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
      
      it('should successfully record new referral', async () => {
        // Mock no existing referral, then successful insert
        mockSupabase.from.mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                data: [],
                error: null
              })
            })
          })
        }).mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              data: [{ id: 'new123' }],
              error: null
            })
          })
        });
        
        // Mock logEvent method
        agent.logEvent = jest.fn().mockResolvedValue('event123');
        
        const payload: ReferralPayload = {
          inviterId: 'user1',
          inviteeId: 'user2',
          channel: 'web',
          referralCode: 'CODE123'
        };
        
        const result = await agent.recordReferral(payload);
        
        expect(result.success).toBe(true);
        expect(result.eventId).toBe('event123');
        expect(mockSupabase.from().insert).toHaveBeenCalled();
        expect(agent.logEvent).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalled();
      });
    });
    
    describe('updateReferralStatus', () => {
      it('should update referral status', async () => {
        // Mock successful update
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                data: [{ id: '123', inviter_id: 'user1' }],
                error: null
              })
            })
          })
        });
        
        // Mock logEvent method
        agent.logEvent = jest.fn().mockResolvedValue('event123');
        
        const result = await agent.updateReferralStatus('user2', 'completed');
        
        expect(result).toBe(true);
        expect(mockSupabase.from).toHaveBeenCalledWith('referrals');
        expect(mockSupabase.from().update).toHaveBeenCalled();
        expect(agent.logEvent).toHaveBeenCalled();
      });
      
      it('should handle case when no referral is found', async () => {
        // Mock no referral found
        mockSupabase.from.mockReturnValue({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                data: [],
                error: null
              })
            })
          })
        });
        
        const result = await agent.updateReferralStatus('user2', 'completed');
        
        expect(result).toBe(false);
      });
    });
    
    describe('getReferralStats', () => {
      it('should return referral metrics for user', async () => {
        // Mock successful rpc call
        const mockStats = {
          inviterId: 'user1',
          totalReferrals: 10,
          completedReferrals: 5,
          pendingReferrals: 5,
          rewardsIssued: 3
        };
        
        mockSupabase.rpc.mockReturnValue({
          data: mockStats,
          error: null
        });
        
        const stats = await agent.getReferralStats('user1');
        
        expect(stats).toEqual(mockStats);
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_referral_metrics', { user_id: 'user1' });
      });
      
      it('should handle errors when fetching stats', async () => {
        // Mock error during rpc call
        mockSupabase.rpc.mockReturnValue({
          data: null,
          error: new Error('Stats error')
        });
        
        await expect(agent.getReferralStats('user1')).rejects.toThrow('Stats error');
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
    
    describe('logEvent', () => {
      it('should log referral event', async () => {
        // Mock successful insert
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              data: [{ id: 'event123' }],
              error: null
            })
          })
        });
        
        const event = {
          inviterId: 'user1',
          inviteeId: 'user2',
          eventType: 'created' as const,
          timestamp: new Date().toISOString()
        };
        
        const eventId = await agent.logEvent(event);
        
        expect(eventId).toBe('event123');
        expect(mockSupabase.from).toHaveBeenCalledWith('referral_events');
        expect(mockSupabase.from().insert).toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalled();
      });
      
      it('should handle errors when logging events', async () => {
        // Mock error during insert
        mockSupabase.from.mockReturnValue({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              data: null,
              error: new Error('Event error')
            })
          })
        });
        
        const event = {
          inviterId: 'user1',
          inviteeId: 'user2',
          eventType: 'created' as const,
          timestamp: new Date().toISOString()
        };
        
        await expect(agent.logEvent(event)).rejects.toThrow('Event error');
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });
  
  // Test singleton pattern
  describe('getInstance', () => {
    it('should return the same instance when called multiple times', () => {
      const instance1 = ReferralAgent.getInstance(mockDeps);
      const instance2 = ReferralAgent.getInstance(mockDeps);
      
      expect(instance1).toBe(instance2);
    });
    
    it('should create a new instance with proper config', () => {
      // Reset singleton instance
      // @ts-ignore - Accessing private static property
      ReferralAgent['instance'] = null;
      
      const instance = ReferralAgent.getInstance(mockDeps);
      
      expect(instance).toBeInstanceOf(ReferralAgent);
      expect(instance['config'].name).toBe('ReferralAgent');
    });
  });
});
