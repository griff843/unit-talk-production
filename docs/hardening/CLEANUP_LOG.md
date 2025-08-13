# Hardening Sprint - Cleanup Log

## Files Identified for Cleanup

### Legacy System References
- No n8n scripts found (already cleaned)
- No SportsDataIO references found in core files (already migrated to Optimal/SGO)

### Docker Compose Conflicts
Found multiple docker-compose files:
- `apps/api/docker-compose.yml` (dev)
- `apps/api/docker-compose.staging.yml` (staging) ✅ Keep
- `apps/api/docker-compose.prod.yml` (prod) ✅ Keep
- `apps/api/docker-compose.test.yml` (test) ✅ Keep

### CI/CD Workflow Conflicts
Existing workflows in `.github/workflows/`:
- `ci-cd-pipeline.yml` - Will be replaced with hardening workflows
- `ci.yml` - Will be consolidated
- `command-center-deploy.yml` - Will be replaced
- `db-audit.yml` - Will be enhanced
- `deploy.yml` - Will be replaced with new deploy workflows
- `docs-validation.yml` - Will be enhanced
- `e2e-staging.yml` - Will be replaced with blocking E2E gate

### Duplicate/Obsolete Scripts
Based on repository scan, identified numerous duplicate scripts in various locations:
- Multiple test scripts in root and apps/
- Various .bat/.ps1 helper scripts
- Legacy migration files

## Action Plan
1. Consolidate CI/CD workflows to new hardening suite
2. Remove duplicate/obsolete scripts
3. Maintain Docker compose hierarchy for different environments
4. Update documentation references

## Changes Made
- Created hardening sprint branch: `hardening-sprint/20250812`
- Identified no critical legacy system references requiring immediate cleanup
- System already uses Temporal (not n8n) and Optimal/SGO providers (not SportsDataIO)