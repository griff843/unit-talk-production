# Production Launch Gatekeeper v1 - Owner Guide

**Version**: 1.0  
**Owner**: Platform Operations Team  
**Last Updated**: January 2025  
**Status**: Production Ready

## Overview

The Production Launch Gatekeeper v1 is a comprehensive deployment safety system that enforces progressive canary rollouts with SLO guards, automated rollback, and emergency controls. This guide provides detailed instructions for operators and platform owners.

## System Architecture

### Core Components

1. **Progressive Deployment Workflow** (`.github/workflows/deploy-prod.yml`)
   - 10% → 50% → 100% canary progression
   - SLO guard monitoring every 10 seconds
   - Automated rollback on guard violations

2. **Auto-Rollback System** (`.github/workflows/rollback.yml`)
   - Emergency rollback within 2 minutes
   - Incident creation and notification dispatch
   - System stabilization and validation

3. **Command Center Integration** (`apps/command-center/`)
   - Kill Switch with `SYSTEM_FREEZE` control
   - Real-time Rollout Timeline monitoring
   - Manual deployment abort capabilities

4. **API Endpoints** (`apps/command-center/src/app/api/ops/`)
   - `/deploy/status` - Live deployment monitoring
   - `/deploy/abort` - Manual deployment termination
   - `/system/freeze` - Kill Switch activation/deactivation

## Deployment Workflow

### Prerequisites Validation

Before any deployment can proceed, these automated checks must pass:

1. **E2E Test Suite** ✅
   ```bash
   npm run test:e2e
   # Must achieve 100% pass rate
   # No failing critical test scenarios
   # Complete within 30 minutes
   ```

2. **Go-Live Rehearsal Freshness** ✅
   ```bash
   # Rehearsal must be completed within 7 days
   # Rehearsal must have passed all validation steps
   # No blocking issues identified
   ```

3. **Build Verification** ✅
   ```bash
   npm run type-check  # Zero TypeScript errors
   npm run build      # Successful production build
   npm run lint       # Zero linting errors
   ```

4. **Security Validation** ✅
   ```bash
   npm audit --audit-level high  # No critical vulnerabilities
   # Secret detection scan passed
   # Dependency security validation
   ```

### Progressive Rollout Phases

#### Phase 1: 10% Canary (15 minutes minimum)
- **Traffic**: 10% routed to green environment
- **Monitoring**: SLO guards checked every 10 seconds
- **Conditions**: All guards must remain GREEN
- **Duration**: Minimum 15 minutes before progression

**Guard Thresholds**:
- Feed Freshness: ≤ 300 seconds
- Temporal Backlog Age: ≤ 300 seconds
- Failure Burn Rate: Must not be "red"
- Canary Health: ≤ 90 seconds since last check

#### Phase 2: 50% Canary (10 minutes minimum)
- **Traffic**: 50% routed to green environment
- **Monitoring**: Intensified guard monitoring
- **Conditions**: Higher sensitivity to performance degradation
- **Duration**: Minimum 10 minutes before full rollout

#### Phase 3: Full Rollout (Immediate)
- **Traffic**: 100% routed to green environment
- **Completion**: Automatic release tagging
- **Notification**: Success alerts to all channels

### Auto-Rollback System

#### Trigger Conditions
The system automatically initiates rollback when:

1. **Guard Violations**: Any SLO guard exceeds threshold for 2 consecutive checks (20 seconds)
2. **Multiple Failures**: Simultaneous violations across multiple guards
3. **Health Failures**: Canary instances become unresponsive
4. **System Alerts**: Critical alerts during rollout window
5. **Kill Switch**: Emergency Kill Switch activation

#### Rollback Process Timeline

| Phase | Duration | Action |
|-------|----------|--------|
| **Detection** | < 10 seconds | SLO guard violation detected |
| **Validation** | < 10 seconds | Confirm violation across multiple checks |
| **Trigger** | < 30 seconds | Initiate rollback workflow |
| **Traffic Shift** | < 30 seconds | Route all traffic to blue environment |
| **Stabilization** | < 60 seconds | Activate safe mode flags |
| **Incident** | < 60 seconds | Create incident record |
| **Notification** | < 60 seconds | Alert all channels |
| **Validation** | < 30 seconds | Confirm system stability |

**Total Rollback Time**: < 2 minutes

## Command Center Operations

### Kill Switch Usage

The Kill Switch is the ultimate emergency control that immediately freezes all system operations.

#### When to Use Kill Switch

**Critical Situations**:
- Security vulnerabilities discovered in production
- Data integrity issues affecting user accounts
- Uncontrolled system behavior or cascading failures
- Regulatory compliance violations
- External service compromise affecting platform security

**NOT for Use**:
- Normal deployment issues (use deployment abort instead)
- Minor performance degradation
- Single service failures with available workarounds
- Planned maintenance activities

#### Kill Switch Activation Process

1. **Access Command Center**: Navigate to https://command-center.unittalk.com/dashboard
2. **Locate Kill Switch Panel**: Red emergency controls section
3. **Click "ACTIVATE KILL SWITCH"**: Big red button
4. **Provide Detailed Reason**: Explain the critical situation
5. **Confirm Activation**: Dual verification required
6. **Monitor System Freeze**: Verify all operations blocked

#### Kill Switch Effects

When activated, the Kill Switch immediately:
- Sets `SYSTEM_FREEZE=true` in configuration
- Blocks all deployment workflows
- Activates `SAFE_MODE=true`
- Enables `SHADOW_MODE=true`  
- Disables `PUBLISH_TO_DISCORD=false`
- Disables `AUTO_SETTLEMENT=false`
- Creates audit log entry
- Sends critical alerts to all channels

#### Kill Switch Deactivation

1. **Resolve Root Cause**: Ensure the emergency situation is resolved
2. **Validate System State**: Confirm system integrity and security
3. **Access Kill Switch Panel**: Navigate to Command Center
4. **Click "DEACTIVATE KILL SWITCH"**: After resolution
5. **Provide Deactivation Reason**: Explain resolution and clearance
6. **Confirm Deactivation**: Verify system returns to normal operation
7. **Monitor Recovery**: Ensure gradual service restoration

### Rollout Timeline Monitoring

The Rollout Timeline widget provides real-time deployment monitoring and control.

#### Timeline Interface Elements

**Phase Indicators**:
- 🔵 **IDLE**: No active deployment
- 🟡 **CANARY10**: 10% traffic to new version
- 🟠 **CANARY50**: 50% traffic to new version  
- 🟢 **FULL**: 100% traffic rollout completed
- 🔴 **ROLLING_BACK**: Auto-rollback in progress
- ❌ **FAILED**: Deployment failed and rolled back

**Guard Status Display**:
- 🟢 **GREEN**: All guards within thresholds
- 🟡 **YELLOW**: Guards approaching thresholds
- 🔴 **RED**: Guards exceeded thresholds (triggers rollback)

**Control Actions**:
- **Abort Deployment**: Manual deployment termination
- **View Details**: Expanded deployment information
- **Monitor Guards**: Real-time guard status updates

#### Manual Deployment Abort

Use manual abort for:
- Discovery of critical issues not caught by guards
- Business decision to halt deployment
- External factors requiring immediate rollback
- Testing and validation purposes

**Abort Process**:
1. Click "Abort Deployment" in Rollout Timeline
2. Provide detailed abort reason
3. Confirm abort action
4. Monitor rollback progress
5. Verify system stability

## Monitoring and Alerting

### Real-Time Monitoring

#### Command Center Dashboard
- **Rollout Timeline**: Live deployment phase progression
- **Guard Status**: SLO guard monitoring with color indicators
- **System Health**: Infrastructure and application metrics
- **Deployment History**: Previous rollout outcomes and trends

#### API Monitoring Endpoints

```bash
# Current deployment status
curl https://command-center.unittalk.com/api/ops/deploy/status

# Kill Switch status  
curl https://command-center.unittalk.com/api/ops/system/freeze/status

# System health overview
curl https://api.unittalk.com/health
```

### Alert Channels

#### Critical Alerts (Immediate Response)
- **Slack**: `#ops-critical` channel
- **Discord**: Operations team notifications
- **PagerDuty**: On-call engineer escalation
- **Email**: Platform leadership team

**Triggers**:
- Kill Switch activation/deactivation
- Auto-rollback triggered by guard violations
- Deployment failures requiring immediate attention
- Security incidents during deployment

#### Warning Alerts (Monitor Closely)
- **Slack**: `#ops-alerts` channel
- **Discord**: General operations notifications
- **Email**: Extended operations team

**Triggers**:
- SLO guards approaching thresholds
- Manual deployment aborts
- Extended deployment phases
- Performance degradation detected

#### Info Alerts (Situational Awareness)
- **Slack**: `#deployments` channel
- **Discord**: Development team notifications
- **Email**: Daily/weekly summaries

**Triggers**:
- Successful deployment completions
- Phase progressions during rollouts
- Release tag creation
- System configuration changes

## Troubleshooting Guide

### Common Issues and Resolutions

#### Deployment Stuck in Canary Phase

**Symptoms**:
- Deployment remains in 10% or 50% phase beyond minimum duration
- No progression to next phase
- Guards showing GREEN status

**Diagnosis**:
```bash
# Check deployment status
curl https://command-center.unittalk.com/api/ops/deploy/status | jq '.'

# Verify guard monitoring
curl https://command-center.unittalk.com/api/ops/deploy/status | jq '.guards'

# Check workflow logs
gh run list --workflow=deploy-prod.yml --limit=1
gh run view [run-id] --log
```

**Resolution**:
1. Verify all guards are consistently GREEN for minimum phase duration
2. Check for GitHub Actions workflow delays or issues
3. Manually trigger phase progression if automation failed
4. Consider manual abort if unable to resolve

#### False Positive Auto-Rollback

**Symptoms**:
- Rollback triggered despite system appearing healthy
- Guards showing intermittent violations
- Users reporting no issues

**Diagnosis**:
```bash
# Review guard violation history
curl https://command-center.unittalk.com/api/ops/deploy/status | jq '.guardViolations[]'

# Check system metrics during rollback window
# Review Prometheus/Grafana dashboards for anomalies

# Verify rollback incident details
# Check incident tracking system for root cause
```

**Resolution**:
1. Analyze guard violation patterns and thresholds
2. Adjust guard sensitivity if false positives frequent
3. Investigate underlying system issues causing violations
4. Update monitoring to reduce noise and improve accuracy

#### Kill Switch Not Responding

**Symptoms**:
- Kill Switch button not responding in Command Center
- System configurations not updating
- Operations continuing despite activation attempt

**Diagnosis**:
```bash
# Check Kill Switch API directly
curl -X GET https://command-center.unittalk.com/api/ops/system/freeze/status

# Verify system configuration values
# Check database for SYSTEM_FREEZE status
# Review Command Center logs for errors
```

**Resolution**:
1. Use API endpoints directly to bypass UI issues
2. Verify database connectivity and configuration table
3. Check Command Center service health and restart if needed
4. Escalate to platform engineering for critical issues

#### Guard Threshold Violations

**Symptoms**:
- Frequent rollbacks due to specific guard violations
- Performance degradation during deployments
- Guard thresholds too sensitive or too loose

**Investigation**:
```bash
# Analyze guard violation patterns
# Review historical performance data
# Compare against baseline system metrics
# Check for external factors affecting performance
```

**Tuning**:
1. **Feed Freshness**: Adjust threshold based on data pipeline performance
2. **Temporal Backlog**: Consider workflow complexity and processing time
3. **Failure Burn Rate**: Calibrate based on acceptable error rates
4. **Canary Health**: Account for health check frequency and network latency

### Escalation Procedures

#### Level 1: Operations Team Response (< 15 minutes)
- Initial assessment and standard troubleshooting
- Execute documented runbook procedures
- Activate appropriate emergency controls

#### Level 2: Platform Engineering (< 30 minutes)
- Complex system issues requiring engineering expertise
- Infrastructure problems affecting deployment pipeline
- Custom fixes or workarounds needed

#### Level 3: Engineering Leadership (< 1 hour)
- Business-critical decisions about deployments
- Policy changes or exceptions required
- Major incident coordination and communication

#### Level 4: Executive Escalation (< 2 hours)
- Platform-wide outages or security incidents
- Regulatory or compliance issues
- External communication and stakeholder management

## Maintenance and Updates

### Regular Maintenance Tasks

#### Daily
- Monitor deployment success rates and trends
- Review guard violation patterns and false positives
- Verify Kill Switch functionality through status checks
- Check Command Center responsiveness and performance

#### Weekly  
- Analyze deployment metrics and performance trends
- Review rollback incidents and root causes
- Update guard thresholds based on system performance
- Test emergency procedures and escalation paths

#### Monthly
- Comprehensive system health assessment
- Update documentation and runbook procedures
- Review and update alerting thresholds
- Conduct tabletop exercises for emergency scenarios

### System Updates

#### Gatekeeper System Updates
1. **Test in staging environment first**
2. **Coordinate with ongoing deployments**
3. **Notify operations team of changes**
4. **Update documentation and procedures**
5. **Monitor for issues post-update**

#### Guard Threshold Updates
1. **Analyze historical performance data**
2. **Calculate optimal thresholds based on SLO targets**
3. **Test threshold changes in staging**
4. **Document rationale for threshold changes**
5. **Monitor impact on deployment success rates**

## Performance Metrics

### Key Performance Indicators

#### Deployment Success Metrics
- **Deployment Success Rate**: Target > 95%
- **Mean Time to Deploy**: Target < 30 minutes
- **Rollback Rate**: Target < 5% of deployments  
- **Mean Time to Rollback**: Target < 2 minutes

#### Guard Performance Metrics
- **Guard Accuracy**: Target > 95% (low false positives)
- **Guard Response Time**: Target < 10 seconds detection
- **False Positive Rate**: Target < 2% of violations
- **Violation Detection Rate**: Target > 99% of actual issues

#### System Availability Metrics
- **Platform Uptime**: Target > 99.95%
- **Kill Switch Availability**: Target > 99.99%
- **Command Center Uptime**: Target > 99.9%
- **Monitoring System Uptime**: Target > 99.95%

### Reporting and Analytics

#### Daily Reports
- Deployment activity and success rates
- Guard violation summary and trends
- System performance during deployments
- Outstanding issues and remediation status

#### Weekly Reports  
- Deployment pipeline performance analysis
- Rollback incident analysis and lessons learned
- Guard threshold effectiveness review
- Operations team performance metrics

#### Monthly Reports
- Overall system reliability and availability
- Deployment success trends and improvements
- Emergency response effectiveness
- Platform engineering recommendations

## Security Considerations

### Access Control

#### Kill Switch Access
- **Primary Access**: Platform Operations team members
- **Secondary Access**: On-call engineers with escalation authority
- **Audit Requirements**: All activations logged with full attribution
- **Authentication**: Multi-factor authentication required

#### Command Center Access
- **Role-Based Access Control**: Tiered permissions by responsibility
- **Session Management**: Automatic timeout and re-authentication
- **Audit Logging**: All actions logged with user attribution
- **IP Restrictions**: Access limited to approved networks/VPNs

### Emergency Procedures Security

#### Kill Switch Security
- **Dual Verification**: Requires reason and confirmation
- **Audit Trail**: Complete logging of activation/deactivation
- **Notification**: Immediate alerts to security and leadership teams
- **Recovery Validation**: Security review before deactivation

#### Rollback Security
- **Change Validation**: All rollbacks verified against known good state
- **Configuration Security**: Secure handling of system configuration changes
- **Incident Creation**: Automatic incident creation for audit trail
- **Post-Rollback Validation**: Security scan of restored system state

## Contact Information

### Primary Contacts
- **Platform Operations Team**: ops-team@unittalk.com
- **On-Call Engineer**: oncall@unittalk.com  
- **Platform Engineering**: platform-eng@unittalk.com
- **Security Team**: security@unittalk.com

### Emergency Escalation
- **Level 1 (Operations)**: ops-team@unittalk.com
- **Level 2 (Engineering)**: platform-eng@unittalk.com
- **Level 3 (Leadership)**: engineering-leadership@unittalk.com
- **Level 4 (Executive)**: exec-team@unittalk.com

### External Support
- **GitHub Actions Support**: Via GitHub Enterprise support
- **Infrastructure Support**: Cloud provider support channels
- **Monitoring Support**: Prometheus/Grafana support resources

---

**Document Control**  
- **Created**: January 2025  
- **Version**: 1.0  
- **Next Review**: April 2025  
- **Owner**: Platform Operations Team  
- **Approvers**: Engineering Leadership, Site Reliability Team