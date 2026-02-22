# System Invariants (Non-Negotiable)

**Purpose:** These invariants define the *permanent* operating rules of Unit Talk.
Any change (feature, refactor, sprint, hotfix) must preserve these rules.
If a change cannot preserve them, the change is rejected or the architecture is redesigned.

**Enforcement Policy:**
- Each invariant must be enforced in **(1) code**, **(2) CI**, and **(3) runtime**.
- No "soft" enforcement. No silent fallbacks.
- "Done" is only allowed with proof artifacts + runtime receipts.

---

## Invariant 1 — Single-Writer Discipline (Canonical Writes)
**Rule:** `unified_picks` may only be written through the canonical lifecycle write path (lifecycle adapters / writer authority).
**Forbidden:** Any "direct write" to `unified_picks` outside the sanctioned write surface.
**Why:** Prevents drift, double-writes, inconsistent states, and race conditions.

**Required Enforcement**
- **Code:** All writes go through a single exported writer API; direct client/table writes are blocked or removed.
- **CI:** A "write-surface scan" fails builds if forbidden write patterns exist.
- **Runtime:** Writer logs include a "writer_id / authority" tag; unexpected writers error hard.

---

## Invariant 2 — Fail-Closed Environment (No Missing Env, No Silent Defaults)
**Rule:** If a required environment variable for the active profile is missing or malformed, the service must **crash** (or refuse to start).
**Forbidden:** Running with partial env, "best effort," or hidden defaults for secrets/URLs.

**Required Enforcement**
- **Code:** Central Zod schema validation at boot.
- **CI:** `pnpm ops:env:check` must pass for all apps/profiles.
- **Runtime:** `/health` reports env profile + validated status (without leaking secrets).

---

## Invariant 3 — Canonical Supabase Host Only
**Rule:** All Supabase URLs must match the canonical host: `cqfnsozknjzvyiziwicl.supabase.co`.
**Forbidden:** Pointing to different projects, accidental staging URLs, local copies, or malformed URLs.

**Required Enforcement**
- **Code:** Canonical host validation (URL parse + exact hostname match).
- **CI:** Env validation fails if host differs.
- **Runtime:** Health endpoints confirm canonical host (masked) and fail if mismatch.

---

## Invariant 4 — No Demo Mode Without Explicit Flag
**Rule:** Mocks, placeholders, and demo behaviors are only allowed when `DEMO_MODE=true` is explicitly set.
**Forbidden:** Implicit fallbacks like `return null`, "if env missing then mock," or "if query fails then placeholder."

**Required Enforcement**
- **Code:** Demo behaviors require a single shared gate check (`DEMO_MODE === true`) and must be centralized.
- **CI:** A "no-mocks" scan fails if mock code is reachable without DEMO_MODE. (`npm run cc:no-mocks`)
- **Runtime:** If DEMO_MODE is off, mock paths throw hard with an operator-safe error.

---

## Invariant 5 — Build vs Runtime Separation (Next.js Rules)
**Rule:** `NEXT_PUBLIC_*` variables are build-time inputs only; secrets must never be required at build time for app routes that are evaluated during `next build`.
**Forbidden:** Requiring service-role keys (or any secrets) during Next build or page-data collection.

**Required Enforcement**
- **Code:** Build-safe route patterns; server-only secrets accessed at runtime only.
- **CI:** Docker/CI build path validates no secret access during `next build`.
- **Runtime:** Secrets validated on boot for server processes, not in Next build pipeline.

---

## Invariant 6 — Idempotent Operations Everywhere
**Rule:** All state transitions and side effects must be idempotent. Retrying must be safe.
**Forbidden:** "Fire and pray" writes, duplicate Discord posts, double settlements, repeated promotions.

**Required Enforcement**
- **Code:** atomicClaim / idempotency keys / unique constraints.
- **CI:** Tests that re-run the same job twice and assert no duplicates.
- **Runtime:** Dedup counters + audit logs for retried work.

---

## Invariant 7 — State Machine Validity for Lifecycle
**Rule:** Lifecycle states may only transition along allowed edges; invalid transitions must be rejected.
**Forbidden:** "Set status directly" bypassing transition validation.

**Required Enforcement**
- **Code:** Central transition function validates edge legality.
- **CI:** State transition tests + forbidden transition tests.
- **Runtime:** Transition attempts are logged with from→to; invalid throws hard.

---

## Invariant 8 — Service Boundaries and Roles
**Rule:** Each service has a declared role (reader/writer) and must not exceed it.
**Forbidden:** Reader services writing, UI services mutating canonical tables, bots bypassing authority.

**Required Enforcement**
- **Code:** Role-specific clients; writer surface restricted.
- **CI:** Import-level restrictions (lint rules) and write-surface scans.
- **Runtime:** Writer authority checks; any violation fails closed.

---

## Invariant 9 — Proof-Based Completion
**Rule:** No sprint is "complete" without proofs + runtime receipts.
**Forbidden:** "Looks good" merges, unverified fixes, bypass flags, or "trust me" closures.

**Required Enforcement**
- **Code:** N/A (process invariant, enforced by workflow).
- **CI:** Required checks + artifact existence checks.
- **Runtime:** Real receipts: health endpoints, DB reads, Discord snowflake receipts when applicable.

---

## Invariant 10 — Schema Single Source of Truth
**Rule:** Production Supabase schema is canonical truth. Code must match it; optional modules must be gated, not "assumed."
**Forbidden:** Code creating phantom tables/types, stale type definitions, or schema guessing.

**Required Enforcement**
- **Code:** Generated types sourced from canonical schema pipeline.
- **CI:** Drift checks (`schema:check-drift`) and type generation checks.
- **Runtime:** Health endpoints expose schema version/commit metadata (non-sensitive).

---

## Change Control Checklist (Must Include in Every Sprint)
For any PR/sprint, include:
1) Which invariants are touched?
2) How each is enforced (code/CI/runtime)
3) Failure modes considered
4) Drift vectors eliminated
5) Proof bundle path + verification commands + receipts

If any item is missing, the sprint is not allowed to merge.

---

## Gate Commands Summary

| Invariant | Gate Command | Description |
|-----------|--------------|-------------|
| #1 | `npm run lifecycle:single-writer -- --strict` | Single-writer discipline |
| #2 | `pnpm ops:env:check` | Fail-closed environment |
| #3 | `npm run guard:supabase-endpoint` | Canonical Supabase host |
| #4 | `npm run cc:no-mocks` | No demo mode without flag |
| #5 | `pnpm ops:build:matrix` | Build vs runtime separation |
| #9 | `npm run sprint:validate` | Proof-based completion |
| #10 | `npm run schema:check-drift` | Schema single source of truth |

---

**Document Created**: 2026-02-22
**Last Updated**: SPRINT-TRUTH-RESTORATION-001
**Owner**: Engineering Team
