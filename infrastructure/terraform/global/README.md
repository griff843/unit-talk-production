# Phase 10 - Global Multi-Region Infrastructure

This directory contains Terraform configuration for deploying the Unit Talk platform across multiple regions (North America, Europe, Asia Pacific) with global load balancing and database replication.

## Prerequisites

- Terraform >= 1.6.0
- AWS CLI configured with appropriate credentials
- Cloudflare account with API token
- Supabase account with multi-region support

## Quick Start

### 1. Configure Variables

```bash
# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your actual values
vim terraform.tfvars
```

### 2. Initialize Terraform

```bash
terraform init
```

### 3. Plan Deployment

```bash
terraform plan -out=tfplan
```

### 4. Apply Configuration

```bash
terraform apply tfplan
```

## Architecture

### Regional Deployment

- **North America (us-east-1)**: Primary region with write access
- **Europe (eu-west-1)**: Read replica with ≤3s replication lag
- **Asia Pacific (ap-southeast-1)**: Read replica with ≤3s replication lag

### Components

- **VPC**: Isolated VPC per region with public/private subnets
- **EKS**: Kubernetes clusters for container orchestration
- **Redis**: Global datastore with cross-region replication
- **Cloudflare**: Global load balancer with geo-steering
- **Monitoring**: Prometheus and Grafana for metrics

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `cloudflare_api_token` | Cloudflare API token | `your-token-here` |
| `domain_name` | Primary domain | `unittalk.io` |
| `ops_email` | Operations email | `ops@unittalk.io` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `environment` | `production` | Environment name |
| `kubernetes_version` | `1.28` | EKS cluster version |
| `redis_node_type` | `cache.r7g.large` | Redis instance type |

## Outputs

After successful deployment, Terraform will output:

- `global_load_balancer_url` - Cloudflare LB URL
- `regional_endpoints` - API endpoints for each region
- `supabase_configuration` - Database replication config
- `redis_endpoints` - Redis cluster endpoints

## Deployment Process

### Initial Deployment

1. **Provision Infrastructure**: `terraform apply`
2. **Configure Supabase**: Setup read replicas via Supabase dashboard
3. **Deploy Applications**: Use GitHub Actions workflow
4. **Validate SLOs**: Check Grafana dashboards

### Updates

1. **Plan Changes**: `terraform plan`
2. **Review Plan**: Ensure no unexpected changes
3. **Apply Changes**: `terraform apply`
4. **Verify Health**: Check health endpoints

### Rollback

```bash
# Rollback to previous state
terraform apply -target=module.eks_na -var-file=previous.tfvars

# Or destroy and recreate
terraform destroy -target=module.eks_na
terraform apply -target=module.eks_na
```

## Monitoring

### Health Checks

```bash
# Global health
curl https://api.unittalk.io/api/health/global

# Regional health
curl https://api-na.unittalk.io/api/health/global
curl https://api-eu.unittalk.io/api/health/global
curl https://api-apac.unittalk.io/api/health/global
```

### Metrics

- **Prometheus**: https://prometheus.unittalk.io
- **Grafana**: https://grafana.unittalk.io

## Cost Estimation

| Component | Monthly Cost |
|-----------|--------------|
| EKS Clusters (3) | $1,050 |
| Supabase DB (3) | $700 |
| Network/Data Transfer | $350 |
| Redis Global | $200 |
| Cloudflare LB | $200 |
| Monitoring | $100 |
| **Total** | **~$2,400** |

## Security

### Network Security

- VPC isolation per region
- Private subnets for databases
- Security groups with least privilege
- TLS 1.3 for all traffic

### Data Security

- AES-256 encryption at rest
- TLS encryption in transit
- AWS Secrets Manager for credentials
- IAM roles with least privilege

## Troubleshooting

### Common Issues

**Issue**: Terraform state lock error
```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

**Issue**: EKS cluster creation timeout
```bash
# Increase timeout in variables
variable "cluster_creation_timeout" {
  default = "30m"
}
```

**Issue**: Cloudflare API rate limit
```bash
# Add retry logic or wait between operations
sleep 60
terraform apply
```

## Disaster Recovery

### Backup Strategy

- Database backups every 6 hours
- 30-day retention period
- Cross-region backup replication

### Failover Procedure

1. Promote read replica to primary
2. Update Cloudflare routing
3. Verify application health
4. Monitor for 24 hours

## Support

- **Documentation**: [PHASE10_GLOBAL_ARCHITECTURE.md](../../../docs/PHASE10_GLOBAL_ARCHITECTURE.md)
- **Issues**: Create GitHub issue with `phase10` label
- **Slack**: #infrastructure channel

## License

Proprietary - Unit Talk Platform

---

**Last Updated**: January 23, 2025  
**Maintained by**: Engineering Team

