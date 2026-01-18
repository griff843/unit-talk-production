# Overall Architecture - Layered View

## Diagram Specification

This diagram shows the complete layered architecture of the Unit Talk platform.

## Mermaid Diagram

```mermaid
graph TB
    subgraph "Client Tier"
        A[Next.js SSR]
        B[React SPA]
        C[Mobile Apps]
        D[Discord Bot]
    end

    subgraph "Edge Tier"
        E[DO Load Balancer]
        F[CDN - Spaces CDN]
        G[WAF]
        H[DDoS Protection]
    end

    subgraph "Gateway Tier"
        I[NGINX Ingress]
        J[Kong API Gateway]
        K[GraphQL Federation]
    end

    subgraph "Service Mesh"
        L[Linkerd]
        M[mTLS]
        N[Circuit Breaking]
        O[Load Balancing]
    end

    subgraph "Application Tier"
        P[API Service]
        Q[Grading Agent]
        R[Alert Agent]
        S[AI Gateway]
    end

    subgraph "Event Backbone"
        T[Kafka Cluster]
        U[Event Sourcing]
        V[Stream Processing]
    end

    subgraph "Data Tier"
        W[(DO Managed PostgreSQL)]
        X[(DO Managed Redis)]
        Y[DO Spaces S3]
        Z[(ElasticSearch)]
        AA[(Vector DB - Qdrant)]
    end

    subgraph "Observability Tier"
        AB[Prometheus]
        AC[Grafana]
        AD[Loki]
        AE[Tempo]
        AF[OpenTelemetry]
    end

    subgraph "Infrastructure Tier"
        AG[DOKS Cluster]
        AH[DO VPC]
        AI[DO Firewall]
        AJ[DO Secrets Manager]
    end

    A --> E
    B --> E
    C --> E
    D --> E

    E --> F
    E --> G
    E --> H

    E --> I
    I --> J
    J --> K

    K --> L
    L --> M
    L --> N
    L --> O

    L --> P
    L --> Q
    L --> R
    L --> S

    P --> T
    Q --> T
    R --> T
    S --> T

    T --> U
    T --> V

    P --> W
    P --> X
    P --> Y
    Q --> W
    R --> W
    S --> AA

    P --> AF
    Q --> AF
    R --> AF
    S --> AF

    AF --> AB
    AF --> AD
    AF --> AE

    AB --> AC
    AD --> AC
    AE --> AC

    AG --> AH
    AG --> AI
    AG --> AJ

    style A fill:#e1f5ff
    style B fill:#e1f5ff
    style C fill:#e1f5ff
    style D fill:#e1f5ff
    style E fill:#fff4e6
    style F fill:#fff4e6
    style G fill:#fff4e6
    style H fill:#fff4e6
    style I fill:#f3e5f5
    style J fill:#f3e5f5
    style K fill:#f3e5f5
    style L fill:#e8f5e9
    style M fill:#e8f5e9
    style N fill:#e8f5e9
    style O fill:#e8f5e9
    style P fill:#e3f2fd
    style Q fill:#e3f2fd
    style R fill:#e3f2fd
    style S fill:#e3f2fd
    style T fill:#fce4ec
    style U fill:#fce4ec
    style V fill:#fce4ec
    style W fill:#fff9c4
    style X fill:#fff9c4
    style Y fill:#fff9c4
    style Z fill:#fff9c4
    style AA fill:#fff9c4
    style AB fill:#f1f8e9
    style AC fill:#f1f8e9
    style AD fill:#f1f8e9
    style AE fill:#f1f8e9
    style AF fill:#f1f8e9
```

## Rendering Instructions

To render this diagram to PNG/SVG:

### Using Mermaid CLI
```bash
# Install mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Render to PNG (high resolution)
mmdc -i 01-overall-architecture.md -o 01-overall-architecture.png -w 3000 -H 2400 -b transparent

# Render to SVG (vector)
mmdc -i 01-overall-architecture.md -o 01-overall-architecture.svg -b transparent
```

### Using Online Tools
- [Mermaid Live Editor](https://mermaid.live/)
- [Draw.io with Mermaid plugin](https://app.diagrams.net/)

## Description

This layered architecture diagram illustrates the complete Unit Talk platform stack:

**Client Tier**: User-facing applications and interfaces
**Edge Tier**: Global distribution, security, and DDoS protection
**Gateway Tier**: Request routing, authentication, and API management
**Service Mesh**: Service-to-service communication, mTLS, and resilience
**Application Tier**: Core business logic microservices
**Event Backbone**: Asynchronous communication and event streaming
**Data Tier**: Persistent storage, caching, and search
**Observability Tier**: Monitoring, logging, and tracing
**Infrastructure Tier**: Kubernetes orchestration and DigitalOcean services
