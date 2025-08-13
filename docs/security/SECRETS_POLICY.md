# Secrets Management Policy

## Overview

This document outlines the secrets management policy for the Unit Talk Platform, including credential handling, rotation procedures, and security best practices.

## 🔐 Core Principles

### Never Commit Secrets
- **NO secrets in source code** - including comments, documentation, or tests
- **NO API keys, passwords, tokens** in any repository files
- **NO database connection strings** with embedded credentials
- **NO private keys or certificates** in version control

### Use Proper Secret Management
- **GitHub Secrets** for CI/CD workflows and deployment
- **Environment Variables** for runtime configuration
- **External Secret Managers** for production (AWS Secrets Manager, HashiCorp Vault)
- **Encrypted Configuration** for sensitive settings

## 🛡️ Secret Categories & Handling

### Critical Secrets (Immediate Rotation Required if Exposed)
- Database passwords and connection strings
- Service role keys (Supabase, Firebase)
- API keys with write access
- Private signing keys
- Production authentication tokens

**Handling**:
- Store in GitHub Secrets for CI/CD
- Use environment variables with restricted access
- Rotate every 90 days or immediately if compromised

### Moderate Secrets (24-hour Rotation Window)
- Read-only API keys
- Discord bot tokens
- Third-party service credentials
- Development database credentials

**Handling**:
- Environment variables or secure configuration files
- Regular rotation schedule (180 days)
- Monitor usage logs for anomalies

### Low Secrets (72-hour Rotation Window)
- Non-production API keys
- Test environment credentials
- Development tokens
- Staging environment secrets

**Handling**:
- Development environment variables
- Documented rotation procedures
- Annual rotation cycle

## 📋 Secret Types & Examples

### Database Credentials
```bash
# ❌ NEVER - Hardcoded in config
DATABASE_URL=postgresql://user:password123@db.example.com/mydb

# ✅ CORRECT - Use environment variables
DATABASE_URL=${DATABASE_URL}

# ✅ CORRECT - GitHub Secrets in workflows
DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### API Keys
```typescript
// ❌ NEVER - Hardcoded
const apiKey = 'sk-abc123def456ghi789';

// ✅ CORRECT - Environment variable
const apiKey = process.env.OPTIMAL_API_KEY;

// ✅ CORRECT - With validation
const apiKey = process.env.OPTIMAL_API_KEY;
if (!apiKey) {
  throw new Error('OPTIMAL_API_KEY environment variable is required');
}
```

### Service Tokens
```yaml
# ❌ NEVER - In docker-compose
environment:
  - SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ✅ CORRECT - Environment file (not committed)
env_file:
  - .env.local

# ✅ CORRECT - GitHub Secrets
environment:
  - SUPABASE_KEY=${{ secrets.SUPABASE_SERVICE_KEY }}
```

## 🔄 Rotation Procedures

### Emergency Rotation (Compromised Secrets)
1. **Immediate** (< 1 hour):
   - Disable compromised credential
   - Generate new credential
   - Update all services simultaneously
   - Monitor for unauthorized access

2. **Investigation** (24 hours):
   - Review access logs
   - Identify potential data exposure
   - Document incident timeline
   - Update security procedures

### Scheduled Rotation

#### Critical Secrets - Every 90 Days
```bash
# Rotation checklist
□ Generate new secret
□ Test in staging environment
□ Update GitHub Secrets
□ Deploy to production
□ Verify service health
□ Disable old secret
□ Update documentation
□ Schedule next rotation
```

#### Moderate Secrets - Every 180 Days
```bash
# Rotation checklist
□ Generate new secret
□ Update environment configurations
□ Test service connectivity
□ Deploy changes
□ Monitor for issues
□ Remove old credentials
```

## 🏗️ Implementation Guidelines

### Environment Variables
```bash
# .env.example (committed - no real values)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
SUPABASE_SERVICE_KEY=your-supabase-service-key-here
DISCORD_BOT_TOKEN=your-discord-bot-token-here
OPTIMAL_API_KEY=your-optimal-api-key-here

# .env.local (never committed - real values)
DATABASE_URL=postgresql://prod_user:real_password@prod-db.example.com/unit_talk
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DISCORD_BOT_TOKEN=ODcyNzM0NzU2MzIwNzY...
OPTIMAL_API_KEY=op_live_ak_abc123def456...
```

### GitHub Secrets Configuration
**Repository Secrets**:
- `DATABASE_URL` - Production database connection
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `DISCORD_BOT_TOKEN` - Discord bot authentication
- `OPTIMAL_API_KEY` - Optimal sports data API
- `ODDS_API_KEY` - Odds API key
- `REDIS_URL` - Redis connection string
- `TEMPORAL_ADDRESS` - Temporal server address

**Environment Secrets** (per environment):
- Production: `PROD_*` prefix
- Staging: `STAGING_*` prefix  
- Development: `DEV_*` prefix

### Docker & Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    image: unit-talk-api:latest
    environment:
      # ✅ Environment variables (no values)
      - DATABASE_URL
      - SUPABASE_SERVICE_KEY
      - DISCORD_BOT_TOKEN
    env_file:
      # ✅ Environment file (not committed)
      - .env.local
```

### TypeScript Configuration Validation
```typescript
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SUPABASE_SERVICE_KEY: z.string().min(40),
  DISCORD_BOT_TOKEN: z.string().regex(/^[A-Za-z0-9._-]+$/),
  OPTIMAL_API_KEY: z.string().startsWith('op_'),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
});

export const env = envSchema.parse(process.env);
```

## 🚨 Security Monitoring

### Automated Scanning
- **Gitleaks** runs on every commit and PR
- **Pre-commit hooks** prevent accidental commits
- **Daily full repository scans** for comprehensive coverage
- **SARIF reports** uploaded to GitHub Security tab

### Alert Thresholds
- **Any secret detected** → Block commit/deployment
- **High entropy strings** → Manual review required
- **Suspicious patterns** → Security team notification
- **Repeated violations** → Developer training required

### Monitoring & Logging
```typescript
// Log secret usage (not values!)
logger.audit('API_KEY_USED', {
  keyType: 'OPTIMAL_API',
  service: 'ingestion',
  userId: req.user?.id,
  timestamp: Date.now(),
  // Never log actual key values
});
```

## 🔧 Development Workflow

### Local Development Setup
```bash
# 1. Clone repository
git clone https://github.com/unit-talk/platform.git

# 2. Copy environment template
cp .env.example .env.local

# 3. Get secrets from secure source
# - Ask team lead for development credentials
# - Use 1Password/LastPass for shared secrets
# - Generate personal development tokens

# 4. Install pre-commit hooks
npm install
npx pre-commit install

# 5. Test secret validation
npm run test:env
```

### CI/CD Integration
```yaml
# .github/workflows/deploy.yml
- name: Configure secrets
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  run: |
    # Never echo secrets
    echo "Configuring environment..."
    # Use secrets in deployment
```

## 📊 Compliance & Auditing

### Regular Audits
- **Monthly**: Review all GitHub Secrets
- **Quarterly**: Validate rotation compliance  
- **Annually**: Complete security assessment
- **Ad-hoc**: Incident response reviews

### Compliance Checklist
```bash
□ All secrets stored securely (not in code)
□ Regular rotation schedule followed
□ Access logs reviewed monthly
□ Unused secrets removed
□ Team training completed
□ Incident response tested
□ Documentation updated
□ Monitoring alerts configured
```

### Audit Trail Requirements
- **Secret Creation**: Who, when, purpose
- **Secret Access**: Service usage patterns
- **Secret Rotation**: Schedule compliance
- **Secret Exposure**: Incident response
- **Access Changes**: Permission modifications

## 🆘 Incident Response

### If Secrets Are Exposed

#### Immediate Actions (< 15 minutes)
1. **Rotate compromised credentials immediately**
2. **Review recent access logs for anomalies**
3. **Notify security team via emergency channel**
4. **Block potentially compromised services**

#### Short-term Actions (< 1 hour)  
1. **Deploy new credentials to all environments**
2. **Verify service health after rotation**
3. **Scan logs for unauthorized access attempts**
4. **Document exposure timeline and scope**

#### Long-term Actions (< 24 hours)
1. **Complete forensic analysis of exposure**
2. **Update security procedures to prevent recurrence**
3. **Conduct team training on lessons learned**
4. **Report incident to stakeholders**

### Contact Information
- **Security Team**: security@unit-talk.com
- **Emergency Slack**: #security-incidents
- **On-call Engineer**: security-oncall@unit-talk.com

## 📚 Tools & Resources

### Recommended Tools
- **GitHub Secrets**: Built-in secret management
- **1Password**: Team secret sharing
- **AWS Secrets Manager**: Production secret storage
- **HashiCorp Vault**: Enterprise secret management
- **Docker Secrets**: Container secret management

### Validation Tools
- **Gitleaks**: Secret scanning
- **TruffleHog**: Historical secret detection
- **GitGuardian**: Continuous monitoring
- **pre-commit**: Prevention hooks
- **npm audit**: Dependency vulnerability scanning

### Training Resources
- [OWASP Secret Management](https://owasp.org/www-community/vulnerabilities/Insecure_Storage_of_Sensitive_Information)
- [GitHub Secrets Security](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [12-Factor App Config](https://12factor.net/config)
- [NIST Cryptographic Guidelines](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

---

**Policy Owner**: Security Team  
**Last Updated**: 2025-08-12  
**Next Review**: 2025-11-12  
**Version**: 1.0