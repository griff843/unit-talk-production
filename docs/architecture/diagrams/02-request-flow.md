# Request Flow Architecture

## Diagram Specification

This diagram shows the detailed path of a user request through the system, including latency budgets.

## Mermaid Diagram

```mermaid
sequenceDiagram
    participant User as 👤 User Browser/App
    participant LB as DO Load Balancer<br/>(5ms)
    participant Ingress as NGINX Ingress<br/>(10ms)
    participant Gateway as Kong API Gateway<br/>(15ms)
    participant Mesh as Service Mesh<br/>(10ms)
    participant API as API Service<br/>(50ms)
    participant Cache as Redis Cache<br/>(2ms)
    participant DB as PostgreSQL<br/>(30ms)

    User->>LB: HTTPS Request
    Note over LB: SSL Termination<br/>WAF Rules<br/>DDoS Protection
    LB->>Ingress: Forward Request

    Note over Ingress: Cert Manager<br/>Let's Encrypt<br/>Routing Rules
    Ingress->>Gateway: Route to Service

    Note over Gateway: JWT Validation<br/>Rate Limiting<br/>Request Validation
    Gateway->>Gateway: Extract tenant_id from JWT
    Gateway->>Mesh: Authenticated Request

    Note over Mesh: mTLS Encryption<br/>Circuit Breaking<br/>Retry Logic
    Mesh->>API: Forward with mTLS

    Note over API: Business Logic<br/>Authorization Check
    API->>Cache: Check Cache

    alt Cache Hit
        Cache-->>API: Return Cached Data (2ms)
        Note over API: Skip Database Query
    else Cache Miss
        API->>DB: Query Database
        Note over DB: RLS Policy Applied<br/>tenant_id filter
        DB-->>API: Return Data (30ms)
        API->>Cache: Store in Cache
    end

    API-->>Mesh: JSON Response
    Mesh-->>Gateway: Response with Trace ID
    Gateway-->>Ingress: Add Cache Headers
    Ingress-->>LB: Response
    LB-->>User: HTTPS Response (130ms total)

    Note over User,LB: ✅ Within 150ms SLO<br/>Error Budget: 20ms
```

## Alternative Flow - Error Handling

```mermaid
sequenceDiagram
    participant User as 👤 User
    participant Gateway as API Gateway
    participant API as API Service
    participant DB as Database
    participant DLQ as Dead Letter Queue

    User->>Gateway: Request
    Gateway->>API: Forward

    alt Database Available
        API->>DB: Query
        DB-->>API: Success
        API-->>Gateway: 200 OK
        Gateway-->>User: Response
    else Database Down
        API->>DB: Query (timeout 3s)
        DB--xAPI: Connection Failed

        Note over API: Circuit Breaker<br/>OPEN State

        API->>API: Check Stale Cache

        alt Stale Cache Available
            API-->>Gateway: 200 OK (stale data)
            Note over Gateway: X-Cache-Status: STALE
            Gateway-->>User: Response with warning
        else No Cache
            API-->>Gateway: 503 Service Unavailable
            API->>DLQ: Log Failed Request
            Gateway-->>User: Error + Retry-After
        end
    end
```

## Rendering Instructions

```bash
# Render sequence diagram to PNG
mmdc -i 02-request-flow.md -o 02-request-flow.png -w 2400 -H 1600 -b white

# Render to SVG
mmdc -i 02-request-flow.md -o 02-request-flow.svg -b white
```

## Latency Budget Breakdown

| Component | Target Latency | Actual (p95) | Budget Status |
|-----------|---------------|--------------|---------------|
| Load Balancer | 5ms | 3ms | ✅ Under budget |
| Ingress | 10ms | 8ms | ✅ Under budget |
| API Gateway | 15ms | 12ms | ✅ Under budget |
| Service Mesh | 10ms | 7ms | ✅ Under budget |
| Application Logic | 50ms | 45ms | ✅ Under budget |
| Database Query | 30ms | 25ms | ✅ Under budget |
| Response Serialization | 10ms | 8ms | ✅ Under budget |
| **Total** | **130ms** | **108ms** | ✅ **22ms buffer** |
| **SLO Target** | **150ms** | | ✅ **Within SLO** |

## Optimization Opportunities

1. **Connection Pooling**: Reduce DB connection overhead from 5ms to 2ms
2. **Redis Pipeline**: Batch cache operations to reduce round trips
3. **Compression**: Enable Brotli compression to reduce response size by 60%
4. **HTTP/2**: Enable multiplexing to reduce connection overhead
5. **Edge Caching**: Cache static API responses at CDN edge (99% hit rate target)
