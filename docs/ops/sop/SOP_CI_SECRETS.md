# SOP: CI Secrets Configuration

> **Sprint**: CI-TRUTH-UNBLOCK-005 **Status**: AUTHORITATIVE **Last Updated**:
> 2026-02-28

---

## Overview

This document describes all GitHub Secrets required for CI/CD pipelines to pass.
Missing secrets will cause specific CI checks to fail with clear error messages.

---

## Required Secrets by Workflow

### E2E CI Pipeline (`.github/workflows/e2e-ci.yml`)

| Secret                      | Required | Purpose                         |
| --------------------------- | -------- | ------------------------------- |
| `SUPABASE_PROJECT_REF`      | Yes      | Supabase project reference ID   |
| `SUPABASE_ACCESS_TOKEN`     | Yes      | Supabase CLI authentication     |
| `SUPABASE_URL`              | Yes      | Supabase project URL            |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Service role key for admin RPCs |

**Failure Mode**: If any of these secrets are missing for main repo PRs, the
workflow will fail-closed with error:

```
::error::Missing required secrets: <list>
See docs/ops/sop/SOP_CI_SECRETS.md for configuration instructions.
```

**Note**: For forked PRs, this workflow skips automatically (secrets
unavailable).

---

### Supabase Database Migration (`.github/workflows/supabase-migrate.yml`)

| Secret                              | Required | Purpose                      |
| ----------------------------------- | -------- | ---------------------------- |
| `SUPABASE_ACCESS_TOKEN`             | Yes      | CLI authentication           |
| `SUPABASE_URL_STAGING`              | Yes      | Staging environment URL      |
| `SUPABASE_URL_PROD`                 | Yes      | Production environment URL   |
| `SUPABASE_SERVICE_ROLE_KEY_STAGING` | Yes      | Staging service role key     |
| `SUPABASE_SERVICE_ROLE_KEY_PROD`    | Yes      | Production service role key  |
| `SUPABASE_PROJECT_REF_STAGING`      | Yes      | Staging project reference    |
| `SUPABASE_PROJECT_REF_PROD`         | Yes      | Production project reference |

**Note**: This workflow is manually triggered via `workflow_dispatch`.

---

### Smart Form Gates (`.github/workflows/ci.yml`)

| Secret                          | Required | Purpose                      |
| ------------------------------- | -------- | ---------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Optional | E2E runtime audit (8th gate) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | E2E runtime audit (8th gate) |

**Note**: If these secrets are not configured, the workflow runs 7/8 static
gates which still provide compliance. The 8th gate (runtime audit with HAR
capture) is skipped.

---

### Container Registry (`.github/workflows/ci-cd-pipeline.yml`)

| Secret         | Required | Purpose                   |
| -------------- | -------- | ------------------------- |
| `GITHUB_TOKEN` | Auto     | Container registry access |

**Note**: `GITHUB_TOKEN` is automatically provided by GitHub Actions.

---

## Supabase Preview Branch Integration

The Supabase GitHub App integration creates preview database branches for PRs.

### Configuration Requirements

1. **Supabase GitHub App**: Must be installed on the repository
2. **Project Settings**: Enable "Preview Branches" in Supabase Dashboard
3. **Access Token**: `SUPABASE_ACCESS_TOKEN` must have project access

### Failure Mode

If the Supabase GitHub App is not properly configured:

- The "Supabase Preview" check will fail
- Error: "Cannot find project ref"

### Resolution

1. Go to your Supabase project dashboard
2. Navigate to **Settings > Integrations > GitHub**
3. Install/configure the GitHub integration
4. Ensure the repository is linked to the project
5. Add `SUPABASE_ACCESS_TOKEN` to GitHub Secrets

---

## Repository Secrets vs Environment Secrets

### Repository Secrets

- Available to all workflows in the repository
- Used for: E2E CI, Smart Form gates, general CI/CD
- Configured at: Settings > Secrets > Actions > Repository secrets

### Environment Secrets

- Scoped to specific deployment environments (staging, production)
- Used for: Deployment workflows with environment protection rules
- Configured at: Settings > Environments > [env] > Secrets

### How Workflows Resolve Secrets

```yaml
# Repository secret - available to all jobs
secrets.SUPABASE_URL

# Environment secret - requires `environment:` declaration
jobs:
  deploy:
    environment: production  # Unlocks environment secrets
    steps:
      - run: echo "${{ secrets.PROD_SECRET }}"
```

### Current Configuration

| Workflow           | Secret Scope | Environment        |
| ------------------ | ------------ | ------------------ |
| E2E CI             | Repository   | N/A                |
| Smart Form Gates   | Repository   | N/A                |
| Supabase Migration | Repository   | staging/production |
| Deploy             | Environment  | staging/production |

---

## How to Configure Secrets

### Step 1: Navigate to Repository Settings

1. Go to GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**

### Step 2: Add Repository Secrets

Click **New repository secret** for each required secret:

#### Supabase Secrets

| Secret Name                 | Where to Find                                      |
| --------------------------- | -------------------------------------------------- |
| `SUPABASE_PROJECT_REF`      | Supabase Dashboard > Settings > General            |
| `SUPABASE_URL`              | Supabase Dashboard > Settings > API                |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard > Settings > API (service_role) |
| `SUPABASE_ACCESS_TOKEN`     | Supabase Dashboard > Account > Access Tokens       |

#### Environment-Specific Secrets

For staging/production workflows, create separate secrets:

- `SUPABASE_URL_STAGING` / `SUPABASE_URL_PROD`
- `SUPABASE_SERVICE_ROLE_KEY_STAGING` / `SUPABASE_SERVICE_ROLE_KEY_PROD`
- `SUPABASE_PROJECT_REF_STAGING` / `SUPABASE_PROJECT_REF_PROD`

---

## Fork PR Handling

GitHub does not expose secrets to workflows triggered by fork PRs for security.

### Implemented Behavior

| Workflow     | Fork PR Behavior                             |
| ------------ | -------------------------------------------- |
| E2E CI       | Skips entirely (job-level `if` condition)    |
| Smart Form   | Runs static gates (7/8), skips runtime audit |
| Code Quality | Runs fully (no secrets required)             |
| Lifecycle    | Runs fully (no secrets required)             |

### Detection Logic

```yaml
# Skip for forked PRs
if: |
  github.event_name == 'push' ||
  github.event_name == 'workflow_dispatch' ||
  (github.event_name == 'pull_request' &&
   github.event.pull_request.head.repo.full_name == github.repository)
```

---

## Troubleshooting

### "Missing required secrets" Error

**Cause**: Secrets not configured in repository settings.

**Resolution**:

1. Navigate to Settings > Secrets > Actions
2. Add missing secrets per table above
3. Re-run the workflow

### "Cannot find project ref" Error

**Cause**: `SUPABASE_PROJECT_REF` is empty or incorrect.

**Resolution**:

1. Get project ref from Supabase Dashboard > Settings > General
2. Update the secret value in GitHub

### Fork PR Failing on Secrets

**Cause**: GitHub doesn't expose secrets to fork PRs.

**Resolution**: This is expected behavior. The workflow should skip or degrade
gracefully per the fork PR handling table above.

---

## Security Notes

1. **Never commit secrets** to the repository
2. **Use environment-specific secrets** for staging/production
3. **Rotate secrets periodically** (recommended: quarterly)
4. **Audit secret access** via GitHub audit log
5. **Service role keys** have elevated privileges - protect accordingly

---

## References

- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase Access Tokens](https://supabase.com/docs/guides/platform/access-tokens)
- [Supabase CLI Authentication](https://supabase.com/docs/guides/cli/getting-started)

---

**Document Owner**: Engineering Team **Sprint Reference**: CI-TRUTH-UNBLOCK-005
