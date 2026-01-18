# Unit Talk Platform - DigitalOcean Kubernetes (DOKS) Infrastructure
# Production-grade Terraform configuration for DO deployment
# Date: 2025-01-24

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.34"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12"
    }
  }
  
  backend "s3" {
    # DigitalOcean Spaces backend (S3-compatible)
    endpoint                    = "https://nyc3.digitaloceanspaces.com"
    region                      = "us-east-1" # Required but not used by Spaces
    bucket                      = "unit-talk-terraform-state"
    key                         = "doks/terraform.tfstate"
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
  }
}

provider "digitalocean" {
  token = var.do_token
}

# Data sources
data "digitalocean_kubernetes_versions" "current" {
  version_prefix = var.kubernetes_version_prefix
}

# Local variables
locals {
  cluster_name = "${var.project_name}-${var.environment}"
  
  common_tags = [
    "project:${var.project_name}",
    "environment:${var.environment}",
    "managed-by:terraform",
    "team:engineering"
  ]
  
  node_pools = {
    system = {
      name       = "system-pool"
      size       = "s-2vcpu-4gb"
      node_count = 3
      auto_scale = true
      min_nodes  = 3
      max_nodes  = 5
      labels = {
        "workload-type" = "system"
      }
      taints = []
    }
    
    application = {
      name       = "app-pool"
      size       = "s-4vcpu-8gb"
      node_count = 3
      auto_scale = true
      min_nodes  = 3
      max_nodes  = 10
      labels = {
        "workload-type" = "application"
      }
      taints = []
    }
    
    workers = {
      name       = "worker-pool"
      size       = "c-4"
      node_count = 2
      auto_scale = true
      min_nodes  = 2
      max_nodes  = 8
      labels = {
        "workload-type" = "workers"
      }
      taints = [{
        key    = "workload-type"
        value  = "workers"
        effect = "NoSchedule"
      }]
    }
  }
}

# DOKS Cluster
resource "digitalocean_kubernetes_cluster" "main" {
  name    = local.cluster_name
  region  = var.region
  version = data.digitalocean_kubernetes_versions.current.latest_version
  
  tags = local.common_tags
  
  # System node pool (required)
  node_pool {
    name       = local.node_pools.system.name
    size       = local.node_pools.system.size
    node_count = local.node_pools.system.node_count
    auto_scale = local.node_pools.system.auto_scale
    min_nodes  = local.node_pools.system.min_nodes
    max_nodes  = local.node_pools.system.max_nodes
    labels     = local.node_pools.system.labels
    tags       = local.common_tags
  }
  
  # Enable maintenance window
  maintenance_policy {
    day        = "sunday"
    start_time = "04:00"
  }
  
  # Enable auto-upgrade
  auto_upgrade = var.auto_upgrade_enabled
  
  # Enable surge upgrade
  surge_upgrade = true
  
  # Enable HA control plane for production
  ha = var.environment == "production" ? true : false
}

# Application node pool
resource "digitalocean_kubernetes_node_pool" "application" {
  cluster_id = digitalocean_kubernetes_cluster.main.id
  
  name       = local.node_pools.application.name
  size       = local.node_pools.application.size
  node_count = local.node_pools.application.node_count
  auto_scale = local.node_pools.application.auto_scale
  min_nodes  = local.node_pools.application.min_nodes
  max_nodes  = local.node_pools.application.max_nodes
  labels     = local.node_pools.application.labels
  tags       = local.common_tags
}

# Worker node pool (for Temporal, background jobs)
resource "digitalocean_kubernetes_node_pool" "workers" {
  cluster_id = digitalocean_kubernetes_cluster.main.id
  
  name       = local.node_pools.workers.name
  size       = local.node_pools.workers.size
  node_count = local.node_pools.workers.node_count
  auto_scale = local.node_pools.workers.auto_scale
  min_nodes  = local.node_pools.workers.min_nodes
  max_nodes  = local.node_pools.workers.max_nodes
  labels     = local.node_pools.workers.labels
  tags       = local.common_tags
  
  dynamic "taint" {
    for_each = local.node_pools.workers.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }
}

# DO Managed PostgreSQL Database
resource "digitalocean_database_cluster" "postgres" {
  name       = "${local.cluster_name}-postgres"
  engine     = "pg"
  version    = var.postgres_version
  size       = var.postgres_node_size
  region     = var.region
  node_count = var.postgres_node_count
  
  tags = local.common_tags
  
  # Enable maintenance window
  maintenance_window {
    day  = "sunday"
    hour = "04:00:00"
  }
  
  # Enable backups
  backup_restore {
    database_name = var.postgres_database_name
  }
}

# PostgreSQL Database
resource "digitalocean_database_db" "main" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = var.postgres_database_name
}

# PostgreSQL User
resource "digitalocean_database_user" "app" {
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "unit_talk_app"
}

# PostgreSQL Read Replica (Production only)
resource "digitalocean_database_replica" "postgres_read" {
  count      = var.environment == "production" ? 1 : 0
  cluster_id = digitalocean_database_cluster.postgres.id
  name       = "${local.cluster_name}-postgres-read"
  size       = var.postgres_node_size
  region     = var.region
  
  tags = local.common_tags
}

# DO Managed Redis
resource "digitalocean_database_cluster" "redis" {
  name       = "${local.cluster_name}-redis"
  engine     = "redis"
  version    = var.redis_version
  size       = var.redis_node_size
  region     = var.region
  node_count = 1
  
  tags = local.common_tags
  
  # Enable maintenance window
  maintenance_window {
    day  = "sunday"
    hour = "05:00:00"
  }
  
  # Enable eviction policy
  eviction_policy = "allkeys_lru"
}

# DO Spaces Bucket (S3-compatible object storage)
resource "digitalocean_spaces_bucket" "main" {
  name   = "${var.project_name}-${var.environment}-assets"
  region = var.spaces_region
  
  # Enable versioning
  versioning {
    enabled = true
  }
  
  # CORS configuration for frontend access
  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.allowed_origins
    max_age_seconds = 3600
  }
}

# DO Container Registry
resource "digitalocean_container_registry" "main" {
  name                   = var.project_name
  subscription_tier_slug = var.registry_tier
  region                 = var.region
}

# DO Load Balancer
resource "digitalocean_loadbalancer" "main" {
  name   = "${local.cluster_name}-lb"
  region = var.region
  
  forwarding_rule {
    entry_port     = 443
    entry_protocol = "https"
    
    target_port     = 80
    target_protocol = "http"
    
    certificate_name = var.ssl_certificate_name
    tls_passthrough  = false
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
    check_interval_seconds   = 10
    response_timeout_seconds = 5
    unhealthy_threshold      = 3
    healthy_threshold        = 2
  }
  
  # Sticky sessions for WebSocket support
  sticky_sessions {
    type               = "cookies"
    cookie_name        = "lb-session"
    cookie_ttl_seconds = 300
  }
  
  # Enable proxy protocol
  enable_proxy_protocol = true
  
  # Enable backend keepalive
  enable_backend_keepalive = true
  
  tags = local.common_tags
}

# DO Firewall
resource "digitalocean_firewall" "cluster" {
  name = "${local.cluster_name}-firewall"
  
  tags = local.common_tags
  
  # Inbound rules
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  inbound_rule {
    protocol         = "tcp"
    port_range       = "80"
    source_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  # Allow DOKS cluster communication
  inbound_rule {
    protocol         = "tcp"
    port_range       = "1-65535"
    source_tags      = local.common_tags
  }
  
  # Outbound rules (allow all)
  outbound_rule {
    protocol              = "tcp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  outbound_rule {
    protocol              = "udp"
    port_range            = "1-65535"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
  
  outbound_rule {
    protocol              = "icmp"
    destination_addresses = ["0.0.0.0/0", "::/0"]
  }
}

# Outputs
output "cluster_id" {
  description = "DOKS cluster ID"
  value       = digitalocean_kubernetes_cluster.main.id
}

output "cluster_endpoint" {
  description = "DOKS cluster endpoint"
  value       = digitalocean_kubernetes_cluster.main.endpoint
  sensitive   = true
}

output "cluster_kubeconfig" {
  description = "DOKS cluster kubeconfig"
  value       = digitalocean_kubernetes_cluster.main.kube_config[0].raw_config
  sensitive   = true
}

output "postgres_host" {
  description = "PostgreSQL host"
  value       = digitalocean_database_cluster.postgres.host
  sensitive   = true
}

output "postgres_port" {
  description = "PostgreSQL port"
  value       = digitalocean_database_cluster.postgres.port
}

output "postgres_database" {
  description = "PostgreSQL database name"
  value       = digitalocean_database_db.main.name
}

output "postgres_user" {
  description = "PostgreSQL user"
  value       = digitalocean_database_user.app.name
}

output "postgres_password" {
  description = "PostgreSQL password"
  value       = digitalocean_database_user.app.password
  sensitive   = true
}

output "redis_host" {
  description = "Redis host"
  value       = digitalocean_database_cluster.redis.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = digitalocean_database_cluster.redis.port
}

output "spaces_bucket_name" {
  description = "Spaces bucket name"
  value       = digitalocean_spaces_bucket.main.name
}

output "spaces_endpoint" {
  description = "Spaces endpoint"
  value       = "https://${digitalocean_spaces_bucket.main.bucket_domain_name}"
}

output "registry_endpoint" {
  description = "Container registry endpoint"
  value       = digitalocean_container_registry.main.endpoint
}

output "loadbalancer_ip" {
  description = "Load balancer IP address"
  value       = digitalocean_loadbalancer.main.ip
}

