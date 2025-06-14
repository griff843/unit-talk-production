# Enhanced Unit Talk Production Deployment Guide

## Overview

This guide covers the deployment of the enhanced Unit Talk platform with advanced AI orchestration, monitoring, and alerting capabilities.

## Prerequisites

### System Requirements
- Node.js 18+ with npm/yarn
- Docker and Docker Compose
- PostgreSQL 14+ (via Supabase)
- Redis 6+ (for caching and queues)
- Prometheus and Grafana (for monitoring)

### API Keys and Services
- OpenAI API key (required)
- Anthropic API key (optional, for Claude models)
- Discord webhook URLs (for alerts)
- Twilio credentials (for SMS alerts)
- Email service credentials (SendGrid, SES, etc.)

## Environment Configuration

### Core Environment Variables

```bash
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key  # Optional

# Discord Integration
DISCORD_ALERT_WEBHOOK=your_discord_webhook_url
DISCORD_PROMOTION_WEBHOOK=your_discord_promotion_webhook_url

# Email Alerts
CRITICAL_EMAIL_RECIPIENTS=admin@unittalk.com,ops@unittalk.com
BUSINESS_EMAIL_RECIPIENTS=business@unittalk.com,analytics@unittalk.com
ALERT_EMAIL_FROM=alerts@unittalk.com

# SMS Alerts (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1234567890
ONCALL_PHONE_NUMBERS=+1234567890,+0987654321

# External Integrations
EXTERNAL_WEBHOOK_URL=https://your-external-system.com/webhooks/unittalk
EXTERNAL_WEBHOOK_TOKEN=your_webhook_token

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3000
DASHBOARD_PORT=3001

# Performance Tuning
MAX_CONCURRENT_AI_REQUESTS=10
AI_REQUEST_TIMEOUT_MS=30000
ALERT_COOLDOWN_MINUTES=15
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT_MS=60000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_PERFORMANCE_LOGGING=true
```

### Advanced Configuration

```bash
# AI Model Configuration
AI_MODEL_PRIORITY_GPT4_TURBO=1
AI_MODEL_PRIORITY_GPT4=2
AI_MODEL_PRIORITY_GPT35_TURBO=3
AI_MODEL_PRIORITY_CLAUDE3_SONNET=2

# Rate Limiting
OPENAI_RATE_LIMIT_RPM=500
ANTHROPIC_RATE_LIMIT_RPM=1000
DISCORD_RATE_LIMIT_RPM=50

# Business Rules
HIGH_TIER_TEMPERATURE_MULTIPLIER=0.8
SHARP_FADE_CONFIDENCE_BOOST=0.1
CONSENSUS_AGREEMENT_THRESHOLD=0.6

# Caching
REDIS_URL=redis://localhost:6379
CACHE_TTL_SECONDS=300
ENABLE_RESPONSE_CACHING=true

# Feature Flags
ENABLE_CONSENSUS_MODE=true
ENABLE_CIRCUIT_BREAKER=true
ENABLE_PERFORMANCE_TRACKING=true
ENABLE_ADVANCED_ALERTS=true
```

## Deployment Steps

### 1. Infrastructure Setup

```bash
# Clone the repository
git clone <repository-url>
cd unit-talk-production

# Install dependencies
npm install

# Set up environment variables
cp config/env.example .env
# Edit .env with your configuration
```

### 2. Database Setup

```sql
-- Enhanced database schema additions
-- Run these in your Supabase SQL editor

-- AI Model Performance Tracking
CREATE TABLE IF NOT EXISTS ai_model_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_id VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    accuracy DECIMAL(5,4) DEFAULT 0,
    avg_latency INTEGER DEFAULT 0,
    error_rate DECIMAL(5,4) DEFAULT 0,
    total_predictions INTEGER DEFAULT 0,
    correct_predictions INTEGER DEFAULT 0,
    avg_confidence DECIMAL(5,4) DEFAULT 0,
    success_rate DECIMAL(5,4) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert Rules Configuration
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    condition VARCHAR(500) NOT NULL,
    threshold DECIMAL(10,4) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    enabled BOOLEAN DEFAULT true,
    cooldown_minutes INTEGER DEFAULT 15,
    channels JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert History
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_id VARCHAR(100) NOT NULL,
    rule_id VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,
    value DECIMAL(10,4) NOT NULL,
    threshold DECIMAL(10,4) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'acknowledged')),
    channels JSONB DEFAULT '[]',
    tags JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

-- System Metrics Storage
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_model_performance_model_id ON ai_model_performance(model_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_rule_id ON alert_rules(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);

-- Row Level Security (RLS)
ALTER TABLE ai_model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- Policies (adjust based on your auth setup)
CREATE POLICY "Allow service role full access" ON ai_model_performance FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON alert_rules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON alert_history FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON system_metrics FOR ALL USING (auth.role() = 'service_role');
```

### 3. Build and Deploy

```bash
# Build the application
npm run build

# Run tests
npm test

# Start the application
npm start

# Or use PM2 for production
npm install -g pm2
pm2 start ecosystem.config.js
```

### 4. Monitoring Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: unit-talk-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./config/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./config/prometheus/rules:/etc/prometheus/rules
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'

  grafana:
    image: grafana/grafana:latest
    container_name: unit-talk-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-storage:/var/lib/grafana
      - ./config/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./config/grafana/datasources:/etc/grafana/provisioning/datasources

  redis:
    image: redis:7-alpine
    container_name: unit-talk-redis
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  grafana-storage:
  redis-data:
```

### 5. Prometheus Configuration

```yaml
# config/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  - job_name: 'unit-talk-app'
    static_configs:
      - targets: ['localhost:3001']
    scrape_interval: 10s
    metrics_path: '/metrics'

  - job_name: 'unit-talk-agents'
    static_configs:
      - targets: ['localhost:3002', 'localhost:3003', 'localhost:3004']
    scrape_interval: 30s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### 6. Alert Rules

```yaml
# config/prometheus/rules/unit-talk-alerts.yml
groups:
  - name: unit-talk-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(unit_talk_agent_errors_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} errors per second"

      - alert: HighProcessingTime
        expr: histogram_quantile(0.95, rate(unit_talk_agent_processing_duration_seconds_bucket[5m])) > 30
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High processing time detected"
          description: "95th percentile processing time is {{ $value }} seconds"

      - alert: AgentDown
        expr: up{job="unit-talk-agents"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Agent is down"
          description: "Agent {{ $labels.instance }} has been down for more than 1 minute"

      - alert: LowPickAccuracy
        expr: unit_talk_pick_accuracy < 0.6
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low pick accuracy detected"
          description: "Pick accuracy is {{ $value }}, below 60% threshold"
```

## Production Checklist

### Pre-Deployment
- [ ] Environment variables configured
- [ ] Database schema updated
- [ ] API keys and webhooks tested
- [ ] Monitoring stack deployed
- [ ] Alert rules configured
- [ ] SSL certificates installed
- [ ] Backup strategy implemented

### Post-Deployment
- [ ] Health checks passing
- [ ] Metrics being collected
- [ ] Alerts functioning
- [ ] Performance within acceptable limits
- [ ] Error rates low
- [ ] AI models responding correctly
- [ ] Database connections stable

### Monitoring Checklist
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboards configured
- [ ] Alert manager routing alerts
- [ ] Discord/email notifications working
- [ ] SMS alerts for critical issues
- [ ] Log aggregation working
- [ ] Performance tracking active

## Scaling Considerations

### Horizontal Scaling
```bash
# Use PM2 cluster mode
pm2 start ecosystem.config.js --instances max

# Or use Docker Swarm/Kubernetes
docker stack deploy -c docker-compose.yml unit-talk
```

### Database Optimization
```sql
-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Query optimization
ANALYZE;
REINDEX DATABASE your_database_name;
```

### Caching Strategy
```javascript
// Redis caching configuration
const cacheConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  ttl: process.env.CACHE_TTL_SECONDS || 300,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100
};
```

## Troubleshooting

### Common Issues

1. **High AI Model Latency**
   - Check API rate limits
   - Verify network connectivity
   - Monitor circuit breaker status
   - Consider model fallback chain

2. **Alert Spam**
   - Adjust cooldown periods
   - Review alert thresholds
   - Check for metric anomalies
   - Verify alert rule conditions

3. **Database Connection Issues**
   - Check connection pool settings
   - Monitor active connections
   - Verify network connectivity
   - Review query performance

4. **Memory Issues**
   - Monitor heap usage
   - Check for memory leaks
   - Adjust Node.js memory limits
   - Review caching strategy

### Performance Tuning

```bash
# Node.js optimization
export NODE_OPTIONS="--max-old-space-size=4096"
export UV_THREADPOOL_SIZE=16

# PM2 optimization
pm2 start ecosystem.config.js --node-args="--max-old-space-size=4096"
```

## Security Considerations

### API Security
- Use HTTPS for all external communications
- Implement rate limiting
- Validate all inputs
- Use secure headers
- Monitor for suspicious activity

### Database Security
- Enable Row Level Security (RLS)
- Use service role keys appropriately
- Implement audit logging
- Regular security updates
- Backup encryption

### Monitoring Security
- Secure Prometheus/Grafana access
- Use authentication for dashboards
- Encrypt metrics in transit
- Regular security scans
- Access logging

## Maintenance

### Regular Tasks
- Monitor system health daily
- Review alert patterns weekly
- Update dependencies monthly
- Performance review quarterly
- Security audit annually

### Backup Strategy
- Database backups (daily)
- Configuration backups (weekly)
- Metrics data retention (90 days)
- Log retention (30 days)
- Disaster recovery testing (quarterly)

## Support and Documentation

### Runbooks
- [Agent Restart Procedures](./runbooks/agent-restart.md)
- [Database Maintenance](./runbooks/database-maintenance.md)
- [Alert Response Guide](./runbooks/alert-response.md)
- [Performance Troubleshooting](./runbooks/performance-troubleshooting.md)

### Monitoring Dashboards
- System Overview: http://localhost:3000/d/system-overview
- Agent Performance: http://localhost:3000/d/agent-performance
- Business Metrics: http://localhost:3000/d/business-metrics
- AI Model Performance: http://localhost:3000/d/ai-models

### Contact Information
- On-call Engineer: +1-XXX-XXX-XXXX
- DevOps Team: devops@unittalk.com
- Business Team: business@unittalk.com
- Emergency Escalation: emergency@unittalk.com