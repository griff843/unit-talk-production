# Variables for Unit Talk Platform - DigitalOcean Infrastructure
# Date: 2025-01-24

# DigitalOcean Configuration
variable "do_token" {
  description = "DigitalOcean API token"
  type        = string
  sensitive   = true
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "unit-talk"
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
  
  validation {
    condition     = contains(["production", "staging"], var.environment)
    error_message = "Environment must be either 'production' or 'staging'."
  }
}

variable "region" {
  description = "DigitalOcean region"
  type        = string
  default     = "nyc3"
  
  validation {
    condition = contains([
      "nyc1", "nyc3", "sfo3", "ams3", "sgp1", "lon1", "fra1", "tor1", "blr1", "syd1"
    ], var.region)
    error_message = "Region must be a valid DigitalOcean region."
  }
}

variable "spaces_region" {
  description = "DigitalOcean Spaces region"
  type        = string
  default     = "nyc3"
  
  validation {
    condition = contains([
      "nyc3", "sfo3", "ams3", "sgp1", "fra1"
    ], var.spaces_region)
    error_message = "Spaces region must be a valid DigitalOcean Spaces region."
  }
}

# Kubernetes Configuration
variable "kubernetes_version_prefix" {
  description = "Kubernetes version prefix (e.g., '1.28.')"
  type        = string
  default     = "1.28."
}

variable "auto_upgrade_enabled" {
  description = "Enable automatic Kubernetes version upgrades"
  type        = bool
  default     = true
}

# PostgreSQL Configuration
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15"
}

variable "postgres_node_size" {
  description = "PostgreSQL node size"
  type        = string
  default     = "db-s-2vcpu-4gb"
  
  validation {
    condition = contains([
      "db-s-1vcpu-1gb", "db-s-1vcpu-2gb", "db-s-2vcpu-4gb", 
      "db-s-4vcpu-8gb", "db-s-6vcpu-16gb", "db-s-8vcpu-32gb"
    ], var.postgres_node_size)
    error_message = "PostgreSQL node size must be a valid DigitalOcean database size."
  }
}

variable "postgres_node_count" {
  description = "Number of PostgreSQL nodes (1 for single node, 2+ for HA)"
  type        = number
  default     = 2
  
  validation {
    condition     = var.postgres_node_count >= 1 && var.postgres_node_count <= 3
    error_message = "PostgreSQL node count must be between 1 and 3."
  }
}

variable "postgres_database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "unit_talk_production"
}

# Redis Configuration
variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "7"
}

variable "redis_node_size" {
  description = "Redis node size"
  type        = string
  default     = "db-s-1vcpu-2gb"
  
  validation {
    condition = contains([
      "db-s-1vcpu-1gb", "db-s-1vcpu-2gb", "db-s-2vcpu-4gb", 
      "db-s-4vcpu-8gb", "db-s-6vcpu-16gb"
    ], var.redis_node_size)
    error_message = "Redis node size must be a valid DigitalOcean database size."
  }
}

# Container Registry Configuration
variable "registry_tier" {
  description = "Container registry subscription tier"
  type        = string
  default     = "professional"
  
  validation {
    condition     = contains(["starter", "basic", "professional"], var.registry_tier)
    error_message = "Registry tier must be 'starter', 'basic', or 'professional'."
  }
}

# Load Balancer Configuration
variable "ssl_certificate_name" {
  description = "Name of the SSL certificate for the load balancer"
  type        = string
  default     = ""
}

# CORS Configuration
variable "allowed_origins" {
  description = "Allowed origins for CORS (Spaces bucket)"
  type        = list(string)
  default = [
    "https://unit-talk.com",
    "https://www.unit-talk.com",
    "https://app.unit-talk.com",
    "https://command-center.unit-talk.com"
  ]
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to resources"
  type        = list(string)
  default     = []
}

