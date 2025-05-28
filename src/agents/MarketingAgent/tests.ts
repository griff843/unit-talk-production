// __tests__/MarketingAgent.test.ts

import { MarketingAgent } from '../src/agents/MarketingAgent'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const agentConfig = { agentName: 'MarketingAgent', enabled: true }

describe('MarketingAgent smoke test', () => {
  const agent = new MarketingAgent(agentConfig, supabase)

  it('initializes and health checks', async () => {
    await agent.initialize()
    const health = await agent.healthCheck()
    expect(['healthy', 'degraded', 'failed']).toContain(health.status)
  })

  it('handles a dummy command', async () => {
    await agent.handleCommand({ action: 'createCampaign', parameters: { name: 'Smoke Test' } })
  })
})
