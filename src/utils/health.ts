// /utils/health.ts

import type { AgentHealthReport } from '../types/agent'

export function reportAgentHealth(agent: string, level: 'ok' | 'warn' | 'error', uptime = 0, incidents = 0, notes = ''): AgentHealthReport {
  return {
    agent,
    health: level,
    lastCheck: new Date().toISOString(),
    uptime,
    incidents,
    notes,
  }
}
