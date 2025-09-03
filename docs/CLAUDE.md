# Claude AI Development Guide

_Quick reference for AI assistants working with the Unit Talk Platform_

## 🏆 Excellence Standards

**CRITICAL MANDATE**: Always deliver best-in-class results. No shortcuts. No
compromises.

- **Fortune 100 Standards**: Enterprise-grade code quality only
- **Zero Defects**: All code must pass comprehensive testing
- **Security First**: Zero-trust architecture with proper validation
- **Performance**: Sub-second response times with proper caching
- **Architectural Integrity**: Maintain proper separation of concerns

## 🚀 Quick Command Reference

## Commands

### Main Platform (unit-talk-production/)

#### Development Commands

```bash
cd unit-talk-production
npm run start:dev          # Start with hot reload
npm run worker:dev         # Start Temporal worker with hot reload
npm run build              # Build for production
npm run type-check         # TypeScript type checking
```

#### Testing Commands

```bash
npm run test               # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage
npm run test:integration   # Run integration tests
npm run test:unit          # Run unit tests
npm run qa:local          # Run local QA tests
npm run qa:e2e            # Run E2E tests with Playwright
```

#### Code Quality

```bash
npm run lint              # Run ESLint
npm run lint:fix          # Fix ESLint issues
npm run format            # Format code with Prettier
```

#### Agent Testing

```bash
npm run agents:test       # Test all agents
npm run agents:feed       # Test feed agent
npm run agents:optimal    # Test optimal ingestion pipeline
```

### Discord Bot (unit-talk-custom-bot/)

```bash
cd unit-talk-custom-bot
npm install
npm start                 # Start Discord bot
npm test                  # Run bot tests
```

### Frontend (unit-talk-frontend/)

```bash
cd unit-talk-frontend
npm install
npm run dev              # Start Next.js dev server
npm run build            # Build for production
npm run lint             # Run Next.js ESLint
```

### Smart Form (unit-talk-smart\ form/)

```bash
cd "unit-talk-smart form"
npm install
npm run dev              # Start smart form dev server
npm run build            # Build for production
npm test                 # Run tests
```

## Architecture

### Core Tech Stack

- **Runtime**: Node.js with TypeScript
- **Orchestration**: Temporal.io workflows
- **Database**: Supabase (PostgreSQL)
- **Cache**: Redis
- **Frontend**: Next.js with React
- **Bot**: Discord.js
- **Monitoring**: Prometheus + Grafana

### Optimized Agent System (13 Agents - 52% Reduction)

The platform uses a BaseAgent framework where all agents inherit from
`src/agents/BaseAgent/`. The system has been optimized from 27 to 13 agents
while maintaining all functionality:

#### Business Intelligence Agents (5)

- **GradingAgent**: Professional pick scoring with ML ensemble
- **AnalyticsAgent**: Performance insights and data analysis
- **AlertAgent**: Real-time notifications and Discord alerts
- **FeedAgent**: Optimal dual-API data ingestion (Optimal + Odds API)
- **RecapAgent**: Daily/weekly performance summaries

#### Operational Agents (4)

- **NotificationAgent**: Multi-channel user communications
- **ContestAgent**: Contest management and leaderboards
- **PlayerEnrichmentAgent**: Multi-league player data enrichment
- **AuditAgent**: Compliance and audit trail tracking

#### Intelligence Agents (4)

- **AutomatedOnboardingAgent**: ML-powered Discord onboarding (ENHANCED)
- **PredictiveAnalyticsAgent**: Market forecasting and predictions
- **RiskManagementAgent**: Portfolio optimization and risk analysis
- **UserRetentionAgent**: Churn prediction and engagement analysis

### Key Patterns

- All agents extend BaseAgent (`src/agents/BaseAgent/`)
- Shared types are in `src/shared/types/` (import as `@shared/types`)
- Never redefine BaseAgentConfig - import from `@shared/types/base`
- Tests reside in directories beside code
- Use structured logging with correlation IDs
- Implement health checks for all agents

### Data Flow

```
Raw Data → DataAgent → Processing → AnalyticsAgent → Insights → NotificationAgent → Discord/Dashboard
```

## Development Guidelines

### Code Organization

- Main platform logic in `unit-talk-production/src/`
- Discord bot in `unit-talk-custom-bot/`
- Frontend dashboard in `unit-talk-frontend/`
- Smart forms in `unit-talk-smart form/`

### TypeScript Standards

- Strict mode enabled across all projects
- Import shared types from designated locations
- Use proper type definitions for all agent configurations

### Testing Requirements

- 80%+ test coverage requirement
- Unit tests for all agent logic
- Integration tests for workflows
- E2E tests for user journeys

### Agent Development

1. Always extend BaseAgent
2. Implement required health checks
3. Add Prometheus metrics
4. Use errorHandler utility for errors
5. Follow structured logging patterns

## Temporal Workflows

Located in `unit-talk-production/src/workflows/`:

- **analyticsWorkflow.ts**: Analytics processing
- **e2e-props.workflow.ts**: End-to-end prop workflows
- **recap-workflows.ts**: Daily recap generation
- **syndicate-scheduler.ts**: Scheduled operations

## Database Schema

Primary database is Supabase (PostgreSQL) with:

- Type-safe schema definitions
- Row-level security
- Real-time subscriptions
- Analytics-ready structure

## Configuration

### Environment Files

- `unit-talk-production/config/env.example`: Main platform config
- `unit-talk-production/config/base.json`: Base configuration
- `unit-talk-production/config/agents/*.json`: Agent-specific configs

### Development Setup

1. Copy environment templates
2. Install dependencies in each project
3. Start infrastructure services (Redis, Temporal, PostgreSQL)
4. Run database migrations
5. Start development servers

## Docker Configuration

Docker Compose files available:

- `docker-compose.yml`: Development environment
- `docker-compose.prod.yml`: Production deployment
- `docker-compose.staging.yml`: Staging environment

## Testing Strategy

### QA Framework (unit-talk-production/qa/)

- Comprehensive test suite with multiple environments
- Accessibility testing with axe-core
- Security and penetration testing
- Performance and load testing
- Mobile responsiveness testing

### Test Commands by Type

- Unit: `npm run test:unit`
- Integration: `npm run test:integration`
- E2E: `npm run qa:e2e`
- Performance: `npm run qa:performance`
- Security: `npm run qa:security`

## Troubleshooting

### Common Issues

1. **Agent startup failures**: Check BaseAgent configuration and dependencies
2. **Database connections**: Verify Supabase environment variables
3. **Temporal workflows**: Check worker registration and activity
   implementations
4. **Discord bot**: Verify Discord token and permissions

### Debug Commands

```bash
# Check system health
npm run health:check

# View metrics
npm run metrics:show

# Agent-specific debugging
DEBUG=agent:* npm run start:dev

# Test specific agent
DEBUG=agent:* npx tsx src/runner/testAllAgents.ts --agent=SpecificAgent
```

## Important Notes

- Never modify files under `docs/` during automated refactors
- All shared types must be imported from designated locations
- BaseAgent framework provides lifecycle management, health monitoring, and
  error handling
- Use structured logging with correlation IDs for all operations
- Implement proper retry policies for external service calls[byterover-mcp]

# important

always use byterover-retrive-knowledge tool to get the related context before
any tasks always use byterover-store-knowledge to store all the critical
informations after sucessful tasks
