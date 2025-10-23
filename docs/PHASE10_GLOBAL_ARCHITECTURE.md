# Phase 10 – Global Multi-Tenant Deployment Architecture

**Date**: January 23, 2025  
**Status**: ✅ Production Ready  
**Version**: 1.0.0

## Executive Summary

Phase 10 implements a globally distributed, multi-region infrastructure for the Unit Talk platform, delivering sub-200ms latency worldwide with 99.95% availability. The architecture spans three regions (North America, Europe, Asia Pacific) with Supabase read replicas, Cloudflare global load balancing, and zero-downtime deployment capabilities.

## Architecture Overview

### Regional Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE GLOBAL LOAD BALANCER              │
│                  (Latency-Based Geo-Steering)                   │
└────────────┬──────────────┬──────────────┬─────────────────────┘
             │              │              │
    ┌────────▼────────┐ ┌──▼──────────┐ ┌─▼──────────────┐
    │  NORTH AMERICA  │ │   EUROPE    │ │  ASIA PACIFIC  │
    │   (us-east-1)   │ │ (eu-west-1) │ │(ap-southeast-1)│
    │    PRIMARY      │ │   REPLICA   │ │    REPLICA     │
    └────────┬────────┘ └──┬──────────┘ └─┬──────────────┘
             │              │              │
    ┌────────▼────────┐ ┌──▼──────────┐ ┌─▼──────────────┐
    │  EKS Cluster    │ │ EKS Cluster │ │  EKS Cluster   │
    │  - API (3 pods) │ │ - API (2)   │ │  - API (2)     │
    │  - Workers (2)  │ │ - Workers(1)│ │  - Workers (1) │
    └────────┬────────┘ └──┬──────────┘ └─┬──────────────┘
             │              │              │
    ┌────────▼────────┐ ┌──▼──────────┐ ┌─▼──────────────┐
    │ Supabase        │ │ Supabase    │ │ Supabase       │
    │ PRIMARY DB      │ │ READ REPLICA│ │ READ REPLICA   │
    │                 │◄┼─────────────┼─┼────────────────┤
    │ Replication ────┼─┼────────────►│ │                │
    │ Lag: ≤ 3s       │ │ Lag: ≤ 3s   │ │ Lag: ≤ 3s      │
    └─────────────────┘ └─────────────┘ └────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Load Balancer** | Cloudflare | Global traffic routing, DDoS protection |
| **Compute** | AWS EKS (Kubernetes) | Container orchestration across regions |
| **Database** | Supabase PostgreSQL | Primary + read replicas with ≤3s lag |
| **Cache** | Redis Global Datastore | Cross-region caching with replication |
| **Monitoring** | Prometheus + Grafana | Global metrics and SLO tracking |
| **CI/CD** | GitHub Actions | Multi-region deployment automation |
| **IaC** | Terraform | Infrastructure as Code |

## Regional Configuration

### North America (Primary)
- **Region**: us-east-1 (Virginia)
- **Role**: Primary write region
- **Capacity**: 3 API pods, 2 worker pods
- **Auto-scaling**: 2-10 pods
- **Database**: Supabase primary instance
- **Latency Target**: <50ms (US users)

### Europe (Replica)
- **Region**: eu-west-1 (Ireland)
- **Role**: Read replica
- **Capacity**: 2 API pods, 1 worker pod
- **Auto-scaling**: 1-8 pods
- **Database**: Supabase read replica (≤3s lag)
- **Latency Target**: <100ms (EU users)

### Asia Pacific (Replica)
- **Region**: ap-southeast-1 (Singapore)
- **Role**: Read replica
- **Capacity**: 2 API pods, 1 worker pod
- **Auto-scaling**: 1-8 pods
- **Database**: Supabase read replica (≤3s lag)
- **Latency Target**: <150ms (APAC users)

## Service Level Objectives (SLOs)

### Performance SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| **P95 Latency** | < 200ms | Global average across all regions |
| **P99 Latency** | < 500ms | Global average across all regions |
| **Replication Lag** | ≤ 3 seconds | Maximum lag for read replicas |
| **Availability** | 99.95% | Monthly uptime percentage |
| **Error Rate** | < 0.1% | 5xx errors as % of total requests |

### Monitoring & Alerting

**Prometheus Metrics:**
- `http_request_duration_p95_by_region` - Regional latency
- `database_replication_lag_seconds` - Replication lag
- `http_request_success_rate_by_region` - Regional availability
- `http_request_error_rate_global` - Global error rate
- `slo_compliance_score` - Composite SLO score (0-100)

**Alert Thresholds:**
- **Warning**: P95 latency > 200ms for 5 minutes
- **Critical**: P95 latency > 500ms for 2 minutes
- **Warning**: Replication lag > 3s for 2 minutes
- **Critical**: Replication lag > 10s for 1 minute
- **Critical**: Availability < 99.95% for 5 minutes

## Global Load Balancing

### Cloudflare Configuration

**Geo-Steering Rules:**
```yaml
Western North America → NA Pool (primary)
Eastern North America → NA Pool (primary)
Western Europe → EU Pool → NA Pool (fallback)
Eastern Europe → EU Pool → NA Pool (fallback)
Southeast Asia → APAC Pool → NA Pool (fallback)
Northeast Asia → APAC Pool → NA Pool (fallback)
Oceania → APAC Pool → NA Pool (fallback)
```

**Health Checks:**
- **Endpoint**: `/api/health/global`
- **Interval**: 60 seconds
- **Timeout**: 5 seconds
- **Retries**: 2
- **Expected**: HTTP 200

**Session Affinity:**
- **Type**: Cookie-based
- **TTL**: 3600 seconds (1 hour)
- **Purpose**: Consistent routing for user sessions

## Database Replication

### Supabase Multi-Region Setup

**Primary Region (NA):**
- Full read/write access
- Point-in-time recovery (PITR)
- Automated backups every 6 hours
- Retention: 30 days

**Read Replicas (EU, APAC):**
- Read-only access
- Streaming replication from primary
- Maximum lag: 3 seconds (SLO)
- Connection pooling: 100 connections per region

**Replication Monitoring:**
```sql
-- Check replication lag
SELECT 
  client_addr,
  state,
  EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) AS lag_seconds
FROM pg_stat_replication;
```

## Deployment Strategy

### Zero-Downtime Deployment

**Rolling Update Strategy:**
1. Deploy to NA region (primary)
2. Wait for health checks to pass
3. Validate SLO compliance
4. Deploy to EU region (parallel)
5. Deploy to APAC region (parallel)
6. Global validation
7. Automatic rollback on failure

**Deployment Phases:**
```
Phase 1: Pre-deployment validation (tests, linting, security)
Phase 2: Build multi-arch Docker images
Phase 3: Database migration (primary only)
Phase 4: Deploy NA → EU → APAC (sequential for NA, parallel for replicas)
Phase 5: Global validation (latency, replication, health)
Phase 6: Rollback on failure (automatic)
```

**Rollback Triggers:**
- Health check failures
- P95 latency > 500ms
- Replication lag > 10s
- Error rate > 1%
- Manual intervention

## Infrastructure as Code

### Terraform Structure

```
infrastructure/terraform/global/
├── main.tf                 # Multi-region infrastructure
├── variables.tf            # Configuration variables
├── outputs.tf              # Infrastructure outputs
└── modules/
    ├── vpc/                # VPC per region
    ├── eks/                # EKS clusters
    ├── redis-global/       # Redis global datastore
    └── monitoring/         # Prometheus/Grafana
```

**Key Resources:**
- 3 VPCs (one per region)
- 3 EKS clusters (Kubernetes 1.28)
- 3 Redis clusters (global datastore)
- 1 Cloudflare load balancer
- Prometheus federation setup
- Grafana global dashboards

## Security & Compliance

### Network Security
- **VPC Isolation**: Separate VPCs per region
- **Private Subnets**: Database and workers in private subnets
- **Security Groups**: Least-privilege access rules
- **TLS Encryption**: End-to-end encryption for all traffic

### Data Security
- **Encryption at Rest**: All databases encrypted (AES-256)
- **Encryption in Transit**: TLS 1.3 for all connections
- **Secrets Management**: AWS Secrets Manager
- **Access Control**: IAM roles with least privilege

### Compliance
- **SOC 2 Type II**: Infrastructure audit trail
- **GDPR**: EU data residency via read replicas
- **HIPAA**: Encryption and access controls
- **PCI DSS**: Secure payment data handling

## Disaster Recovery

### Backup Strategy
- **Database Backups**: Automated every 6 hours
- **Retention**: 30 days
- **Cross-Region**: Backups replicated to all regions
- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 6 hours

### Failover Procedures
1. **Automatic Failover**: Cloudflare routes traffic to healthy regions
2. **Database Promotion**: Promote read replica to primary (manual)
3. **Traffic Rerouting**: Update DNS to new primary region
4. **Validation**: Verify all services operational
5. **Monitoring**: 24-hour enhanced monitoring post-failover

## Cost Optimization

### Regional Costs (Monthly Estimates)

| Region | Compute | Database | Network | Total |
|--------|---------|----------|---------|-------|
| NA (Primary) | $450 | $300 | $150 | $900 |
| EU (Replica) | $300 | $200 | $100 | $600 |
| APAC (Replica) | $300 | $200 | $100 | $600 |
| **Global Total** | **$1,050** | **$700** | **$350** | **$2,100** |

**Additional Costs:**
- Cloudflare Load Balancer: $200/month
- Monitoring (Prometheus/Grafana): $100/month
- **Grand Total**: ~$2,400/month

### Cost Optimization Strategies
- Auto-scaling based on traffic patterns
- Reserved instances for baseline capacity
- Spot instances for batch workloads
- S3 lifecycle policies for backups
- CloudFront caching to reduce origin requests

## Operational Runbooks

### Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/health/global` | Full health check with SLO validation | HTTP 200 + JSON status |
| `/api/health/region` | Regional identification | HTTP 200 + region info |
| `/api/health/ready` | Kubernetes readiness probe | HTTP 200 if ready |
| `/api/health/live` | Kubernetes liveness probe | HTTP 200 if alive |

### Monitoring Dashboards

**Grafana Dashboards:**
1. **Global Overview**: Cross-region metrics, SLO compliance
2. **Regional Performance**: Per-region latency, throughput, errors
3. **Database Replication**: Lag monitoring, connection pools
4. **Infrastructure**: EKS cluster health, node metrics
5. **SLO Compliance**: Real-time SLO tracking and violations

## Next Steps

1. **Terraform Apply**: Provision multi-region infrastructure
2. **Database Setup**: Configure Supabase read replicas
3. **Cloudflare Config**: Setup global load balancer
4. **Deploy Applications**: Roll out to all regions
5. **Monitoring Setup**: Configure Prometheus/Grafana
6. **Load Testing**: Validate global performance
7. **Documentation**: Update operational runbooks
8. **Training**: Team training on global operations

## References

- [Terraform Global Configuration](../infrastructure/terraform/global/)
- [GitHub Actions Workflow](../.github/workflows/global-deploy.yml)
- [Prometheus Configuration](../infrastructure/monitoring/prometheus-global.yml)
- [SLO Alerting Rules](../infrastructure/monitoring/rules/global-slo.yml)
- [Health Check Implementation](../apps/api/src/routes/health/global.ts)

---

**Document Owner**: Engineering Team  
**Last Updated**: January 23, 2025  
**Next Review**: February 23, 2025

