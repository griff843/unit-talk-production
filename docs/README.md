# Unit Talk Backend Documentation

[![Build Status](https://github.com/unit-talk/backend/workflows/CI/badge.svg)](https://github.com/unit-talk/backend/actions)
[![Coverage Status](https://coveralls.io/repos/github/unit-talk/backend/badge.svg?branch=main)](https://coveralls.io/github/unit-talk/backend?branch=main)
[![Code Climate](https://codeclimate.com/github/unit-talk/backend/badges/gpa.svg)](https://codeclimate.com/github/unit-talk/backend)
[![Documentation Status](https://readthedocs.org/projects/unit-talk/badge/?version=latest)](https://unit-talk.readthedocs.io/en/latest/?badge=latest)

## Overview
Unit Talk is a modular agent-driven sports betting and community insights platform. The system consists of several specialized agents that work together to provide betting analysis, grading, and community features.

## System Architecture

### High-Level Architecture
```mermaid
graph TB
    subgraph "Frontend"
        UI[Web UI]
        Mobile[Mobile App]
    end

    subgraph "API Layer"
        API[API Gateway]
        WS[WebSocket Server]
    end

    subgraph "Agent Layer"
        GA[Grading Agent]
        DA[Data Agent]
        CA[Contest Agent]
    end

    subgraph "Data Layer"
        DB[(Supabase)]
        Cache[(Redis)]
        Queue[(Message Queue)]
    end

    subgraph "Monitoring"
        Prom[Prometheus]
        Alert[AlertManager]
        Grafana[Grafana]
    end

    UI --> API
    Mobile --> API
    UI --> WS
    Mobile --> WS

    API --> GA
    API --> DA
    API --> CA
    WS --> GA
    WS --> DA
    WS --> CA

    GA --> DB
    DA --> DB
    CA --> DB
    GA --> Cache
    DA --> Cache
    CA --> Cache
    GA --> Queue
    DA --> Queue
    CA --> Queue

    GA --> Prom
    DA --> Prom
    CA --> Prom
    Prom --> Alert
    Prom --> Grafana
```

### Agent Architecture
```mermaid
classDiagram
    class BaseAgent {
        +name: string
        +config: BaseConfig
        +status: AgentStatus
        +initialize()
        +start()
        +stop()
        #handleError()
        #withRetry()
    }

    class GradingAgent {
        +scoreEngine: ScoreEngine
        +rules: Rule[]
        +gradePick()
        +calculateEdge()
    }

    class DataAgent {
        +etlPipeline: ETLPipeline
        +validators: Validator[]
        +processData()
        +validateQuality()
    }

    class ContestAgent {
        +lifecycle: ContestLifecycle
        +fairplay: FairPlayEngine
        +manageContest()
        +enforceRules()
    }

    BaseAgent <|-- GradingAgent
    BaseAgent <|-- DataAgent
    BaseAgent <|-- ContestAgent
```

## Quick Start

### Prerequisites
- Node.js 16+
- PostgreSQL 13+
- Redis 6+

### Installation
```bash
# Clone repository
git clone https://github.com/unit-talk/backend.git
cd backend

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:grading
npm run test:data
npm run test:contest

# Run with coverage
npm run test:coverage
```

## Architecture
The system follows a modular architecture with the following key components:

- **GradingAgent**: Handles pick evaluation and tier classification
- **DataAgent**: Manages ETL workflows and data quality
- **ContestAgent**: Handles contest lifecycle and fair play
- **BaseAgent**: Common functionality for all agents

### System Diagram
```mermaid
graph TD
    A[User Interface] --> B[API Gateway]
    B --> C[GradingAgent]
    B --> D[DataAgent]
    B --> E[ContestAgent]
    C --> F[Supabase]
    D --> F
    E --> F
    C --> G[Metrics/Monitoring]
    D --> G
    E --> G
```

## Getting Started
1. [Installation Guide](./installation.md)
2. [Configuration Guide](./configuration.md)
3. [Development Setup](./development.md)
4. [Testing Guide](./testing.md)

## Agent Documentation
- [GradingAgent](./agents/grading/README.md)
- [DataAgent](./agents/data/README.md)
- [ContestAgent](./agents/contest/README.md)

## API Reference
- [REST API](./api/rest.md)
- [WebSocket API](./api/websocket.md)
- [Event System](./api/events.md)

## Monitoring & Operations
- [Metrics & Alerting](./ops/monitoring.md)
- [Logging](./ops/logging.md)
- [Deployment](./ops/deployment.md)
- [Scaling](./ops/scaling.md)
- [Troubleshooting](./ops/troubleshooting.md)

## Development
- [Contributing Guide](./contributing.md)
- [Code Style Guide](./code-style.md)
- [Testing Strategy](./testing.md)
- [CI/CD](./cicd.md)

## Architecture Decision Records
- [ADR-001: Agent Architecture](./adr/001-agent-architecture.md)
- [ADR-002: Data Storage](./adr/002-data-storage.md)
- [ADR-003: Monitoring Strategy](./adr/003-monitoring.md)

## Release Notes
- [Changelog](./CHANGELOG.md)
- [Migration Guide](./migration.md)
- [Known Issues](./known-issues.md)

## Support
- [FAQ](./faq.md)
- [Troubleshooting Guide](./troubleshooting.md)
- [Support Channels](./support.md)

## Folder Structure
```
src/
  agents/
    BaseAgent/
      index.ts
      types.ts
      errors.ts
    GradingAgent/
      index.ts
      types.ts
      scoring/
      monitoring/
    DataAgent/
      index.ts
      types.ts
      etl/
      validation/
    ContestAgent/
      index.ts
      types.ts
      lifecycle/
      fairplay/
  shared/
    types/
      index.ts
      validation.ts
    monitoring/
      metrics.ts
      alerts.ts
    utils/
      retry.ts
      logging.ts
  test/
    harness/
    fixtures/
    integration/
  docs/
    agents/
    api/
    ops/
    adr/ 