# Skill: Discord Diagnose

## Purpose

Structured diagnostic workflow for Unit Talk Discord delivery and workflow
failures. Classifies the issue, identifies the likely failure layer, and routes
to the correct next action — without claiming runtime visibility the operator
does not actually have.

**Portability class:** Unit Talk-Specific v1 (pattern may generalize to
`delivery-diagnose` in a future adapter-based version)

## Invocation

```
/discord-diagnose
```

With symptom hint:

```
/discord-diagnose --symptom "pick not posted to channel"
/discord-diagnose --symptom "wrong channel"
/discord-diagnose --symptom "embed missing fields"
```

---

## When to Use

Run `/discord-diagnose` when:

- A pick post did not appear in Discord when expected
- A message posted to the wrong channel or thread
- An embed is malformed, missing fields, or incomplete
- A Discord command flow behaves unexpectedly
- A role-gated experience doesn't match expectations
- Onboarding DMs did not fire or fired incorrectly
- Alerts or recap messages failed to deliver
- The symptom appears Discord-related but the actual root cause is uncertain
- You're about to start an unstructured Discord debug session — use this first

**Do not use** for general platform issues unrelated to Discord delivery.

---

## Required Inputs (gather before starting)

| Input                 | What it is                                                                          |
| --------------------- | ----------------------------------------------------------------------------------- |
| Expected behavior     | What should have happened                                                           |
| Actual behavior       | What actually happened (or didn't)                                                  |
| Workflow context      | Which workflow/agent/feature triggered it (posting, recap, alert, onboarding, etc.) |
| Channel/route context | Target channel, thread, DM, or command                                              |
| Timing                | When did this happen / when was it last working                                     |

---

## Optional Inputs

- Discord channel IDs
- Message type or slash command name
- Screenshots or embed screenshots
- Related pick ID, bet slip ID, or workflow identifier
- Recent deployment or sprint that may have changed related code
- Any error logs or output from the Discord bot process

---

## Failure Class Reference

Before starting diagnosis, identify which failure class best fits the symptom:

| Class                    | Description                                          | Example Symptoms                          |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------- |
| **ROUTING**              | Message sent to wrong destination                    | Posted to wrong channel, wrong thread     |
| **PERMISSION**           | Bot lacks required access                            | Embed rejected, message blocked, 403      |
| **UPSTREAM_WORKFLOW**    | Discord symptom caused by API/agent failure upstream | Pick never reached posting stage          |
| **CONTENT_GENERATION**   | Embed or message content is malformed                | Missing fields, null values, wrong format |
| **ENV_MISMATCH**         | Dev/staging/prod config divergence                   | Works locally, fails in prod              |
| **STALE_STATE**          | Cached config, bot not restarted after change        | Old channel IDs, outdated role mappings   |
| **INCOMPLETE_WIRING**    | Feature was scaffolded but not fully connected       | Trigger exists but handler not wired      |
| **EXPECTATION_MISMATCH** | Behavior is correct per code, expectation was wrong  | Feature intentionally works this way      |

---

## Procedure

### Step 1: Classify the Symptom

Based on the inputs gathered, identify the most likely failure class from the
reference table above. Assign:

- **Primary class:** most likely
- **Secondary class:** if unclear, the second most likely
- **Confidence:** HIGH / MEDIUM / LOW

### Step 2: Inspect the Promotion / Posting Pipeline

For posting failures (pick not appearing in Discord), trace the posting path:

```bash
# Check unified_picks for the relevant pick
# Key fields to inspect:
# - lifecycle_stage: should be 'promoted' or 'posted'
# - posted_to_discord: should be true if posted
# - posting_channel_id: which channel was targeted
# - promotion_band: must not be null (null = never posted)
# - pick_origin: capper / system / null (determines which posting path)

# If pick_origin=capper → processCapperPicks() path
# If meta.system_approved=true → processSystemPicks() path
# If promotion_band=HARD and pick_origin IS NULL → processLegacyPicks() path
```

**Known failure patterns to check:**

- `promotion_band = NULL` → pick reached grading but never got a promotion band
  assigned → see SPRINT-DISCORD-WORKER-HEALTH-RESTORE fix (GradingAgent.ts line
  ~972: must return `result.promotionBand || 'HARD'`)
- `lifecycle_stage != 'promoted'` → pick did not pass promotion criteria
- `posted_to_discord = false` + correct stage → Discord posting agent may not
  have picked it up

### Step 3: Check Discord Bot Health

For any Discord failure, confirm bot is healthy:

```bash
# Check agent health table or health endpoint
# Look for discord_api and discord_gateway health rows
# discord_gateway intents must NOT include GuildPresences (removed in SPRINT-DISCORD-GATEWAY-INTENTS-ENABLEMENT)
# Expected health: discord_api = HEALTHY, discord_gateway = CONNECTED
```

If the bot is showing unhealthy or disconnected, **routing or content issues are
secondary** — fix bot health first.

### Step 4: Check Channel Routing Configuration

For wrong-channel failures:

```bash
# Inspect the Discord channel routing configuration
# Channel IDs are configured in environment or database config
# Check:
#   - DISCORD_CHANNEL_ID env vars
#   - Any channel routing tables or config files
#   - Whether the feature uses hardcoded IDs vs dynamic lookup
```

**Common cause:** Dev/staging channel IDs in a production deployment
(ENV_MISMATCH).

### Step 5: Check Permissions

For message-blocked or embed-rejected failures:

- Confirm bot has `Send Messages` permission in the target channel
- Confirm bot has `Embed Links` permission (required for rich embeds)
- Confirm bot role is not excluded from the channel's role permissions
- For DMs: confirm the user has DMs from server members enabled

### Step 6: Trace the Upstream Workflow

For failures where the pick/message never reached Discord:

```bash
# Inspect the workflow registry for the relevant workflow
# Check: apps/api/src/lib/workflows/ or the WorkflowRegistry
# GET /ops/workflows — lists all registered workflows and their states
# GET /ops/workflows/<name> — details for a specific workflow
```

Determine whether the trigger event fired, whether the agent received it, and
whether it reached the Discord posting stage.

### Step 7: Check for Incomplete Wiring

For features that were recently added but are not working:

- Check that the Discord handler file is registered (not just scaffolded)
- Check that the event listener or command handler is exported and imported in
  the main bot index
- Check that the slash command is registered with Discord's API (may need
  re-registration after change)

```bash
# Check discord-bot/src/commands/ or handlers/ for the relevant handler
# Verify it's imported in the main index or command loader
```

### Step 8: Generate Diagnosis Output

Use the format below.

---

## Output Format

```markdown
# Discord Diagnose — <symptom summary>

**Date**: <YYYY-MM-DD> **Symptom**: <one-line description> **Primary Class**:
<ROUTING | PERMISSION | UPSTREAM_WORKFLOW | CONTENT_GENERATION | ENV_MISMATCH |
STALE_STATE | INCOMPLETE_WIRING | EXPECTATION_MISMATCH> **Secondary Class**:
<class or N/A> **Confidence**: HIGH | MEDIUM | LOW

---

## Failure Analysis

<2-4 sentences: what the evidence points to, what layer is most likely
responsible, and why>

---

## Priority Checks

1. <Most important thing to check — specific query, endpoint, or file>
2. <Second check>
3. <Third check>

---

## Likely Owner / Next Path

- [ ] <Action 1 — e.g., "Inspect unified_picks.promotion_band for affected
      picks">
- [ ] <Action 2>
- [ ] <Action 3 — e.g., "Run /prompt-compose if code fix is needed">

---

## What This Is NOT

<One sentence noting what this diagnosis explicitly rules out or cannot assess
without more evidence>
```

---

## Failure Protocol

| Failure                            | Action                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| Cannot determine expected behavior | Ask operator — do not diagnose without it                           |
| Bot health is unhealthy            | Diagnose bot health first; Discord-level diagnosis is secondary     |
| Symptom is not Discord-related     | STOP — redirect to `/system-status` or `/incident-triage`           |
| Cannot access relevant pick data   | Note the gap; produce best available diagnosis with explicit caveat |
| Multiple classes equally plausible | Report both; recommend starting with the more verifiable one        |

---

## Non-Goals

This skill does NOT:

- Directly mutate Discord state, channel configs, or bot settings
- Claim runtime visibility it does not actually have — if a check requires live
  DB access, say so explicitly
- Replace end-to-end integration testing
- Diagnose non-Discord issues (platform health, phase blockers, scoring
  problems)
- Substitute for actual logs when logs are required for certainty

---

## Known Unit Talk Discord Architecture Reference

Key concepts to keep in mind during diagnosis:

| Component         | Location                        | Notes                                   |
| ----------------- | ------------------------------- | --------------------------------------- |
| Discord bot       | `apps/discord-bot/`             | Main bot process                        |
| Posting agent     | `apps/api/src/`                 | DiscordPromotionAgent or equivalent     |
| Posting paths     | 3 paths: capper, system, legacy | Pick origin determines path             |
| Promotion band    | `unified_picks.promotion_band`  | NULL = never promoted                   |
| Gateway intents   | `apps/discord-bot/`             | GuildPresences must NOT be included     |
| Channel routing   | Environment config              | Check DISCORD\_\* env vars              |
| Workflow registry | `apps/api/src/lib/workflows/`   | 18 registered workflows in 6 categories |
| Health rows       | `agent_health` table            | discord_api + discord_gateway rows      |

---

## Integration with Claude OS

| This skill uses                        | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `/system-status`                       | Check platform health before assuming Discord-specific cause |
| `/prompt-compose`                      | If fix path is identified — compose implementation prompt    |
| `docs/status/CURRENT_SYSTEM_STATUS.md` | Discord-related subsystem rows                               |
| `docs/status/DRIFT_REPORT.md`          | Any active Discord drift items                               |
| `apps/discord-bot/`                    | Bot source for wiring checks                                 |
| `apps/api/src/`                        | Upstream agent / workflow source                             |

---

## Notes

- Discord symptoms frequently have upstream causes — trace the full promotion
  path before assuming a Discord config issue
- Null `promotion_band` has been a persistent failure mode — always check this
  for posting failures
- Bot gateway intents were tightened in
  SPRINT-DISCORD-GATEWAY-INTENTS-ENABLEMENT — do not re-add GuildPresences
- If bot was recently redeployed, slash commands may need re-registration with
  Discord API
- This skill is Unit Talk-specific v1; a future `delivery-diagnose` adapter
  could generalize the pattern
