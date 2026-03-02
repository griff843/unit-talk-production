# Unit Talk OS — GitHub Actions Setup

## Quick Start

1. Copy this entire `.github/` folder into the root of your
   `unit-talk-production` repo
2. Add the required secrets (see below)
3. Push to main — the workflows activate automatically

## Required Secrets

Go to your GitHub repo → Settings → Secrets and variables → Actions → New
repository secret

| Secret                | Required | Description                                                                             |
| --------------------- | -------- | --------------------------------------------------------------------------------------- |
| `NOTION_API_KEY`      | YES      | Your Notion internal integration token. Create at https://www.notion.so/my-integrations |
| `DISCORD_WEBHOOK_URL` | Optional | Discord webhook URL for contract drift critical alerts                                  |

## Creating the Notion Integration

1. Go to https://www.notion.so/my-integrations
2. Click "New integration"
3. Name it "Unit Talk OS Automation"
4. Select your workspace
5. Copy the "Internal Integration Secret" — this is your `NOTION_API_KEY`
6. Go to your Unit Talk Operating System v1.0 page in Notion
7. Click the `...` menu → "Connections" → Add your integration
8. This gives the integration access to all databases under that page

## What Each Workflow Does

### 1. PR → Task Sync (`notion-pr-sync.yml`)

- **Triggers on:** PR opened, closed, reopened
- **What it does:** Updates Task Registry status based on PR state
- **Task matching:** Add `Notion-Task: https://www.notion.so/<page-id>` in PR
  description, or it matches by PR title
- **Status mapping:**
  - PR Opened → Active
  - PR Merged → Awaiting Proof
  - PR Closed (not merged) → Blocked

### 2. Lock Tag Detection (`notion-lock-tag.yml`)

- **Triggers on:** Git tag push matching `LOCK-*`
- **What it does:** Finds sprint with matching Lock Tag, sets status to Locked
- **Phase cascade:** If all sprints for a phase are locked, the phase auto-locks
  too
- **Usage:** `git tag LOCK-P1-STRUCTURAL && git push --tags`

### 3. CI Failure Detection (`notion-ci-failure.yml`)

- **Triggers on:** Your CI workflow completing with failure
- **What it does:** Finds sprint by Git Branch field, flags active tasks as
  Blocked
- **IMPORTANT:** Change the `workflows: ["CI"]` value in the YAML to match your
  actual CI workflow name

### 4. Contract Drift Detection (`notion-contract-drift.yml`)

- **Triggers on:** Push to main that modifies files in `contracts/`
- **What it does:** Checks each changed file against Contract Index
- **Critical alert:** If a LOCKED contract is modified, the workflow FAILS and
  logs to Decision Log
- **Optional:** Sends Discord webhook alert for critical drift

## Database IDs Reference

These are hardcoded in the workflows and match your current Notion workspace:

| Database        | Data Source ID                         |
| --------------- | -------------------------------------- |
| Phase Registry  | `9f28632b-d98b-4a3d-aff3-86ff945711e9` |
| Sprint Registry | `52d622d5-2eaf-4e6d-8930-7b8274b8ab84` |
| Task Registry   | `42d94858-efe9-43ff-a973-bc8a9da98f53` |
| Contract Index  | `0a7d4850-38fa-4d19-9377-6440dba6fc32` |
| Decision Log    | `cf5d6124-149e-4c17-ade1-3c64a09820f8` |

## Verifying It Works

1. After pushing the workflows, go to your repo → Actions tab
2. You should see 4 new workflows listed
3. Test PR sync by opening a test PR
4. Test lock tag by pushing: `git tag LOCK-TEST && git push --tags` (then delete
   it after)
5. Test contract drift by modifying any file in `contracts/` on a branch and
   merging to main
