# GitHub Auth Truth Lock

> SPRINT-GITHUB-AUTH-TRUTH-LOCK-007

## Overview

The Reality Report daemon creates GitHub Issues from AI-generated task
candidates. This requires **write** access to the repository's Issues API.
Authentication uses a layered strategy with fail-closed CI behavior.

## Auth Priority

| Tier | Source      | Env Vars                                                                | CI Valid | Notes                                    |
| ---- | ----------- | ----------------------------------------------------------------------- | -------- | ---------------------------------------- |
| 1    | GitHub App  | `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_INSTALLATION_ID` | Yes      | Preferred. Short-lived tokens.           |
| 2    | Classic PAT | `GITHUB_TOKEN_CLASSIC`                                                  | Yes      | Must have `repo` + `issues` scope.       |
| 3    | GH_TOKEN    | `GH_TOKEN` (from `gh auth login`)                                       | **No**   | Local dev only. Rejected when `CI=true`. |

## Minimum Scopes

### GitHub App Permissions

| Permission | Access       | Why                           |
| ---------- | ------------ | ----------------------------- |
| Issues     | Read & Write | Create/update task issues     |
| Metadata   | Read         | Search issues by body content |

### Classic PAT Scopes

- `repo` (includes issues access)
- Or fine-grained: `Issues: Read and write` + `Metadata: Read`

## CI Configuration

Set these secrets in your CI environment:

```yaml
# Option A: GitHub App (preferred)
GITHUB_APP_ID: ${{ secrets.GITHUB_APP_ID }}
GITHUB_APP_PRIVATE_KEY: ${{ secrets.GITHUB_APP_PRIVATE_KEY }}
GITHUB_APP_INSTALLATION_ID: ${{ secrets.GITHUB_APP_INSTALLATION_ID }}

# Option B: Classic PAT
GITHUB_TOKEN_CLASSIC: ${{ secrets.GITHUB_TOKEN_CLASSIC }}
```

When `CI=true` and neither App nor Classic PAT credentials are available, the
task generator will throw a `GitHubAuthError` with code `no_credential`. This
error is caught by the report runner's fail-safe wrapper — the report still
publishes to Huly, but no GitHub issues are created.

## Local Development

For local dev, `gh auth login` provides `GH_TOKEN` automatically. The adapter
picks it up as a Tier 3 fallback. No extra configuration needed.

```bash
# Verify gh CLI is authenticated
gh auth status

# Run with GH_TOKEN injected
GH_TOKEN=$(gh auth token) pnpm huly-os:report:run
```

## Token Rotation

### GitHub App

App installation tokens are short-lived (1 hour). The auth helper mints a fresh
token on each run. No manual rotation needed.

### Classic PAT

Classic PATs must be rotated manually. Set an expiry reminder. Update the CI
secret when rotating.

### GH_TOKEN

Managed by `gh` CLI. Refresh with `gh auth refresh`.

## Troubleshooting

| Error Code                  | Meaning                         | Fix                                        |
| --------------------------- | ------------------------------- | ------------------------------------------ |
| `ci_rejected`               | GH_TOKEN used in CI             | Add GITHUB*APP*\* or GITHUB_TOKEN_CLASSIC  |
| `no_credential`             | No token found                  | See Auth Priority table above              |
| `app_token_exchange_failed` | App JWT rejected                | Check APP_ID, private key, installation ID |
| `app_token_missing`         | Exchange succeeded but no token | Check App installation permissions         |

## Implementation

- Auth helper: `tools/huly-os/daemon/adapters/github-auth.ts`
- Issues adapter: `tools/huly-os/daemon/adapters/github-issues.ts`
- Wired in: `tools/huly-os/daemon/report-runner.ts` (task generation step)
