// /types/agent.ts

export interface AgentStatus {
  name: string
  online: boolean
  lastCheck: string // ISO timestamp
  health: 'ok' | 'warn' | 'error'
  details?: string
}

export interface AgentConfig {
  agentName: string
  enabled: boolean
  cron?: string
}

export interface AgentTaskInput {
  task_id: string
  agent: string
  data: unknown
}

export interface AgentTaskOutput {
  task_id: string
  agent: string
  result: 'success' | 'fail' | 'pending'
  details?: unknown
}

export interface AgentHealthReport {
  agent: string
  health: 'ok' | 'warn' | 'error'
  lastCheck: string
  uptime: number
  incidents?: number
  notes?: string
}
