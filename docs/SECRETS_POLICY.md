# Secrets Management Policy
**Effective Date**: October 2025  
**Owner**: Engineering Team  
**Review Cadence**: Quarterly

---

## Overview

This document defines the secrets management policy for the Unit Talk Platform. All team members must follow these guidelines to protect production credentials and sensitive data.

---

## Core Principles

1. **Never commit secrets to version control**
2. **Use GitHub Secrets for CI/CD workflows**
3. **Rotate secrets immediately upon exposure**
4. **Use environment-specific credentials**
5. **Implement least-privilege access**

---

## Secrets Classification

### Critical (Tier 1)
- Database passwords and connection strings
- Service role keys (Supabase, AWS, etc.)
- Discord bot tokens
- API keys with write access

**Storage**: GitHub Secrets (encrypted at rest)  
**Rotation**: Immediately upon exposure, quarterly otherwise  
**Access**: Engineering leads only

### High (Tier 2)
- Read-only API keys
- Webhook URLs
- OAuth client secrets

**Storage**: GitHub Secrets or secure vault  
**Rotation**: Quarterly  
**Access**: Engineering team

### Medium (Tier 3)
- Public API endpoints
- Non-sensitive configuration values

**Storage**: `.env.example` (no actual values)  
**Rotation**: As needed  
**Access**: All team members

---

## File Structure

### Allowed Files

| File | Purpose | Committed to Git | Contains Secrets |
|------|---------|------------------|------------------|
| `.env.example` | Template for local development | ✅ YES | ❌ NO |
| `.env.local` | Local development overrides | ❌ NO | ✅ YES |
| `.env` | Local environment (gitignored) | ❌ NO | ✅ YES |

### Prohibited Files

- ❌ `.env.production` (use GitHub Secrets instead)
- ❌ `.env.cloud` (use GitHub Secrets instead)
- ❌ `.env.db` (use GitHub Secrets instead)
- ❌ Any file with actual secret values committed to Git

---

## GitHub Secrets Configuration

### Required Secrets

All workflows require these secrets to be configured in GitHub repository settings:

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
DATABASE_URL
DISCORD_TOKEN
DISCORD_BOT_TOKEN
DISCORD_CLIENT_ID
DISCORD_GUILD_ID
DISCORD_ALERT_WEBHOOK
DISCORD_OPS_WEBHOOK
OPTIMAL_API_KEY
ODDS_API_KEY
SGO_API_KEY
NOTION_TOKEN
```

### Setting Secrets

```bash
# Via GitHub CLI
gh secret set SUPABASE_SERVICE_ROLE_KEY < secret.txt

# Via GitHub UI
Settings → Secrets and variables → Actions → New repository secret
```

---

## DSN Pattern Standards

### Database Connection Strings

**Pooler DSN** (for API/application code):
```
postgresql://postgres.{project_ref}:{password}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Direct DSN** (for migrations only):
```
postgresql://postgres:{password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require
```

### Usage Rules

- ✅ **Use Pooler DSN** for all application code (API, agents, workers)
- ✅ **Use Direct DSN** only for migrations and schema changes
- ❌ **Never hardcode passwords** - use environment variables
- ❌ **Never commit DSN strings** - use `.env.example` with placeholders

---

## Secret Rotation Procedures

### Immediate Rotation (Exposure Event)

1. **Revoke compromised secret** in provider dashboard
2. **Generate new secret** with different value
3. **Update GitHub Secrets** with new value
4. **Redeploy affected services** to pick up new secret
5. **Document incident** in security log
6. **Notify team** via Slack/Discord

### Quarterly Rotation (Scheduled)

1. **Generate new secrets** for all Tier 1 credentials
2. **Update GitHub Secrets** in repository settings
3. **Update local `.env` files** for all developers
4. **Redeploy all services** to pick up new secrets
5. **Verify functionality** across all environments
6. **Revoke old secrets** after 24-hour grace period

---

## Enforcement

### Pre-commit Hooks

Install pre-commit hooks to prevent secret commits:

```bash
npm install --save-dev @commitlint/cli husky
npx husky install
npx husky add .husky/pre-commit "npm run secrets:scan"
```

### CI/CD Checks

All PRs must pass secrets scanning:

```yaml
# .github/workflows/secrets-scan.yml
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

### Manual Audits

- **Weekly**: Automated scan via GitHub Actions
- **Monthly**: Manual review of `.env` files
- **Quarterly**: Full secrets rotation

---

## Incident Response

### If Secrets Are Committed to Git

1. **DO NOT** simply delete the file - Git history retains it
2. **Immediately rotate** all exposed secrets
3. **Use BFG Repo-Cleaner** to purge from Git history:
   ```bash
   bfg --delete-files .env
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```
4. **Force push** to remote (requires team coordination)
5. **Notify all team members** to re-clone repository
6. **Document incident** in security log

### If Secrets Are Exposed Publicly

1. **Revoke immediately** in provider dashboard
2. **Generate new secrets** with different values
3. **Update GitHub Secrets** and redeploy
4. **Monitor for unauthorized usage** (API logs, database access)
5. **File incident report** with security team
6. **Review access logs** for 30 days prior

---

## Developer Onboarding

### New Team Member Checklist

- [ ] Read this policy document
- [ ] Install pre-commit hooks
- [ ] Copy `.env.example` to `.env.local`
- [ ] Request access to GitHub Secrets (from lead)
- [ ] Populate `.env.local` with development credentials
- [ ] Verify local environment works
- [ ] Acknowledge policy compliance

---

## Compliance

### Audit Trail

All secret access is logged:
- GitHub Secrets access (via audit log)
- Supabase dashboard access (via activity log)
- Database connections (via PostgreSQL logs)

### Retention

- **GitHub audit logs**: 90 days
- **Supabase activity logs**: 30 days
- **Database connection logs**: 7 days

---

## References

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated**: October 2025  
**Next Review**: January 2026

