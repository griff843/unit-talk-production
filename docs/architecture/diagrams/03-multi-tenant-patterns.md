# Multi-Tenant Data Isolation Patterns

## Diagram Specification

Visual comparison of three tenant isolation models with security, cost, and performance trade-offs.

## Pattern 1: Row-Level Security (RLS)

```mermaid
graph TB
    subgraph "Shared Database"
        subgraph "unified_picks table"
            R1[id: 1<br/>tenant_id: tenant_a<br/>player: Mahomes<br/>line: 275.5]
            R2[id: 2<br/>tenant_id: tenant_b<br/>player: Allen<br/>line: 280.5]
            R3[id: 3<br/>tenant_id: tenant_a<br/>player: Burrow<br/>line: 265.5]
        end
    end

    subgraph "Application Tier"
        App1[API Request<br/>Tenant A]
        App2[API Request<br/>Tenant B]
    end

    App1 -->|SET app.current_tenant = 'tenant_a'| R1
    App1 -.->|RLS BLOCKS| R2
    App1 -->|SET app.current_tenant = 'tenant_a'| R3

    App2 -.->|RLS BLOCKS| R1
    App2 -->|SET app.current_tenant = 'tenant_b'| R2
    App2 -.->|RLS BLOCKS| R3

    style R1 fill:#e3f2fd
    style R2 fill:#fff3e0
    style R3 fill:#e3f2fd
    style App1 fill:#e3f2fd
    style App2 fill:#fff3e0
```

**RLS Policy**:
```sql
CREATE POLICY tenant_isolation ON unified_picks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

**Pros**:
- ✅ Cost-effective (single database)
- ✅ Fast tenant onboarding (no schema creation)
- ✅ Simplified management

**Cons**:
- ❌ Requires careful query testing
- ❌ Performance impact on large tables
- ❌ Shared resource contention

**Best For**: Startups, high-volume low-touch, cost-sensitive deployments

---

## Pattern 2: Schema-per-Tenant

```mermaid
graph TB
    subgraph "Shared PostgreSQL Instance"
        subgraph "tenant_acme schema"
            T1A[unified_picks<br/>users<br/>raw_props]
        end
        subgraph "tenant_globex schema"
            T2A[unified_picks<br/>users<br/>raw_props]
        end
        subgraph "tenant_initech schema"
            T3A[unified_picks<br/>users<br/>raw_props]
        end
        subgraph "public schema"
            Shared[Common lookup tables<br/>sports, leagues, teams]
        end
    end

    App1[API Request<br/>Tenant: ACME]
    App2[API Request<br/>Tenant: Globex]
    App3[API Request<br/>Tenant: Initech]

    App1 -->|SET search_path = tenant_acme| T1A
    App2 -->|SET search_path = tenant_globex| T2A
    App3 -->|SET search_path = tenant_initech| T3A

    T1A -.->|Reference| Shared
    T2A -.->|Reference| Shared
    T3A -.->|Reference| Shared

    style T1A fill:#e3f2fd
    style T2A fill:#fff3e0
    style T3A fill:#f3e5f5
    style Shared fill:#e8f5e9
```

**Implementation**:
```sql
-- Create tenant schema
CREATE SCHEMA tenant_acme_corp;
GRANT USAGE ON SCHEMA tenant_acme_corp TO app_role;

-- Set search path per request
SET search_path TO tenant_acme_corp, public;
```

**Pros**:
- ✅ Strong logical isolation
- ✅ Custom schema modifications per tenant
- ✅ Better query performance (no RLS overhead)

**Cons**:
- ❌ Migration complexity (N schemas to update)
- ❌ Connection pool management overhead

**Best For**: Mid-market, SMB growth, regulated industries

---

## Pattern 3: Database-per-Tenant

```mermaid
graph TB
    subgraph "DO Managed PostgreSQL - Region NYC3"
        DB1[(Database: tenant_acme<br/>Connection: acme-db.internal.do.com)]
        DB2[(Database: tenant_globex<br/>Connection: globex-db.internal.do.com)]
    end

    subgraph "DO Managed PostgreSQL - Region SFO3"
        DB3[(Database: tenant_initech<br/>Connection: initech-db.internal.do.com)]
    end

    App1[API Request<br/>Tenant: ACME<br/>Region: US-East]
    App2[API Request<br/>Tenant: Globex<br/>Region: US-East]
    App3[API Request<br/>Tenant: Initech<br/>Region: US-West]

    App1 -->|Dedicated Connection Pool| DB1
    App2 -->|Dedicated Connection Pool| DB2
    App3 -->|Dedicated Connection Pool| DB3

    style DB1 fill:#e3f2fd
    style DB2 fill:#fff3e0
    style DB3 fill:#f3e5f5
```

**Connection Routing**:
```typescript
const getTenantDatabase = (tenantId: string) => {
  const config = tenantConfigs[tenantId];
  return new Pool({
    host: config.dbHost,
    database: config.dbName,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
};
```

**Pros**:
- ✅ Complete data isolation (strongest security)
- ✅ Independent scaling and backup strategies
- ✅ No "noisy neighbor" issues
- ✅ Data residency compliance (EU, US regions)

**Cons**:
- ❌ Highest operational cost
- ❌ Complex multi-tenant analytics
- ❌ Database provisioning latency

**Best For**: Enterprise, regulated industries, data residency requirements

---

## Selection Decision Tree

```mermaid
graph TD
    Start[Tenant Requirements]
    Start --> Q1{Data Residency<br/>Required?}

    Q1 -->|Yes| DB[Database-per-Tenant]
    Q1 -->|No| Q2{Regulatory<br/>Compliance?}

    Q2 -->|HIPAA/SOC2| Q3{Budget?}
    Q2 -->|No| Q4{Data Volume<br/>per Tenant?}

    Q3 -->|Enterprise| DB
    Q3 -->|Mid-market| Schema[Schema-per-Tenant]

    Q4 -->|>1TB| DB
    Q4 -->|100GB-1TB| Schema
    Q4 -->|<100GB| RLS[Row-Level Security]

    style DB fill:#ffcccc
    style Schema fill:#fff3cc
    style RLS fill:#ccffcc
```

## Comparison Matrix

| Criteria | RLS | Schema-per-Tenant | DB-per-Tenant |
|----------|-----|-------------------|---------------|
| **Security** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Cost** | $ | $$$ | $$$$$ |
| **Performance** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Scalability** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Ops Complexity** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| **Onboarding Speed** | Fast | Medium | Slow |
| **Data Residency** | ❌ | ❌ | ✅ |
| **Custom Schema** | ❌ | ✅ | ✅ |

## Rendering Instructions

```bash
# Render all multi-tenant diagrams
mmdc -i 03-multi-tenant-patterns.md -o 03-multi-tenant-patterns.png -w 2400 -H 3000 -b white
mmdc -i 03-multi-tenant-patterns.md -o 03-multi-tenant-patterns.svg -b white
```

## Migration Path

```
Phase 1: Launch with RLS (0-1000 tenants)
    ↓
Phase 2: Offer Schema-per-Tenant for enterprise (10-100 tenants)
    ↓
Phase 3: Offer DB-per-Tenant for regulated industries (1-10 tenants)
```

Each tenant can be individually migrated to a higher isolation tier without affecting others.
