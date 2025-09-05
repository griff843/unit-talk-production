# Unit Talk Platform

> **Fortune 100-grade sports betting intelligence platform**
> _Enterprise SaaS architecture • Multi-application workspace • Discord-native_

## 🏗️ Architecture Overview

This is a **SaaS-grade monorepo** with clear separation of concerns following
industry best practices:

```
unit-talk-platform/
├── apps/                          # Applications
│   ├── api/                      # Main backend API
│   ├── discord-bot/              # Discord bot
│   ├── dashboard/                # Frontend dashboard
│   ├── smart-form/               # Smart form app
│   └── command-center/           # Command center
├── packages/                     # Shared packages
├── docs/                         # Documentation
├── infrastructure/               # Infrastructure as Code
├── scripts/                      # Shared tooling
└── tools/                        # Development tools
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 8+
- PostgreSQL
- Redis
- Docker (optional)

### Installation

```bash
# Clone and install
git clone <repository>
cd unit-talk-platform
npm install

# Setup environment
cp apps/api/config/env.example .env
# Edit .env with your configuration

# Build all applications
npm run build
```

### Development

```bash
# Start all services
npm run dev

# Or start individual applications
npm run start:api           # Backend API
npm run start:discord-bot   # Discord bot
npm run start:dashboard     # Frontend dashboard
npm run start:smart-form    # Smart form
npm run start:command-center # Command center
```

## 📱 Applications

| Application        | Description           | Technology                    | Port |
| ------------------ | --------------------- | ----------------------------- | ---- |
| **API**            | Main backend platform | Node.js, TypeScript, Temporal | 3000 |
| **Discord Bot**    | Discord integration   | Discord.js, TypeScript        | -    |
| **Dashboard**      | Web dashboard         | Next.js, React, TypeScript    | 3001 |
| **Smart Form**     | Betting forms         | Next.js, React, TypeScript    | 3002 |
| **Command Center** | Admin interface       | Next.js, React, TypeScript    | 3003 |

## 🎯 Key Features

- **Agent-Based Architecture**: Event-driven business logic
- **Real-Time Updates**: 1-minute data refresh cycles
- **Elite Dual-API System**: Optimal + Odds API integration
- **Fortune 100 Standards**: Enterprise-grade code quality
- **Discord Integration**: Native Discord experience
- **Temporal Workflows**: Fault-tolerant task orchestration
- **Type-Safe Database**: Supabase with TypeScript
- **v3.0.0 Unified Schema**: Optimized database architecture (77→45 tables)

## 🗄️ Database Architecture v3.0.0

### Core Tables (Unified Schema)
- `unified_picks`: Core pick management (was `final_picks`)
- `raw_props`: Market data with `processed_at` timestamp gate
- `users`: User/capper profiles with Discord integration
- `agent_health`: System monitoring and metrics

### Schema Migration Summary
- **Table rename**: `final_picks` → `unified_picks`
- **Column migration**: `auto_approved` → `published`
- **Status migration**: `is_graded` → `grading_status`
- **Processing gate**: `processed` (boolean) → `processed_at` (timestamp)
- **Professional columns**: `professional_score`, `devigged_edge`, `kelly_fraction`, `clv_pct`
- **Performance gain**: 42% table reduction (77→45 tables)

- **[docs/ROADMAP_STATUS.md](docs/ROADMAP_STATUS.md)** - Production readiness roadmap and real-time status
- **[docs/monitoring.md](docs/monitoring.md)** - Monitoring (Prometheus, Alertmanager, OTEL)

## 📚 Documentation

- **[CLAUDE.md](CLAUDE.md)** - AI assistant guidance
- **[docs/architecture/](docs/architecture/)** - System architecture
- **[docs/api/](docs/api/)** - API documentation
- **[docs/deployment/](docs/deployment/)** - Deployment guides

## 🧪 Testing

```bash
# Run all tests
npm run test

# Test specific application
npm run test --workspace=apps/api

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

```bash
# Production build
npm run build

# Deploy with Docker
docker-compose up -d

# Deploy individual services
npm run deploy --workspace=apps/api
```

## 📊 Monitoring

- **Health Checks**: `/health` endpoints on all services
- **Metrics**: Prometheus metrics collection
- **Logging**: Structured logging with correlation IDs
- **Tracing**: Distributed tracing across services

## 🤝 Contributing

1. Follow the **[Development Guidelines](CLAUDE.md#development-guidelines)**
2. Maintain **80%+ test coverage**
3. Use **TypeScript strict mode**
4. Follow **agent separation of concerns**
5. Update documentation with changes

## 📞 Support

- **Technical Issues**: Check app-specific README files
- **Architecture Questions**: See [docs/architecture/](docs/architecture/)
- **Development Setup**: Follow [CLAUDE.md](CLAUDE.md) guidance

---

**Built with Enterprise Standards** • **Powered by TypeScript** • **Orchestrated
by Temporal**
