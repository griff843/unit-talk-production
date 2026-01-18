# Unit Talk Platform - DigitalOcean Kubernetes (DOKS) Bootstrap Guide
**Date**: 2025-01-24  
**Version**: 1.0  
**Target**: Production & Staging Environments

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [DigitalOcean Account Setup](#digitalocean-account-setup)
3. [Terraform Infrastructure Provisioning](#terraform-infrastructure-provisioning)
4. [Kubernetes Cluster Access](#kubernetes-cluster-access)
5. [ArgoCD Installation](#argocd-installation)
6. [Sealed Secrets Setup](#sealed-secrets-setup)
7. [Observability Stack Deployment](#observability-stack-deployment)
8. [Application Deployment](#application-deployment)
9. [DNS and SSL Configuration](#dns-and-ssl-configuration)
10. [Verification and Testing](#verification-and-testing)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

Install the following tools on your local machine:

```bash
# Terraform (>= 1.0)
brew install terraform  # macOS
# or
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip

# kubectl (>= 1.28)
brew install kubectl  # macOS
# or
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# doctl (DigitalOcean CLI)
brew install doctl  # macOS
# or
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.104.0/doctl-1.104.0-linux-amd64.tar.gz
tar xf doctl-1.104.0-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# Helm (>= 3.12)
brew install helm  # macOS
# or
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# ArgoCD CLI
brew install argocd  # macOS
# or
curl -sSL -o argocd-linux-amd64 https://github.com/argoproj/argo-cd/releases/latest/download/argocd-linux-amd64
sudo install -m 555 argocd-linux-amd64 /usr/local/bin/argocd

# kubeseal (for Sealed Secrets)
brew install kubeseal  # macOS
# or
wget https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.5/kubeseal-0.24.5-linux-amd64.tar.gz
tar xfz kubeseal-0.24.5-linux-amd64.tar.gz
sudo install -m 755 kubeseal /usr/local/bin/kubeseal
```

### Required Credentials

Gather the following credentials before starting:

- **DigitalOcean API Token**: [Create here](https://cloud.digitalocean.com/account/api/tokens)
- **Supabase Credentials**: URL, Anon Key, Service Role Key
- **Discord Bot Token**: From Discord Developer Portal
- **GitHub Personal Access Token**: For ArgoCD repository access
- **Slack Webhook URL**: For alerting (optional)
- **PagerDuty Service Key**: For critical alerts (optional)

---

## DigitalOcean Account Setup

### 1. Create DigitalOcean Account

1. Sign up at [https://www.digitalocean.com](https://www.digitalocean.com)
2. Add payment method
3. Enable 2FA for security

### 2. Generate API Token

```bash
# Navigate to: https://cloud.digitalocean.com/account/api/tokens
# Click "Generate New Token"
# Name: "unit-talk-terraform"
# Scopes: Read & Write
# Copy the token (you won't see it again!)

# Set environment variable
export DIGITALOCEAN_ACCESS_TOKEN="dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Verify token
doctl auth init --access-token $DIGITALOCEAN_ACCESS_TOKEN
doctl account get
```

### 3. Create Spaces Bucket for Terraform State

```bash
# Create Spaces bucket for Terraform state
doctl spaces create unit-talk-terraform-state --region nyc3

# Verify bucket creation
doctl spaces list
```

### 4. Generate Spaces Access Keys

```bash
# Navigate to: https://cloud.digitalocean.com/account/api/spaces
# Click "Generate New Key"
# Name: "terraform-state-backend"
# Copy Access Key ID and Secret Access Key

# Set environment variables
export AWS_ACCESS_KEY_ID="DO00XXXXXXXXXXXXXXXXXXXX"
export AWS_SECRET_ACCESS_KEY="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## Terraform Infrastructure Provisioning

### 1. Configure Terraform Variables

```bash
cd infrastructure/doks

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

**terraform.tfvars** (Production):
```hcl
do_token = "dop_v1_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

project_name = "unit-talk"
environment  = "production"

region        = "nyc3"
spaces_region = "nyc3"

kubernetes_version_prefix = "1.28."
auto_upgrade_enabled      = true

postgres_version      = "15"
postgres_node_size    = "db-s-4vcpu-8gb"
postgres_node_count   = 2
postgres_database_name = "unit_talk_production"

redis_version   = "7"
redis_node_size = "db-s-2vcpu-4gb"

registry_tier = "professional"

allowed_origins = [
  "https://unit-talk.com",
  "https://www.unit-talk.com",
  "https://app.unit-talk.com",
  "https://command-center.unit-talk.com"
]
```

### 2. Initialize Terraform

```bash
# Initialize Terraform with DO Spaces backend
terraform init

# Verify initialization
terraform version
terraform providers
```

### 3. Plan Infrastructure

```bash
# Review planned changes
terraform plan -out=tfplan

# Review the plan carefully:
# - DOKS cluster with 3 node pools
# - DO Managed Postgres (2 nodes + read replica)
# - DO Managed Redis
# - DO Container Registry
# - DO Spaces bucket
# - DO Load Balancer
# - DO Firewall
```

### 4. Apply Infrastructure

```bash
# Apply the plan
terraform apply tfplan

# This will take 15-20 minutes to provision all resources
# Monitor progress in DigitalOcean console: https://cloud.digitalocean.com

# Save outputs
terraform output -json > terraform-outputs.json
```

### 5. Verify Infrastructure

```bash
# Verify DOKS cluster
doctl kubernetes cluster list

# Verify databases
doctl databases list

# Verify container registry
doctl registry get

# Verify Spaces bucket
doctl spaces list

# Verify load balancer
doctl compute load-balancer list
```

---

## Kubernetes Cluster Access

### 1. Configure kubectl

```bash
# Get cluster ID from Terraform output
CLUSTER_ID=$(terraform output -raw cluster_id)

# Download kubeconfig
doctl kubernetes cluster kubeconfig save $CLUSTER_ID

# Verify cluster access
kubectl cluster-info
kubectl get nodes

# Expected output: 8 nodes (3 system + 3 application + 2 workers)
```

### 2. Create Namespaces

```bash
# Create required namespaces
kubectl create namespace unit-talk
kubectl create namespace argocd
kubectl create namespace monitoring
kubectl create namespace ingress-nginx
kubectl create namespace cert-manager
kubectl create namespace external-dns

# Verify namespaces
kubectl get namespaces
```

### 3. Configure Container Registry Access

```bash
# Get registry endpoint
REGISTRY_ENDPOINT=$(terraform output -raw registry_endpoint)

# Create registry credentials
doctl registry kubernetes-manifest | kubectl apply -f -

# Verify secret creation
kubectl get secret regcred -n unit-talk
```

---

## ArgoCD Installation

### 1. Install ArgoCD

```bash
# Install ArgoCD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml

# Wait for ArgoCD to be ready
kubectl wait --for=condition=available --timeout=600s deployment/argocd-server -n argocd

# Get initial admin password
ARGOCD_PASSWORD=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d)
echo "ArgoCD Admin Password: $ARGOCD_PASSWORD"
```

### 2. Access ArgoCD UI

```bash
# Port forward to ArgoCD server
kubectl port-forward svc/argocd-server -n argocd 8080:443

# Open browser to: https://localhost:8080
# Username: admin
# Password: $ARGOCD_PASSWORD

# Or use ArgoCD CLI
argocd login localhost:8080 --username admin --password $ARGOCD_PASSWORD --insecure
```

### 3. Configure ArgoCD Repository

```bash
# Add GitHub repository
argocd repo add https://github.com/griff843/unit-talk-production.git \
  --username griff843 \
  --password $GITHUB_TOKEN \
  --name unit-talk-production

# Verify repository
argocd repo list
```

### 4. Deploy App-of-Apps

```bash
# Apply the root application
kubectl apply -f infrastructure/argocd/bootstrap/app-of-apps.yaml

# Verify application
argocd app list
argocd app get unit-talk-platform

# Sync the application
argocd app sync unit-talk-platform
```

---

## Sealed Secrets Setup

### 1. Install Sealed Secrets Controller

```bash
# Sealed Secrets is installed via ArgoCD (infrastructure.yaml)
# Verify installation
kubectl get pods -n kube-system | grep sealed-secrets

# Get public key for sealing secrets
kubeseal --fetch-cert --controller-name=sealed-secrets-controller --controller-namespace=kube-system > sealed-secrets-pub-cert.pem
```

### 2. Create Sealed Secrets

```bash
# Create secret for Supabase credentials
kubectl create secret generic supabase-credentials \
  --from-literal=url=$SUPABASE_URL \
  --from-literal=anon-key=$SUPABASE_ANON_KEY \
  --from-literal=service-role-key=$SUPABASE_SERVICE_ROLE_KEY \
  --dry-run=client -o yaml | \
  kubeseal --cert sealed-secrets-pub-cert.pem --format yaml > infrastructure/kubernetes/secrets/supabase-sealed.yaml

# Create secret for Discord bot token
kubectl create secret generic discord-credentials \
  --from-literal=token=$DISCORD_BOT_TOKEN \
  --from-literal=client-id=$DISCORD_CLIENT_ID \
  --from-literal=guild-id=$DISCORD_GUILD_ID \
  --dry-run=client -o yaml | \
  kubeseal --cert sealed-secrets-pub-cert.pem --format yaml > infrastructure/kubernetes/secrets/discord-sealed.yaml

# Create secret for database credentials
POSTGRES_HOST=$(terraform output -raw postgres_host)
POSTGRES_PASSWORD=$(terraform output -raw postgres_password)
REDIS_HOST=$(terraform output -raw redis_host)

kubectl create secret generic database-credentials \
  --from-literal=postgres-url="postgresql://unit_talk_app:$POSTGRES_PASSWORD@$POSTGRES_HOST:25060/unit_talk_production?sslmode=require" \
  --from-literal=redis-url="redis://$REDIS_HOST:25061" \
  --dry-run=client -o yaml | \
  kubeseal --cert sealed-secrets-pub-cert.pem --format yaml > infrastructure/kubernetes/secrets/database-sealed.yaml

# Apply sealed secrets
kubectl apply -f infrastructure/kubernetes/secrets/
```

### 3. Verify Sealed Secrets

```bash
# Check sealed secrets
kubectl get sealedsecrets -n unit-talk

# Verify secrets were created
kubectl get secrets -n unit-talk
```

---

## Observability Stack Deployment

### 1. Deploy Prometheus & Grafana

```bash
# Observability stack is deployed via ArgoCD (observability.yaml)
# Verify deployment
kubectl get pods -n monitoring

# Wait for all pods to be ready
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n monitoring --timeout=600s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n monitoring --timeout=600s
```

### 2. Access Grafana

```bash
# Get Grafana admin password
GRAFANA_PASSWORD=$(kubectl get secret -n monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d)
echo "Grafana Admin Password: $GRAFANA_PASSWORD"

# Port forward to Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Open browser to: http://localhost:3000
# Username: admin
# Password: $GRAFANA_PASSWORD
```

### 3. Configure Dashboards

```bash
# Dashboards are automatically provisioned via Helm values
# Verify dashboards in Grafana UI:
# - Kubernetes Cluster (ID: 7249)
# - NGINX Ingress (ID: 9614)
# - PostgreSQL (ID: 9628)
# - Redis (ID: 11835)
```

---

## Application Deployment

### 1. Build and Push Container Images

```bash
# Login to DO Container Registry
doctl registry login

# Build and push images
REGISTRY_ENDPOINT=$(terraform output -raw registry_endpoint)

# API
docker build -t $REGISTRY_ENDPOINT/api:latest -f apps/api/Dockerfile apps/api
docker push $REGISTRY_ENDPOINT/api:latest

# Command Center
docker build -t $REGISTRY_ENDPOINT/command-center:latest -f apps/command-center/Dockerfile apps/command-center
docker push $REGISTRY_ENDPOINT/command-center:latest

# Dashboard
docker build -t $REGISTRY_ENDPOINT/dashboard:latest -f apps/dashboard/Dockerfile apps/dashboard
docker push $REGISTRY_ENDPOINT/dashboard:latest

# Smart Form
docker build -t $REGISTRY_ENDPOINT/smart-form:latest -f apps/smart-form/Dockerfile apps/smart-form
docker push $REGISTRY_ENDPOINT/smart-form:latest

# Discord Bot
docker build -t $REGISTRY_ENDPOINT/discord-bot:latest -f apps/discord-bot/Dockerfile apps/discord-bot
docker push $REGISTRY_ENDPOINT/discord-bot:latest

# Workers
docker build -t $REGISTRY_ENDPOINT/workers:latest -f apps/worker/Dockerfile apps/worker
docker push $REGISTRY_ENDPOINT/workers:latest
```

### 2. Deploy Applications via ArgoCD

```bash
# Applications are deployed via ArgoCD (unit-talk-services.yaml)
# Sync all applications
argocd app sync unit-talk-api
argocd app sync unit-talk-command-center
argocd app sync unit-talk-dashboard
argocd app sync unit-talk-smart-form
argocd app sync unit-talk-discord-bot
argocd app sync unit-talk-workers

# Verify deployments
kubectl get pods -n unit-talk
kubectl get svc -n unit-talk
kubectl get ingress -n unit-talk
```

---

## DNS and SSL Configuration

### 1. Configure DNS Records

```bash
# Get load balancer IP
LB_IP=$(terraform output -raw loadbalancer_ip)

# Add DNS A records in your DNS provider:
# api.unit-talk.com          -> $LB_IP
# app.unit-talk.com          -> $LB_IP
# command-center.unit-talk.com -> $LB_IP
# *.unit-talk.com            -> $LB_IP (wildcard)
```

### 2. Create Let's Encrypt ClusterIssuer

```bash
# Apply ClusterIssuer for Let's Encrypt
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: engineering@unit-talk.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

# Verify ClusterIssuer
kubectl get clusterissuer
```

### 3. Verify SSL Certificates

```bash
# Check certificate status
kubectl get certificates -n unit-talk
kubectl describe certificate unit-talk-tls -n unit-talk

# Wait for certificates to be ready
kubectl wait --for=condition=ready certificate/unit-talk-tls -n unit-talk --timeout=600s
```

---

## Verification and Testing

### 1. Health Checks

```bash
# Test API health endpoint
curl https://api.unit-talk.com/health

# Test Command Center
curl https://command-center.unit-talk.com/api/health

# Test Dashboard
curl https://app.unit-talk.com/api/health
```

### 2. Run Verification Script

```bash
# Create verification script
cat > scripts/ops/verify-deployment.sh <<'EOF'
#!/bin/bash
set -e

echo "🔍 Verifying Unit Talk Platform Deployment..."

# Check cluster health
echo "✅ Checking cluster health..."
kubectl get nodes

# Check namespaces
echo "✅ Checking namespaces..."
kubectl get ns

# Check applications
echo "✅ Checking applications..."
kubectl get pods -n unit-talk
kubectl get svc -n unit-talk
kubectl get ingress -n unit-talk

# Check observability
echo "✅ Checking observability stack..."
kubectl get pods -n monitoring

# Check infrastructure
echo "✅ Checking infrastructure..."
kubectl get pods -n ingress-nginx
kubectl get pods -n cert-manager

# Test endpoints
echo "✅ Testing endpoints..."
curl -f https://api.unit-talk.com/health || echo "❌ API health check failed"
curl -f https://command-center.unit-talk.com/api/health || echo "❌ Command Center health check failed"

echo "✅ Deployment verification complete!"
EOF

chmod +x scripts/ops/verify-deployment.sh
./scripts/ops/verify-deployment.sh
```

---

## Troubleshooting

### Common Issues

**Issue**: Pods stuck in `Pending` state
```bash
# Check node resources
kubectl describe nodes

# Check pod events
kubectl describe pod <pod-name> -n unit-talk

# Solution: Scale up node pool or adjust resource requests
```

**Issue**: SSL certificate not issuing
```bash
# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Check certificate status
kubectl describe certificate <cert-name> -n unit-talk

# Solution: Verify DNS records and ClusterIssuer configuration
```

**Issue**: ArgoCD sync failures
```bash
# Check application status
argocd app get <app-name>

# Check sync logs
argocd app logs <app-name>

# Solution: Verify repository access and manifest syntax
```

---

## Next Steps

1. **Configure Monitoring Alerts**: Set up Slack/PagerDuty integrations
2. **Implement Backup Strategy**: Configure automated database backups
3. **Set Up CI/CD**: Update GitHub Actions to deploy to DOKS
4. **Performance Testing**: Run load tests and optimize resources
5. **Security Hardening**: Implement Network Policies and RBAC
6. **Disaster Recovery**: Test backup and restore procedures

---

**Documentation Owner**: Engineering Team  
**Last Updated**: 2025-01-24  
**Next Review**: After production deployment  
**Status**: 🚀 READY FOR DEPLOYMENT

