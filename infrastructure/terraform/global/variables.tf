# =============================================================================
# UNIT TALK PLATFORM - PHASE 10 GLOBAL VARIABLES
# =============================================================================

variable "environment" {
  description = "Environment name (production, staging, development)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["production", "staging", "development"], var.environment)
    error_message = "Environment must be production, staging, or development."
  }
}

variable "domain_name" {
  description = "Primary domain name for the platform"
  type        = string
  default     = "unittalk.io"
}

variable "cloudflare_api_token" {
  description = "Cloudflare API token for DNS and load balancer management"
  type        = string
  sensitive   = true
}

variable "ops_email" {
  description = "Operations team email for alerts and notifications"
  type        = string
  default     = "ops@unittalk.io"
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS clusters"
  type        = string
  default     = "1.28"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.r7g.large"
}

# =============================================================================
# REGIONAL CONFIGURATIONS
# =============================================================================

variable "regions" {
  description = "Regional deployment configuration"
  type = map(object({
    aws_region         = string
    role               = string  # primary or replica
    min_nodes          = number
    max_nodes          = number
    desired_nodes      = number
  }))
  
  default = {
    na = {
      aws_region    = "us-east-1"
      role          = "primary"
      min_nodes     = 2
      max_nodes     = 10
      desired_nodes = 3
    }
    eu = {
      aws_region    = "eu-west-1"
      role          = "replica"
      min_nodes     = 1
      max_nodes     = 8
      desired_nodes = 2
    }
    apac = {
      aws_region    = "ap-southeast-1"
      role          = "replica"
      min_nodes     = 1
      max_nodes     = 8
      desired_nodes = 2
    }
  }
}

# =============================================================================
# SLO TARGETS
# =============================================================================

variable "slo_targets" {
  description = "Service Level Objective targets for global deployment"
  type = object({
    p95_latency_ms           = number
    max_replication_lag_sec  = number
    availability_percent     = number
    error_rate_percent       = number
  })
  
  default = {
    p95_latency_ms          = 200
    max_replication_lag_sec = 3
    availability_percent    = 99.95
    error_rate_percent      = 0.1
  }
}

# =============================================================================
# HEALTH CHECK CONFIGURATION
# =============================================================================

variable "health_check_config" {
  description = "Health check configuration for load balancers"
  type = object({
    interval_seconds    = number
    timeout_seconds     = number
    healthy_threshold   = number
    unhealthy_threshold = number
    path                = string
  })
  
  default = {
    interval_seconds    = 30
    timeout_seconds     = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    path                = "/api/health/global"
  }
}

# =============================================================================
# MONITORING CONFIGURATION
# =============================================================================

variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    prometheus_retention_days = number
    grafana_admin_password    = string
    alert_channels            = list(string)
  })
  
  default = {
    prometheus_retention_days = 30
    grafana_admin_password    = "changeme"  # Override in terraform.tfvars
    alert_channels            = ["email", "slack"]
  }
  
  sensitive = true
}

# =============================================================================
# DEPLOYMENT CONFIGURATION
# =============================================================================

variable "deployment_config" {
  description = "Deployment strategy configuration"
  type = object({
    strategy                = string  # rolling, blue-green, canary
    max_surge               = string
    max_unavailable         = string
    health_check_grace_period = number
    rollback_on_failure     = bool
  })
  
  default = {
    strategy                = "rolling"
    max_surge               = "25%"
    max_unavailable         = "0"
    health_check_grace_period = 300
    rollback_on_failure     = true
  }
}

# =============================================================================
# TAGS
# =============================================================================

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  
  default = {
    Project     = "Unit Talk Platform"
    ManagedBy   = "Terraform"
    Phase       = "Phase10-Global"
    CostCenter  = "Engineering"
    Compliance  = "SOC2"
  }
}

