# 🎯 Unit Talk - Premium Sports Betting Intelligence Platform

## Overview

Unit Talk is a Fortune 100-grade sports betting intelligence platform that
combines advanced analytics, machine learning, and real-time market analysis to
provide premium betting insights through a sophisticated multi-agent
architecture.

### 🌟 Key Features

- 🤖 **13 Optimized Agents** - Streamlined automation with 52% resource
  reduction
- ⚡ **Elite 1-Minute Updates** - Industry-leading real-time alerts and data
  processing
- 🔀 **Dual-API System** - Optimal API + Odds API for comprehensive sports
  coverage
- 🏈 **Complete Sports Coverage** - NFL, NCAAF, NBA, WNBA, MLB, NHL with
  settlement data
- 📊 **Advanced ML Grading** - Multi-model ensemble scoring with risk management
- 📈 **Real-time Analysis** - Market resistance and trend detection
- 💬 **Discord Integration** - Community engagement with thread-based
  discussions
- 🔄 **Temporal Workflows** - Fault-tolerant task orchestration
- 📱 **Modern Dashboard** - Next.js web interface with real-time updates
- 🎫 **VIP+ Analytics** - Premium tier features and insights

### 🏗️ Multi-Application Architecture

```
📦 Unit Talk Production v3/
├── 🎯 unit-talk-production/     # Main platform with agent system
├── 🤖 unit-talk-custom-bot/     # Discord bot implementation
├── 📊 unit-talk-frontend/       # Next.js dashboard
└── 📝 unit-talk-smart form/     # Smart form submission system
```

## Architecture

The system is built on a modern, scalable tech stack:

```mermaid
graph TD
    A[Smart Form] --> B[Temporal Workflows]
    B --> C[Agent System]
    C --> D[Supabase]
    C --> E[Discord Bot]
    F[Next.js Dashboard] --> D
    G[Market Data APIs] --> C
```

### 🤖 Optimized Agent System (13 Agents - 52% Reduction)

#### Business Intelligence Agents (5)

- **[ScoringAgent](src/agents/ScoringAgent/README.md)** - Professional pick
  scoring with ML ensemble
- **[AnalyticsAgent](src/agents/AnalyticsAgent/README.md)** - Performance
  insights and data analysis
- **[AlertAgent](src/agents/AlertAgent/README.md)** - Real-time notifications
  and Discord alerts
- **[FeedAgent](src/agents/FeedAgent/README.md)** - Optimal dual-API data
  ingestion (Optimal + Odds API)
- **[RecapAgent](src/agents/RecapAgent/README.md)** - Daily/weekly performance
  summaries

#### Operational Agents (4)

- **[NotificationAgent](src/agents/NotificationAgent/README.md)** -
  Multi-channel user communications
- **[ContestAgent](src/agents/ContestAgent/)** - Contest management and
  leaderboards
- **[PlayerEnrichmentAgent](src/agents/PlayerEnrichmentAgent/README.md)** -
  Multi-league player data enrichment
- **[AuditAgent](src/agents/AuditAgent/)** - Compliance and audit trail tracking

#### Intelligence Agents (4)

- **[AutomatedOnboardingAgent](src/agents/AutomatedOnboardingAgent/)** -
  ML-powered Discord onboarding (ENHANCED)
- **[PredictiveAnalyticsAgent](src/agents/PredictiveAnalyticsAgent/)** - Market
  forecasting and predictions
- **[RiskManagementAgent](src/agents/RiskManagementAgent/)** - Portfolio
  optimization and risk analysis
- **[UserRetentionAgent](src/agents/UserRetentionAgent/)** - Churn prediction
  and engagement analysis

**Agent System Optimization Results:**

- ✅ **52% Agent Reduction**: 27 → 13 agents with maintained functionality
- ✅ **Enhanced ML Capabilities**: AutomatedOnboardingAgent with adaptive
  learning
- ✅ **Resource Optimization**: Reduced memory footprint and computational
  overhead
- ✅ **DigitalOcean Ready**: Optimized for 2GB memory deployment

### ⚡ Elite Dual-API System Architecture

**Industry-Leading 1-Minute Real-Time Updates**

Our cutting-edge dual-API strategy combines the best of both worlds for
comprehensive sports coverage:

| Feature              | Optimal API ($69)  | Odds API ($49)   | Combined Elite System  |
| -------------------- | ------------------ | ---------------- | ---------------------- |
| **Player Props**     | NFL, NBA, MLB, NHL | Limited Coverage | ✅ Best Coverage       |
| **NCAAF**            | ❌ Not Available   | ✅ Full Coverage | ✅ **Elite Exclusive** |
| **WNBA**             | ❌ Not Available   | ✅ Full Coverage | ✅ **Elite Exclusive** |
| **Settlement Data**  | ❌ Manual          | ✅ Automated     | ✅ **Automated**       |
| **Game Lines**       | Limited            | ✅ Complete      | ✅ Complete            |
| **Update Frequency** | 2 minutes          | 1 minute         | ⚡ **1 minute**        |
| **Total Cost**       | $69/month          | $49/month        | **$118/month**         |

#### 🎯 Smart Routing System

```typescript
// Automatic intelligent routing
const ncaafData = await fetchUnifiedData({
  sport: 'NCAAF', // → Routes to Odds API (exclusive)
  marketType: 'spreads',
});

const nflProps = await fetchUnifiedData({
  sport: 'NFL', // → Routes to Optimal API (best props)
  marketType: 'player-props',
});
```

#### 🏆 Competitive Advantages

- **Fastest Updates**: 1-minute vs industry standard 5-15 minutes
- **Complete Coverage**: 100% major sports including NCAAF/WNBA
- **Automated Settlement**: Post-game automation vs manual competitors
- **Cost Efficient**: $118/month vs competitor $200-500/month
- **Redundancy**: Dual-API failover for maximum reliability

### 🔄 Core Platform Components

1. **[BaseAgent Framework](src/agents/BaseAgent/README.md)**
   - Lifecycle management and health monitoring
   - Prometheus metrics and observability
   - Error handling with retry logic
   - Event-driven communication

2. **[Elite Data Router](src/agents/FeedAgent/dataSourceRouter.ts)**
   - Intelligent API selection and routing
   - Credit optimization and monitoring
   - Parallel processing for 1-minute updates
   - Automated failover and redundancy

3. **[Temporal Workflows](src/workflows/)**
   - Fault-tolerant task orchestration
   - Activity-based modularization
   - Advanced retry and compensation logic
   - Distributed processing capabilities

4. **Database Architecture (Supabase)**
   - Type-safe PostgreSQL schema
   - Real-time subscriptions and triggers
   - Row-level security policies
   - Analytics-optimized structure

5. **Discord Integration**
   - Thread-based pick discussions
   - Automated tier-based alerts
   - VIP+ exclusive features
   - Community engagement tools

## 🚀 Quick Start Guide

### Prerequisites

- **Node.js 18+** - JavaScript runtime
- **PostgreSQL 14+** - Primary database (Supabase)
- **Redis** - Caching and session management
- **Temporal** - Workflow orchestration engine

### ⚡ Installation & Setup

1. **Clone and Install**

```bash
git clone https://github.com/your-org/unit-talk-production.git
cd unit-talk-production
npm install
```

2. **Environment Configuration**

```bash
cp config/env.example .env
# Configure your environment variables
```

3. **Start Development Environment**

```bash
# Start all services (Redis, Temporal, PostgreSQL)
npm run dev:services

# Start development server with hot reload
npm run start:dev

# Start Temporal worker (separate terminal)
npm run worker:dev
```

### ⚡ Elite System Quick Start

**Deploy the complete elite dual-API system with 1-minute updates:**

```bash
# 1. Deploy elite system (all components)
npm run elite:deploy

# 2. Test complete integration
npm run elite:test

# 3. Start elite services (3 terminals):
npm run worker:dev         # Terminal 1: Temporal worker
npm run syndicate:start    # Terminal 2: 1-minute scheduler
npm run odds-api:monitor   # Terminal 3: Credit monitoring
```

**Elite System Features:**

- ⚡ **1-minute updates** (fastest in industry)
- 🏈 **NCAAF coverage** (competitors don't have this)
- 🏀 **WNBA integration** (complete women's basketball)
- 🏁 **Automated settlement** (post-game prop resolution)
- 💰 **Cost optimized** at $118/month total

### 📁 Project Navigation

```
unit-talk-production/
├── 📂 src/
│   ├── 🤖 agents/              # 13 optimized agents
│   ├── ⚡ activities/          # Temporal activity functions
│   ├── 🔄 workflows/           # Temporal workflow definitions
│   ├── 🌐 api/                 # REST API endpoints
│   ├── 💾 db/                  # Database operations
│   ├── 📊 monitoring/          # Metrics and health checks
│   ├── 🛠️ utils/               # Shared utilities
│   └── 📝 types/               # TypeScript type definitions
├── 📋 scripts/                 # Maintenance and deployment scripts
├── 🧪 test/                    # Comprehensive test suites
├── ⚙️ config/                  # Configuration management
└── 📚 docs/                    # Documentation
```

### 🔧 Configuration Management

#### Core Configuration Files

- **`config/base.json`** - Platform base configuration
- **`config/agents/*.json`** - Individual agent configurations
- **`config/temporal/*.yaml`** - Temporal workflow configs
- **`.env`** - Environment variables and secrets

#### Agent Configuration

```typescript
interface BaseAgentConfig {
  agentName: string; // Agent identifier
  enabled: boolean; // Enable/disable agent
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsEnabled: boolean; // Prometheus metrics
  retryConfig: RetryConfig; // Error handling
}
```

## 🛠️ Development Guide

### 💻 Development Commands

#### Core Development

```bash
npm run start:dev          # Start with hot reload
npm run worker:dev         # Start Temporal worker with hot reload
npm run build              # Build for production
npm run type-check         # TypeScript validation
npm run type-check:watch   # Watch mode type checking
```

#### 🧪 Testing Suite

```bash
# Core testing
npm test                   # Run all tests
npm run test:watch         # Watch mode for development
npm run test:coverage      # Coverage reports

# Specialized testing
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests
npm run qa:e2e            # End-to-end with Playwright
npm run qa:performance    # Load and stress testing
npm run qa:accessibility  # WCAG compliance testing
npm run qa:security       # Security and penetration tests

# Agent testing
npm run agents:test       # Test all 13 agents
npm run agents:feed       # Test feed agent with data validation
npm run agents:optimal    # Test optimal ingestion pipeline

# Elite dual-API testing
npm run elite:test        # Comprehensive dual-API system testing
npm run elite:deploy      # Deploy elite 1-minute system
npm run odds-api:test     # Test Odds API integration
npm run odds-api:ncaaf    # Test NCAAF data specifically
npm run odds-api:monitor  # Real-time credit monitoring
npm run settlement:test   # Test settlement automation
```

#### 🔍 Code Quality

```bash
npm run lint              # ESLint validation
npm run lint:fix          # Auto-fix ESLint issues
npm run format            # Prettier formatting
npm run format:check      # Check formatting
```

### 🏗️ Architecture Patterns

#### Agent Development Guidelines

1. **Extend BaseAgent** - All agents inherit from `src/agents/BaseAgent/`
2. **Implement Health Checks** - Required for monitoring and observability
3. **Use Structured Logging** - Correlation IDs and distributed tracing
4. **Prometheus Metrics** - Performance and business metrics collection
5. **Error Handling** - Use `errorHandler` utility with retry logic

#### Creating a New Agent

```typescript
import { BaseAgent } from '../BaseAgent';
import { BaseAgentConfig, BaseAgentDependencies } from '../BaseAgent/types';

export class NewAgent extends BaseAgent {
  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    super(config, deps);
  }

  protected async initialize(): Promise<void> {
    // Agent initialization logic
  }

  protected async process(): Promise<void> {
    // Main processing logic
  }

  protected async healthCheck(): Promise<HealthCheckResult> {
    // Health monitoring implementation
  }
}
```

### 🧪 Comprehensive Testing Strategy

#### Test Structure

```
test/
├── 🔬 unit/              # Unit tests for individual components
├── 🔗 integration/       # Integration tests for system interactions
├── 🎭 e2e/               # End-to-end user journey tests
├── ⚡ performance/       # Load, stress, and performance tests
├── 🛡️ security/          # Security and penetration tests
└── 🎯 agents/            # Agent-specific test suites
```

#### Testing Requirements

- **80%+ Coverage** - Comprehensive test coverage requirement
- **Agent Testing** - All 13 agents must have dedicated test suites
- **Integration Testing** - Test agent interactions and workflows
- **Performance Testing** - Load testing for high-traffic scenarios
- **Accessibility Testing** - WCAG compliance validation

### 📊 Key Business Features

#### 1. Multi-Model Grading System

- **Ensemble Scoring** - Multiple ML models for accuracy
- **Market Resistance** - Real-time line movement analysis
- **Risk Management** - Portfolio optimization and position sizing
- **Tier Classification** - 5-tier system for pick quality

#### 2. Intelligent Content Feeds

- **Personalization** - User preference-based content
- **Real-time Updates** - Live content delivery
- **Optimal Pipeline** - High-performance data processing
- **Multi-channel Distribution** - Discord, web, mobile delivery

#### 3. Advanced Analytics

- **Performance Tracking** - ROI and Sharpe ratio analysis
- **Trend Detection** - Market pattern recognition
- **VIP+ Insights** - Premium tier exclusive features
- **Real-time Monitoring** - System health and performance

## 🚀 Production Deployment

### 📋 Pre-Deployment Checklist

#### Infrastructure Requirements

- **Compute**: 4+ CPU cores, 16GB+ RAM per service
- **Database**: PostgreSQL 14+ with connection pooling
- **Cache**: Redis cluster with persistence
- **Orchestration**: Temporal server cluster
- **Monitoring**: Prometheus + Grafana stack

#### Security Requirements

- SSL/TLS certificates for all endpoints
- Environment variable encryption
- Database connection security
- API key rotation policies
- Network security groups

### ⚙️ Production Configuration

#### 1. Environment Setup

```bash
# Copy production environment template
cp config/env.example .env.production

# Configure production variables
ENVIRONMENT=production
DATABASE_URL=postgresql://user:pass@prod-db:5432/unittalk
REDIS_URL=redis://prod-redis:6379
TEMPORAL_HOST=prod-temporal:7233
```

#### 2. Build & Deploy

```bash
# Install production dependencies
npm ci --only=production

# Build optimized application
npm run build

# Run production validation
npm run validate:production

# Deploy using master script
npm run deploy:production
```

### 🔧 Deployment Scripts

#### Primary Deployment

```bash
# Master deployment orchestrator
npm run scripts:deploy-master      # Full production deployment

# Environment-specific deployments
npm run scripts:deploy-production  # Production environment
npm run scripts:deploy-staging     # Staging environment

# Infrastructure setup
npm run scripts:setup-infrastructure  # Complete infrastructure setup
npm run scripts:production-redis     # Redis cluster configuration
```

#### Health Validation

```bash
# Pre-deployment validation
npm run scripts:validate-environment  # Environment configuration
npm run scripts:validate-redis       # Redis connectivity
npm run scripts:validate-schema      # Database schema

# Post-deployment verification
npm run scripts:health-check         # System health status
npm run scripts:comprehensive-test   # Full system validation
```

### 📊 Monitoring & Observability

#### Metrics Stack

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization dashboards and alerting
- **Node Exporter** - System metrics collection
- **Custom Metrics** - Business and application metrics

#### Health Check Endpoints

```bash
GET /health                    # Overall system health
GET /health/agents            # All 13 agents status
GET /health/database          # Database connectivity
GET /health/temporal          # Temporal workflow status
GET /metrics                  # Prometheus metrics endpoint
```

#### Key Performance Indicators

```typescript
interface ProductionMetrics {
  // System Performance
  uptime: number; // System uptime percentage
  responseTime: number; // Average API response time
  throughput: number; // Requests per second
  errorRate: number; // Error rate percentage

  // Business Metrics
  picksProcessed: number; // Daily picks processed
  userEngagement: number; // Active user sessions
  alertsSent: number; // Notifications delivered
  feedsGenerated: number; // Content feeds created

  // Agent Performance
  agentHealth: AgentHealth[]; // Individual agent status
  workflowSuccess: number; // Temporal workflow success rate
  processingLatency: number; // Average processing time
}
```

### 🚨 Production Monitoring

#### Alert Thresholds

```yaml
alerts:
  critical:
    - agent_down: 1 # Any agent failure
    - error_rate: 5% # Error rate > 5%
    - response_time: 2000ms # Response time > 2s
    - uptime: 99% # Uptime < 99%

  warning:
    - memory_usage: 80% # Memory usage > 80%
    - cpu_usage: 75% # CPU usage > 75%
    - disk_usage: 85% # Disk usage > 85%
    - queue_backlog: 1000 # Processing backlog > 1000
```

#### Monitoring Dashboards

- **System Overview** - High-level system health and performance
- **Agent Performance** - Individual agent metrics and status
- **Business Metrics** - User engagement and business KPIs
- **Infrastructure** - Server resources and network performance

### 🔄 Deployment Strategies

#### Blue-Green Deployment

```bash
# Deploy to staging environment (Green)
npm run deploy:staging

# Run comprehensive validation
npm run qa:full

# Switch traffic to green environment
npm run deploy:switch-green

# Monitor and rollback if needed
npm run deploy:rollback
```

#### Zero-Downtime Deployment

1. **Health Check** - Verify current system status
2. **Deploy New Version** - Deploy to inactive environment
3. **Smoke Tests** - Run critical path validation
4. **Traffic Switch** - Gradually shift traffic to new version
5. **Monitoring** - Monitor metrics and error rates
6. **Rollback Plan** - Automatic rollback on failure

### 🔐 Security & Compliance

#### Security Measures

- **Authentication** - Multi-factor authentication for admin access
- **Authorization** - Role-based access control (RBAC)
- **Encryption** - Data encryption at rest and in transit
- **Audit Logging** - Comprehensive audit trail
- **Vulnerability Scanning** - Regular security assessments

#### Compliance Requirements

- **Data Protection** - GDPR/CCPA compliance for user data
- **Financial Regulations** - Gaming and financial compliance
- **Security Standards** - SOC2 Type II compliance
- **Audit Trail** - Complete action logging and monitoring

### 📈 Scaling & Performance

#### Horizontal Scaling

- **Agent Scaling** - Auto-scaling based on queue depth
- **Database Scaling** - Read replicas and connection pooling
- **Cache Scaling** - Redis cluster with sharding
- **Load Balancing** - Multi-region load distribution

#### Performance Optimization

- **Database Optimization** - Query optimization and indexing
- **Caching Strategy** - Multi-level caching implementation
- **CDN Integration** - Global content delivery
- **Resource Management** - Dynamic resource allocation

### 🆘 Disaster Recovery

#### Backup Strategy

- **Database Backups** - Hourly incremental, daily full backups
- **Configuration Backups** - Version-controlled configurations
- **Application Backups** - Container image versioning
- **Data Replication** - Multi-region data replication

#### Recovery Procedures

```bash
# Emergency recovery procedures
npm run recovery:database         # Database recovery from backup
npm run recovery:redis           # Redis cluster recovery
npm run recovery:full-system     # Complete system recovery
```

## 📚 Documentation & Resources

### 🤖 Agent Documentation

- **[BaseAgent Framework](src/agents/BaseAgent/README.md)** - Core agent
  architecture and patterns
- **[ScoringAgent](src/agents/ScoringAgent/README.md)** - Professional pick
  scoring with ML ensemble
- **[FeedAgent](src/agents/FeedAgent/README.md)** - Optimal dual-API data
  ingestion
- **[AlertAgent](src/agents/AlertAgent/README.md)** - Real-time notifications
  and Discord alerts
- **[AnalyticsAgent](src/agents/AnalyticsAgent/README.md)** - Performance
  insights and data analysis
- **[NotificationAgent](src/agents/NotificationAgent/README.md)** -
  Multi-channel user communications
- **[PlayerEnrichmentAgent](src/agents/PlayerEnrichmentAgent/README.md)** -
  Multi-league player data enrichment
- **[AutomatedOnboardingAgent](src/agents/AutomatedOnboardingAgent/README.md)** -
  ML-powered Discord onboarding (ENHANCED)
- **[RecapAgent](src/agents/RecapAgent/README.md)** - Daily/weekly performance
  summaries

### 📖 System Documentation

- **[Architecture Overview](ARCHITECTURE.md)** - Complete system architecture
- **[Scripts Reference](SCRIPTS_REFERENCE.md)** - Comprehensive script
  documentation
- **[Agent Development SOP](agent-development-sop.md)** - Agent development
  guidelines
- **[Base Agent Specification](BASE_AGENT_SPEC.md)** - Technical specifications
- **[Production Deployment Master](PRODUCTION_DEPLOYMENT_MASTER.md)** - Complete
  deployment guide
- **[System Operations Guide](SYSTEM_OPERATIONS_GUIDE.md)** - Operations and
  maintenance

### 🔧 Development Resources

- **[Contributing Guidelines](CONTRIBUTING.md)** - Contribution standards and
  processes
- **[Agent Development SOP](agent-development-sop.md)** - Creating and
  maintaining agents
- **[External Integration SOP](external-integration-sop.md)** - External service
  integration
- **[KPI Documentation SOP](kpi-documentation-sop.md)** - Performance metrics
  documentation

### 🚀 Deployment Resources

- **[Production Deployment Master](PRODUCTION_DEPLOYMENT_MASTER.md)** - Complete
  deployment procedures
- **[System Operations Guide](SYSTEM_OPERATIONS_GUIDE.md)** - Operations and
  maintenance guide
- **[Elite System Guide](ELITE_SYSTEM_GUIDE.md)** - Elite dual-API system setup
- **[Professional Capper Features](PROFESSIONAL_CAPPER_FEATURES.md)** - Advanced
  features guide

## 🛠️ Development Workflow

### Getting Started

1. **Environment Setup** - Configure local development environment
2. **Agent Development** - Create and test new agents following BaseAgent
   pattern
3. **Testing** - Comprehensive testing including unit, integration, and
   performance tests
4. **Code Quality** - ESLint, Prettier, and TypeScript validation
5. **Documentation** - Update relevant documentation and README files

### Contributing Guidelines

1. **Fork Repository** - Create personal fork for development
2. **Feature Branch** - Create feature branch from main
3. **Development** - Implement changes following coding standards
4. **Testing** - Ensure comprehensive test coverage (80%+)
5. **Documentation** - Update documentation for any changes
6. **Pull Request** - Submit PR with detailed description and test results

### Code Standards

- **TypeScript Strict Mode** - Full type safety and validation
- **ESLint Configuration** - Airbnb configuration with custom rules
- **Prettier Formatting** - Consistent code formatting
- **Comprehensive Testing** - Unit, integration, and E2E test coverage
- **Agent Pattern** - All agents must extend BaseAgent framework

## 🏆 Performance & Scale

### Elite System Capabilities

- **13 Optimized Agents** - Streamlined automation with 52% resource reduction
- ⚡ **1-Minute Real-Time Updates** - Industry-leading speed (5-15x faster than
  competitors)
- 🔀 **Dual-API Intelligence** - Optimal + Odds API for comprehensive coverage
- 🏈 **Complete Sports Coverage** - NFL, NCAAF, NBA, WNBA, MLB, NHL + Settlement
- **>10,000 picks/day** - High-volume processing capacity
- **<50s processing cycles** - Elite 1-minute update capability
- **<500ms response** - Sub-second API response times
- **99.9% uptime** - Enterprise-grade reliability
- **Multi-region** - Global deployment capabilities

### Elite Business Impact

- **Industry Leadership** - 1-minute updates vs 5-15 minute industry standard
- **Market Exclusivity** - Only platform with complete NCAAF and WNBA coverage
- **Automated Settlement** - Post-game automation competitors lack
- **Cost Advantage** - $118/month vs competitor $200-500/month
- **Advanced ML Grading** - Multi-model ensemble for superior accuracy
- **Real-time Processing** - Live market analysis and opportunity detection
- **Intelligent Automation** - 24/7 automated business operations
- **Scalable Architecture** - Handle Fortune 100-level traffic and data volumes

## 📞 Support & Contact

### Development Support

- **Technical Issues** - Create GitHub issue with detailed description
- **Feature Requests** - Submit enhancement requests through issue tracker
- **Documentation** - Refer to comprehensive documentation in `/docs`
- **Agent Development** - Follow BaseAgent pattern and development guidelines

### Business Inquiries

- **Platform Access** - Contact for platform access and integration
- **Enterprise Features** - Discuss enterprise-level features and customization
- **Partnership Opportunities** - Explore partnership and collaboration
  opportunities

### Quick Links

- 📋
  **[Issue Tracker](https://github.com/your-org/unit-talk-production/issues)** -
  Report bugs and request features
- 📚 **[Documentation](docs/)** - Complete system documentation
- 🤖 **[Agent Reference](src/agents/)** - Agent-specific documentation
- 🔧 **[Scripts](scripts/)** - Maintenance and deployment scripts

---

## License

**Proprietary** - All rights reserved. This software is proprietary and
confidential.

---

_Unit Talk - Fortune 100-Grade Sports Betting Intelligence Platform_ _⚡ Elite
1-Minute Updates • 🔀 Dual-API System • 🏈 Complete Sports Coverage_ _Powered by
13 Optimized Agents and Advanced Machine Learning_
