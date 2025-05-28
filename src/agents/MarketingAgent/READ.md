# MarketingAgent – Production Guide

## Overview
Automates all marketing campaigns, referral programs, and engagement tracking for Unit Talk. Integrates with Supabase and exposes event hooks for Discord/Notion.

## Key Files
- `/types/marketing.ts`: Core types/interfaces
- `/src/agents/MarketingAgent/`: Agent and managers
- `__tests__/MarketingAgent.test.ts`: Smoke test

## Event Hooks
- `onCampaignCreated`, `onReferralUpdated`, `onEngagementReported` – connect to Discord, Notion, or Retool

## Extending
- Add new campaign/referral types by extending managers
- Update config and health logic via `AgentConfig`

## Usage Example

```ts
import { MarketingAgent } from './src/agents/MarketingAgent'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
const agent = new MarketingAgent({ agentName: 'MarketingAgent', enabled: true }, supabase)

await agent.initialize()
await agent.start()
