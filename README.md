# Unit Talk Platform

Unit Talk is an enterprise-grade betting automation platform built with TypeScript, Temporal workflows, and Supabase. The platform uses a microservices architecture with specialized agents handling different aspects of the business logic.

## Architecture Overview

- **Frontend**: Next.js application
- **Backend**: TypeScript-based microservices
- **Workflow Engine**: Temporal
- **Database**: Supabase (PostgreSQL)
- **Monitoring**: Prometheus & Grafana
- **Logging**: Structured JSON logging with redaction
- **Testing**: Jest with extensive mocking

## Quick Start Guide

### Prerequisites

- Node.js 18+
- npm/yarn
- Docker
- Temporal CLI
- Supabase CLI

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd unit-talk
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Build the project:
```bash
npm run build
```

5. Run tests:
```bash
npm test
```

6. Start the worker:
```bash
npm run worker:start
```

### Development Workflow

1. Create a new branch for your feature:
```bash
git checkout -b feature/your-feature-name
```

2. Implement your changes following our coding standards
3. Write tests for your changes
4. Run linting and type checking:
```bash
npm run lint
npm run type-check
```

5. Submit a PR with your changes

## Agents Overview

### Core Agents

1. **BaseAgent**
   - Base class for all agents
   - Handles common functionality like health checks, metrics, and error handling

2. **OnboardingAgent**
   - Manages user onboarding workflows
   - Handles role-specific onboarding steps
   - Integrates with NotificationAgent for status updates

3. **NotificationAgent**
   - Centralizes all platform notifications
   - Supports multiple channels (Discord, Email, SMS, Notion)
   - Handles retry logic and failure escalation

4. **FeedAgent**
   - Manages data ingestion from external providers
   - Handles deduplication and validation
   - Maintains provider-specific rate limits

### Business Logic Agents

5. **ContestAgent**
   - Manages betting contests and competitions
   - Handles entry validation and scoring
   - Integrates with GradingAgent for results

6. **GradingAgent**
   - Processes and grades contest entries
   - Calculates user performance metrics
   - Updates leaderboards and rankings

7. **AnalyticsAgent**
   - Tracks platform metrics and KPIs
   - Generates reports and insights
   - Monitors user engagement

### Support Agents

8. **AuditAgent**
   - Maintains audit logs of all system actions
   - Ensures compliance with regulations
   - Provides audit trail for investigations

9. **OperatorAgent**
   - Handles system operations and maintenance
   - Manages incident response
   - Coordinates between other agents

10. **AlertAgent**
    - Monitors system health
    - Triggers alerts based on thresholds
    - Manages alert routing and escalation

## Monitoring & Metrics

All agents expose metrics in Prometheus format at `/metrics`. Key metrics include:

- Health status
- Operation latency
- Success/error rates
- Business-specific KPIs

View metrics through:
1. CLI: `npm run metrics:show`
2. Prometheus UI: `http://localhost:9090`
3. Grafana dashboards: `http://localhost:3000`

## Configuration

Agents are configured through:
1. Environment variables (validated via zod)
2. Agent-specific config files
3. Supabase tables for dynamic configuration

See each agent's README for detailed configuration options.

## Health Checks

Health checks are standardized across all agents:
- HTTP endpoint: `/health`
- CLI: `npm run health:check`
- Kubernetes probes configured in deployment manifests

## Logging

- Structured JSON logging
- Automatic PII redaction
- Log levels: debug, info, warn, error
- Correlation IDs for request tracing

## TODOs and Next Steps

High Priority:
1. Implement email notification channel in NotificationAgent
2. Add rate limiting to FeedAgent providers
3. Enhance metrics collection in AnalyticsAgent
4. Add transaction support to ContestAgent

Medium Priority:
1. Implement SMS notification channel
2. Add more provider integrations to FeedAgent
3. Enhance audit logging
4. Add more Grafana dashboards

Low Priority:
1. Add more test coverage
2. Enhance documentation
3. Add performance benchmarks
4. Implement more notification channels

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines.

## License

Proprietary - All rights reserved
