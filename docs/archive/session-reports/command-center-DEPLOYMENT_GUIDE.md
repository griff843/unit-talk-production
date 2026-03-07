# Unit Talk Command Center - Deployment Guide

Fortune 100 SaaS-grade admin dashboard deployment instructions.

## Overview

The Command Center is a comprehensive admin dashboard that provides:

- **PicksHQ**: Advanced pick filtering and analytics
- **Agent Control**: Real-time Temporal agent monitoring
- **SmartForm Review**: Submission validation workflows
- **LLM Task Center**: AI-powered task assignment
- **Business Intelligence**: Phase D analytics integration
- **User Management**: Discord integration and permissions

## Prerequisites

### System Requirements

- Node.js 18+
- npm or yarn
- 4GB+ RAM (8GB recommended)
- 10GB+ disk space

### Dependencies

- **Supabase database** with required tables
- **Unit Talk platform API** running on port 3004
- **Phase D analytics system** running on port 3005
- **Redis** (optional, for caching)

### Required Database Tables

The Command Center expects these Supabase tables to exist:

```sql
-- picks table
CREATE TABLE picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  capper_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,
  tier TEXT NOT NULL,
  ev_score NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,
  outcome TEXT,
  roi NUMERIC,
  status TEXT DEFAULT 'pending'
);

-- players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT NOT NULL,
  league TEXT NOT NULL,
  player_id TEXT UNIQUE NOT NULL
);

-- agent_logs table
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  agent_name TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  correlation_id TEXT,
  metadata JSONB
);

-- user_profiles table
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  tier TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  roi NUMERIC
);

-- raw_props table (if using SmartForm integration)
CREATE TABLE raw_props (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  game_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  market_type TEXT NOT NULL,
  line NUMERIC NOT NULL,
  odds NUMERIC NOT NULL,
  book TEXT NOT NULL,
  ev_score NUMERIC,
  tier_tag TEXT,
  confidence NUMERIC
);
```

## Installation Methods

### Method 1: Automated Setup (Recommended)

1. **Navigate to project directory**:

```bash
cd unit-talk-command-center
```

2. **Run setup script**:

```bash
npx tsx scripts/setup-command-center.ts
```

3. **Configure environment variables** when prompted:
   - Supabase URL and keys
   - Platform API URL
   - Phase D analytics URL

4. **Start the application**:

```bash
./scripts/start.sh
```

### Method 2: Manual Setup

1. **Install dependencies**:

```bash
npm install
```

2. **Configure environment**:

```bash
cp .env.local.example .env.local
# Edit .env.local with your configuration
```

3. **Build application**:

```bash
npm run build
```

4. **Start production server**:

```bash
npm start
```

## Environment Configuration

### Required Environment Variables

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Unit Talk Platform API
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3004

# Phase D Analytics Integration
NEXT_PUBLIC_ANALYTICS_API_URL=http://localhost:3005

# Command Center Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXTAUTH_SECRET=your_nextauth_secret_key
NEXTAUTH_URL=http://localhost:3001

# Environment
NODE_ENV=production
```

### Optional Environment Variables

```bash
# Redis Configuration (for caching)
REDIS_URL=redis://localhost:6379

# Discord Integration (for user lookups)
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_discord_server_id

# Monitoring & Logging
LOG_LEVEL=info
ENABLE_METRICS=true
```

## Deployment Strategies

### Development Deployment

```bash
# Start development server
npm run dev

# Or use script
./scripts/dev.sh
```

Access at: http://localhost:3001

### Production Deployment

#### Option 1: Local Production

```bash
# Build and start
npm run build
npm start

# Or use script
./scripts/start.sh
```

#### Option 2: Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .
RUN npm run build

EXPOSE 3001

CMD ["npm", "start"]
```

```bash
# Build and run Docker container
docker build -t unit-talk-command-center .
docker run -p 3001:3001 --env-file .env.local unit-talk-command-center
```

#### Option 3: PM2 Process Manager

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start npm --name "command-center" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### Cloud Deployment

#### Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

#### Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

## Health Monitoring

### Health Check Endpoint

The Command Center includes built-in health monitoring:

```bash
# Manual health check
node scripts/health-check.js

# Health check endpoint
curl http://localhost:3001/api/health
```

### Monitoring Integration

The system integrates with the Phase D analytics for comprehensive monitoring:

- **System Health**: Overall application status
- **Database Connectivity**: Supabase connection health
- **API Integration**: Platform and analytics API status
- **Performance Metrics**: Response times and error rates

## Integration Setup

### Platform API Integration

Ensure the main Unit Talk platform API is running:

```bash
# In unit-talk-production directory
npm run start:dev  # Port 3004
```

### Phase D Analytics Integration

Ensure the Phase D analytics system is running:

```bash
# Start Phase D system
npx tsx src/monitoring/deploy-phase-d-analytics.ts  # Port 3005
```

### Database Integration

The Command Center connects to your existing Supabase database. Ensure:

1. **Row Level Security (RLS)** is configured appropriately
2. **API keys** have necessary permissions
3. **Real-time subscriptions** are enabled for live data

## Security Configuration

### Authentication

Currently uses development authentication. For production:

1. **Implement NextAuth.js** with Discord OAuth
2. **Configure RBAC** (Role-Based Access Control)
3. **Set up session management**

### API Security

1. **Rate limiting** on API endpoints
2. **CORS configuration** for allowed origins
3. **Input validation** on all forms
4. **SQL injection protection** via Supabase

### Environment Security

1. **Secure secrets** in environment variables
2. **Use HTTPS** in production
3. **Implement CSP** (Content Security Policy)
4. **Regular security audits**

## Performance Optimization

### Caching Strategy

1. **Redis caching** for frequently accessed data
2. **Browser caching** for static assets
3. **API response caching** with appropriate TTL
4. **Real-time data** optimization

### Bundle Optimization

```bash
# Analyze bundle size
npm run build -- --analyze

# Build optimization already included:
# - Code splitting
# - Tree shaking
# - Image optimization
# - Font optimization
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

```bash
# Check Supabase configuration
curl -H "apikey: YOUR_ANON_KEY" https://YOUR_PROJECT.supabase.co/rest/v1/
```

#### 2. Platform API Connection

```bash
# Test platform API
curl http://localhost:3004/health
```

#### 3. Phase D Analytics Connection

```bash
# Test analytics API
curl http://localhost:3005/health
```

#### 4. Build Failures

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Logs and Debugging

```bash
# View application logs
npm run dev -- --debug

# View production logs with PM2
pm2 logs command-center

# Enable verbose logging
DEBUG=* npm run dev
```

## Maintenance

### Regular Tasks

1. **Update dependencies** monthly
2. **Monitor performance** metrics
3. **Review security** configurations
4. **Backup configurations** regularly

### Updates

```bash
# Update dependencies
npm update

# Rebuild after updates
npm run build

# Restart services
pm2 restart command-center
```

## Support

### Documentation

- **README.md**: Basic setup and features
- **QUICK_START.md**: Fast deployment guide
- **API Documentation**: Available at `/api/docs`

### Monitoring

- **Health Dashboard**: http://localhost:3001/dashboard
- **Phase D Analytics**: http://localhost:3005/dashboard
- **System Metrics**: Integrated monitoring

### Contact

For technical support, refer to the main Unit Talk production documentation and
development team.

---

**Status**: ✅ Production Ready  
**Version**: 1.0.0  
**Last Updated**: January 2025
