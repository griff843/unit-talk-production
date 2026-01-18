# Unit Talk: Syndicate-Grade SaaS Architecture Reference
## Executive Architecture Document v1.0

**Target Platform**: DigitalOcean Kubernetes (DOKS)
**Document Owner**: Engineering Leadership
**Last Updated**: January 2025
**Status**: Production-Ready Blueprint

---

## Table of Contents

1. [Executive Overview](#1-executive-overview)
2. [Vision and Core Tenets](#2-vision-and-core-tenets)
3. [Architecture Layers](#3-architecture-layers)
4. [Multi-Tenant Strategy](#4-multi-tenant-strategy)
5. [Security and Compliance](#5-security-and-compliance)
6. [Scalability and Reliability](#6-scalability-and-reliability)
7. [Observability Stack](#7-observability-stack)
8. [AI-Native Integration](#8-ai-native-integration)
9. [Event-Driven Architecture](#9-event-driven-architecture)
10. [DevOps and GitOps](#10-devops-and-gitops)
11. [SLO/SLA Model](#11-slosla-model)
12. [Cost Model and Tiers](#12-cost-model-and-tiers)
13. [Technology Stack](#13-technology-stack)
14. [Implementation Phases](#14-implementation-phases)

---

## 1. Executive Overview

### Mission Statement

Unit Talk is a **cloud-native, multi-tenant, AI-powered sports intelligence SaaS platform** built on syndicate-grade architecture principles. The platform delivers real-time sports betting analytics, capper performance tracking, and collaborative decision-making tools through a horizontally scalable, zero-trust architecture.

### Key Architecture Goals

- **Sub-150ms API Response Times**: p95 latency under 150ms for all user-facing APIs
- **Sub-50ms Database Queries**: p95 database query latency under 50ms
- **99.95% Uptime SLA**: Four-nines availability with multi-region failover
- **Infinite Tenant Scalability**: Architectural support for 10,000+ concurrent tenants
- **AI-First Design**: Native integration for LLM-powered insights and automation
- **Zero-Trust Security**: No implicit trust, all access verified and audited

### Business Value Proposition

| Capability | Business Impact |
|------------|----------------|
| **Real-Time Intelligence** | Process and grade 20,000+ props daily with sub-second latency |
| **Multi-Tenant Isolation** | Enterprise-grade data security with configurable isolation models |
| **AI-Powered Insights** | Automated market analysis, hedge detection, injury impact assessment |
| **Horizontal Scalability** | Add capacity linearly without architectural changes |
| **Operational Excellence** | Full observability, self-healing, and GitOps-driven deployments |

---

## 2. Vision and Core Tenets

### Architecture Principles

#### 1. **Composability**
Every system component is a service with well-defined interfaces. Services communicate via standardized protocols (REST, GraphQL, gRPC, events).

```
Principle: Build with Lego blocks, not monoliths
Implementation: Domain-Driven Design (DDD) bounded contexts
```

#### 2. **Zero-Trust Security**
No implicit trust between services, users, or networks. All access requires authentication, authorization, and audit.

```
Principle: Never trust, always verify
Implementation: OIDC, mTLS, RBAC, Row-Level Security (RLS)
```

#### 3. **Horizontal Scalability**
Stateless service design enabling linear capacity growth through pod replication.

```
Principle: Scale out, not up
Implementation: Kubernetes HPA, stateless services, distributed caching
```

#### 4. **Observability-First**
Every service emits structured metrics, logs, and traces. Operational decisions driven by data.

```
Principle: If you can't measure it, you can't manage it
Implementation: OpenTelemetry, Prometheus, Grafana, Loki, Tempo
```

#### 5. **AI-Native Architecture**
AI capabilities embedded at the platform level, not bolted on as afterthoughts.

```
Principle: AI as a first-class citizen
Implementation: Dedicated AI gateway, vector databases, LLM observability
```

#### 6. **Event-Driven Communication**
Asynchronous, decoupled service communication via event streaming for resilience and scalability.

```
Principle: Choreography over orchestration
Implementation: Kafka/NATS, event sourcing, CQRS patterns
```

---

## 3. Architecture Layers

### 3.1 Overall Architecture Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT TIER                               │
│  Next.js SSR • React SPA • Mobile Apps • Discord Bot         │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTPS/WSS
┌─────────────────────────────────────────────────────────────┐
│                    EDGE TIER                                 │
│  DO Load Balancer • CDN (Spaces CDN) • WAF • DDoS Protection│
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    GATEWAY TIER                              │
│  NGINX Ingress • Kong API Gateway • GraphQL Federation      │
│  AuthN/AuthZ • Rate Limiting • Request Routing              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE MESH                              │
│  Linkerd/Istio • mTLS • Circuit Breaking • Load Balancing   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION TIER                          │
│  Microservices (Node.js/Go/Python)                          │
│  ├─ API Service (Express/Fastify)                           │
│  ├─ Grading Agent (Temporal Workers)                        │
│  ├─ Alert Agent (Event Consumers)                           │
│  ├─ Discord Bot (Discord.js)                                │
│  └─ AI Gateway (LLM Orchestration)                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    EVENT BACKBONE                            │
│  Kafka/NATS • Event Sourcing • Stream Processing            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATA TIER                                 │
│  ├─ DO Managed PostgreSQL (Primary Data Store)              │
│  ├─ DO Managed Redis (Cache + Session Store)                │
│  ├─ DO Spaces (Object Storage - S3 Compatible)              │
│  ├─ ElasticSearch/OpenSearch (Full-Text Search)             │
│  └─ Qdrant/Pinecone (Vector Database for AI)                │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    OBSERVABILITY TIER                        │
│  Prometheus • Grafana • Loki • Tempo • OpenTelemetry        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE TIER                       │
│  DOKS Cluster • DO VPC • DO Firewall • DO Secrets Manager   │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Request Flow Architecture

#### User Request Path (Synchronous)

```
[User Browser/App]
      ↓ HTTPS
[DO Load Balancer] → WAF Rules, SSL Termination
      ↓
[NGINX Ingress Controller] → Cert Manager (Let's Encrypt)
      ↓
[Kong API Gateway] → AuthN (JWT), Rate Limiting, Request Validation
      ↓
[Service Mesh (Linkerd)] → mTLS, Circuit Breaking, Retry Logic
      ↓
[API Service Pod] → Business Logic, Data Access
      ↓
[PostgreSQL/Redis] → Data Retrieval
      ↓
[Response] → JSON, Cache Headers, Tracing Context
```

**Latency Budget Breakdown**:
- Load Balancer: 5ms
- Ingress: 10ms
- API Gateway: 15ms
- Service Mesh: 10ms
- Application Logic: 50ms
- Database Query: 30ms
- Response Serialization: 10ms
- **Total: 130ms (within 150ms SLO)**

#### Event Processing Path (Asynchronous)

```
[Event Producer] → Kafka Topic (partitioned by tenant_id)
      ↓
[Consumer Group] → Parallel processing across pods
      ↓
[Event Handler Service] → Business logic, side effects
      ↓
[Write to Database] → Transactional writes with retry
      ↓
[Emit Result Event] → Downstream consumers notified
```

### 3.3 Control Plane Architecture (GitOps)

```
[Developer] → Git Push → [GitHub]
                            ↓
                     [GitHub Actions]
                            ↓
                  ┌─────────┴─────────┐
                  ↓                   ↓
          [Build Container]     [Run Tests]
                  ↓                   ↓
          [Push to Registry]  [Security Scan]
                  ↓                   ↓
              [Update Manifest] → [ArgoCD]
                                      ↓
                              [Sync to DOKS Cluster]
                                      ↓
                              [Blue/Green Deployment]
                                      ↓
                              [Health Checks Pass]
                                      ↓
                              [Route Traffic]
```

**GitOps Principles**:
- Git is the single source of truth
- Declarative configuration (Kubernetes manifests, Helm charts)
- Automated synchronization via ArgoCD
- Rollback = git revert + auto-sync
- Audit trail = git log

---

## 4. Multi-Tenant Strategy

### 4.1 Tenant Isolation Models

Unit Talk supports **three tenant isolation models** with different security/cost tradeoffs:

| Model | Security | Cost | Performance | Use Case |
|-------|----------|------|-------------|----------|
| **Database-per-Tenant** | ⭐⭐⭐⭐⭐ | $$$$$ | ⭐⭐⭐⭐⭐ | Enterprise, regulated industries |
| **Schema-per-Tenant** | ⭐⭐⭐⭐ | $$$ | ⭐⭐⭐⭐ | Mid-market, SMB growth |
| **Row-Level Security (RLS)** | ⭐⭐⭐ | $ | ⭐⭐⭐ | Startups, high-volume low-touch |

### 4.2 Model Selection Matrix

```
┌─────────────────────────────────────────────────────────────┐
│  Tenant Requirements Assessment                              │
└─────────────────────────────────────────────────────────────┘

Questions to determine isolation model:

1. **Data Residency Requirements?**
   - Yes → Database-per-Tenant (geo-specific regions)
   - No → Continue

2. **Regulatory Compliance (HIPAA, SOC2 Type II)?**
   - Yes → Database-per-Tenant or Schema-per-Tenant
   - No → Continue

3. **Expected Data Volume per Tenant?**
   - >1TB → Database-per-Tenant (independent scaling)
   - 100GB-1TB → Schema-per-Tenant
   - <100GB → RLS

4. **Budget Constraints?**
   - Enterprise budget → Database-per-Tenant
   - Mid-market → Schema-per-Tenant
   - Cost-sensitive → RLS

5. **Custom Schema Requirements?**
   - Yes → Database-per-Tenant or Schema-per-Tenant
   - No → RLS acceptable
```

### 4.3 Row-Level Security (RLS) Implementation

**Default Model for Unit Talk Platform**

```sql
-- PostgreSQL RLS Policy Example
CREATE POLICY tenant_isolation ON unified_picks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Set tenant context per request
SET app.current_tenant = '550e8400-e29b-41d4-a716-446655440000';
```

**Application Middleware**:
```typescript
// Tenant context propagation
export const tenantMiddleware = async (req, res, next) => {
  const tenantId = extractTenantId(req); // From JWT, subdomain, header
  await db.query('SET app.current_tenant = $1', [tenantId]);
  req.tenantId = tenantId;
  next();
};
```

**Advantages**:
- Cost-effective for large tenant counts
- Simplified database management
- Fast tenant onboarding (no schema creation)

**Disadvantages**:
- Requires careful query testing (RLS can be bypassed if misconfigured)
- Performance impact on large tables (row filtering overhead)
- Shared resource contention

### 4.4 Schema-per-Tenant Implementation

```sql
-- Create tenant schema
CREATE SCHEMA tenant_acme_corp;

-- Grant permissions
GRANT USAGE ON SCHEMA tenant_acme_corp TO app_role;

-- Set search path per request
SET search_path TO tenant_acme_corp, public;
```

**Advantages**:
- Strong logical isolation
- Custom schema modifications per tenant possible
- Better query performance (no RLS overhead)

**Disadvantages**:
- Migration complexity (N schemas to update)
- Connection pool management (schema switching overhead)

### 4.5 Database-per-Tenant Implementation

```typescript
// Dynamic database connection routing
const getTenantDatabase = (tenantId: string) => {
  return new Pool({
    host: `tenant-${tenantId}-db.internal.do.com`,
    database: 'unit_talk',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
};
```

**Advantages**:
- Complete data isolation (strongest security)
- Independent scaling and backup strategies
- No "noisy neighbor" issues

**Disadvantages**:
- Highest operational cost
- Complex multi-tenant analytics (requires data federation)
- Database provisioning latency

---

## 5. Security and Compliance

### 5.1 Zero-Trust Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Security Layers (Defense in Depth)                         │
└─────────────────────────────────────────────────────────────┘

Layer 1: Network Security
├─ DO VPC with private subnets
├─ DO Cloud Firewall (allowlist-only ingress)
├─ Network Policies (Kubernetes)
└─ DDoS Protection (DO Load Balancer)

Layer 2: Transport Security
├─ TLS 1.3 for all external traffic
├─ mTLS between services (Linkerd/Istio)
├─ Certificate rotation (Cert Manager)
└─ HSTS headers enforced

Layer 3: Identity and Access
├─ OAuth 2.0 / OpenID Connect (OIDC)
├─ JWT tokens with short TTL (15min access, 7d refresh)
├─ Multi-Factor Authentication (MFA) required
├─ SSO integration (Okta, Azure AD, Google Workspace)
└─ Service-to-Service authentication (mutual TLS)

Layer 4: Authorization
├─ Role-Based Access Control (RBAC)
├─ Attribute-Based Access Control (ABAC)
├─ Row-Level Security (RLS) in PostgreSQL
└─ Open Policy Agent (OPA) for fine-grained policies

Layer 5: Data Security
├─ Encryption at rest (AES-256)
├─ Encryption in transit (TLS 1.3)
├─ DO Spaces encryption (server-side)
├─ Database column encryption (PGP for PII)
└─ Secrets management (DO Secrets Manager / Vault)

Layer 6: Application Security
├─ Input validation (Zod schemas)
├─ SQL injection prevention (parameterized queries)
├─ XSS protection (Content Security Policy)
├─ CSRF tokens (SameSite cookies)
└─ Dependency scanning (Snyk, npm audit)

Layer 7: Audit and Compliance
├─ Immutable audit logs (append-only)
├─ Centralized logging (Loki)
├─ Security event monitoring (Prometheus Alertmanager)
└─ Compliance reporting (SOC2, GDPR)
```

### 5.2 Authentication Flow

```
[User] → Login Request → [Auth Service]
                              ↓
                    Validate credentials
                              ↓
                    Generate JWT tokens
                    ├─ Access Token (15min)
                    └─ Refresh Token (7d)
                              ↓
                    Store refresh token (Redis)
                              ↓
                    Return tokens to client
                              ↓
[User] → API Request + Access Token → [API Gateway]
                                          ↓
                                    Verify JWT signature
                                          ↓
                                    Check expiration
                                          ↓
                                    Extract claims (tenant_id, roles)
                                          ↓
                                    Set request context
                                          ↓
                                    Forward to service
```

### 5.3 Secrets Management

**DigitalOcean Secrets Management Options**:

1. **DO Secrets Manager** (Recommended for DO-native deployments)
   - Native integration with DOKS
   - Automatic secret rotation
   - Audit logging
   - IAM-based access control

2. **Sealed Secrets** (GitOps-friendly)
   - Encrypted secrets in Git
   - Bitnami Sealed Secrets controller
   - Public key encryption

3. **HashiCorp Vault** (Enterprise-grade)
   - Dynamic secret generation
   - Secret leasing and renewal
   - Audit logging and compliance

**Implementation Pattern**:
```yaml
# Kubernetes Secret from DO Secrets Manager
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
type: Opaque
data:
  username: <base64-encoded>
  password: <base64-encoded>
```

### 5.4 Compliance Framework

| Standard | Scope | Implementation Status |
|----------|-------|----------------------|
| **SOC 2 Type II** | Security, Availability, Confidentiality | Architecture Ready |
| **ISO 27001** | Information Security Management | Architecture Ready |
| **GDPR** | Data Privacy (EU) | RLS + Data Residency |
| **CCPA** | Data Privacy (California) | User data controls |
| **HIPAA** | Healthcare (if applicable) | Database-per-Tenant model |

**Compliance Checklist**:
- [ ] Encryption at rest and in transit
- [ ] Audit logging for all data access
- [ ] Role-based access control
- [ ] Data retention and deletion policies
- [ ] Incident response procedures
- [ ] Regular security assessments
- [ ] Third-party security audits

---

## 6. Scalability and Reliability

### 6.1 Horizontal Scaling Strategy

**Stateless Services Design**:
```
Principle: Any request can be served by any pod
Implementation:
├─ No in-memory session state (use Redis)
├─ No local file storage (use DO Spaces)
├─ No hard-coded server IPs (use service discovery)
└─ Idempotent operations (retry-safe)
```

**Kubernetes Horizontal Pod Autoscaling (HPA)**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
```

**Scaling Behavior**:
- Scale up: Add pods when CPU >70% or RPS >1000/pod
- Scale down: Remove pods when CPU <50% for 5min
- Scale limits: Min 3 pods (HA), Max 50 pods (cost control)

### 6.2 Database Scaling

**Read Scaling**:
```
[Write Requests] → Primary Database (DO Managed PostgreSQL)
                        ↓
                  WAL Replication
                        ↓
[Read Requests] → Read Replicas (up to 7 replicas)
                        ↓
                  Connection Pooling (PgBouncer)
```

**Write Scaling**:
- **Vertical scaling**: Scale up to 32 vCPU, 192 GB RAM (DO Premium plan)
- **Sharding**: Partition by `tenant_id` for multi-tenant workloads
- **CQRS pattern**: Separate read and write models for high-write workloads

**Connection Pooling**:
```typescript
// PgBouncer configuration
import { Pool } from 'pg';

const pool = new Pool({
  host: 'pgbouncer.internal.do.com',
  port: 6432,
  max: 100, // Max connections per app instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

### 6.3 Caching Strategy

**Multi-Layer Caching**:

```
Layer 1: CDN Cache (DO Spaces CDN)
└─ Static assets, images, videos
   ├─ TTL: 1 year
   └─ Cache-Control: public, immutable

Layer 2: HTTP Cache (NGINX)
└─ API responses (GET only)
   ├─ TTL: 5 minutes
   └─ Cache-Control: public, max-age=300

Layer 3: Application Cache (Redis)
└─ Database query results, session data
   ├─ TTL: 15 minutes
   └─ Invalidation: Event-driven (Kafka)

Layer 4: Database Cache (PostgreSQL Shared Buffers)
└─ Hot data in memory
   ├─ Size: 25% of RAM
   └─ Automatic management
```

**Cache Invalidation Pattern**:
```typescript
// Event-driven cache invalidation
kafka.on('pick.updated', async (event) => {
  const cacheKeys = [
    `pick:${event.pickId}`,
    `user:${event.userId}:picks`,
    `daily-picks:${event.date}`,
  ];
  await redis.del(...cacheKeys);
});
```

### 6.4 Reliability Patterns

**Circuit Breaker**:
```typescript
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000, // If function takes longer than 3s, trigger failure
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 30000, // Try to close circuit after 30s
};

const breaker = new CircuitBreaker(fetchExternalAPI, options);

breaker.fallback(() => {
  return getCachedData(); // Return stale data on failure
});
```

**Retry Logic with Exponential Backoff**:
```typescript
import pRetry from 'p-retry';

const fetchWithRetry = async () => {
  return pRetry(
    async () => {
      const response = await fetch('https://api.sportsbook.com/odds');
      if (!response.ok) throw new Error('API failed');
      return response.json();
    },
    {
      retries: 3,
      minTimeout: 1000, // 1s
      maxTimeout: 10000, // 10s
      factor: 2, // Exponential backoff
      onFailedAttempt: (error) => {
        logger.warn(`Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      },
    }
  );
};
```

**Bulkhead Pattern**:
```typescript
// Isolate critical resources with separate thread pools
const criticalPool = new Pool({ max: 50 }); // Reserved for user-facing APIs
const backgroundPool = new Pool({ max: 20 }); // For batch jobs
```

### 6.5 Multi-Region Failover

**Active-Active Multi-Region Setup**:

```
Region 1 (NYC3):
├─ DOKS Cluster (Primary)
├─ PostgreSQL Primary
└─ Redis Primary

Region 2 (SFO3):
├─ DOKS Cluster (Secondary)
├─ PostgreSQL Read Replica
└─ Redis Replica

Global Traffic Manager:
└─ DO Load Balancer with geo-routing
   ├─ US East → NYC3
   ├─ US West → SFO3
   └─ Failover: Health check every 10s
```

**Failover Triggers**:
- Health check failure (3 consecutive failures)
- Latency threshold exceeded (>500ms p95)
- Manual failover (maintenance)

**RTO/RPO Targets**:
- **RTO (Recovery Time Objective)**: 5 minutes
- **RPO (Recovery Point Objective)**: 1 minute (last committed transaction)

---

## 7. Observability Stack

### 7.1 Golden Signals

Unit Talk monitors the **four golden signals** for every service:

| Signal | Metric | Target | Alert Threshold |
|--------|--------|--------|----------------|
| **Latency** | p95 response time | <150ms | >200ms for 5min |
| **Traffic** | Requests per second | Baseline + 50% | <50% of baseline for 5min |
| **Errors** | Error rate | <0.5% | >1% for 5min |
| **Saturation** | CPU/Memory/Disk | <70% | >85% for 5min |

### 7.2 Observability Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Application Services                                        │
│  ├─ OpenTelemetry SDK (traces, metrics, logs)               │
│  └─ Instrumentation (auto + manual)                         │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  OpenTelemetry Collector                                     │
│  ├─ Receive (OTLP protocol)                                 │
│  ├─ Process (sampling, filtering, batching)                 │
│  └─ Export (Prometheus, Loki, Tempo)                        │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Prometheus   │  │ Loki         │  │ Tempo        │
│ (Metrics)    │  │ (Logs)       │  │ (Traces)     │
└──────────────┘  └──────────────┘  └──────────────┘
        ↓                  ↓                  ↓
┌─────────────────────────────────────────────────────────────┐
│  Grafana (Unified Observability Dashboard)                  │
│  ├─ Service dashboards                                      │
│  ├─ SLO tracking                                            │
│  ├─ Alerting rules                                          │
│  └─ On-call integration (PagerDuty/Opsgenie)               │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Metrics Collection (Prometheus)

**Key Metrics**:
```
# HTTP metrics
http_request_duration_seconds{method, path, status}
http_requests_total{method, path, status}

# Database metrics
db_query_duration_seconds{query, table}
db_connections_active
db_connections_idle

# Business metrics
picks_graded_total{sport, status}
users_active_total
revenue_total{tier}

# System metrics
process_cpu_seconds_total
process_resident_memory_bytes
nodejs_heap_size_total_bytes
```

**Prometheus Configuration**:
```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
```

### 7.4 Logging (Loki)

**Structured Logging Standard**:
```typescript
import { logger } from './logger';

logger.info('Pick graded', {
  pickId: '123e4567-e89b-12d3-a456-426614174000',
  userId: 'user_abc',
  sport: 'NFL',
  result: 'WIN',
  duration_ms: 42,
  trace_id: 'abc123', // Correlated with traces
});
```

**Log Retention Policy**:
- Hot logs (last 7 days): Loki
- Warm logs (8-90 days): DO Spaces (compressed)
- Cold logs (91-365 days): DO Spaces Glacier (compliance)
- Purge: After 365 days (or per tenant policy)

### 7.5 Distributed Tracing (Tempo)

**Trace Propagation**:
```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('api-service');

app.get('/api/picks/:id', async (req, res) => {
  const span = tracer.startSpan('get_pick', {
    attributes: {
      'pick.id': req.params.id,
      'user.id': req.user.id,
      'tenant.id': req.tenantId,
    },
  });

  try {
    const pick = await database.getPick(req.params.id);
    span.setStatus({ code: SpanStatusCode.OK });
    res.json(pick);
  } catch (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR });
    throw error;
  } finally {
    span.end();
  }
});
```

**Sampling Strategy**:
- Always sample: Errors, slow requests (>1s)
- Probabilistic: 10% of normal requests
- Debug mode: 100% sampling (manual override)

### 7.6 Alerting Rules

**Critical Alerts** (Page on-call immediately):
```yaml
groups:
  - name: critical
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: DatabaseDown
        expr: up{job="postgresql"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Database is down"

      - alert: HighLatency
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 0.2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "p95 latency exceeded 200ms"
```

**Warning Alerts** (Investigate during business hours):
```yaml
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / node_memory_total_bytes > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage above 85%"
```

---

## 8. AI-Native Integration

### 8.1 AI Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  AI Use Cases                                                │
│  ├─ Automated prop grading insights                         │
│  ├─ Natural language query interface                        │
│  ├─ Injury impact analysis                                  │
│  ├─ Hedge opportunity detection                             │
│  └─ Recap generation and summarization                      │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  AI Gateway Service                                          │
│  ├─ LLM routing (OpenAI, Anthropic, local models)           │
│  ├─ Prompt management and versioning                        │
│  ├─ Token usage tracking and rate limiting                  │
│  ├─ Response caching (semantic similarity)                  │
│  └─ Fallback and retry logic                                │
└─────────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ OpenAI API   │  │ Anthropic    │  │ Local Models │
│ (GPT-4)      │  │ (Claude)     │  │ (Llama 3)    │
└──────────────┘  └──────────────┘  └──────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Vector Database (Qdrant / Pinecone)                        │
│  ├─ Embeddings (OpenAI text-embedding-3-large)              │
│  ├─ Semantic search over historical data                    │
│  └─ RAG (Retrieval-Augmented Generation) context            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  AI Observability                                            │
│  ├─ Token usage per tenant                                  │
│  ├─ Latency tracking (TTFT, TPS)                            │
│  ├─ Cost attribution                                        │
│  └─ Model drift detection                                   │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 AI Gateway Implementation

```typescript
// AI Gateway service
export class AIGateway {
  private providers = {
    openai: new OpenAIProvider(),
    anthropic: new AnthropicProvider(),
    local: new LocalModelProvider(),
  };

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const span = tracer.startSpan('ai_completion');
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = await this.cache.get(request.cacheKey);
      if (cached) {
        span.setAttribute('cache.hit', true);
        return cached;
      }

      // Route to appropriate provider
      const provider = this.selectProvider(request.model);

      // Execute with retry and fallback
      const response = await this.executeWithFallback(provider, request);

      // Track metrics
      await this.trackUsage({
        tenantId: request.tenantId,
        model: request.model,
        tokens: response.usage.totalTokens,
        latency: Date.now() - startTime,
        cost: this.calculateCost(response.usage),
      });

      // Cache response
      await this.cache.set(request.cacheKey, response, { ttl: 3600 });

      return response;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  private async executeWithFallback(
    provider: AIProvider,
    request: CompletionRequest
  ): Promise<CompletionResponse> {
    try {
      return await provider.complete(request);
    } catch (error) {
      logger.warn('Primary AI provider failed, trying fallback', { error });
      const fallbackProvider = this.getFallbackProvider(provider);
      return await fallbackProvider.complete(request);
    }
  }
}
```

### 8.3 Vector Database for RAG

**Use Case**: Semantic search over historical prop data for AI context

```typescript
import { QdrantClient } from '@qdrant/js-client-rest';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// Index prop data with embeddings
async function indexProp(prop: Prop) {
  const embedding = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: `${prop.player_name} ${prop.stat_type} ${prop.line} ${prop.sport}`,
  });

  await qdrant.upsert('props', {
    points: [{
      id: prop.id,
      vector: embedding.data[0].embedding,
      payload: {
        player_name: prop.player_name,
        stat_type: prop.stat_type,
        line: prop.line,
        sport: prop.sport,
        date: prop.date,
      },
    }],
  });
}

// Semantic search for similar props
async function findSimilarProps(query: string, limit: number = 10) {
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-large',
    input: query,
  });

  const results = await qdrant.search('props', {
    vector: queryEmbedding.data[0].embedding,
    limit,
  });

  return results.map(r => r.payload);
}
```

### 8.4 AI Cost Management

**Token Usage Tracking**:
```sql
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  user_id UUID,
  model VARCHAR(100) NOT NULL,
  prompt_tokens INT NOT NULL,
  completion_tokens INT NOT NULL,
  total_tokens INT NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  latency_ms INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_tenant ON ai_usage(tenant_id, created_at);
```

**Cost Attribution Dashboard**:
- Total AI cost per tenant
- Cost per use case (grading, recaps, queries)
- Most expensive queries (optimization targets)
- Token efficiency metrics

**Rate Limiting**:
```typescript
// Per-tenant AI rate limits
const rateLimits = {
  starter: { tokensPerMonth: 100_000, requestsPerMin: 10 },
  growth: { tokensPerMonth: 1_000_000, requestsPerMin: 50 },
  enterprise: { tokensPerMonth: 10_000_000, requestsPerMin: 200 },
};
```

---

## 9. Event-Driven Architecture

### 9.1 Event Backbone

**Technology Choice**: **Kafka** for high-throughput, ordered event streaming

**Alternative**: **NATS JetStream** for lighter-weight deployments

```
┌─────────────────────────────────────────────────────────────┐
│  Event Producers                                             │
│  ├─ API Service (user actions)                              │
│  ├─ Smart Form (bet slip submissions)                       │
│  ├─ Grading Agent (prop results)                            │
│  └─ External integrations (sportsbook APIs)                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Kafka Cluster (3+ brokers)                                 │
│  ├─ Topic: picks.created                                    │
│  ├─ Topic: picks.graded                                     │
│  ├─ Topic: injuries.detected                                │
│  ├─ Topic: hedges.opportunity                               │
│  └─ Topic: alerts.triggered                                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Event Consumers (Consumer Groups)                           │
│  ├─ GradingAgent (processes picks.created)                  │
│  ├─ AlertAgent (processes injuries, hedges)                 │
│  ├─ NotificationService (processes alerts)                  │
│  └─ AnalyticsService (processes all events)                 │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Event Schema Design

**CloudEvents Standard**:
```json
{
  "specversion": "1.0",
  "type": "com.unittalk.pick.created",
  "source": "/api/picks",
  "id": "A234-1234-1234",
  "time": "2025-01-15T10:30:00Z",
  "datacontenttype": "application/json",
  "data": {
    "pick_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "user_abc",
    "tenant_id": "tenant_xyz",
    "player_name": "Patrick Mahomes",
    "stat_type": "passing_yards",
    "line": 275.5,
    "side": "OVER",
    "stake": 100
  }
}
```

**Schema Evolution**:
- Use Schema Registry (Confluent or Karapace)
- Backward compatibility required
- Version schemas (v1, v2, etc.)

### 9.3 Event Processing Patterns

**At-Least-Once Delivery**:
```typescript
const consumer = kafka.consumer({ groupId: 'grading-agent' });

await consumer.subscribe({ topic: 'picks.created', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());

    try {
      // Idempotent processing (check if already processed)
      const alreadyProcessed = await db.query(
        'SELECT 1 FROM processed_events WHERE event_id = $1',
        [event.id]
      );

      if (alreadyProcessed.rowCount > 0) {
        logger.info('Event already processed, skipping', { eventId: event.id });
        return;
      }

      // Process event
      await gradePick(event.data);

      // Mark as processed
      await db.query(
        'INSERT INTO processed_events (event_id, processed_at) VALUES ($1, NOW())',
        [event.id]
      );

      // Commit offset
      await consumer.commitOffsets([{
        topic,
        partition,
        offset: (parseInt(message.offset) + 1).toString(),
      }]);
    } catch (error) {
      logger.error('Event processing failed', { error, event });
      // Do not commit offset - message will be reprocessed
    }
  },
});
```

**Dead Letter Queue (DLQ)**:
```typescript
const MAX_RETRIES = 3;

async function processWithDLQ(event: Event) {
  const retryCount = parseInt(event.headers['x-retry-count'] || '0');

  try {
    await processEvent(event);
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      // Retry with exponential backoff
      await producer.send({
        topic: 'picks.created',
        messages: [{
          ...event,
          headers: { 'x-retry-count': (retryCount + 1).toString() },
        }],
      });
    } else {
      // Send to DLQ for manual investigation
      await producer.send({
        topic: 'picks.created.dlq',
        messages: [event],
      });

      logger.error('Event moved to DLQ after max retries', { event });
    }
  }
}
```

### 9.4 Event-Driven Failure Modes

| Failure Mode | Detection | Mitigation |
|--------------|-----------|------------|
| **Consumer Lag** | Kafka lag monitoring | Add consumer instances |
| **Poison Message** | Repeated failures | DLQ + manual review |
| **Broker Outage** | Health checks | Multi-broker cluster |
| **Partition Imbalance** | Throughput metrics | Rebalance partitions |
| **Schema Incompatibility** | Schema validation | Schema registry + versioning |

---

## 10. DevOps and GitOps

### 10.1 GitOps Workflow

**Core Principles**:
1. **Git as single source of truth** for infrastructure and application config
2. **Declarative configuration** (Kubernetes manifests, Helm charts)
3. **Automated synchronization** (ArgoCD watches Git repos)
4. **Pull-based deployments** (cluster pulls changes, not CI/CD pushes)

**Repository Structure**:
```
unit-talk-gitops/
├── apps/
│   ├── api/
│   │   ├── base/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   └── kustomization.yaml
│   │   ├── overlays/
│   │   │   ├── dev/
│   │   │   ├── staging/
│   │   │   └── production/
│   ├── discord-bot/
│   └── command-center/
├── infrastructure/
│   ├── ingress-nginx/
│   ├── cert-manager/
│   ├── argocd/
│   └── prometheus-stack/
└── argocd-apps/
    ├── app-of-apps.yaml
    └── infrastructure.yaml
```

### 10.2 CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub Actions (CI)                                         │
└─────────────────────────────────────────────────────────────┘

Step 1: Code Quality Checks
├─ Lint (ESLint, Prettier)
├─ Type check (TypeScript)
├─ Unit tests (Jest)
└─ Security scan (Snyk, npm audit)

Step 2: Build
├─ Build Docker image
├─ Run integration tests
└─ Tag image (commit SHA + semantic version)

Step 3: Publish
├─ Push to DigitalOcean Container Registry (DOCR)
├─ Sign image (Cosign for supply chain security)
└─ Generate SBOM (Software Bill of Materials)

Step 4: Update Manifests
├─ Update image tag in GitOps repo
├─ Open pull request (automated)
└─ Require approval for production

┌─────────────────────────────────────────────────────────────┐
│  ArgoCD (CD)                                                 │
└─────────────────────────────────────────────────────────────┘

Step 5: Sync
├─ ArgoCD detects manifest changes
├─ Applies changes to DOKS cluster
└─ Monitors sync status

Step 6: Health Checks
├─ Kubernetes readiness probes
├─ Service mesh health checks
└─ Smoke tests (automated E2E)

Step 7: Promote (Blue/Green)
├─ Deploy to "green" environment
├─ Run validation tests
├─ Switch traffic to "green"
└─ Keep "blue" for rollback

Step 8: Observability
├─ Deployment events in Grafana
├─ Automatic SLO monitoring
└─ Alert if SLO violated
```

### 10.3 Deployment Strategies

**Blue/Green Deployment**:
```yaml
# Blue deployment (current production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
spec:
  replicas: 10
  selector:
    matchLabels:
      app: api
      version: blue

---
# Green deployment (new version)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
spec:
  replicas: 10
  selector:
    matchLabels:
      app: api
      version: green

---
# Service switches between blue and green
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
    version: blue  # Change to "green" to cut over
```

**Canary Deployment** (Argo Rollouts):
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5   # 5% traffic to new version
        - pause: { duration: 5m }
        - setWeight: 20  # 20% traffic
        - pause: { duration: 5m }
        - setWeight: 50  # 50% traffic
        - pause: { duration: 5m }
        - setWeight: 100 # Full rollout
      analysis:
        templates:
          - templateName: error-rate-check
        args:
          - name: service-name
            value: api
```

### 10.4 Infrastructure as Code (Terraform)

**DOKS Cluster Provisioning**:
```hcl
# terraform/doks-cluster.tf

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_kubernetes_cluster" "unit_talk" {
  name    = "unit-talk-production"
  region  = "nyc3"
  version = "1.28.2-do.0"

  node_pool {
    name       = "worker-pool"
    size       = "s-4vcpu-8gb"
    auto_scale = true
    min_nodes  = 3
    max_nodes  = 20
  }

  node_pool {
    name       = "high-memory-pool"
    size       = "m-8vcpu-64gb"
    auto_scale = true
    min_nodes  = 0
    max_nodes  = 5
    labels = {
      workload = "ai-inference"
    }
  }

  tags = ["production", "unit-talk"]
}

resource "digitalocean_database_cluster" "postgres" {
  name       = "unit-talk-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-4vcpu-8gb"
  region     = "nyc3"
  node_count = 3  # HA cluster
}

resource "digitalocean_database_db" "unit_talk" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "unit_talk_production"
}

resource "digitalocean_spaces_bucket" "storage" {
  name   = "unit-talk-storage"
  region = "nyc3"
  acl    = "private"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    enabled = true
    prefix  = "backups/"

    expiration {
      days = 90
    }
  }
}
```

---

## 11. SLO/SLA Model

### 11.1 Service Level Objectives (SLOs)

**Tier 1: User-Facing APIs**

| Metric | Target | Measurement Window | Error Budget |
|--------|--------|-------------------|--------------|
| **Availability** | 99.95% | 30 days | 21.6 minutes/month |
| **Latency (p95)** | <150ms | 5 minutes | 5% of requests can exceed |
| **Latency (p99)** | <300ms | 5 minutes | 1% of requests can exceed |
| **Error Rate** | <0.5% | 5 minutes | 0.5% of requests can fail |

**Tier 2: Background Jobs**

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| **Availability** | 99.5% | 30 days |
| **Processing Time** | <5 minutes (p95) | 1 hour |
| **Failure Rate** | <1% | 1 hour |

**Tier 3: Batch Processing**

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| **Availability** | 99% | 30 days |
| **Completion Time** | <1 hour | 1 day |
| **Data Quality** | >99.9% accuracy | 1 day |

### 11.2 Service Level Agreements (SLAs)

**Customer-Facing SLAs by Tier**:

| Plan | Uptime SLA | Support Response | Downtime Credits |
|------|------------|------------------|------------------|
| **Starter** | 99.5% | Best effort | No credits |
| **Growth** | 99.9% | <4 hours | 10% credit per 0.1% below |
| **Enterprise** | 99.95% | <1 hour | 25% credit per 0.1% below |

**SLA Credit Calculation**:
```
Downtime% = ((Total Minutes in Month - Available Minutes) / Total Minutes) * 100
Credit% = (SLA% - Actual Uptime%) * Credit Multiplier

Example:
Enterprise plan: 99.95% SLA
Actual uptime: 99.8%
Downtime: 0.15%
Credit: 0.15% * 25% multiplier per 0.1% = ~37.5% credit
```

### 11.3 Error Budget Management

**Error Budget Policy**:
```
Monthly Error Budget = (1 - SLO) * Total Requests

Example (99.95% SLO, 10M requests/month):
Error Budget = 0.0005 * 10,000,000 = 5,000 failed requests

Error Budget Tracking:
- 100% remaining → Normal velocity, deploy anytime
- 75% remaining → Review before major changes
- 50% remaining → Freeze on risky changes
- 25% remaining → Focus on reliability, no new features
- 0% remaining → Code freeze until budget replenishes
```

**Burn Rate Alerts**:
```yaml
- alert: ErrorBudgetBurnRateFast
  expr: |
    (
      rate(http_requests_total{status=~"5.."}[1h]) /
      rate(http_requests_total[1h])
    ) > 0.01  # Burning at 2x rate
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Error budget burning at 2x normal rate"
```

### 11.4 SLO Dashboards

**Grafana Dashboard Components**:
- Current SLO compliance (% of time within target)
- Error budget remaining (% and absolute)
- Burn rate (last 1h, 6h, 24h)
- Recent incidents (root cause, impact)
- Monthly SLO trend (historical compliance)

---

## 12. Cost Model and Tiers

### 12.1 DigitalOcean Cost Breakdown

**Startup Tier** (0-1000 users):
```
┌─────────────────────────────────────────────────────────────┐
│  Startup Tier Infrastructure Costs                          │
└─────────────────────────────────────────────────────────────┘

DOKS Cluster:
├─ 3x s-2vcpu-4gb nodes                     $72/month
└─ Load Balancer                            $12/month

Database:
├─ DO Managed PostgreSQL (db-s-2vcpu-4gb)   $60/month
└─ 1x read replica                          $60/month

Cache:
└─ DO Managed Redis (db-s-1vcpu-2gb)        $30/month

Storage:
├─ DO Spaces (100 GB)                       $5/month
└─ Spaces CDN bandwidth (1 TB)              $10/month

Observability:
├─ Prometheus (self-hosted on cluster)      $0/month
├─ Grafana Cloud Free Tier                  $0/month
└─ Loki (self-hosted, 7-day retention)      $0/month

───────────────────────────────────────────────────────────────
Total Infrastructure:                       $249/month
Per-User Cost (1000 users):                 $0.25/user/month
```

**Growth Tier** (1,000-10,000 users):
```
┌─────────────────────────────────────────────────────────────┐
│  Growth Tier Infrastructure Costs                           │
└─────────────────────────────────────────────────────────────┘

DOKS Cluster:
├─ 5x s-4vcpu-8gb nodes                     $240/month
├─ 2x m-2vcpu-16gb (AI workloads)           $90/month
└─ Load Balancer                            $12/month

Database:
├─ DO Managed PostgreSQL (db-s-4vcpu-8gb)   $120/month
├─ 2x read replicas                         $240/month
└─ Daily backups (automatic)                $0/month

Cache:
├─ DO Managed Redis (db-s-2vcpu-4gb)        $60/month
└─ Redis replica                            $60/month

Storage:
├─ DO Spaces (1 TB)                         $20/month
└─ Spaces CDN bandwidth (10 TB)             $100/month

Observability:
├─ Grafana Cloud Pro                        $50/month
├─ Loki (30-day retention)                  $30/month
└─ Tempo (7-day retention)                  $20/month

───────────────────────────────────────────────────────────────
Total Infrastructure:                       $1,042/month
Per-User Cost (10,000 users):               $0.10/user/month
```

**Enterprise Tier** (10,000+ users):
```
┌─────────────────────────────────────────────────────────────┐
│  Enterprise Tier Infrastructure Costs                       │
└─────────────────────────────────────────────────────────────┘

DOKS Cluster:
├─ 10x s-8vcpu-16gb nodes                   $960/month
├─ 5x m-8vcpu-64gb (AI/batch workloads)     $900/month
├─ Load Balancer (multi-region)             $24/month
└─ Reserved instances (20% discount)        -$376/month

Database:
├─ DO Managed PostgreSQL (db-s-8vcpu-32gb)  $480/month
├─ 4x read replicas                         $1,920/month
├─ Point-in-time recovery                   $0/month
└─ Automated failover                       $0/month

Cache:
├─ DO Managed Redis (db-s-4vcpu-8gb)        $120/month
├─ 2x Redis replicas                        $240/month
└─ Redis Cluster mode (sharding)            Included

Storage:
├─ DO Spaces (10 TB)                        $200/month
├─ Spaces CDN bandwidth (100 TB)            $1,000/month
└─ Versioning + lifecycle policies          $0/month

Observability:
├─ Grafana Cloud Advanced                   $200/month
├─ Loki (90-day retention)                  $150/month
├─ Tempo (30-day retention)                 $100/month
└─ Custom SLO dashboards                    $0/month

Extras:
├─ DO VPC Peering                           $0/month
├─ DO Cloud Firewall                        $0/month
├─ DO Uptime Checks                         $0/month
└─ DO DDoS Protection                       $0/month

───────────────────────────────────────────────────────────────
Total Infrastructure:                       $5,918/month
Per-User Cost (100,000 users):              $0.06/user/month
```

### 12.2 Cost Optimization Strategies

**1. Reserved Instances**:
- Commit to 1-year for 20% discount on DOKS nodes
- Commit to 2-year for 30% discount

**2. Autoscaling**:
- Scale down during off-peak hours (nights, weekends)
- Use KEDA for event-driven autoscaling (scale to zero for non-critical workloads)

**3. Spot Instances** (if DO offers):
- Use for batch processing workloads
- Use for development/staging environments

**4. Data Transfer Optimization**:
- Use DO Spaces CDN to reduce bandwidth costs
- Compress API responses (gzip/brotli)
- Implement client-side caching (service workers)

**5. Database Optimization**:
- Use read replicas for read-heavy workloads
- Implement query result caching (Redis)
- Archive old data to Spaces (cold storage)

**6. AI Cost Management**:
- Cache LLM responses (semantic similarity matching)
- Use smaller models for simple tasks
- Batch inference requests

### 12.3 Cost Per Feature

| Feature | Monthly Cost | Cost Driver |
|---------|-------------|-------------|
| **Prop Grading** | $200 | Temporal workers, database writes |
| **Real-Time Alerts** | $150 | Kafka, WebSocket connections |
| **AI Insights** | $500 | LLM API calls, vector database |
| **Discord Bot** | $50 | Compute (minimal) |
| **Analytics Dashboard** | $300 | ElasticSearch, Grafana |
| **API Gateway** | $100 | Kong, rate limiting |
| **Observability** | $400 | Prometheus, Loki, Tempo, Grafana Cloud |

---

## 13. Technology Stack

### 13.1 Complete Bill of Materials

See **[BILL_OF_MATERIALS.md](./BILL_OF_MATERIALS.md)** for detailed BOM with DigitalOcean SKUs and rationale.

### 13.2 Technology Selection Criteria

| Category | Selected | Alternatives Considered | Decision Rationale |
|----------|----------|------------------------|-------------------|
| **Container Orchestration** | Kubernetes (DOKS) | Docker Swarm, Nomad | Industry standard, DO managed |
| **Service Mesh** | Linkerd | Istio, Consul Connect | Lightweight, easy to operate |
| **API Gateway** | Kong | Tyk, AWS API Gateway | Open source, extensible |
| **Event Streaming** | Kafka | NATS, RabbitMQ | High throughput, ordered delivery |
| **Database** | PostgreSQL | MySQL, CockroachDB | ACID guarantees, RLS support |
| **Cache** | Redis | Memcached, Dragonfly | Rich data structures, pub/sub |
| **Observability** | Prometheus/Grafana | Datadog, New Relic | Open source, cost-effective |
| **CI/CD** | GitHub Actions + ArgoCD | GitLab CI, Jenkins | Native GitHub integration, GitOps |
| **IaC** | Terraform | Pulumi, CloudFormation | Multi-cloud, DO provider |

---

## 14. Implementation Phases

### Phase 0: Blueprint and Foundation (Weeks 1-2)

**Goal**: Establish infrastructure and GitOps foundation

**Deliverables**:
- [x] Architecture documentation (this document)
- [ ] DOKS cluster provisioned via Terraform
- [ ] ArgoCD installed and configured
- [ ] DO Managed PostgreSQL + Redis provisioned
- [ ] GitHub Actions CI/CD pipelines
- [ ] Base observability stack (Prometheus, Grafana)

**Success Criteria**:
- Infrastructure as Code (IaC) in Git
- Automated deployments via ArgoCD
- Health checks passing for all core services

---

### Phase 1: MVP Core (Weeks 3-6)

**Goal**: Launch minimal viable product with core features

**Deliverables**:
- [ ] Authentication and authorization (OIDC, RBAC)
- [ ] API service with /picks, /users endpoints
- [ ] Database schema v3.0.0 deployed
- [ ] Basic prop grading (manual trigger)
- [ ] Discord bot integration
- [ ] Monitoring dashboards with SLO tracking

**Success Criteria**:
- 100 test users onboarded
- <150ms API latency (p95)
- 99.5% uptime over 7 days
- All unit tests passing

---

### Phase 2: Enterprise Features (Weeks 7-12)

**Goal**: Scale to support growth and enterprise customers

**Deliverables**:
- [ ] Multi-tenant isolation (schema-per-tenant or RLS)
- [ ] AI-powered insights and recaps
- [ ] Advanced grading features (steam, CLV, timing)
- [ ] Real-time alerts (injury, hedge, middle)
- [ ] Billing integration (Stripe)
- [ ] SOC2 compliance preparation

**Success Criteria**:
- Support 1,000+ concurrent users
- <50ms database query latency (p95)
- 99.9% uptime over 30 days
- Positive customer feedback (NPS >50)

---

### Phase 3: Syndication and Partner APIs (Weeks 13-20)

**Goal**: Enable third-party integrations and API monetization

**Deliverables**:
- [ ] Public API with OpenAPI documentation
- [ ] API key management and rate limiting
- [ ] Webhook infrastructure
- [ ] Partner onboarding portal
- [ ] SDK libraries (JavaScript, Python)
- [ ] Usage-based billing for API access

**Success Criteria**:
- 10+ partner integrations live
- API uptime >99.95%
- API documentation completeness score >90%
- Positive partner feedback

---

### Phase 4: Global Scale (Weeks 21+)

**Goal**: Multi-region deployment and global scale

**Deliverables**:
- [ ] Multi-region DOKS clusters (NYC, SFO, EU)
- [ ] Global load balancing (DNS-based)
- [ ] Active-active database replication
- [ ] CDN optimization (Spaces CDN)
- [ ] Chaos engineering tests (Litmus Chaos)
- [ ] 99.99% uptime SLA

**Success Criteria**:
- Support 100,000+ users globally
- <100ms API latency globally (p95)
- Zero-downtime deployments
- RTO <5 minutes, RPO <1 minute

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **DOKS** | DigitalOcean Kubernetes Service - managed Kubernetes platform |
| **RLS** | Row-Level Security - database access control at row level |
| **SLO** | Service Level Objective - internal reliability target |
| **SLA** | Service Level Agreement - customer-facing uptime guarantee |
| **mTLS** | Mutual TLS - two-way authentication between services |
| **RBAC** | Role-Based Access Control - permissions based on user roles |
| **GitOps** | Infrastructure management via Git commits |
| **HPA** | Horizontal Pod Autoscaler - automatic scaling of Kubernetes pods |
| **DLQ** | Dead Letter Queue - storage for failed messages |
| **RAG** | Retrieval-Augmented Generation - LLM + knowledge base |

---

## Appendix B: Reference Links

- [DigitalOcean Kubernetes Documentation](https://docs.digitalocean.com/products/kubernetes/)
- [ArgoCD Documentation](https://argo-cd.readthedocs.io/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Linkerd Documentation](https://linkerd.io/docs/)
- [Temporal Documentation](https://docs.temporal.io/)

---

**Document Version**: 1.0
**Last Updated**: January 2025
**Next Review**: Q2 2025
**Owner**: Engineering Leadership
**Status**: Production-Ready Blueprint
