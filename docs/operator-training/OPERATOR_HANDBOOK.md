# Unit Talk Operator Handbook

## 🎯 Overview

This handbook provides comprehensive training and procedures for operators of the Unit Talk syndicate-grade betting intelligence platform. Operators are responsible for monitoring system health, managing incidents, and maintaining operational excellence.

## 👤 Operator Roles & Responsibilities

### Primary Responsibilities
- **System Monitoring**: Continuous oversight of system health and performance
- **Incident Management**: First response to alerts and incident escalation
- **System Controls**: Managing safe mode, circuit breakers, and agent controls
- **Performance Optimization**: Identifying and addressing performance bottlenecks
- **Documentation**: Maintaining accurate incident records and operational logs

### Role Hierarchy
1. **Operator Level 1**: Basic monitoring and incident response
2. **Operator Level 2**: System controls and advanced troubleshooting
3. **Senior Operator**: Emergency procedures and system architecture changes
4. **Operations Manager**: Strategic oversight and team coordination

## 🚨 Alert Response Procedures

### Alert Classification

#### Severity Levels
- **Critical**: System down or major functionality impaired (Response: Immediate)
- **High**: Significant performance degradation (Response: 5 minutes)
- **Medium**: Minor issues with potential impact (Response: 15 minutes)
- **Low**: Informational or maintenance alerts (Response: 1 hour)

#### Alert Types
1. **SLO Violations**: Performance metrics exceeding thresholds
2. **Agent Health**: Agent failures or degraded performance
3. **Data Quality**: Issues with data ingestion or processing
4. **Security**: Potential security incidents or anomalies
5. **Infrastructure**: Hardware or service availability issues

### Response Workflows

#### Standard Alert Response (Non-Critical)
1. **Acknowledge** alert within response time SLA
2. **Assess** impact using dashboard metrics
3. **Investigate** root cause using monitoring tools
4. **Document** findings in incident management system
5. **Resolve** or escalate based on complexity
6. **Verify** resolution and close alert

#### Critical Alert Response
1. **Immediate acknowledgment** (< 30 seconds)
2. **Emergency assessment** using Command Center
3. **Activate** incident response team if needed
4. **Implement** immediate mitigation (safe mode, circuit breakers)
5. **Communicate** status to stakeholders
6. **Coordinate** resolution efforts
7. **Post-incident** review and documentation

## 📊 Dashboard Operations

### Primary Dashboard Views

#### System Health Overview
- **Overall Health Score**: Composite metric (target: > 0.95)
- **Component Status**: Individual service health indicators
- **Active Alerts**: Current alerts by severity
- **Performance Metrics**: Key SLO indicators

#### Agent Management
- **Agent Status**: Real-time health and activity
- **Performance Metrics**: Throughput and latency
- **Error Rates**: Failure percentages and trends
- **Resource Utilization**: CPU, memory, and connection usage

#### Data Pipeline Monitor
- **HOT Data**: Real-time ingestion metrics
- **Steam Detection**: Market movement alerts
- **Feature Computation**: 45-factor scoring status
- **Grading Pipeline**: Processing throughput

### Navigation Procedures

#### Daily Health Check (Start of Shift)
1. **Access** Operator Dashboard at http://localhost:3004
2. **Review** overall system health score
3. **Check** active alerts and incidents
4. **Verify** all agents are healthy
5. **Review** overnight activity logs
6. **Document** any anomalies or concerns

#### Hourly Monitoring Routine
1. **Monitor** SLO metrics for violations
2. **Check** data pipeline throughput
3. **Review** error rates and trends
4. **Validate** steam detection accuracy
5. **Monitor** feature computation performance

## 🎛️ System Controls

### Safe Mode Operations

#### When to Enable Safe Mode
- **Pre-deployment**: Before major system changes
- **Performance Issues**: During high error rates
- **Data Quality Problems**: When data validation fails
- **External Service Issues**: Third-party API problems
- **Maintenance Windows**: Planned maintenance activities

#### Safe Mode Procedures
1. **Access** System Controls panel
2. **Click** "Enable Safe Mode"
3. **Provide** detailed reason (minimum 10 characters)
4. **Confirm** operation
5. **Monitor** system behavior in safe mode
6. **Document** reason and duration

#### Safe Mode Effects
- **Reduced Throughput**: Lower processing rate with higher validation
- **Enhanced Monitoring**: Increased health check frequency
- **Conservative Processing**: More stringent data quality checks
- **Operator Alerts**: Additional notifications for anomalies

### Agent Control Procedures

#### Agent Actions
- **Start**: Initialize agent from stopped state
- **Stop**: Gracefully shutdown agent
- **Pause**: Temporarily halt processing without shutdown
- **Restart**: Stop and start agent (recommended for configuration changes)

#### Agent Control Steps
1. **Select** agent from control panel
2. **Choose** action (start/stop/pause/restart)
3. **Provide** reason for action (minimum 5 characters)
4. **Confirm** operation
5. **Monitor** agent status change
6. **Verify** successful completion

#### Agent-Specific Considerations

**FeedAgent**
- **Impact**: Stops data ingestion from external sources
- **Recovery Time**: 30-60 seconds for restart
- **Monitoring**: Check data gap after restart

**ScoringAgent**
- **Impact**: Halts prop scoring and market intelligence
- **Recovery Time**: 60-90 seconds for restart
- **Monitoring**: Verify scoring queue processing

**AlertAgent**
- **Impact**: Stops Discord notifications and alerts
- **Recovery Time**: 15-30 seconds for restart
- **Monitoring**: Check alert delivery after restart

### Circuit Breaker Management

#### Circuit Breaker Types
- **External APIs**: Third-party data sources
- **Database**: Primary and replica connections
- **Cache**: Redis and memory caches
- **Storage**: File system and cloud storage

#### When to Use Circuit Breakers
- **High Error Rates**: > 10% failure rate from external services
- **Timeout Issues**: Consistent response time violations
- **Resource Exhaustion**: Connection pool or memory issues
- **Cascading Failures**: Preventing system-wide impacts

#### Circuit Breaker Procedures
1. **Identify** problematic service
2. **Access** Circuit Breaker controls
3. **Select** service name
4. **Toggle** circuit breaker state
5. **Provide** detailed reason
6. **Monitor** system response
7. **Plan** recovery timeline

## 🚨 Incident Management

### Incident Creation

#### Automatic Incident Creation
System automatically creates incidents for:
- **SLO Violations**: Performance threshold breaches
- **Agent Failures**: Agent health check failures
- **Data Quality Issues**: Validation failures
- **Security Events**: Suspicious activity detection

#### Manual Incident Creation
Create manual incidents for:
- **User Reports**: Issues reported by stakeholders
- **Proactive Issues**: Problems identified during monitoring
- **Maintenance Impact**: Unexpected maintenance effects
- **External Dependencies**: Third-party service issues

#### Incident Creation Process
1. **Access** Incident Management panel
2. **Click** "Create New Incident"
3. **Fill** required fields:
   - Title (clear, descriptive)
   - Description (detailed problem description)
   - Severity (critical/high/medium/low)
   - Affected Services
   - Impact Assessment
4. **Add** relevant tags
5. **Submit** incident
6. **Monitor** automatic assignment

### Incident Response

#### Initial Response (First 5 Minutes)
1. **Acknowledge** incident assignment
2. **Assess** severity and impact
3. **Gather** initial information
4. **Implement** immediate mitigation if possible
5. **Update** incident status

#### Investigation Phase
1. **Use** monitoring tools to gather data
2. **Check** logs for error patterns
3. **Review** recent system changes
4. **Identify** potential root causes
5. **Document** findings in incident comments

#### Resolution Phase
1. **Implement** fix or workaround
2. **Verify** issue resolution
3. **Monitor** for recurrence
4. **Update** incident status to "Resolved"
5. **Document** resolution steps

### Incident Escalation

#### Escalation Triggers
- **Time-based**: Incident open > defined threshold
- **Severity-based**: Critical incidents require immediate escalation
- **Complexity-based**: Issues requiring specialized expertise
- **Impact-based**: Customer or revenue impact

#### Escalation Process
1. **Assess** escalation criteria
2. **Contact** appropriate escalation contact
3. **Provide** incident context and current status
4. **Transfer** incident ownership if required
5. **Continue** monitoring and support

## 📈 Performance Monitoring

### Key Performance Indicators (KPIs)

#### System Performance
- **API Response Time**: Target P95 < 100ms
- **Database Query Time**: Target P95 < 50ms
- **Steam Detection Latency**: Target P95 < 5 seconds
- **Feature Computation Rate**: Target > 1000 features/second
- **System Availability**: Target 99.9% uptime

#### Operational Metrics
- **Incident Volume**: Target < 5 incidents/day
- **Mean Time to Resolution**: Target < 30 minutes
- **SLO Compliance**: Target > 95% compliance
- **Alert Noise**: Target < 10% false positives

### Performance Analysis

#### Trend Identification
1. **Access** Analytics dashboard
2. **Select** time range (last 24 hours, week, month)
3. **Review** performance trends
4. **Identify** degradation patterns
5. **Correlate** with system changes

#### Capacity Planning
1. **Monitor** resource utilization trends
2. **Project** future capacity needs
3. **Identify** scaling requirements
4. **Plan** infrastructure improvements
5. **Document** capacity recommendations

### Performance Optimization

#### Immediate Actions
- **Identify** performance bottlenecks
- **Implement** quick fixes (cache tuning, query optimization)
- **Monitor** impact of changes
- **Document** improvements

#### Long-term Planning
- **Analyze** architectural improvements
- **Plan** infrastructure upgrades
- **Coordinate** with development team
- **Implement** strategic optimizations

## 🔧 Troubleshooting Guide

### Common Issues and Solutions

#### High API Response Times
**Symptoms**: API response time P95 > 100ms
**Investigation**:
1. Check database query performance
2. Review connection pool utilization
3. Analyze endpoint-specific metrics
4. Check external API response times

**Solutions**:
- Scale database read replicas
- Optimize slow queries
- Increase connection pool size
- Enable query caching
- Implement circuit breakers for external APIs

#### Agent Health Issues
**Symptoms**: Agent health checks failing
**Investigation**:
1. Check agent-specific logs
2. Review resource utilization
3. Validate configuration settings
4. Check network connectivity

**Solutions**:
- Restart affected agent
- Increase resource allocation
- Fix configuration issues
- Resolve network problems

#### Steam Detection Delays
**Symptoms**: Steam detection latency > 5 seconds
**Investigation**:
1. Check data ingestion pipeline
2. Review feature computation performance
3. Analyze processing queue depth
4. Validate data quality

**Solutions**:
- Optimize data processing pipeline
- Scale feature computation resources
- Implement parallel processing
- Improve data quality filters

#### Database Connection Issues
**Symptoms**: Connection pool exhaustion, query timeouts
**Investigation**:
1. Monitor connection pool metrics
2. Check for connection leaks
3. Review query performance
4. Analyze connection patterns

**Solutions**:
- Increase connection pool size
- Fix connection leaks in application code
- Optimize long-running queries
- Implement connection retry logic

### Diagnostic Tools

#### Log Analysis
```bash
# Check API logs for errors
docker-compose logs api | grep -i error

# Monitor real-time agent activity
docker-compose logs -f feedagent

# Search for specific error patterns
docker-compose logs | grep -A 5 -B 5 "steam detection"
```

#### Database Diagnostics
```sql
-- Check active connections
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';

-- Identify slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check table sizes
SELECT 
  schemaname||'.'||tablename as table,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Performance Monitoring
```bash
# Check system resource usage
docker stats

# Monitor API metrics
curl -s http://localhost:9464/metrics | grep -E "api_request|database_query"

# Check Prometheus targets
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[].health'
```

## 📚 Standard Operating Procedures (SOPs)

### Daily Operations Checklist

#### Start of Shift
- [ ] Access Operator Dashboard
- [ ] Review overnight alerts and incidents
- [ ] Check system health score (target: > 0.95)
- [ ] Verify all agents are healthy
- [ ] Review performance metrics
- [ ] Check data pipeline status
- [ ] Document any concerns

#### During Shift
- [ ] Monitor alerts in real-time
- [ ] Respond to incidents per severity SLA
- [ ] Perform hourly health checks
- [ ] Update incident documentation
- [ ] Communicate with stakeholders as needed
- [ ] Escalate complex issues appropriately

#### End of Shift
- [ ] Complete incident handover notes
- [ ] Update shift summary
- [ ] Brief incoming operator
- [ ] Document any pending issues
- [ ] Verify all critical alerts addressed

### Weekly Operations Tasks

#### Monday
- [ ] Review weekend incident summary
- [ ] Plan week's maintenance activities
- [ ] Check capacity planning metrics
- [ ] Review SLO compliance

#### Wednesday
- [ ] Mid-week performance review
- [ ] Update operational documentation
- [ ] Validate monitoring accuracy
- [ ] Review escalation procedures

#### Friday
- [ ] Week summary preparation
- [ ] Weekend coverage planning
- [ ] Performance trend analysis
- [ ] Incident pattern review

### Emergency Procedures

#### System-Wide Emergency
1. **Assess** situation severity
2. **Activate** emergency response team
3. **Implement** emergency stop if required
4. **Communicate** status to all stakeholders
5. **Coordinate** resolution efforts
6. **Document** incident progression
7. **Conduct** post-incident review

#### Data Security Incident
1. **Immediately** enable safe mode
2. **Isolate** affected systems
3. **Contact** security team
4. **Preserve** evidence
5. **Implement** containment measures
6. **Coordinate** with legal/compliance

## 📞 Contact Information

### Escalation Contacts

#### Technical Escalation
- **Senior Operations**: ext. 2001
- **Engineering Team**: ext. 2010
- **Database Admin**: ext. 2020
- **Security Team**: ext. 2030

#### Business Escalation
- **Operations Manager**: ext. 3001
- **Product Manager**: ext. 3010
- **Executive Team**: ext. 3020

#### External Support
- **Supabase Support**: support@supabase.com
- **Infrastructure Provider**: ops@provider.com
- **Monitoring Vendor**: support@monitoring.com

### Communication Channels

#### Internal
- **Slack**: #operations-alerts
- **Discord**: Operations Channel
- **Email**: ops-team@unittalk.com
- **Dashboard**: Real-time status

#### External
- **Status Page**: status.unittalk.com
- **Customer Support**: support@unittalk.com
- **Social Media**: @UnitTalkStatus

---

**Handbook Version**: 2.0  
**Last Updated**: September 10, 2025  
**Next Review**: Monthly operational review  
**Owner**: Operations Team