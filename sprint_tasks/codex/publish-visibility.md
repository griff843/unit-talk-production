# Codex Task: Publish Visibility Verifier

**Mode**: verify **Sprint**: on-demand **Agent**: publish-verifier

## Objective

Inspect the Unit Talk Discord publish proof path, outbox linkage, and Command
Center visibility chain from repo evidence. Produce a structured visibility
confidence report that operators can act on without guessing.

## Scope

**IN scope:**

- `apps/api/src/agents/DiscordPromotionAgent/` — posting logic
- `apps/api/src/agents/BridgeWorkerAgent/` — outbox consumer
- `apps/api/src/lib/lifecycle/` — atomicClaimForPost, posting state
- `apps/smart-form/src/` — bridge_outbox write path
- `apps/command-center/src/` — alert/picks/workflow pages for visibility
- `apps/api/src/routes/` — /api/alerts, /api/ops/workflows, /api/health routes
- `supabase/migrations/` — pick_publish, bridge_outbox schema

**OUT of scope:**

- Do not modify any file
- Do not run tests or build commands
- Do not query live Supabase (read code only)

## Constraints

- Read-only. Zero file writes.
- Base all findings on code evidence, not assumptions.
- If a path cannot be confirmed from repo evidence, say "UNVERIFIED" explicitly.
- Do not speculate beyond what the code shows.

## Required Output

Produce a structured visibility confidence report with these sections:

### 1. Submit Path

> smart-form → bridge_outbox → BridgeWorkerAgent → unified_picks

Trace each hop. For each hop: ✅ VERIFIED | ⚠️ PARTIAL | ❌ BROKEN | UNVERIFIED

### 2. Discord Post Path

> unified_picks → DiscordPromotionAgent → Discord embed → atomicClaimForPost

Trace each hop. State the trigger mechanism (scheduled? event-driven?).

### 3. Embed Build Confidence

- Does buildEmbedFromPresentation produce a valid embed structure?
- Is capper visibility handled correctly (hidden for 'Unit Talk')?
- Are stat type display fields mapped?

### 4. Command Center Visibility

- Can operators see pending picks? (route + page check)
- Can operators see posted picks?
- Are alerts visible? (/api/alerts → /dashboard/alerts)
- Is there a workflow management view?

### 5. Known Gaps / Risk Areas

List any paths marked PARTIAL or BROKEN with a one-line fix recommendation.

### 6. Operator Confidence Score

Rate each path: HIGH / MEDIUM / LOW confidence.

Format: Markdown with clear headers. Scannable. Use ✅/⚠️/❌ symbols.

## Acceptance Criteria

- [ ] All 4 visibility paths assessed (submit, post, embed, CC)
- [ ] Each hop explicitly marked VERIFIED / PARTIAL / BROKEN / UNVERIFIED
- [ ] At least one actionable gap identified (or "no gaps found" if clean)
- [ ] No files modified
