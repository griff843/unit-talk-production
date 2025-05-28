# Unit Talk Platform

A Fortune 100-level betting automation platform built with TypeScript, Temporal, Supabase, and Next.js.

## System Overview

Unit Talk is a modular betting automation platform that uses a collection of specialized agents to handle different aspects of the betting process. The system is built on modern, scalable technologies and follows enterprise-level best practices.

### Core Technologies

- **TypeScript**: Strongly-typed language for reliable code
- **Temporal**: Workflow orchestration and reliable background job processing
- **Supabase**: PostgreSQL database with real-time capabilities
- **Next.js**: Frontend framework for the web interface
- **Retool**: Administrative dashboard for command execution

### Agent System

The platform uses a modular agent architecture where each agent is responsible for a specific domain:

- **GradingAgent**: Handles bet grading and result processing
- **AlertsAgent**: Manages system and user notifications
- **ContestAgent**: Manages betting contests and competitions
- **PromoAgent**: Handles promotional offers and bonuses
- **AnalyticsAgent**: Processes betting data and generates insights
- **NotificationAgent**: Manages user communications
- **FeedAgent**: Handles data ingestion from external sources
- **OperatorAgent**: Manages system operations and maintenance
- **AuditAgent**: Tracks system activities and ensures compliance

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL
- Temporal server
- Supabase account
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/unit-talk.git
   cd unit-talk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration values.

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Start the Temporal worker:
   ```bash
   npm run worker
   ```

## Architecture

### Directory Structure

```
src/
├── agents/           # Agent implementations
├── workflows/        # Temporal workflows
├── types/           # TypeScript type definitions
├── utils/           # Shared utilities
├── monitoring/      # Metrics and monitoring
├── db/              # Database utilities
├── services/        # Shared services
└── config/          # Configuration files
```

### Agent Structure

Each agent follows a standardized structure:

```
agents/ExampleAgent/
├── activities.ts    # Temporal activities
├── config/         # Agent-specific configuration
├── types/          # Agent-specific types
├── utils/          # Agent utilities
└── index.ts        # Agent entry point
```

## Configuration

The system uses a hierarchical configuration system:

1. Base configuration in `config/base.json`
2. Environment-specific configs in `config/environments/`
3. Agent-specific configs in `config/agents/`

## Monitoring & Logging

- Prometheus metrics exposed at `/metrics`
- Structured logging with Pino
- Health checks for each agent
- Error tracking and alerting
- Performance monitoring

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Building

```bash
npm run build
```

## Deployment

The system can be deployed using Docker:

```bash
docker-compose up -d
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

[Your License Here]

## Support

For support, contact [Your Support Email]
