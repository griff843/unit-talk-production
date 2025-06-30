# Unit Talk Discord Bot - Production Deployment Guide

This guide provides step-by-step instructions for deploying the Unit Talk Discord Bot to a production environment with enterprise-grade monitoring, caching, and security features.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Configuration](#configuration)
4. [Deployment](#deployment)
5. [Monitoring & Observability](#monitoring--observability)
6. [Security](#security)
7. [Backup & Recovery](#backup--recovery)
8. [Maintenance](#maintenance)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended) or Windows Server 2019+
- **CPU**: Minimum 2 cores, Recommended 4+ cores
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 50GB SSD, Recommended 100GB+ SSD
- **Network**: Stable internet connection with low latency

### Software Requirements

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Git**: Latest version
- **Node.js**: Version 18+ (for development)
- **PostgreSQL Client**: For database operations (optional)

### External Services

- **Discord Bot Token**: From Discord Developer Portal
- **Supabase Account**: For database and authentication
- **OpenAI API Key**: For AI-powered features
- **Cloud Storage**: AWS S3, Google Cloud Storage, or Azure Blob (for backups)

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/unit-talk-custom-bot.git
cd unit-talk-custom-bot
```

### 2. Create Production Environment File

```bash
cp .env.production.example .env.production
```

### 3. Configure Environment Variables

Edit `.env.production` with your actual values:

```bash
nano .env.production
```

**Critical Variables to Configure:**

```env
# Discord Configuration
DISCORD_TOKEN=your_actual_discord_bot_token
DISCORD_CLIENT_ID=your_actual_client_id
DISCORD_GUILD_ID=your_actual_guild_id

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key

# Security
REDIS_PASSWORD=generate_secure_password_here
GRAFANA_ADMIN_PASSWORD=generate_secure_password_here
JWT_SECRET=generate_32_character_secret_here

# OpenAI
OPENAI_API_KEY=your_actual_openai_api_key
```

### 4. Set Up SSL Certificates (Production)

For HTTPS in production:

```bash
mkdir -p config/nginx/ssl
# Copy your SSL certificates to config/nginx/ssl/
# cert.pem and key.pem
```

## Configuration

### Database Setup

1. **Create Supabase Project**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Create a new project
   - Note down the URL and API keys

2. **Run Database Migrations**
   ```bash
   # Apply database schema
   npm run migrate:prod
   ```

### Discord Bot Setup

1. **Create Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create new application
   - Create bot and get token
   - Enable necessary intents

2. **Invite Bot to Server**
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=bot%20applications.commands
   ```

### Monitoring Configuration

The deployment includes:
- **Prometheus**: Metrics collection
- **Grafana**: Visualization dashboards
- **Redis**: Caching layer
- **Nginx**: Reverse proxy and load balancer

## Deployment

### Option 1: Automated Deployment (Recommended)

```bash
# Make deployment script executable (Linux/Mac)
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh
```

### Option 2: Manual Deployment

```bash
# Build Docker images
docker build -f Dockerfile.production -t unit-talk-bot:latest .

# Start services
docker-compose -f docker-compose.production.yml --env-file .env.production up -d

# Check service status
docker-compose -f docker-compose.production.yml ps
```

### Verify Deployment

1. **Health Check**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check Service Status**
   ```bash
   ./scripts/deploy.sh status
   ```

3. **View Logs**
   ```bash
   ./scripts/deploy.sh logs
   ```

## Monitoring & Observability

### Access Monitoring Dashboards

- **Application Health**: http://localhost:3000/health
- **Metrics Endpoint**: http://localhost:3001/metrics
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3002 (admin/your_grafana_password)

### Key Metrics to Monitor

1. **Application Metrics**
   - Response time
   - Error rate
   - Request volume
   - Memory usage
   - CPU usage

2. **Infrastructure Metrics**
   - System resources
   - Database performance
   - Cache hit rate
   - Network latency

3. **Business Metrics**
   - Discord API calls
   - User interactions
   - Command execution time
   - Feature usage

### Setting Up Alerts

1. **Configure Notification Webhooks**
   ```env
   NOTIFICATION_WEBHOOK=https://discord.com/api/webhooks/your_webhook
   ```

2. **Customize Alert Rules**
   Edit `config/prometheus/rules/alerts.yml` for custom thresholds

## Security

### Security Checklist

- [ ] Strong passwords for all services
- [ ] SSL/TLS certificates configured
- [ ] Firewall rules configured
- [ ] Regular security updates
- [ ] Access logs monitored
- [ ] Rate limiting enabled
- [ ] Input validation implemented

### Network Security

```bash
# Configure firewall (Ubuntu/Debian)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable

# Block direct access to internal ports
sudo ufw deny 3001/tcp   # Metrics
sudo ufw deny 6379/tcp   # Redis
sudo ufw deny 9090/tcp   # Prometheus
```

### Regular Security Tasks

1. **Update Dependencies**
   ```bash
   npm audit
   npm update
   ```

2. **Rotate Secrets**
   - Discord bot token
   - Database passwords
   - API keys
   - JWT secrets

3. **Monitor Access Logs**
   ```bash
   tail -f logs/access.log
   ```

## Backup & Recovery

### Automated Backups

```bash
# Run backup manually
./scripts/backup.sh

# Set up cron job for daily backups
crontab -e
# Add: 0 2 * * * /path/to/unit-talk-custom-bot/scripts/backup.sh
```

### Backup Strategy

1. **Database Backups**
   - Daily automated backups
   - Retention: 7 days local, 30 days cloud
   - Encryption at rest

2. **Configuration Backups**
   - Environment files
   - Docker configurations
   - SSL certificates

3. **Application Data**
   - Logs (last 30 days)
   - Cache snapshots
   - Metrics data

### Recovery Procedures

1. **Database Recovery**
   ```bash
   # Restore from backup
   psql -h your-db-host -U postgres -d your-db < backup.sql
   ```

2. **Application Recovery**
   ```bash
   # Stop services
   ./scripts/deploy.sh stop
   
   # Restore configuration
   tar -xzf backup.tar.gz
   
   # Restart services
   ./scripts/deploy.sh
   ```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- [ ] Check service health
- [ ] Review error logs
- [ ] Monitor resource usage
- [ ] Verify backups

#### Weekly
- [ ] Update dependencies
- [ ] Review security logs
- [ ] Clean old logs
- [ ] Performance analysis

#### Monthly
- [ ] Security audit
- [ ] Capacity planning
- [ ] Disaster recovery test
- [ ] Documentation updates

### Maintenance Commands

```bash
# Update application
git pull origin main
docker-compose -f docker-compose.production.yml build
./scripts/deploy.sh restart

# Clean up old data
docker system prune -f
./scripts/backup.sh cleanup

# View system resources
docker stats
df -h
free -h
```

## Troubleshooting

### Common Issues

#### Bot Not Responding
```bash
# Check bot status
docker-compose -f docker-compose.production.yml logs discord-bot

# Verify Discord token
curl -H "Authorization: Bot $DISCORD_TOKEN" https://discord.com/api/v10/users/@me
```

#### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart services
./scripts/deploy.sh restart

# Adjust memory limits in docker-compose.production.yml
```

#### Database Connection Issues
```bash
# Test database connection
docker-compose -f docker-compose.production.yml exec discord-bot npm run db:test

# Check Supabase status
curl https://your-project.supabase.co/rest/v1/
```

#### Cache Issues
```bash
# Check Redis status
docker-compose -f docker-compose.production.yml logs redis

# Clear cache
docker-compose -f docker-compose.production.yml exec redis redis-cli FLUSHALL
```

### Performance Optimization

1. **Database Optimization**
   - Add indexes for frequently queried columns
   - Optimize query patterns
   - Use connection pooling

2. **Cache Optimization**
   - Tune cache TTL values
   - Monitor hit rates
   - Implement cache warming

3. **Application Optimization**
   - Profile memory usage
   - Optimize Discord API calls
   - Implement request batching

### Log Analysis

```bash
# View application logs
./scripts/deploy.sh logs

# Search for errors
grep -i error logs/application.log

# Monitor real-time logs
tail -f logs/application.log | grep -i error
```

## Support & Documentation

### Getting Help

1. **Check Documentation**: Review this guide and inline code comments
2. **Search Issues**: Look for similar issues in the repository
3. **Create Issue**: Submit detailed bug reports or feature requests
4. **Contact Support**: Reach out to the development team

### Useful Resources

- [Discord.js Documentation](https://discord.js.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [Docker Documentation](https://docs.docker.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

---

## Quick Reference

### Essential Commands

```bash
# Deploy application
./scripts/deploy.sh

# Check status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs

# Stop services
./scripts/deploy.sh stop

# Restart services
./scripts/deploy.sh restart

# Create backup
./scripts/backup.sh

# Health check
curl http://localhost:3000/health
```

### Important URLs

- Application: http://localhost:3000
- Health Check: http://localhost:3000/health
- Metrics: http://localhost:3001/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3002

### Emergency Contacts

- **Development Team**: dev@unittalk.com
- **Infrastructure Team**: ops@unittalk.com
- **Security Team**: security@unittalk.com

---

*Last Updated: $(date)*
*Version: 1.0.0*