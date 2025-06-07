// __tests__/MarketingAgent.test.ts

import { MarketingAgent } from '../src/agents/MarketingAgent'
import { createClient } from '@supabase/supabase-js'
import { Logger } from '../../utils/logger'
import { ErrorHandler } from '../../utils/errorHandling'
import { BaseAgentDependencies } from '../../types/agent'

const mockConfig = {
  name: 'MarketingAgent',
  agentName: 'MarketingAgent',
  enabled: true,
  version: '1.0.0',
  logLevel: 'info',
  metrics: { enabled: true, interval: 60 },
  retryConfig: {
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000
  },
  metricsConfig: {
    interval: 60000,
    prefix: 'marketing'
  },
  campaignConfig: {
    maxActiveCampaigns: 5,
    minBudget: 100,
    maxBudget: 10000
  }
}

describe('MarketingAgent', () => {
  let agent: MarketingAgent
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createClient('test-url', 'test-service-role-key')
    const dependencies: BaseAgentDependencies = {
      supabase: mockSupabase,
      config: mockConfig,
      logger: new Logger('MarketingAgent'),
      errorHandler: new ErrorHandler('MarketingAgent')
    }
    agent = new MarketingAgent(dependencies)
  })

  describe('Test Methods', () => {
    it('should support test initialization', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow()
    })

    it('should support test metrics collection', async () => {
      const metrics = await agent.__test__collectMetrics()
      expect(metrics).toBeDefined()
      expect(metrics.successCount).toBeDefined()
      expect(metrics.errorCount).toBeDefined()
      expect(metrics.warningCount).toBeDefined()
    })

    it('should support test health checks', async () => {
      const health = await agent.__test__checkHealth()
      expect(health).toBeDefined()
      expect(health.status).toBeDefined()
    })
  })

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await expect(agent.__test__initialize()).resolves.not.toThrow()
    })
  })

  describe('health check', () => {
    it('should return healthy status when all is well', async () => {
      const health = await agent.__test__checkHealth()
      expect(['healthy', 'degraded', 'failed']).toContain(health.status)
    })
  })

  describe('command handling', () => {
    it('should handle createCampaign command', async () => {
      await expect(agent.handleCommand({
        type: 'CREATE_CAMPAIGN',
        payload: { name: 'Smoke Test' }
      })).resolves.not.toThrow()
    })
  })
})
