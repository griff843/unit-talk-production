# 🚀 Unit Talk Production Deployment Master Guide

_Last Updated: January 2025_

## Overview

This consolidated guide provides complete deployment procedures for the Unit
Talk Platform across all environments from startup to Fortune 100 enterprise
scale.

---

## 📋 Quick Reference

### Deployment Types

- **[Startup Deployment](#startup-deployment)** - Cost-optimized infrastructure
  ($200-500/month)
- **[Enterprise Deployment](#enterprise-deployment)** - Fortune 100-grade
  infrastructure ($2K-10K/month)
- **[Development Setup](#development-setup)** - Local development environment

### Pre-Deployment Checklist

- ✅ **Database**: Supabase PostgreSQL 14+ configured
- ✅ **API Keys**: OpenAI, Discord, Twilio credentials ready
- ✅ **Infrastructure**: Docker, Redis, monitoring stack
- ✅ **Code Quality**: All tests passing, TypeScript clean

---

## 🏗️ Infrastructure Options

### Startup Infrastructure (Cost-Optimized)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Discord Bot   │    │   Web Frontend  │    │   Admin Panel   │
│  (DO App Plat)  │    │    (Vercel)     │    │   (Retool)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   API Backend   │
                    │ (DO Droplet)    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Database      │
                    │  (Supabase)     │
                    └─────────────────┘
```

**Monthly Cost**: ~$300-500

- DigitalOcean Droplet: $50-100
- Supabase Pro: $25
- Vercel Pro: $20
- Monitoring: $50-100
- External APIs: $150-250

### Enterprise Infrastructure (Fortune 100)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Load Balancer  │    │   Kubernetes    │    │  Monitoring     │
│   (AWS ALB)     │    │   Cluster       │    │ (Prometheus)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Multi-Region   │
                    │   Database      │
                    │  (Supabase)     │
                    └─────────────────┘
```

**Monthly Cost**: ~$2K-10K+

- Kubernetes cluster: $500-2000
- Multi-region database: $200-1000
- Monitoring & logging: $300-800
- CDN & security: $200-500
- Premium support: $1000+

---

## 🚀 Deployment Procedures

### 1. Environment Setup

#### Core Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Discord Integration
DISCORD_ALERT_WEBHOOK=your_discord_webhook_url

# Monitoring
PROMETHEUS_ENDPOINT=your_prometheus_endpoint
```

#### Database Setup (Supabase)

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Apply schema from schema/supabase.sql
\i schema/supabase.sql
```

### 2. Application Deployment

#### Quick Start Commands

```bash
# 1. Clone and setup
git clone <repository>
cd unit-talk-production
npm install

# 2. Configure environment
cp config/env.example .env
# Edit .env with your credentials

# 3. Build application
npm run build

# 4. Deploy (choose method)
# Docker deployment
docker-compose -f docker-compose.prod.yml up -d

# OR Kubernetes deployment
kubectl apply -f k8s/

# OR Manual deployment
npm run deploy:production
```

### 3. Service Configuration

#### Agent System Setup

```bash
# Test all agents
npm run agents:test

# Start individual services
npm run worker:dev         # Temporal worker
npm run syndicate:start    # Scheduler
npm run odds-api:monitor   # API monitoring
```

#### Monitoring Setup

```bash
# Deploy monitoring stack
docker-compose -f monitoring/docker-compose.yml up -d

# Access dashboards
echo "Grafana: http://localhost:3000"
echo "Prometheus: http://localhost:9090"
```

---

## ✅ Production Readiness Checklist

### Critical Systems (Must Complete)

- [ ] **Database Schema**: All migrations applied
- [ ] **Agent System**: All 12+ agents healthy
- [ ] **API Integration**: Dual-API system working
- [ ] **Discord Bot**: Commands and interactions functional
- [ ] **Health Checks**: All endpoints responding
- [ ] **Monitoring**: Prometheus metrics collecting
- [ ] **Security**: SSL certificates and security headers
- [ ] **Backup Strategy**: Database and configuration backups

### Performance Requirements

- [ ] **Response Time**: <500ms for API calls
- [ ] **Processing Speed**: <50s for 1-minute update cycles
- [ ] **Uptime Target**: 99.9% availability
- [ ] **Error Rate**: <0.1% for critical operations

### Quality Gates

- [ ] **Test Coverage**: 80%+ across all components
- [ ] **TypeScript**: Zero compilation errors
- [ ] **Security Scan**: No high/critical vulnerabilities
- [ ] **Load Testing**: Handles expected traffic

---

## 🔧 Troubleshooting

### Common Issues

#### Agent Startup Failures

```bash
# Check agent health
npm run health:check

# Debug specific agent
DEBUG=agent:* npx tsx src/runner/testAllAgents.ts --agent=GradingAgent
```

#### Database Connection Issues

```bash
# Test database connectivity
npx tsx scripts/validateSchema.ts

# Check Supabase status
curl -f $SUPABASE_URL/rest/v1/health
```

#### Performance Issues

```bash
# Monitor metrics
npm run metrics:show

# Performance profiling
npm run qa:performance
```

### Emergency Procedures

```bash
# Rollback deployment
npm run deploy:rollback

# Emergency system recovery
npm run recovery:full-system

# Database recovery
npm run recovery:database
```

---

## 📊 Monitoring & Maintenance

### Health Check Endpoints

```bash
GET /health                 # Overall system health
GET /health/agents         # Agent status
GET /health/database       # Database connectivity
GET /metrics               # Prometheus metrics
```

### Alert Thresholds

```yaml
alerts:
  critical:
    - agent_down: 1 # Any agent failure
    - error_rate: 5% # Error rate > 5%
    - response_time: 2000ms # Response time > 2s
  warning:
    - memory_usage: 80% # Memory usage > 80%
    - cpu_usage: 75% # CPU usage > 75%
```

### Maintenance Tasks

```bash
# Daily
npm run maintenance:daily   # Health checks, log rotation

# Weekly
npm run maintenance:weekly  # Performance analysis, updates

# Monthly
npm run maintenance:monthly # Security audit, optimization
```

---

## 📚 Additional Resources

- **[Architecture Documentation](ARCHITECTURE.md)** - System design and patterns
- **[Agent Development Guide](agent-development-sop.md)** - Creating new agents
- **[API Documentation](api/)** - REST API reference
- **[Security Guidelines](SECURITY.md)** - Security best practices

---

_For technical support, create an issue or contact the engineering team_
