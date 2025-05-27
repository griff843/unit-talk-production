// src/types/agentTypes.ts

export interface RecapAgentInput {
  recap_type: 'daily' | 'weekly' | 'monthly'
  recap_date?: string
  // Add any other fields you want
}

export interface RecapAgentOutput {
  status: 'success' | 'error'
  summary?: string
  leaderboard?: string
  recapStats?: any[]
  error?: string
}
