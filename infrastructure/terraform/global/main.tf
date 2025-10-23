# =============================================================================
# UNIT TALK PLATFORM - PHASE 10 GLOBAL MULTI-REGION INFRASTRUCTURE
# =============================================================================
# Multi-region deployment across NA, EU, and APAC with Supabase read replicas,
# Cloudflare global load balancing, and zero-downtime deployments.
#
# Regions:
# - NA: us-east-1 (Primary)
# - EU: eu-west-1 (Read Replica)
# - APAC: ap-southeast-1 (Read Replica)
#
# SLO Targets:
# - P95 Latency: < 200ms globally
# - Replication Lag: ≤ 3 seconds
# - Availability: 99.95%
# =============================================================================

terraform {
  required_version = ">= 1.6"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
  
  backend "s3" {
    bucket         = "unit-talk-terraform-global-state"
    key            = "global/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "unit-talk-terraform-locks"
  }
}

# =============================================================================
# PROVIDER CONFIGURATIONS - MULTI-REGION
# =============================================================================

# Primary Region: North America (us-east-1)
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
  
  default_tags {
    tags = {
      Project     = "Unit Talk Platform"
      Environment = var.environment
      Region      = "NA"
      ManagedBy   = "Terraform"
      Phase       = "Phase10-Global"
    }
  }
}

# EU Region: Europe West (eu-west-1)
provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
  
  default_tags {
    tags = {
      Project     = "Unit Talk Platform"
      Environment = var.environment
      Region      = "EU"
      ManagedBy   = "Terraform"
      Phase       = "Phase10-Global"
    }
  }
}

# APAC Region: Asia Pacific Southeast (ap-southeast-1)
provider "aws" {
  alias  = "ap_southeast_1"
  region = "ap-southeast-1"
  
  default_tags {
    tags = {
      Project     = "Unit Talk Platform"
      Environment = var.environment
      Region      = "APAC"
      ManagedBy   = "Terraform"
      Phase       = "Phase10-Global"
    }
  }
}

# Cloudflare for Global Load Balancing
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# =============================================================================
# DATA SOURCES
# =============================================================================

data "aws_caller_identity" "current" {}

data "cloudflare_zone" "main" {
  name = var.domain_name
}

# =============================================================================
# GLOBAL NETWORKING - VPC PEERING
# =============================================================================

module "vpc_na" {
  source = "../modules/vpc"
  providers = {
    aws = aws.us_east_1
  }
  
  region              = "us-east-1"
  vpc_cidr            = "10.0.0.0/16"
  availability_zones  = ["us-east-1a", "us-east-1b", "us-east-1c"]
  public_subnet_cidrs = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  private_subnet_cidrs = ["10.0.11.0/24", "10.0.12.0/24", "10.0.13.0/24"]
  
  tags = {
    Region = "NA"
    Role   = "Primary"
  }
}

module "vpc_eu" {
  source = "../modules/vpc"
  providers = {
    aws = aws.eu_west_1
  }
  
  region              = "eu-west-1"
  vpc_cidr            = "10.1.0.0/16"
  availability_zones  = ["eu-west-1a", "eu-west-1b", "eu-west-1c"]
  public_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  private_subnet_cidrs = ["10.1.11.0/24", "10.1.12.0/24", "10.1.13.0/24"]
  
  tags = {
    Region = "EU"
    Role   = "Replica"
  }
}

module "vpc_apac" {
  source = "../modules/vpc"
  providers = {
    aws = aws.ap_southeast_1
  }
  
  region              = "ap-southeast-1"
  vpc_cidr            = "10.2.0.0/16"
  availability_zones  = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
  public_subnet_cidrs = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  private_subnet_cidrs = ["10.2.11.0/24", "10.2.12.0/24", "10.2.13.0/24"]
  
  tags = {
    Region = "APAC"
    Role   = "Replica"
  }
}

# =============================================================================
# KUBERNETES CLUSTERS - MULTI-REGION EKS
# =============================================================================

module "eks_na" {
  source = "../modules/eks"
  providers = {
    aws = aws.us_east_1
  }
  
  cluster_name    = "unit-talk-na"
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc_na.vpc_id
  subnet_ids      = module.vpc_na.private_subnet_ids
  
  node_groups = {
    api = {
      desired_size = 3
      min_size     = 2
      max_size     = 10
      instance_types = ["t3.large"]
    }
    workers = {
      desired_size = 2
      min_size     = 1
      max_size     = 5
      instance_types = ["t3.medium"]
    }
  }
  
  tags = {
    Region = "NA"
    Role   = "Primary"
  }
}

module "eks_eu" {
  source = "../modules/eks"
  providers = {
    aws = aws.eu_west_1
  }
  
  cluster_name    = "unit-talk-eu"
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc_eu.vpc_id
  subnet_ids      = module.vpc_eu.private_subnet_ids
  
  node_groups = {
    api = {
      desired_size = 2
      min_size     = 1
      max_size     = 8
      instance_types = ["t3.large"]
    }
    workers = {
      desired_size = 1
      min_size     = 1
      max_size     = 4
      instance_types = ["t3.medium"]
    }
  }
  
  tags = {
    Region = "EU"
    Role   = "Replica"
  }
}

module "eks_apac" {
  source = "../modules/eks"
  providers = {
    aws = aws.ap_southeast_1
  }
  
  cluster_name    = "unit-talk-apac"
  cluster_version = var.kubernetes_version
  vpc_id          = module.vpc_apac.vpc_id
  subnet_ids      = module.vpc_apac.private_subnet_ids
  
  node_groups = {
    api = {
      desired_size = 2
      min_size     = 1
      max_size     = 8
      instance_types = ["t3.large"]
    }
    workers = {
      desired_size = 1
      min_size     = 1
      max_size     = 4
      instance_types = ["t3.medium"]
    }
  }
  
  tags = {
    Region = "APAC"
    Role   = "Replica"
  }
}

# =============================================================================
# CLOUDFLARE GLOBAL LOAD BALANCER
# =============================================================================

# Health Check Monitors
resource "cloudflare_load_balancer_monitor" "api_health" {
  type        = "https"
  description = "Unit Talk API Health Check"
  method      = "GET"
  path        = "/api/health/global"
  timeout     = 5
  interval    = 60
  retries     = 2
  expected_codes = "200"
  
  header {
    header = "Host"
    values = [var.domain_name]
  }
  
  header {
    header = "X-Health-Check"
    values = ["cloudflare"]
  }
}

# Origin Pools - Regional Endpoints
resource "cloudflare_load_balancer_pool" "na" {
  name        = "unit-talk-na-pool"
  description = "North America Origin Pool"
  
  origins {
    name    = "na-primary"
    address = module.eks_na.cluster_endpoint
    enabled = true
    weight  = 1
  }
  
  monitor           = cloudflare_load_balancer_monitor.api_health.id
  notification_email = var.ops_email
  
  load_shedding {
    default_percent = 0
    default_policy  = "random"
    session_percent = 0
    session_policy  = "hash"
  }
}

resource "cloudflare_load_balancer_pool" "eu" {
  name        = "unit-talk-eu-pool"
  description = "Europe Origin Pool"

  origins {
    name    = "eu-replica"
    address = module.eks_eu.cluster_endpoint
    enabled = true
    weight  = 1
  }

  monitor           = cloudflare_load_balancer_monitor.api_health.id
  notification_email = var.ops_email

  load_shedding {
    default_percent = 0
    default_policy  = "random"
    session_percent = 0
    session_policy  = "hash"
  }
}

resource "cloudflare_load_balancer_pool" "apac" {
  name        = "unit-talk-apac-pool"
  description = "Asia Pacific Origin Pool"

  origins {
    name    = "apac-replica"
    address = module.eks_apac.cluster_endpoint
    enabled = true
    weight  = 1
  }

  monitor           = cloudflare_load_balancer_monitor.api_health.id
  notification_email = var.ops_email

  load_shedding {
    default_percent = 0
    default_policy  = "random"
    session_percent = 0
    session_policy  = "hash"
  }
}

# Global Load Balancer with Geo-Steering
resource "cloudflare_load_balancer" "global" {
  zone_id = data.cloudflare_zone.main.id
  name    = "api.${var.domain_name}"

  default_pool_ids = [
    cloudflare_load_balancer_pool.na.id,
    cloudflare_load_balancer_pool.eu.id,
    cloudflare_load_balancer_pool.apac.id,
  ]

  fallback_pool_id = cloudflare_load_balancer_pool.na.id

  description = "Unit Talk Global Load Balancer - Phase 10"
  ttl         = 30
  proxied     = true

  # Geo-steering for latency-based routing
  region_pools {
    region   = "WNAM"  # Western North America
    pool_ids = [cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "ENAM"  # Eastern North America
    pool_ids = [cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "WEU"   # Western Europe
    pool_ids = [cloudflare_load_balancer_pool.eu.id, cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "EEU"   # Eastern Europe
    pool_ids = [cloudflare_load_balancer_pool.eu.id, cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "SEAS"  # Southeast Asia
    pool_ids = [cloudflare_load_balancer_pool.apac.id, cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "NEAS"  # Northeast Asia
    pool_ids = [cloudflare_load_balancer_pool.apac.id, cloudflare_load_balancer_pool.na.id]
  }

  region_pools {
    region   = "OC"    # Oceania
    pool_ids = [cloudflare_load_balancer_pool.apac.id, cloudflare_load_balancer_pool.na.id]
  }

  # Session affinity for consistent routing
  session_affinity = "cookie"
  session_affinity_ttl = 3600

  # Adaptive routing for performance
  adaptive_routing {
    failover_across_pools = true
  }

  # Location-based load balancing
  location_strategy {
    prefer_ecs = "always"
    mode       = "resolver_ip"
  }
}

# =============================================================================
# SUPABASE READ REPLICAS CONFIGURATION
# =============================================================================

# Note: Supabase read replicas are configured via Supabase Dashboard/API
# This section documents the configuration for operational reference

locals {
  supabase_config = {
    primary_region = "us-east-1"
    read_replicas = {
      eu = {
        region          = "eu-west-1"
        max_replication_lag = 3  # seconds
        connection_pooling  = true
        max_connections     = 100
      }
      apac = {
        region          = "ap-southeast-1"
        max_replication_lag = 3  # seconds
        connection_pooling  = true
        max_connections     = 100
      }
    }
  }
}

# =============================================================================
# REDIS GLOBAL DATASTORE
# =============================================================================

module "redis_global" {
  source = "../modules/redis-global"

  providers = {
    aws.primary = aws.us_east_1
    aws.eu      = aws.eu_west_1
    aws.apac    = aws.ap_southeast_1
  }

  cluster_id = "unit-talk-global"
  node_type  = var.redis_node_type

  primary_region = "us-east-1"
  replica_regions = ["eu-west-1", "ap-southeast-1"]

  vpc_ids = {
    "us-east-1"        = module.vpc_na.vpc_id
    "eu-west-1"        = module.vpc_eu.vpc_id
    "ap-southeast-1"   = module.vpc_apac.vpc_id
  }

  subnet_ids = {
    "us-east-1"        = module.vpc_na.private_subnet_ids
    "eu-west-1"        = module.vpc_eu.private_subnet_ids
    "ap-southeast-1"   = module.vpc_apac.private_subnet_ids
  }
}

# =============================================================================
# OUTPUTS
# =============================================================================

output "global_load_balancer_url" {
  description = "Global Load Balancer URL"
  value       = "https://${cloudflare_load_balancer.global.name}"
}

output "regional_endpoints" {
  description = "Regional API Endpoints"
  value = {
    na   = module.eks_na.cluster_endpoint
    eu   = module.eks_eu.cluster_endpoint
    apac = module.eks_apac.cluster_endpoint
  }
}

output "supabase_configuration" {
  description = "Supabase Multi-Region Configuration"
  value       = local.supabase_config
  sensitive   = false
}

output "redis_endpoints" {
  description = "Redis Global Datastore Endpoints"
  value       = module.redis_global.endpoints
  sensitive   = true
}


