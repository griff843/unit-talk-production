# Unit Talk Platform - Incident Response Playbook

**Version**: 1.0  
**Last Updated**: August 7, 2025  
**Scope**: Production incident management for Unit Talk platform

---

## 🚨 Emergency Contacts

### Primary On-Call
- **Platform Owner**: Available 24/7 during NFL season
- **Escalation Path**: Technical Lead → Engineering Manager → CTO

### Key URLs
- **Command Center**: http://localhost:3004
- **Temporal UI**: http://localhost:8088  
- **Grafana**: http://localhost:3001
- **Prometheus**: http://localhost:9090

---

## 🚦 Incident Severity Levels

### **P1 - Critical (Response Time: 15 minutes)**
- **Impact**: Complete system outage, data loss, security breach
- **Examples**: 
  - All workflows stopped
  - Database unavailable
  - Discord bot completely down
  - Data ingestion halted during live games
  - Security breach detected

### **P2 - High (Response Time: 1 hour)**
- **Impact**: Major feature degraded, significant user impact
- **Examples**:
  - One critical workflow failing
  - API response times >5 seconds
  - Command Center unavailable
  - External API quota exceeded

### **P3 - Medium (Response Time: 4 hours)**
- **Impact**: Minor feature issues, limited user impact
- **Examples**:
  - Non-critical agent failing
  - Slow response times (2-5 seconds)
  - Minor Discord integration issues

### **P4 - Low (Response Time: Next business day)**
- **Impact**: Cosmetic issues, no user impact
- **Examples**:
  - UI styling issues
  - Non-critical monitoring alerts
  - Documentation updates needed

---

## 📋 Incident Response Process

### **1. Detection & Assessment (0-5 minutes)**

#### Immediate Actions
1. **Acknowledge the incident** in monitoring systems
2. **Assess severity** using the matrix above
3. **Start incident timer** and document start time
4. **Notify team** if P1/P2 severity

#### Detection Sources
- **Automated Alerts**: Grafana/Prometheus alerts
- **Command Center**: Real-time dashboard alerts
- **User Reports**: Discord community reports
- **Monitoring**: Health check failures
- **External**: API provider notifications

### **2. Initial Response (5-15 minutes)**

#### P1 Critical Response
```bash
# 1. System Status Check
./dev.sh status
docker-compose ps

# 2. Emergency Stop if needed
npm run workflows:emergency-stop

# 3. Health Check All Services
npm run health:check

# 4. Check logs for errors
./dev.sh logs | grep ERROR
```

#### P2 High Response
```bash
# 1. Identify affected components
./dev.sh status

# 2. Check specific service logs
docker-compose logs [service-name] --tail=100

# 3. Restart affected services if needed
docker-compose restart [service-name]
```

### **3. Investigation & Diagnosis (15-60 minutes)**

#### System Analysis Checklist
- [ ] **Docker Services**: All containers running?
- [ ] **Database**: Master and replica healthy?
- [ ] **Temporal**: All workflows executing?
- [ ] **External APIs**: Quota and connectivity OK?
- [ ] **Network**: Connectivity between services?
- [ ] **Resources**: CPU, Memory, Disk space OK?

#### Key Diagnostic Commands
```bash
# System health overview
./dev.sh status
npm run health:check

# Database health
node scripts/database-failover.js --check

# Temporal workflow status
npm run workflows:status

# Resource usage
docker stats

# Service logs
docker-compose logs --tail=200 --timestamps
```

### **4. Resolution & Recovery**

#### Common Resolution Patterns

**Workflow Stopped**:
```bash
# 1. Check Temporal server
docker-compose restart temporal

# 2. Restart workers
docker-compose restart workers

# 3. Start workflows
npm run workflows:start
```

**Database Issues**:
```bash
# 1. Check database health
node scripts/database-failover.js --check

# 2. If master down, failover to replica
node scripts/database-failover.js --failover

# 3. Update app database URL to replica (port 5433)
```

**API Quota Exceeded**:
```bash
# 1. Check quota status in Command Center
# 2. Activate fallback API routing
# 3. Monitor quota reset times
# 4. Consider upgrading API plan if recurring
```

**High Memory/CPU**:
```bash
# 1. Identify resource-heavy containers
docker stats

# 2. Restart specific services
docker-compose restart [service-name]

# 3. Scale down non-critical services if needed
```

### **5. Communication**

#### Internal Communication
- **P1/P2**: Immediate Slack notification
- **Status Updates**: Every 30 minutes during active incident
- **Resolution**: Incident closed notification

#### User Communication (if applicable)
- **Discord Announcement**: For user-facing outages
- **Status Message**: Clear, non-technical explanation
- **ETA Updates**: Regular updates on resolution progress

---

## 🛠️ Service-Specific Runbooks

### **Temporal Workflows**

#### Symptoms
- No new data in database
- Workflows showing as stopped in UI
- "No active workflows" in Command Center

#### Diagnosis
```bash
# Check Temporal server health
docker-compose exec temporal temporal operator cluster health

# List active workflows
npm run workflows:status

# Check worker logs
docker-compose logs workers --tail=100
```

#### Resolution
```bash
# 1. Restart Temporal stack
docker-compose restart temporal temporal-ui

# 2. Restart workers
docker-compose restart workers

# 3. Start all workflows
npm run workflows:start

# 4. Verify in UI
npm run workflows:status
```

### **Database Connectivity**

#### Symptoms
- "Connection refused" errors
- Apps unable to start
- Slow query responses

#### Diagnosis
```bash
# Check database containers
docker-compose ps postgres postgres-replica

# Test connections
node scripts/database-failover.js --check

# Check replication status
docker-compose exec postgres-replica psql -U postgres -c "SELECT pg_is_in_recovery();"
```

#### Resolution
```bash
# 1. If master healthy, restart apps
docker-compose restart api discord-bot command-center

# 2. If master down, failover to replica
node scripts/database-failover.js --failover

# 3. Update DATABASE_URL in docker-compose.yml to replica port (5433)
# 4. Restart all dependent services
```

### **External API Failures**

#### Symptoms
- "API quota exceeded" alerts
- "Connection timeout" errors
- Missing prop data during live games

#### Diagnosis
- Check API Health in Command Center
- Review quota usage percentages
- Test API endpoints manually

#### Resolution
```bash
# 1. Check quota status
curl https://api.optimal.com/usage
curl https://api.the-odds-api.com/v4/usage

# 2. Activate fallback routing if needed
# 3. Monitor quota reset schedules
# 4. Consider upgrading API plans if consistently hitting limits
```

### **Discord Bot Issues**

#### Symptoms
- Bot appears offline
- Commands not responding
- No automated alerts being sent

#### Diagnosis
```bash
# Check bot container
docker-compose ps discord-bot

# Check bot logs
docker-compose logs discord-bot --tail=100

# Verify Discord API connectivity
```

#### Resolution
```bash
# 1. Restart Discord bot
docker-compose restart discord-bot

# 2. Verify Discord token is valid
# 3. Check Discord API status
# 4. Verify bot permissions in Discord server
```

---

## 🔍 Monitoring & Alerting

### **Critical Alerts**

#### System Health Alerts
- **Workflow Failures**: Any critical workflow stopped >5 minutes
- **Database Connectivity**: Connection failures >30 seconds
- **API Quota**: Usage >90% of daily limit
- **Response Time**: API responses >2 seconds for 5 minutes
- **Error Rate**: >1% error rate for 5 minutes

#### Business Impact Alerts
- **Data Ingestion**: No new props >10 minutes during live games
- **Discord Connectivity**: Bot offline >2 minutes
- **User Authentication**: Login failures >5% for 10 minutes

### **Alert Response Matrix**

| Alert | Severity | Auto-Action | Manual Action Required |
|-------|----------|-------------|----------------------|
| Critical workflow stopped | P1 | Auto-restart attempt | Investigate root cause |
| Database connection failed | P1 | Failover to replica | Fix master database |
| API quota >95% | P2 | Activate fallback | Upgrade API plan |
| High error rate | P2 | None | Investigate errors |
| Slow response times | P3 | None | Performance analysis |

---

## 📊 Post-Incident Process

### **1. Immediate Post-Resolution (0-30 minutes)**
- [ ] Verify all systems operational
- [ ] Update internal stakeholders
- [ ] Document initial timeline
- [ ] Monitor for regression

### **2. Post-Incident Review (Within 24 hours)**
- [ ] **Timeline Documentation**: Complete incident timeline
- [ ] **Root Cause Analysis**: 5-whys analysis
- [ ] **Impact Assessment**: User impact, data impact, revenue impact
- [ ] **Action Items**: Preventive measures identified

### **3. Follow-up Actions (Within 1 week)**
- [ ] **Process Improvements**: Update runbooks
- [ ] **Technical Improvements**: Fix root causes
- [ ] **Monitoring Enhancements**: Add new alerts if needed
- [ ] **Training Updates**: Share learnings with team

---

## 🧪 Testing & Validation

### **Monthly Disaster Recovery Tests**
- **Database Failover**: Test replica promotion
- **Workflow Recovery**: Test workflow restart procedures  
- **API Failover**: Test fallback routing
- **Communication**: Test alerting channels

### **Quarterly Game Day Simulations**
- **Full System Failure**: Complete platform outage simulation
- **Partial Outages**: Single service failure scenarios
- **High Load**: Stress test during simulated peak traffic
- **Security Incident**: Simulated security breach response

---

## 📞 Escalation Matrix

### **Technical Escalation**
1. **On-Call Engineer** (0-15 minutes)
2. **Technical Lead** (15-30 minutes)
3. **Engineering Manager** (30-60 minutes)
4. **CTO** (60+ minutes or security incidents)

### **Business Escalation**
1. **Product Owner** (P1/P2 incidents affecting users)
2. **VP Product** (Extended outages >2 hours)
3. **CEO** (Security breaches or extended outages >4 hours)

### **External Escalation**
- **API Providers**: For quota/connectivity issues
- **Discord Support**: For bot-related issues
- **AWS/Infrastructure**: For hosting issues
- **Security Team**: For security incidents

---

## 🔐 Security Incident Response

### **Security Breach Detection**
- Unauthorized database access
- API key compromise
- Suspicious user activity
- Data exfiltration attempts

### **Immediate Security Response**
```bash
# 1. Isolate affected systems
docker-compose stop [affected-services]

# 2. Preserve evidence
docker-compose logs [service] > incident-logs-$(date +%Y%m%d-%H%M%S).log

# 3. Reset compromised credentials
# 4. Review access logs
# 5. Notify security team
```

### **Security Investigation**
- **Preserve Evidence**: All logs, configurations, affected data
- **Timeline Analysis**: When did breach occur, what was accessed
- **Impact Assessment**: What data was compromised
- **Containment**: Prevent further damage
- **Recovery**: Restore secure operations

---

## 📚 Resources & References

### **Documentation**
- [System Architecture](./architecture/)
- [API Documentation](./api/)
- [Deployment Guide](./deployment/)
- [Security Protocols](./security/)

### **Monitoring URLs**
- **Command Center**: http://localhost:3004
- **Temporal UI**: http://localhost:8088
- **Grafana Dashboards**: http://localhost:3001
- **Prometheus Metrics**: http://localhost:9090
- **pgAdmin**: http://localhost:5050

### **Key Scripts**
- `./dev.sh` - Docker service management
- `scripts/database-failover.js` - Database failover utility
- `npm run workflows:start` - Start Temporal workflows
- `npm run health:check` - System health verification

---

**Document Owner**: Platform Engineering Team  
**Review Frequency**: Monthly during NFL season, Quarterly off-season  
**Last Reviewed**: August 7, 2025  
**Next Review**: September 7, 2025