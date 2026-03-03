# Supabase CI Environment Setup

> **Sprint**: SUPABASE-SECRET-CONTRACT-LOCK-001 **Status**: REQUIRED before
> Supabase-dependent CI checks pass

## Problem

Supabase secrets exist only at GitHub Environment level (staging, production)
but CI workflows read them as repository-level secrets. Repository-level secrets
resolve to empty strings, tripping fail-closed guards on every PR.

## Solution: `ci` GitHub Environment

Create a dedicated `ci` environment with no manual approvals that holds the
Supabase secrets needed for PR validation workflows.

---

## Step 1: Create the `ci` environment

```bash
# Creates the environment with no protection rules
gh api repos/{owner}/{repo}/environments/ci -X PUT -f wait_timer=0
```

Or: GitHub UI > Settings > Environments > New environment > Name: `ci`

**Important**: Do NOT add required reviewers or wait timers. PR checks must run
without manual approval.

---

## Step 2: Set environment secrets

The following secrets must be set in the `ci` environment. Use staging-scoped
values (NOT production keys).

### Required secrets

| Secret                          | Source                                          | Used by             |
| ------------------------------- | ----------------------------------------------- | ------------------- |
| `SUPABASE_URL`                  | Supabase Dashboard > Project Settings > API     | e2e-ci.yml          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase Dashboard > Project Settings > API     | e2e-ci.yml          |
| `SUPABASE_PROJECT_REF`          | Supabase Dashboard > Project Settings > General | e2e-ci.yml          |
| `SUPABASE_ANON_KEY`             | Supabase Dashboard > Project Settings > API     | ci.yml              |
| `NEXT_PUBLIC_SUPABASE_URL`      | Same as SUPABASE_URL                            | ci.yml (smart-form) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as SUPABASE_ANON_KEY                       | ci.yml (smart-form) |

### Commands

```bash
# Set each secret (will prompt for value)
gh secret set SUPABASE_URL --env ci
gh secret set SUPABASE_SERVICE_ROLE_KEY --env ci
gh secret set SUPABASE_PROJECT_REF --env ci
gh secret set SUPABASE_ANON_KEY --env ci
gh secret set NEXT_PUBLIC_SUPABASE_URL --env ci
gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --env ci
```

Or set non-interactively:

```bash
gh secret set SUPABASE_URL --env ci --body "https://YOUR_PROJECT.supabase.co"
```

### Note on SUPABASE_ACCESS_TOKEN

`SUPABASE_ACCESS_TOKEN` is already configured as a **repository-level** secret.
Repository secrets are available to all environments, so it does not need to be
duplicated into the `ci` environment.

---

## Step 3: Verify existing environments

The `staging` and `production` environments already have the correct secrets.
Verify with:

```bash
gh api repos/{owner}/{repo}/environments/staging/secrets --jq '.secrets[].name'
gh api repos/{owner}/{repo}/environments/production/secrets --jq '.secrets[].name'
```

Expected staging secrets include: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`, `SUPABASE_DB_PASSWORD`.

---

## Step 4: Verify CI passes

After setting secrets, re-run the failing workflows:

```bash
# Re-run the E2E CI Pipeline (main offender)
gh workflow run e2e-ci.yml

# Or push a trivial commit to trigger PR checks
```

### Expected results after setup

| Workflow   | Check                                        | Expected |
| ---------- | -------------------------------------------- | -------- |
| e2e-ci.yml | Supabase migrate / admin RPCs / Gates / SLOs | PASS     |
| ci.yml     | Smart Form V1.1 Compliance Gates (8/8)       | PASS     |

---

## Security Notes

- Use **staging** credentials for the `ci` environment, never production
- The `ci` environment should have the **least privilege** needed for tests
- `SUPABASE_SERVICE_ROLE_KEY` has admin access; only use staging project
- Rotate keys if they are ever exposed in CI logs (check masking)
- The guard script (`scripts/ci/guard-supabase-env.mjs`) prevents future
  regressions by failing if any job uses Supabase secrets without `environment:`

---

## Contract: Environment/Secret Mapping

| Environment  | Purpose                          | Triggered by                              |
| ------------ | -------------------------------- | ----------------------------------------- |
| `ci`         | PR validation, E2E checks        | pull_request, push                        |
| `staging`    | Deploy verification, nightly E2E | workflow_dispatch, schedule, push to main |
| `production` | Production deploys, acceptance   | workflow_dispatch only                    |

### Rule (enforced by guard script)

> Any job that references `secrets.*SUPABASE*` MUST declare
> `environment: ci | staging | production`. Violations fail CI.

---

## Troubleshooting

### "Missing required secrets" in E2E CI Pipeline

1. Check that the `ci` environment exists:
   `gh api repos/{owner}/{repo}/environments/ci`
2. Check that secrets are set:
   `gh api repos/{owner}/{repo}/environments/ci/secrets --jq '.secrets[].name'`
3. Verify the workflow job has `environment: ci` (not missing)

### "Dependencies lock file is not found"

Separate issue: workflow uses `cache: npm` instead of `cache: pnpm`. See PR #88
fix.

### Guard script fails locally

```bash
node scripts/ci/guard-supabase-env.mjs
```

If it reports violations, add `environment:` to the listed jobs.
