# Smart Form Production Runbook

**Version**: 3.0 Production Hardened  
**Last Updated**: August 2025  
**Environment**: Production  

## 📋 Overview

This runbook provides operational guidance for the production-hardened Smart Form application. All features have been upgraded to enterprise standards with comprehensive security, logging, and monitoring.

## 🚀 Production Architecture

### Core Components

- **Next.js 14 Application**: Smart Form frontend with API routes
- **Production API**: Hardened endpoints with Zod validation
- **Supabase v3.0.0**: Unified database with 42% optimization (77→45 tables)
- **Bridge Integration**: Idempotent event processing with outbox pattern
- **Structured Logging**: Pino-based logging with performance monitoring
- **Environment Security**: Locked secrets with server/client separation

### Security Features ✅

- **No Direct DB Access**: All client operations via validated API routes
- **UUID-Based IDs**: Capper identification via secure UUIDs instead of names
- **Environment Isolation**: Service role keys isolated to server-side only
- **Input Validation**: Comprehensive Zod schemas on all endpoints
- **Security Logging**: Automated logging of manual entries and security events

## 🛠️ Deployment

### Prerequisites

```bash
# Required environment variables (see .env.example)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # SERVER ONLY
OPTIMAL_API_KEY=your_optimal_api_key_here             # SERVER ONLY
DISCORD_WEBHOOK_URL=your_discord_webhook_url_here     # SERVER ONLY
```

### Database Migration

```sql
-- Run the production migration
\i sql/2025-08-bridge-constraints.sql
```

### Application Startup

```bash
# Production deployment
npm run build
npm run start

# Development with monitoring
npm run dev
```

### Health Checks

| Endpoint | Expected Response | Purpose |
|----------|------------------|---------|
| `/api/cappers` | `{"cappers": [...]}` | Capper data availability |
| `/api/games?sport=NBA` | `{"games": [...]}` | Game data pipeline |
| `/api/props?sport=NBA` | `{"props": [...]}` | Props data integration |
| `/submit-ticket` | Form loads without errors | Frontend health |

## 📊 Monitoring & Observability

### Key Metrics

**API Performance**:
- Response time: <100ms (95th percentile)
- Database queries: <50ms (95th percentile)
- Error rate: <0.1%
- Uptime: >99.9%

**Bridge Integration**:
- Event processing success rate: >99%
- Idempotency collision handling: Logged and handled
- Outbox processing latency: <5 seconds

**Security Monitoring**:
- Manual odds entries: Logged with medium security level
- Invalid UUID attempts: Logged and blocked
- Failed authentication attempts: Logged with capper context

### Logging Structure

All logs use structured JSON format with Pino:

```json
{
  "level": "info",
  "time": 1691234567890,
  "pid": 1234,
  "hostname": "smart-form-prod",
  "route": "POST /api/submit-ticket",
  "method": "POST",
  "component": "smart-form-api",
  "bet_slip_id": "550e8400-e29b-41d4-a716-446655440000",
  "capper_id": "123e4567-e89b-12d3-a456-426614174000",
  "sport": "NBA",
  "selection_count": 1,
  "is_live": false,
  "performance": {
    "duration_ms": 45,
    "db_queries": 3,
    "api_calls": 0
  },
  "msg": "Ticket successfully saved"
}
```

### Log Levels

- **ERROR**: System failures, validation errors, database issues
- **WARN**: Security events, data inconsistencies, fallback usage  
- **INFO**: Successful operations, performance metrics, state changes
- **DEBUG**: Detailed execution flow (development only)

## 🚨 Troubleshooting

### Common Issues

#### 1. Database Connection Issues

**Symptoms**: 
- API endpoints return 500 errors
- Logs show "Connection failed" errors
- Form displays "No cappers found" with fallback data

**Resolution**:
```bash
# Check database connectivity
npm run setup

# Verify environment variables
echo $SUPABASE_SERVICE_ROLE_KEY | head -c 20

# Test database health
curl "https://your-supabase-url.com/rest/v1/users?select=count" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY"
```

#### 2. API Validation Errors

**Symptoms**:
- Form submission fails with 400 errors
- Logs show "Invalid request data" 
- User sees "Validation Error" toast

**Resolution**:
```bash
# Check request format in logs
grep "validation_error" /var/log/smart-form.log

# Common issues:
# - capper_id not UUID format
# - sport not in enum [NFL, NBA, MLB, NHL, NCAAF]  
# - selections array empty
# - parlay with <2 selections
```

#### 3. Bridge Integration Failures  

**Symptoms**:
- Tickets submit but events not processed
- Bridge simulation endpoint returns errors
- Outbox table has "failed" status events

**Resolution**:
```bash
# Check bridge outbox status
SELECT status, COUNT(*) FROM bridge_outbox GROUP BY status;

# Retry failed events (development)
curl -X GET "http://localhost:3021/api/dev/simulate-bridge?id=<bet_slip_id>"

# Check event payload structure
SELECT payload FROM bridge_outbox WHERE status = 'failed' LIMIT 1;
```

#### 4. Performance Degradation

**Symptoms**:
- API response times >1 second
- Form interactions feel sluggish  
- High CPU usage in logs

**Resolution**:
```bash
# Check API performance logs
grep "performance.*duration_ms" /var/log/smart-form.log | tail -10

# Monitor database query performance  
grep "db_operation.*duration" /var/log/smart-form.log

# Check for N+1 queries or missing indexes
```

### Error Response Codes

| Code | Meaning | Common Causes | Resolution |
|------|---------|---------------|------------|
| 400 | Validation Error | Invalid input data | Check request format |
| 401 | Unauthorized | Missing/invalid API key | Verify environment variables |
| 404 | Not Found | Invalid capper_id | Check capper exists and is active |
| 429 | Rate Limited | Too many requests | Implement client-side throttling |
| 500 | Server Error | Database/system issue | Check logs and system health |

### Emergency Procedures

#### Production Incident Response

1. **Immediate Assessment** (0-5 minutes)
   - Check application availability
   - Review error rate in logs  
   - Verify database connectivity
   - Confirm API endpoint health

2. **Mitigation** (5-15 minutes)
   - Roll back to last known good version if needed
   - Enable maintenance mode if critical
   - Scale resources if performance-related
   - Notify stakeholders via Discord webhook

3. **Investigation** (15-60 minutes)
   - Analyze structured logs for root cause
   - Check database performance metrics
   - Review recent code deployments
   - Identify data inconsistencies

4. **Resolution** (Variable)
   - Apply hot fix if code-related
   - Optimize queries if database-related
   - Scale infrastructure if capacity-related
   - Update monitoring if observability gap

#### Rollback Procedure

```bash
# Quick rollback to previous version
git checkout <previous-release-tag>
npm run build
npm run start

# Database rollback (if needed)
# Note: Only possible if migration is reversible
```

## 🔧 Maintenance

### Regular Tasks

**Daily**:
- Monitor error rates in logs
- Check bridge outbox processing status
- Verify API response times
- Review security event logs

**Weekly**:
- Analyze performance trends
- Review and clean up old log files
- Update dependencies if security patches available
- Validate backup and disaster recovery procedures

**Monthly**:
- Performance optimization review
- Security audit of environment variables
- Database index analysis and optimization
- Capacity planning and scaling assessment

### Database Maintenance

```sql
-- Clean up old bridge events (monthly)
DELETE FROM bridge_outbox 
WHERE status = 'completed' 
AND processed_at < NOW() - INTERVAL '30 days';

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename IN ('unified_picks', 'smart_tickets', 'bridge_outbox');

-- Analyze performance
ANALYZE unified_picks;
ANALYZE smart_tickets;
ANALYZE bridge_outbox;
```

### Log Rotation

```bash
# Configure logrotate for production logs
sudo tee /etc/logrotate.d/smart-form << EOF
/var/log/smart-form.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
  postrotate
    systemctl reload smart-form
  endscript
}
EOF
```

## 📈 Performance Optimization

### Database Optimization

```sql
-- Key indexes for performance
CREATE INDEX CONCURRENTLY idx_unified_picks_user_sport 
ON unified_picks(user_id, sport, created_at DESC);

CREATE INDEX CONCURRENTLY idx_bridge_outbox_status_attempt
ON bridge_outbox(status, next_attempt_at);

CREATE INDEX CONCURRENTLY idx_smart_tickets_capper_date
ON smart_tickets(capper_id, created_at DESC);
```

### API Optimization

- **Caching**: Capper data cached for 5 minutes
- **Connection Pooling**: Database connections reused  
- **Query Optimization**: Selective fields, proper indexes
- **Compression**: API responses use gzip compression
- **Rate Limiting**: Prevent abuse with request throttling

### Frontend Optimization

- **Bundle Optimization**: Code splitting by route
- **Image Optimization**: Next.js automatic optimization
- **Prefetching**: Critical API calls prefetched
- **Error Boundaries**: Graceful error handling
- **Performance Monitoring**: Real User Monitoring (RUM)

## 🔒 Security

### Access Control

- **API Keys**: Server-side environment variables only
- **Database Access**: Service role key isolated to API routes
- **CORS**: Configured for specific origins only
- **Input Validation**: All inputs validated with Zod schemas
- **Output Sanitization**: All responses structured and sanitized

### Security Monitoring

```bash
# Monitor security events
grep "security_event" /var/log/smart-form.log

# Check for failed authentication attempts  
grep "auth_failure" /var/log/smart-form.log

# Monitor manual odds entries
grep "manual_odds_entry" /var/log/smart-form.log
```

### Security Incident Response

1. **Detection**: Automated logging alerts stakeholders
2. **Assessment**: Determine severity and scope
3. **Containment**: Block malicious requests if needed
4. **Investigation**: Analyze logs for attack patterns
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

## 📞 Support Contacts

### Escalation Matrix

**Level 1 - Application Issues**:
- Frontend errors, form validation issues
- API response errors, data loading problems
- Contact: Development Team

**Level 2 - Infrastructure Issues**:  
- Database connectivity, performance degradation
- Environment variable issues, deployment problems
- Contact: DevOps Team

**Level 3 - Security Issues**:
- Suspicious activity, potential breaches
- Authentication failures, data integrity issues
- Contact: Security Team + Management

### Monitoring Alerts

**Critical (Immediate Response)**:
- Application down
- Error rate >5%
- Database connectivity lost
- Security incidents

**Warning (15-minute Response)**:
- Performance degradation
- Error rate >1%  
- Bridge processing delays
- Resource utilization >80%

**Info (Daily Review)**:
- Performance trends
- Feature usage analytics
- Security event summaries
- Capacity planning metrics

---

**Document Owner**: Engineering Team  
**Review Cycle**: Monthly  
**Version**: 3.0 Production Hardened  
**Last Validated**: August 2025