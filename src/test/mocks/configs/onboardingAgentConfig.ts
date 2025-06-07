import { BaseAgentConfig } from '@shared/types/baseAgent';

export const onboardingAgentConfig: BaseAgentConfig = {
  name: 'OnboardingAgent',
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
    prefix: 'onboarding'
  },
  onboarding: {
    steps: [
      {
        id: 'welcome',
        required: true,
        timeoutMs: 3600000
      },
      {
        id: 'profile',
        required: true,
        timeoutMs: 7200000
      },
      {
        id: 'preferences',
        required: false,
        timeoutMs: 3600000
      }
    ],
    timeout: {
      perStep: 3600000,
      total: 86400000
    },
    notifications: {
      onComplete: true,
      onTimeout: true
    }
  }
}; 