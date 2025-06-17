// __tests__/MarketingAgent.test.ts

import { MarketingAgent } from './index'
import { createClient } from '@supabase/supabase-js'
import { createTestConfig, createTestDependencies } from '../../test/helpers/testHelpers'

describe('MarketingAgent', () => {
  let agent: MarketingAgent
  let mockSupabase: any
  let config: any
  let dependencies: any

  beforeEach(() => {
    mockSupabase = createClient('test-url', 'test-service-role-key')
    config = createTestConfig({ name: 'MarketingAgent' })
    dependencies = createTestDependencies({ supabase: mockSupabase })
    agent = new MarketingAgent(config, dependencies)
  })

  describe('Basic functionality', () => {
    it('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow()
    })

    it('should collect metrics successfully', async () => {
      const metrics = await agent.collectMetrics()
      expect(metrics).toBeDefined()
      expect(metrics.successCount).toBeDefined()
      expect(metrics.errorCount).toBeDefined()
      expect(metrics.warningCount).toBeDefined()
    })

    it('should perform health check successfully', async () => {
      const health = await agent.checkHealth()
      expect(health).toBeDefined()
      expect(health.status).toBeDefined()
      expect(health.timestamp).toBeDefined()
    })
  })
})
