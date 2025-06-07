import { BaseAgentConfig } from '@shared/types/baseAgent';

export const contestAgentConfig: BaseAgentConfig = {
  name: 'ContestAgent',
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
    backoffMs: 1000,
    maxBackoffMs: 5000
  },
  logging: {
    prefix: 'contest'
  },
  contest: {
    maxParticipants: 100,
    entryFee: 10,
    prizePool: {
      first: 0.5,
      second: 0.3,
      third: 0.2
    },
    rules: {
      allowEarlyExit: true
    },
    picks: {
      maxPicks: 10,
      minOdds: 1.5,
      maxOdds: 5.0
    },
    notifications: {
      onEnd: true,
      onJoin: true,
      onLeave: true
    }
  }
}; 