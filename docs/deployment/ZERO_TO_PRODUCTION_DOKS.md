# From-Zero-to-Production: Complete DOKS Deployment Runbook

## Overview

This runbook guides you through deploying the Unit Talk platform from scratch on DigitalOcean Kubernetes (DOKS), from initial infrastructure setup to production-ready deployment.

**Timeline**: ~4 hours for complete setup
**Prerequisites**: DigitalOcean account, GitHub account, domain name, local development tools

---

## Table of Contents

1. [Prerequisites and Setup](#1-prerequisites-and-setup)
2. [DigitalOcean Infrastructure](#2-digitalocean-infrastructure)
3. [DOKS Cluster Bootstrap](#3-doks-cluster-bootstrap)
4. [Core Services Installation](#4-core-services-installation)
5. [GitOps with ArgoCD](#5-gitops-with-argocd)
6. [Database Setup](#6-database-setup)
7. [Application Deployment](#7-application-deployment)
8. [Observability Stack](#8-observability-stack)
9. [Security and Secrets](#9-security-and-secrets)
10. [DNS and TLS](#10-dns-and-tls)
11. [CI/CD Pipeline](#11-cicd-pipeline)
12. [Production Validation](#12-production-validation)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites and Setup

### 1.1 Local Development Tools

Install the following tools on your local machine:

```bash
# macOS
brew install doctl kubectl helm terraform argocd

# Linux (Ubuntu/Debian)
curl -sL https://github.com/digitalocean/doctl/releases/download/v1.98.0/doctl-1.98.0-linux-amd64.tar.gz | tar -xzv
sudo mv doctl /usr/local/bin
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Windows
choco install doctl kubernetes-cli kubernetes-helm terraform argocd-cli
```

**Tool Versions**:
- `doctl`: v1.98+
- `kubectl`: v1.28+
- `helm`: v3.12+
- `terraform`: v1.5+
- `argocd`: v2.8+

### 1.2 DigitalOcean Account Setup

```bash
# Create API token: https://cloud.digitalocean.com/account/api/tokens
export DO_TOKEN="your_digitalocean_api_token"

# Authenticate doctl
doctl auth init --access-token $DO_TOKEN

# Verify authentication
doctl account get
```

### 1.3 GitHub Repository Setup

```bash
# Clone the Unit Talk repositories
git clone https://github.com/unit-talk/unit-talk-production.git
git clone https://github.com/unit-talk/unit-talk-gitops.git

cd unit-talk-production
```

### 1.4 Environment Variables

Create a `.env.production` file:

```bash
# DigitalOcean
DO_TOKEN="your_do_token"
DO_REGION="nyc3"
DO_CLUSTER_NAME="unit-talk-production"

# Database
DB_USER="unit_talk_admin"
DB_PASSWORD="$(openssl rand -base64 32)"
DB_NAME="unit_talk_production"

# Application
APP_ENV="production"
APP_SECRET_KEY="$(openssl rand -base64 32)"
JWT_SECRET="$(openssl rand -base64 32)"

# External Services
STRIPE_API_KEY="sk_live_..."
OPENAI_API_KEY="sk-..."
DISCORD_BOT_TOKEN="..."

# Domain
DOMAIN="unittalk.com"
API_DOMAIN="api.unittalk.com"
```

---

## 2. DigitalOcean Infrastructure

### 2.1 Create VPC Network

```bash
# Create VPC for cluster isolation
doctl vpcs create \
  --name unit-talk-vpc \
  --description "Unit Talk Production VPC" \
  --region nyc3 \
  --ip-range 10.244.0.0/16

# Save VPC ID
export VPC_ID=$(doctl vpcs list --format ID --no-header | head -1)
echo "VPC_ID=$VPC_ID" >> .env.production
```

### 2.2 Setup Container Registry

```bash
# Create DO Container Registry (DOCR)
doctl registry create unit-talk

# Login to registry
doctl registry login

# Verify login
docker info | grep Registry
```

### 2.3 Create Spaces Bucket (Object Storage)

```bash
# Create Spaces bucket for storage
doctl compute space create unit-talk-storage \
  --region nyc3 \
  --access-key $DO_SPACES_KEY \
  --secret-key $DO_SPACES_SECRET

# Enable CDN
doctl compute space cdn enable unit-talk-storage

# Get CDN endpoint
export CDN_ENDPOINT=$(doctl compute space cdn list --format Endpoint --no-header)
echo "CDN_ENDPOINT=$CDN_ENDPOINT" >> .env.production
```

---

## 3. DOKS Cluster Bootstrap

### 3.1 Terraform Configuration

Create `terraform/doks-cluster.tf`:

```hcl
terraform {
  required_version = ">= 1.5"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.29"
    }
  }

  backend "s3" {
    endpoint                    = "nyc3.digitaloceanspaces.com"
    key                         = "terraform/state"
    bucket                      = "unit-talk-terraform-state"
    region                      = "us-east-1"  # Dummy value required by AWS provider
    skip_credentials_validation = true
    skip_metadata_api_check     = true
  }
}

provider "digitalocean" {
  token = var.do_token
}

# DOKS Cluster
resource "digitalocean_kubernetes_cluster" "unit_talk" {
  name    = "unit-talk-production"
  region  = "nyc3"
  version = "1.28.2-do.0"

  vpc_uuid = var.vpc_id

  node_pool {
    name       = "worker-pool"
    size       = "s-4vcpu-8gb"
    auto_scale = true
    min_nodes  = 3
    max_nodes  = 20
    labels = {
      workload = "general"
    }
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
    taints {
      key    = "workload"
      value  = "ai-inference"
      effect = "NoSchedule"
    }
  }

  tags = ["production", "unit-talk"]
}

# Managed PostgreSQL
resource "digitalocean_database_cluster" "postgres" {
  name       = "unit-talk-db"
  engine     = "pg"
  version    = "16"
  size       = "db-s-4vcpu-8gb"
  region     = "nyc3"
  node_count = 3  # HA cluster

  private_network_uuid = var.vpc_id

  tags = ["production", "database"]
}

resource "digitalocean_database_db" "unit_talk" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "unit_talk_production"
}

resource "digitalocean_database_user" "app_user" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "unit_talk_app"
}

# Managed Redis
resource "digitalocean_database_cluster" "redis" {
  name       = "unit-talk-redis"
  engine     = "redis"
  version    = "7"
  size       = "db-s-2vcpu-4gb"
  region     = "nyc3"
  node_count = 2  # Primary + replica

  private_network_uuid = var.vpc_id

  tags = ["production", "cache"]
}

# Load Balancer
resource "digitalocean_loadbalancer" "public" {
  name   = "unit-talk-lb"
  region = "nyc3"

  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"

    target_port     = 80
    target_protocol = "http"

    certificate_name = digitalocean_certificate.main.name
  }

  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"

    target_port     = 80
    target_protocol = "http"
  }

  healthcheck {
    port     = 80
    protocol = "http"
    path     = "/health"
  }

  vpc_uuid = var.vpc_id
}

# Outputs
output "cluster_id" {
  value = digitalocean_kubernetes_cluster.unit_talk.id
}

output "cluster_endpoint" {
  value = digitalocean_kubernetes_cluster.unit_talk.endpoint
}

output "database_host" {
  value     = digitalocean_database_cluster.postgres.host
  sensitive = true
}

output "database_port" {
  value = digitalocean_database_cluster.postgres.port
}

output "redis_host" {
  value     = digitalocean_database_cluster.redis.host
  sensitive = true
}
```

### 3.2 Deploy Infrastructure

```bash
cd terraform/

# Initialize Terraform
terraform init

# Plan deployment
terraform plan \
  -var "do_token=$DO_TOKEN" \
  -var "vpc_id=$VPC_ID" \
  -out=tfplan

# Apply (creates cluster + databases)
terraform apply tfplan

# Save outputs
terraform output -json > ../outputs.json

# Get kubeconfig
doctl kubernetes cluster kubeconfig save unit-talk-production

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

**Expected Output**:
```
NAME                           STATUS   ROLES    AGE   VERSION
worker-pool-abc123             Ready    <none>   2m    v1.28.2
worker-pool-def456             Ready    <none>   2m    v1.28.2
worker-pool-ghi789             Ready    <none>   2m    v1.28.2
```

---

## 4. Core Services Installation

### 4.1 Install NGINX Ingress Controller

```bash
# Add NGINX Ingress Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Create namespace
kubectl create namespace ingress-nginx

# Install NGINX Ingress with DO Load Balancer
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --set controller.service.type=LoadBalancer \
  --set controller.service.annotations."service\.beta\.kubernetes\.io/do-loadbalancer-name"="unit-talk-lb" \
  --set controller.metrics.enabled=true \
  --set controller.podAnnotations."prometheus\.io/scrape"="true" \
  --set controller.podAnnotations."prometheus\.io/port"="10254"

# Wait for Load Balancer IP
kubectl get svc -n ingress-nginx -w

# Save Load Balancer IP
export LB_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "LB_IP=$LB_IP" >> .env.production
```

### 4.2 Install Cert-Manager (Let's Encrypt)

```bash
# Add Jetstack Helm repo
helm repo add jetstack https://charts.jetstack.io
helm repo update

# Create namespace
kubectl create namespace cert-manager

# Install cert-manager with CRDs
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --set installCRDs=true \
  --set prometheus.enabled=true

# Wait for cert-manager to be ready
kubectl wait --for=condition=Available --timeout=300s \
  deployment/cert-manager -n cert-manager

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@unittalk.com
    privateKeySecretRef:
      name: letsencrypt-production
    solvers:
      - http01:
          ingress:
            class: nginx
EOF
```

### 4.3 Install ExternalDNS (Cloudflare or DO DNS)

```bash
# For DigitalOcean DNS
kubectl create namespace external-dns

kubectl create secret generic digitalocean-dns \
  --from-literal=access-token=$DO_TOKEN \
  -n external-dns

kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
  namespace: external-dns
spec:
  replicas: 1
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
        - name: external-dns
          image: registry.k8s.io/external-dns/external-dns:v0.14.0
          args:
            - --source=ingress
            - --domain-filter=unittalk.com
            - --provider=digitalocean
            - --policy=sync
            - --txt-owner-id=unit-talk-production
          env:
            - name: DO_TOKEN
              valueFrom:
                secretKeyRef:
                  name: digitalocean-dns
                  key: access-token
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
  namespace: external-dns
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
  - apiGroups: [""]
    resources: ["services", "endpoints", "pods"]
    verbs: ["get", "watch", "list"]
  - apiGroups: ["extensions", "networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "watch", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: external-dns
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
  - kind: ServiceAccount
    name: external-dns
    namespace: external-dns
EOF
```

### 4.4 Setup Network Policies

```bash
# Create default deny-all policy
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: unit-talk
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# Allow ingress from NGINX
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-from-ingress
  namespace: unit-talk
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
---
# Allow egress to database
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-to-database
  namespace: unit-talk
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: postgres
      ports:
        - protocol: TCP
          port: 5432
EOF
```

---

## 5. GitOps with ArgoCD

### 5.1 Install ArgoCD

```bash
# Create namespace
kubectl create namespace argocd

# Install ArgoCD
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=Available --timeout=300s \
  deployment/argocd-server -n argocd

# Expose ArgoCD with Ingress
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: argocd-server-ingress
  namespace: argocd
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-production
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - argocd.unittalk.com
      secretName: argocd-tls
  rules:
    - host: argocd.unittalk.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: argocd-server
                port:
                  number: 443
EOF

# Get initial admin password
export ARGOCD_PASSWORD=$(kubectl get secret argocd-initial-admin-secret \
  -n argocd -o jsonpath="{.data.password}" | base64 -d)

echo "ArgoCD URL: https://argocd.unittalk.com"
echo "Username: admin"
echo "Password: $ARGOCD_PASSWORD"

# Login via CLI
argocd login argocd.unittalk.com --username admin --password $ARGOCD_PASSWORD

# Change admin password
argocd account update-password \
  --current-password $ARGOCD_PASSWORD \
  --new-password $(openssl rand -base64 32)
```

### 5.2 Configure ArgoCD for GitOps

```bash
# Add Git repository
argocd repo add https://github.com/unit-talk/unit-talk-gitops \
  --username $GITHUB_USERNAME \
  --password $GITHUB_TOKEN

# Create App-of-Apps
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: unit-talk-apps
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/unit-talk/unit-talk-gitops
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
EOF

# Verify sync status
argocd app list
argocd app get unit-talk-apps
```

---

## 6. Database Setup

### 6.1 Get Database Credentials from Terraform

```bash
# Extract database connection details
export DB_HOST=$(terraform output -raw database_host)
export DB_PORT=$(terraform output -raw database_port)
export DB_PASSWORD=$(terraform output -raw database_password)

# Create Kubernetes secret for database
kubectl create namespace unit-talk

kubectl create secret generic database-credentials \
  --from-literal=host=$DB_HOST \
  --from-literal=port=$DB_PORT \
  --from-literal=username=unit_talk_app \
  --from-literal=password=$DB_PASSWORD \
  --from-literal=database=unit_talk_production \
  -n unit-talk
```

### 6.2 Run Database Migrations

```bash
# Create migration job
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration
  namespace: unit-talk
spec:
  template:
    spec:
      containers:
        - name: migrate
          image: registry.digitalocean.com/unit-talk/api:latest
          command: ["npm", "run", "db:migrate"]
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
      restartPolicy: OnFailure
  backoffLimit: 3
EOF

# Watch migration progress
kubectl logs -f job/db-migration -n unit-talk

# Verify migration
kubectl exec -it deployment/api -n unit-talk -- npm run db:status
```

### 6.3 Setup Database Backups

```bash
# Create CronJob for daily backups
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: unit-talk
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: postgres:16
              command:
                - /bin/sh
                - -c
                - |
                  pg_dump -h \$DB_HOST -U \$DB_USER -d \$DB_NAME \
                  | gzip > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql.gz
                  aws s3 cp /backup/*.sql.gz s3://unit-talk-backups/
              env:
                - name: DB_HOST
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: host
                - name: DB_USER
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: username
                - name: PGPASSWORD
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: password
                - name: DB_NAME
                  valueFrom:
                    secretKeyRef:
                      name: database-credentials
                      key: database
                - name: AWS_ACCESS_KEY_ID
                  valueFrom:
                    secretKeyRef:
                      name: spaces-credentials
                      key: access-key
                - name: AWS_SECRET_ACCESS_KEY
                  valueFrom:
                    secretKeyRef:
                      name: spaces-credentials
                      key: secret-key
              volumeMounts:
                - name: backup
                  mountPath: /backup
          restartPolicy: OnFailure
          volumes:
            - name: backup
              emptyDir: {}
EOF
```

---

## 7. Application Deployment

### 7.1 Deploy API Service

```bash
# Create deployment manifest
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: unit-talk
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: registry.digitalocean.com/unit-talk/api:latest
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: unit-talk
spec:
  selector:
    app: api
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: unit-talk
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-production
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.unittalk.com
      secretName: api-tls
  rules:
    - host: api.unittalk.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
EOF

# Verify deployment
kubectl get deployments -n unit-talk
kubectl get pods -n unit-talk
kubectl get ingress -n unit-talk
```

### 7.2 Deploy Worker Services

```bash
# Deploy Grading Agent (Temporal Worker)
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grading-agent
  namespace: unit-talk
spec:
  replicas: 5
  selector:
    matchLabels:
      app: grading-agent
  template:
    metadata:
      labels:
        app: grading-agent
    spec:
      containers:
        - name: worker
          image: registry.digitalocean.com/unit-talk/grading-agent:latest
          env:
            - name: TEMPORAL_ADDRESS
              value: temporal:7233
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: url
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
EOF
```

### 7.3 Setup Horizontal Pod Autoscaling

```bash
# Create HPA for API service
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
  namespace: unit-talk
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 20
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
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
EOF
```

---

## 8. Observability Stack

### 8.1 Install Prometheus + Grafana (kube-prometheus-stack)

```bash
# Add Prometheus Helm repo
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Create namespace
kubectl create namespace monitoring

# Install kube-prometheus-stack
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=100Gi \
  --set grafana.adminPassword=$(openssl rand -base64 32) \
  --set grafana.ingress.enabled=true \
  --set grafana.ingress.hosts[0]=grafana.unittalk.com \
  --set grafana.ingress.annotations."cert-manager\.io/cluster-issuer"=letsencrypt-production \
  --set grafana.ingress.tls[0].secretName=grafana-tls \
  --set grafana.ingress.tls[0].hosts[0]=grafana.unittalk.com

# Get Grafana password
export GRAFANA_PASSWORD=$(kubectl get secret prometheus-grafana \
  -n monitoring -o jsonpath="{.data.admin-password}" | base64 -d)

echo "Grafana URL: https://grafana.unittalk.com"
echo "Username: admin"
echo "Password: $GRAFANA_PASSWORD"
```

### 8.2 Install Loki (Logging)

```bash
# Add Grafana Loki Helm repo
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

# Install Loki
helm install loki grafana/loki-stack \
  --namespace monitoring \
  --set loki.persistence.enabled=true \
  --set loki.persistence.size=50Gi \
  --set promtail.enabled=true \
  --set grafana.enabled=false  # Already installed

# Add Loki as Grafana data source (automatic)
```

### 8.3 Install Tempo (Tracing)

```bash
# Install Tempo
helm install tempo grafana/tempo \
  --namespace monitoring \
  --set tempo.retention=168h  # 7 days

# Configure Grafana to use Tempo
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-datasources
  namespace: monitoring
data:
  tempo.yaml: |
    apiVersion: 1
    datasources:
      - name: Tempo
        type: tempo
        access: proxy
        url: http://tempo:3100
        isDefault: false
EOF
```

### 8.4 Install OpenTelemetry Collector

```bash
# Add OpenTelemetry Helm repo
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Install OpenTelemetry Collector
helm install opentelemetry-collector open-telemetry/opentelemetry-collector \
  --namespace monitoring \
  --set mode=deployment \
  --set config.exporters.prometheus.endpoint="0.0.0.0:8889" \
  --set config.exporters.loki.endpoint="http://loki:3100/loki/api/v1/push" \
  --set config.exporters.tempo.endpoint="tempo:4317"
```

---

## 9. Security and Secrets

### 9.1 Install Sealed Secrets (GitOps-friendly secrets)

```bash
# Install Sealed Secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Install kubeseal CLI
wget https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/kubeseal-0.24.0-linux-amd64.tar.gz
tar -xzf kubeseal-0.24.0-linux-amd64.tar.gz
sudo mv kubeseal /usr/local/bin/

# Create sealed secret
echo -n "my-secret-value" | kubectl create secret generic my-secret \
  --dry-run=client --from-file=secret=/dev/stdin -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# Commit sealed secret to Git (safe to commit)
git add sealed-secret.yaml
git commit -m "Add sealed secret"
```

### 9.2 Configure RBAC

```bash
# Create service account for applications
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: unit-talk-app
  namespace: unit-talk
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: unit-talk-app-role
  namespace: unit-talk
rules:
  - apiGroups: [""]
    resources: ["configmaps", "secrets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: unit-talk-app-rolebinding
  namespace: unit-talk
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: unit-talk-app-role
subjects:
  - kind: ServiceAccount
    name: unit-talk-app
    namespace: unit-talk
EOF
```

### 9.3 Enable Pod Security Standards

```bash
# Label namespace with Pod Security Standard
kubectl label namespace unit-talk \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

---

## 10. DNS and TLS

### 10.1 Configure DNS Records

```bash
# Point domain to Load Balancer IP
doctl compute domain records create unittalk.com \
  --record-type A \
  --record-name api \
  --record-data $LB_IP \
  --record-ttl 300

doctl compute domain records create unittalk.com \
  --record-type A \
  --record-name grafana \
  --record-data $LB_IP \
  --record-ttl 300

doctl compute domain records create unittalk.com \
  --record-type A \
  --record-name argocd \
  --record-data $LB_IP \
  --record-ttl 300

# Verify DNS propagation
dig api.unittalk.com +short
```

### 10.2 Verify TLS Certificates

```bash
# Check certificate status
kubectl get certificates -n unit-talk

# Describe certificate
kubectl describe certificate api-tls -n unit-talk

# Check certificate expiration
openssl s_client -connect api.unittalk.com:443 -servername api.unittalk.com | \
  openssl x509 -noout -dates
```

---

## 11. CI/CD Pipeline

### 11.1 Setup GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to DOCR
        uses: docker/login-action@v2
        with:
          registry: registry.digitalocean.com
          username: ${{ secrets.DOCR_TOKEN }}
          password: ${{ secrets.DOCR_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: .
          push: true
          tags: |
            registry.digitalocean.com/unit-talk/api:${{ github.sha }}
            registry.digitalocean.com/unit-talk/api:latest
          cache-from: type=registry,ref=registry.digitalocean.com/unit-talk/api:buildcache
          cache-to: type=registry,ref=registry.digitalocean.com/unit-talk/api:buildcache,mode=max

      - name: Update GitOps repo
        run: |
          git clone https://github.com/unit-talk/unit-talk-gitops
          cd unit-talk-gitops
          sed -i "s|image: .*|image: registry.digitalocean.com/unit-talk/api:${{ github.sha }}|" apps/api/base/deployment.yaml
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add .
          git commit -m "Update API image to ${{ github.sha }}"
          git push
```

### 11.2 Setup ArgoCD Image Updater (Optional)

```bash
# Install ArgoCD Image Updater
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj-labs/argocd-image-updater/stable/manifests/install.yaml

# Configure image updater
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-image-updater-config
  namespace: argocd
data:
  registries.conf: |
    registries:
      - name: DigitalOcean Container Registry
        api_url: https://registry.digitalocean.com
        prefix: registry.digitalocean.com
        credentials: pullsecret:argocd/docr-credentials
        default: true
EOF
```

---

## 12. Production Validation

### 12.1 Smoke Tests

```bash
# Test API health endpoint
curl https://api.unittalk.com/health

# Expected: {"status":"healthy","uptime":12345}

# Test authenticated endpoint
curl -H "Authorization: Bearer $JWT_TOKEN" https://api.unittalk.com/api/picks

# Run E2E tests
kubectl run e2e-tests \
  --image=registry.digitalocean.com/unit-talk/e2e-tests:latest \
  --restart=Never \
  -n unit-talk \
  -- npm run test:e2e:production

kubectl logs -f e2e-tests -n unit-talk
```

### 12.2 Performance Tests

```bash
# Install k6 for load testing
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: k6-script
  namespace: unit-talk
data:
  script.js: |
    import http from 'k6/http';
    import { check, sleep } from 'k6';

    export let options = {
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '2m', target: 0 },
      ],
      thresholds: {
        'http_req_duration': ['p(95)<200', 'p(99)<500'],
        'http_req_failed': ['rate<0.01'],
      },
    };

    export default function () {
      let res = http.get('https://api.unittalk.com/api/picks');
      check(res, {
        'status is 200': (r) => r.status === 200,
        'duration < 200ms': (r) => r.timings.duration < 200,
      });
      sleep(1);
    }
---
apiVersion: batch/v1
kind: Job
metadata:
  name: k6-load-test
  namespace: unit-talk
spec:
  template:
    spec:
      containers:
        - name: k6
          image: grafana/k6:latest
          command: ["k6", "run", "/scripts/script.js"]
          volumeMounts:
            - name: script
              mountPath: /scripts
      restartPolicy: Never
      volumes:
        - name: script
          configMap:
            name: k6-script
EOF

# Monitor load test
kubectl logs -f job/k6-load-test -n unit-talk
```

### 12.3 Verify SLO Compliance

```bash
# Check SLO dashboard in Grafana
open https://grafana.unittalk.com/d/slo-dashboard

# Query Prometheus for SLO metrics
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090

# p95 latency
curl 'http://localhost:9090/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m]))'

# Error rate
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m])/rate(http_requests_total[5m])'
```

---

## 13. Troubleshooting

### 13.1 Common Issues

#### Pods not starting

```bash
# Check pod status
kubectl get pods -n unit-talk

# Describe pod to see events
kubectl describe pod <pod-name> -n unit-talk

# Check logs
kubectl logs <pod-name> -n unit-talk

# Common causes:
# - Image pull errors (check DOCR credentials)
# - Resource limits exceeded (check node capacity)
# - ConfigMap/Secret not found (verify secrets)
```

#### Database connection failures

```bash
# Test database connectivity from pod
kubectl run -it --rm psql \
  --image=postgres:16 \
  --restart=Never \
  -n unit-talk \
  -- psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# Check database secret
kubectl get secret database-credentials -n unit-talk -o yaml | grep -E 'host|port|username' | base64 -d
```

#### Ingress not working

```bash
# Check ingress status
kubectl get ingress -n unit-talk

# Check NGINX ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify DNS
dig api.unittalk.com +short

# Check certificate
kubectl get certificate api-tls -n unit-talk
kubectl describe certificate api-tls -n unit-talk
```

### 13.2 Rollback Procedure

```bash
# Rollback deployment via kubectl
kubectl rollout undo deployment/api -n unit-talk

# Rollback via ArgoCD
argocd app rollback unit-talk-api <revision-id>

# Verify rollback
kubectl rollout status deployment/api -n unit-talk
```

### 13.3 Emergency Procedures

#### Scale down to zero (maintenance mode)

```bash
kubectl scale deployment/api --replicas=0 -n unit-talk
```

#### Force pod restart

```bash
kubectl rollout restart deployment/api -n unit-talk
```

#### Delete and recreate pod

```bash
kubectl delete pod <pod-name> -n unit-talk
```

---

## Summary Checklist

Production deployment complete when all checks pass:

- [ ] DOKS cluster operational (3+ nodes)
- [ ] DO Managed PostgreSQL + Redis running
- [ ] NGINX Ingress with Load Balancer IP
- [ ] Cert-Manager issuing Let's Encrypt certificates
- [ ] ArgoCD syncing GitOps repository
- [ ] All applications deployed and healthy
- [ ] Prometheus + Grafana monitoring operational
- [ ] Loki collecting logs
- [ ] Tempo tracing enabled
- [ ] DNS records pointing to Load Balancer
- [ ] TLS certificates valid
- [ ] Smoke tests passing
- [ ] Load tests within SLO targets (<150ms p95)
- [ ] Error rate <0.5%
- [ ] Database backups configured
- [ ] Secrets encrypted with Sealed Secrets
- [ ] RBAC policies enforced
- [ ] Network policies active

---

**Deployment Time**: ~4 hours
**Estimated Monthly Cost**: See [BILL_OF_MATERIALS.md](../architecture/BILL_OF_MATERIALS.md)
**Support**: [GitHub Issues](https://github.com/unit-talk/unit-talk-production/issues)
