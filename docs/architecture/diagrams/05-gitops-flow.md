# GitOps CI/CD Flow

## Diagram Specification

Complete CI/CD pipeline from code commit to production deployment using GitHub Actions and ArgoCD.

## GitOps Workflow

```mermaid
graph TB
    subgraph "Developer Workflow"
        Dev[👨‍💻 Developer]
        Local[Local Development<br/>Docker Compose]
        PR[Create Pull Request]
    end

    subgraph "GitHub"
        Main[main branch]
        Feature[feature/* branch]
    end

    subgraph "GitHub Actions CI Pipeline"
        CI1[Lint & Type Check<br/>ESLint, Prettier, TSC]
        CI2[Unit Tests<br/>Jest 80%+ coverage]
        CI3[Build Docker Image<br/>Multi-stage build]
        CI4[Security Scan<br/>Snyk, Trivy]
        CI5[Integration Tests<br/>Playwright E2E]
        CI6[Push to DOCR<br/>Tag: SHA + semver]
    end

    subgraph "GitOps Repository"
        GitOps[unit-talk-gitops]
        Manifests[Kubernetes Manifests<br/>Kustomize overlays]
        Update[Update Image Tag<br/>Automated PR]
    end

    subgraph "ArgoCD"
        Argo[ArgoCD Controller]
        Sync[Sync Loop<br/>Every 3 minutes]
        Health[Health Checks]
    end

    subgraph "DOKS Cluster"
        Blue[Blue Deployment<br/>Current Production]
        Green[Green Deployment<br/>New Version]
        Service[Kubernetes Service]
        Ingress[NGINX Ingress]
    end

    subgraph "Deployment Strategies"
        Strategy{Deployment Type?}
        BlueGreen[Blue/Green<br/>Zero-downtime cutover]
        Canary[Canary<br/>5% → 20% → 50% → 100%]
        Rolling[Rolling Update<br/>1 pod at a time]
    end

    subgraph "Validation"
        Smoke[Smoke Tests<br/>Health endpoints]
        SLO[SLO Monitoring<br/>Latency, errors]
        Rollback{SLO Violated?}
    end

    Dev --> Local
    Local --> Feature
    Feature --> PR
    PR --> Main

    Main --> CI1
    CI1 --> CI2
    CI2 --> CI3
    CI3 --> CI4
    CI4 --> CI5
    CI5 --> CI6

    CI6 --> Update
    Update --> Manifests
    Manifests --> GitOps

    GitOps --> Sync
    Sync --> Argo

    Argo --> Health
    Health --> Strategy

    Strategy --> BlueGreen
    Strategy --> Canary
    Strategy --> Rolling

    BlueGreen --> Green
    Green --> Smoke
    Canary --> Green
    Rolling --> Green

    Smoke --> SLO
    SLO --> Rollback

    Rollback -->|Yes| Blue
    Rollback -->|No| Service

    Blue -.->|Standby| Ingress
    Service --> Ingress
    Green --> Service

    style Dev fill:#e3f2fd
    style Main fill:#c8e6c9
    style CI3 fill:#fff3e0
    style Argo fill:#f3e5f5
    style Green fill:#e8f5e9
    style Blue fill:#ffebee
```

## Detailed CI Pipeline (GitHub Actions)

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant DOCR as DO Container Registry
    participant GitOps as GitOps Repo
    participant ArgoCD as ArgoCD
    participant DOKS as DOKS Cluster

    Dev->>GH: git push origin feature/new-feature
    GH->>CI: Trigger Workflow

    Note over CI: Job 1: Code Quality
    CI->>CI: npm run lint
    CI->>CI: npm run type-check
    CI->>CI: npm run format:check

    Note over CI: Job 2: Tests
    CI->>CI: npm run test:unit
    CI->>CI: Generate coverage report
    CI->>CI: Fail if coverage <80%

    Note over CI: Job 3: Build
    CI->>CI: docker build -t unit-talk-api:$SHA
    CI->>CI: docker build --target test (multi-stage)

    Note over CI: Job 4: Security
    CI->>CI: snyk test --severity-threshold=high
    CI->>CI: trivy image scan
    CI->>CI: npm audit --audit-level=moderate

    Note over CI: Job 5: Integration Tests
    CI->>CI: docker-compose up -d (test environment)
    CI->>CI: npm run test:e2e (Playwright)
    CI->>CI: docker-compose down

    alt All checks pass
        Note over CI: Job 6: Publish
        CI->>DOCR: docker push registry.digitalocean.com/unit-talk/api:$SHA
        CI->>DOCR: docker push registry.digitalocean.com/unit-talk/api:$TAG

        Note over CI: Job 7: Update Manifests
        CI->>GitOps: Clone gitops repo
        CI->>GitOps: Update image tag in deployment.yaml
        CI->>GitOps: Create Pull Request
        CI-->>GH: ✅ Build Success

        Dev->>GitOps: Review and merge PR

        Note over ArgoCD: Detect manifest change
        ArgoCD->>DOKS: kubectl apply -f deployment.yaml
        ArgoCD->>DOKS: Monitor sync status
        ArgoCD->>DOKS: Run health checks
        ArgoCD-->>Dev: 🚀 Deployment Complete
    else Any check fails
        CI-->>GH: ❌ Build Failed
        GH-->>Dev: Email notification + GitHub status
    end
```

## Blue/Green Deployment Strategy

```mermaid
stateDiagram-v2
    [*] --> BlueProduction: Initial State

    BlueProduction: Blue Environment (v1.0)
    BlueProduction: 100% Traffic
    GreenStaging: Green Environment (v1.1)
    GreenStaging: 0% Traffic (deploy + test)
    GreenProduction: Green Environment (v1.1)
    GreenProduction: 100% Traffic
    BlueStandby: Blue Environment (v1.0)
    BlueStandby: 0% Traffic (standby)

    BlueProduction --> GreenStaging: Deploy v1.1 to green
    GreenStaging --> GreenStaging: Run smoke tests
    GreenStaging --> GreenStaging: Run E2E tests
    GreenStaging --> GreenStaging: Monitor SLO metrics

    GreenStaging --> GreenProduction: Switch traffic (update service selector)
    GreenStaging --> BlueProduction: Rollback if tests fail

    GreenProduction --> BlueStandby: Keep blue for rollback (1 hour)
    BlueStandby --> [*]: Decommission blue (if stable)

    GreenProduction --> BlueProduction: Emergency rollback (if SLO violated)
```

**Implementation**:
```yaml
# Blue deployment (current production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-blue
spec:
  replicas: 10
  template:
    metadata:
      labels:
        app: api
        version: blue
    spec:
      containers:
      - name: api
        image: registry.digitalocean.com/unit-talk/api:v1.0.0

---
# Green deployment (new version)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-green
spec:
  replicas: 10
  template:
    metadata:
      labels:
        app: api
        version: green
    spec:
      containers:
      - name: api
        image: registry.digitalocean.com/unit-talk/api:v1.1.0

---
# Service switches traffic
apiVersion: v1
kind: Service
metadata:
  name: api
spec:
  selector:
    app: api
    version: blue  # Change to "green" to cut over
  ports:
  - port: 80
    targetPort: 3000
```

## Canary Deployment with Argo Rollouts

```mermaid
graph LR
    subgraph "Traffic Split"
        U[100% Users]
    end

    subgraph "Stage 1: 5% Canary"
        Stable1[Stable v1.0<br/>95% traffic]
        Canary1[Canary v1.1<br/>5% traffic]
    end

    subgraph "Stage 2: 20% Canary"
        Stable2[Stable v1.0<br/>80% traffic]
        Canary2[Canary v1.1<br/>20% traffic]
    end

    subgraph "Stage 3: 50% Canary"
        Stable3[Stable v1.0<br/>50% traffic]
        Canary3[Canary v1.1<br/>50% traffic]
    end

    subgraph "Stage 4: Full Rollout"
        Stable4[Stable v1.1<br/>100% traffic]
    end

    U -->|5min pause| Stable1
    U -->|5min pause| Canary1

    Canary1 -.->|Analysis: OK| Stable2
    Canary1 -.->|Analysis: FAIL| Rollback1[❌ Rollback to 100% stable]

    Stable2 --> Canary2
    Canary2 -.->|Analysis: OK| Stable3
    Canary2 -.->|Analysis: FAIL| Rollback2[❌ Rollback to 100% stable]

    Stable3 --> Canary3
    Canary3 -.->|Analysis: OK| Stable4
    Canary3 -.->|Analysis: FAIL| Rollback3[❌ Rollback to 100% stable]

    style Canary1 fill:#fff3e0
    style Canary2 fill:#fff3e0
    style Canary3 fill:#fff3e0
    style Stable4 fill:#e8f5e9
    style Rollback1 fill:#ffebee
    style Rollback2 fill:#ffebee
    style Rollback3 fill:#ffebee
```

**Argo Rollouts Configuration**:
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
        - setWeight: 5   # 5% traffic to canary
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: error-rate-check
              - templateName: latency-check
        - setWeight: 20  # 20% traffic
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: error-rate-check
              - templateName: latency-check
        - setWeight: 50  # 50% traffic
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: error-rate-check
              - templateName: latency-check
        - setWeight: 100 # Full rollout

---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: error-rate-check
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result < 0.01  # <1% error rate
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus:9090
          query: |
            rate(http_requests_total{status=~"5..",app="api",version="canary"}[5m])
            /
            rate(http_requests_total{app="api",version="canary"}[5m])
```

## Repository Structure

```
unit-talk-gitops/
├── apps/
│   ├── api/
│   │   ├── base/
│   │   │   ├── deployment.yaml
│   │   │   ├── service.yaml
│   │   │   ├── configmap.yaml
│   │   │   └── kustomization.yaml
│   │   ├── overlays/
│   │   │   ├── dev/
│   │   │   │   ├── kustomization.yaml
│   │   │   │   └── replicas.yaml (replicas: 1)
│   │   │   ├── staging/
│   │   │   │   ├── kustomization.yaml
│   │   │   │   └── replicas.yaml (replicas: 3)
│   │   │   └── production/
│   │   │       ├── kustomization.yaml
│   │   │       ├── replicas.yaml (replicas: 10)
│   │   │       └── hpa.yaml
├── infrastructure/
│   ├── argocd/
│   ├── prometheus/
│   ├── ingress-nginx/
│   └── cert-manager/
└── argocd-apps/
    ├── app-of-apps.yaml
    └── infrastructure.yaml
```

## ArgoCD App-of-Apps Pattern

```yaml
# argocd-apps/app-of-apps.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: unit-talk-apps
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/unit-talk/gitops
    targetRevision: main
    path: apps
  destination:
    server: https://kubernetes.default.svc
    namespace: unit-talk
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

## Rollback Procedure

```mermaid
flowchart TD
    Alert[🚨 SLO Alert Triggered]
    Alert --> Investigate{Quick Investigation<br/>2-minute window}

    Investigate -->|Confirmed Issue| Rollback[Initiate Rollback]
    Investigate -->|False Alarm| Monitor[Continue Monitoring]

    Rollback --> Method{Rollback Method?}

    Method --> Git[Git Revert<br/>Revert manifest commit]
    Method --> ArgoCD[ArgoCD UI<br/>Rollback to previous sync]
    Method --> Kubectl[kubectl<br/>kubectl rollout undo]

    Git --> Sync[ArgoCD Auto-Sync]
    ArgoCD --> Apply[Immediate Apply]
    Kubectl --> Apply

    Apply --> Verify[Verify Health Checks]
    Verify --> Success{SLO Restored?}

    Success -->|Yes| Postmortem[📝 Incident Postmortem]
    Success -->|No| Emergency[🚨 Escalate to SRE]

    style Alert fill:#ffebee
    style Rollback fill:#fff3e0
    style Success fill:#e8f5e9
    style Emergency fill:#ff5252
```

**Rollback Commands**:
```bash
# Method 1: Git revert (preferred)
git revert HEAD
git push origin main
# ArgoCD will auto-sync in 3 minutes

# Method 2: ArgoCD CLI
argocd app rollback unit-talk-api <revision-id>

# Method 3: kubectl
kubectl rollout undo deployment/api -n unit-talk

# Verify rollback
kubectl rollout status deployment/api -n unit-talk
```

## Deployment Metrics

Key metrics tracked during deployment:

```yaml
# Prometheus alerts for deployment validation
groups:
  - name: deployment
    rules:
      - alert: HighErrorRateDuringDeployment
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) /
          rate(http_requests_total[5m]) > 0.01
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate >1% during deployment"

      - alert: HighLatencyDuringDeployment
        expr: |
          histogram_quantile(0.95,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 0.2
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "p95 latency >200ms during deployment"

      - alert: PodCrashLoopBackOff
        expr: |
          rate(kube_pod_container_status_restarts_total[10m]) > 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod restarting frequently"
```

## Rendering Instructions

```bash
# Render GitOps flow diagrams
mmdc -i 05-gitops-flow.md -o 05-gitops-flow.png -w 3200 -H 2400 -b white
mmdc -i 05-gitops-flow.md -o 05-gitops-flow.svg -b white
```

## Deployment Checklist

Before every production deployment:

- [ ] All CI checks passing (lint, tests, security)
- [ ] Code reviewed and approved (2+ approvers)
- [ ] Staging environment tested (smoke + E2E)
- [ ] Database migrations tested (if applicable)
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Customer communication sent (if breaking changes)
- [ ] Monitoring dashboards ready
- [ ] SLO alerts configured
