# OnboardingAgent

The OnboardingAgent manages user onboarding workflows across different user types in the Unit Talk platform. It handles step tracking, notifications, and role-specific requirements.

## Features

- Role-specific onboarding workflows
- Step completion tracking
- Integration with NotificationAgent
- Progress metrics and analytics
- Automatic escalation for stuck flows

## Configuration

### Environment Variables

```env
ONBOARDING_ENABLED=true
ONBOARDING_METRICS_INTERVAL=60000
ONBOARDING_METRICS_PREFIX=onboarding
ONBOARDING_HEALTH_CHECK_INTERVAL=30000
ONBOARDING_MAX_RETRIES=3
```

### Agent Config

```typescript
interface OnboardingAgentConfig {
  agentName: 'OnboardingAgent';
  enabled: boolean;
  metricsConfig: {
    interval: number;
    prefix: string;
  };
}
```

### Database Schema

Required tables:
- `onboarding`: Tracks onboarding flows
- `users`: User information

## Metrics

### Standard Metrics
- `onboarding_flows_active`: Number of active onboarding flows
- `onboarding_flows_completed`: Number of completed flows
- `onboarding_success_rate`: Success rate percentage
- `onboarding_avg_completion_time`: Average completion time in minutes

### Training Metrics
- `onboarding_training_active_modules`: Number of active training modules
- `onboarding_training_completion_rate`: Training completion rate
- `onboarding_assessment_pass_rate`: Assessment pass rate
- `onboarding_certification_rate`: Certification success rate

### Permission Metrics
- `onboarding_permission_sets`: Total permission sets
- `onboarding_avg_grant_time`: Average time to grant permissions
- `onboarding_escalation_rate`: Permission escalation rate
- `onboarding_review_rate`: Permission review rate

## Health Checks

The agent performs the following health checks:

1. Database Connectivity
   - Verifies access to required tables
   - Checks write permissions

2. Notification Integration
   - Verifies NotificationAgent connectivity
   - Checks channel availability

3. Resource Availability
   - Monitors training resource availability
   - Checks permission service status

## Failure Modes

### Database Failures
- **Symptom**: Unable to read/write onboarding records
- **Impact**: New users cannot start onboarding
- **Recovery**: Automatic retry with exponential backoff
- **Escalation**: Alerts OperatorAgent after 3 failures

### Notification Failures
- **Symptom**: Cannot send notifications
- **Impact**: Users not informed of progress
- **Recovery**: Queue notifications for retry
- **Escalation**: Switch to alternative channels

### Step Completion Failures
- **Symptom**: Steps cannot be marked complete
- **Impact**: Users stuck in current step
- **Recovery**: Retry operation
- **Escalation**: Manual operator review

## Usage

### Starting Onboarding

```typescript
const result = await onboardingAgent.startOnboarding({
  userId: 'user123',
  userType: 'customer',
  meta: { source: 'web' }
});
```

### Completing Steps

```typescript
const completed = await onboardingAgent.completeStep(
  'user123',
  'accept_tos'
);
```

### Handling Stuck Flows

```typescript
await onboardingAgent.escalateStuckOnboarding(
  'user123',
  'Training module unavailable'
);
```

## Testing

Run the test suite:

```bash
npm test src/agents/OnboardingAgent
```

### Test Coverage

- Unit tests: 95%
- Integration tests: 85%
- E2E tests: 70%

## Dependencies

- NotificationAgent: For status updates
- OperatorAgent: For escalations
- AuditAgent: For compliance logging

## Contributing

1. Check existing issues or create a new one
2. Fork the repository
3. Create a feature branch
4. Add tests for new functionality
5. Submit a pull request

## Troubleshooting

Common issues and solutions:

1. Stuck Onboarding Flow
   - Check database locks
   - Verify step requirements
   - Check notification logs

2. Missing Notifications
   - Verify NotificationAgent status
   - Check channel configurations
   - Review notification queue

3. Permission Issues
   - Verify role configurations
   - Check permission service
   - Review escalation logs 