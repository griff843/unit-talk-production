# Unit Talk Discord Onboarding — Whop Integration Plan (Phase 1)

Last updated: 2025-09-21
Owner: Engineering
Status: Design approved pending implementation

## 1) Goals and Scope

- Make Whop the source of truth for membership and tier (Trial, Member, VIP, VIP+)
- Automate role assignment/downgrades in Discord via webhook-driven events
- Introduce a premium, concierge-style onboarding that is personalized and paced
- Preserve existing tier-change DMs and implement trial reminder DMs (T-48h, T-6h)
- Add new Trial Member role and progression to paid or free Member
- Maintain backward compatibility and provide safe rollout controls

## 2) High-Level Architecture

```mermaid
flowchart LR
  subgraph External
    W[Whop]-- webhooks -->API
  end
  subgraph UnitTalk
    API[API Webhook Handler]\napps/api
    DB[(Supabase)]
    Q[(Redis/Queue)]
    BOT[Discord Bot]\napps/discord-bot
  end
  API-- verify & persist -->DB
  API-- enqueue role job -->Q
  BOT-- consume job -->Q
  BOT-- assign/remove roles -->Discord
  BOT-- send DMs -->Discord
  BOT-- audit -->DB
```

Transport options (internal service-to-service):
- Recommended: Redis queue (pub/sub or list) for role jobs and scheduled reminders
- Alternative: Bot exposes internal HTTP endpoint (HMAC) `/internal/roles/apply` (only on docker network)

## 3) Role Progression Matrix (Authoritative: Whop)

| Event | From | To | Discord Role Changes | DM Trigger |
|------|------|----|----------------------|-----------|
| trial.started | - | Trial | +Trial, -Member/-VIP/-VIP+ | Welcome Trial concierge DM (+experience selector)
| trial.will_end (T-48h) | Trial | Trial | none | Reminder DM #1 (value recap + feedback)
| trial.will_end (T-6h) | Trial | Trial | none | Reminder DM #2 (conversion CTA)
| trial.ended + payment_succeeded | Trial | VIP | -Trial, +VIP | VIP Welcome concierge DM
| trial.ended (no payment) | Trial | Member | -Trial, +Member | Trial end DM (soft downgrade)
| subscription.created (VIP) | Member | VIP | -Member, +VIP | VIP Welcome DM
| subscription.updated (VIP→VIP+) | VIP | VIP+ | +VIP+ (or replace) | VIP+ Welcome DM
| subscription.canceled / payment_failed | VIP/VIP+ | Member | -VIP/-VIP+, +Member | Downgrade DM

Notes:
- Only one of {Trial, Member, VIP, VIP+} should be active at a time (decide if VIP+ replaces VIP or stacks; we will replace)

## 4) User Journeys (Concierge-style, paced)

### Trial Member (primary funnel)
```mermaid
flowchart TD
  A[Join via Whop + Connect Discord] --> B[Assign Trial Role]
  B --> C[DM: Welcome + choose experience level]
  C --> D[DM: 1-step setup: follow 1-2 cappers + notification density]
  D --> E[Progressive channel unlock: Trial Lobby, VIP Showcase (read-only), General]
  E --> F[Daily micro-digest DM]
  F --> G[T-48h reminder DM]
  G --> H[T-6h reminder DM]
  H --> I{Conversion?}
  I -->|Yes| J[Assign VIP, VIP Welcome DM]
  I -->|No| K[Assign Member, Trial End DM]
```

### Member
- Welcome DM (simple map) → optional sport preferences → free resources tour → soft VIP preview

### VIP
- VIP Quickstart DM: follow cappers → notification density → introduce yourself in VIP Lounge → weekly performance snapshot DMs

### VIP+
- VIP+ Welcome DM: advanced analytics overview → early-access channels → concierge escalation path → pro tips micro-sequence

### Capper
- Application or whitelist → setup checklist (thread mapping, shadow post) → standards → activation announcement

### Staff
- Ops overview → drills (buttons/slash commands) → short policy quiz → Staff role granted

## 5) Webhook Event Mapping (Whop → Role/DM)

| Whop Event | Required Fields | API Action | Bot Action |
|------------|------------------|------------|------------|
| trial.started | whop_customer_id, discord_user_id?, trial_end_at | Upsert member, set tier=trial, schedule reminders | Assign Trial, send Trial Welcome DM
| trial.will_end | whop_customer_id, trial_end_at | Ensure schedule; idempotent | Send Reminder DM (T-48h or T-6h)
| trial.ended | whop_customer_id, status, payment_status | Update tier → VIP if paid; else Member | Assign target role; send DM
| subscription.created | whop_customer_id, plan_tier | Update tier (VIP/VIP+) | Assign target role; send DM
| subscription.updated | whop_customer_id, plan_tier | Update tier | Adjust role; send DM
| subscription.canceled | whop_customer_id | Update tier=Member | Assign Member; send downgrade DM
| payment_failed | whop_customer_id | Mark grace + notify | DM payment issue + pending downgrade

If discord_user_id unknown: create pending link state and DM/email a “Connect Discord” claim link.

## 6) Database Schema Updates (Supabase)

Tables (new)
- members
  - id (uuid, pk)
  - whop_customer_id (text, unique)
  - discord_user_id (text, unique nullable)
  - tier (enum: trial, member, vip, vip_plus)
  - trial_end_at (timestamptz, nullable)
  - status (enum: active, canceled, past_due, trialing)
  - last_event (text)
  - last_synced_at (timestamptz)
  - created_at, updated_at (timestamptz)

- membership_events
  - id (uuid, pk)
  - whop_customer_id (text)
  - discord_user_id (text, nullable)
  - event_type (text)
  - event_payload (jsonb)
  - processed (boolean)
  - created_at (timestamptz)

- onboarding_state
  - id (uuid, pk)
  - discord_user_id (text, unique)
  - track (text: trial/member/vip/vip_plus/capper/staff)
  - step (text)
  - experience_level (text: beginner/intermediate/advanced)
  - started_at, updated_at (timestamptz)
  - completed_at (timestamptz, nullable)

- role_audit
  - id (uuid, pk)
  - discord_user_id (text)
  - from_role (text)
  - to_role (text)
  - reason (text)
  - source_event (text)
  - created_at (timestamptz)

- reminder_jobs
  - id (uuid, pk)
  - discord_user_id (text)
  - type (text: trial_t48, trial_t6)
  - run_at (timestamptz)
  - status (queued|sent|canceled)
  - created_at, updated_at (timestamptz)

Indexes/constraints
- Unique whop_customer_id on members
- Unique discord_user_id on members (nullable unique)
- Index reminder_jobs(run_at)

## 7) API Endpoints (Webhook + Internal)

Public (verify HMAC signature + rate limit + replay protection)
- POST /api/webhooks/whop
  - Headers: X-Whop-Signature, X-Whop-Timestamp
  - Body: Whop event payload (JSON)
  - 200 OK on idempotent accept; 401/403 on signature fail

Internal (optional, if using HTTP between API→Bot)
- POST http://discord-bot:PORT/internal/roles/apply
  - Header: X-Internal-Signature (HMAC)
  - Body: { discord_user_id, add: string[], remove: string[], reason, source_event }
- POST http://discord-bot:PORT/internal/notify
  - Body: { discord_user_id, template: string, context: object }

If using Redis jobs (recommended):
- Queue: role_jobs (payload: above)
- Queue: reminder_jobs (discord_user_id, type, run_at)

## 8) Security Requirements

- Verify Whop webhook signatures (HMAC using Whop secret)
- Reject stale timestamps (>5 minutes) and repeated nonces (store nonce for 10 minutes)
- Service-to-service auth:
  - HTTP: HMAC with rotating secrets in .env
  - Redis: scoped channels and secret; restrict to docker network
- Strict rate limiting on webhook endpoint; structured logging of all verifications
- PII minimization: store only necessary identifiers

## 9) RoleService (discord-bot) – Responsibilities

- Idempotent role mutations with invariants:
  - Exactly one of {Trial, Member, VIP, VIP+} at a time
  - VIP+ replaces VIP
- Comprehensive audit logging → role_audit
- Error handling with DLQ (dead-letter) for failed discord operations
- Backoff + retry for Discord rate limits

## 10) DM Templates (concierge tone)

- Trial Welcome: experience selection + 1-step setup
- Trial Reminder T-48h: value recap + 1 question feedback (buttons)
- Trial Reminder T-6h: conversion CTA + concierge assist
- VIP Welcome: quickstart (follow cappers, notification density), community intro
- VIP+ Welcome: advanced features + concierge escalation
- Downgrade notifications: clear next steps + soft re-upgrade CTA

## 11) Testing Strategy

Environments
- Local docker (sandbox mode), Staging, Production with feature flags

Tests
- Signature verification unit tests
- Webhook → role mutation E2E using Whop sandbox payloads (record/replay)
- Trial reminder scheduling and execution (time travel/simulation)
- DM sequence correctness per tier and experience level
- Idempotency tests (duplicate events)
- Rollback tests: failure of bot → DLQ without losing events

Success metrics
- Join→Personalize→First action conversion rate
- Trial conversion rate; TTFA (time to first action)
- DM opt-out rate; funnel drop-off points

## 12) Rollout Plan

- Phase-gate behind feature flags:
  - whop_webhooks_enabled
  - trial_role_enabled
  - concierge_dm_enabled
- Dark launch: ingest webhooks, write to DB, no role changes for 24–48h
- Canary: enable role changes for internal testers
- Full rollout: enable in production; monitor dashboards and logs
- Backout: disable flags; resume legacy DMs only

## 13) Implementation Checklist (Phase 2+)

- [ ] Create DB tables and migrations
- [ ] Implement /api/webhooks/whop with HMAC verify + idempotency
- [ ] Implement queue publishing for role/reminder jobs
- [ ] Build RoleService in discord-bot with audit + invariants
- [ ] Implement reminder scheduler/worker in bot
- [ ] Create DM templates + personalization (experience level)
- [ ] Start Here channel: role selection panel + progressive unlock
- [ ] Preserve existing tier change DMs; swap to new templates
- [ ] Instrument metrics and dashboards
- [ ] Staging E2E with Whop sandbox; go/no-go review

---

Questions for Product/Ops
- Confirm VIP+ role replaces VIP (vs stacking)
- Confirm Discord “Connect” is required in Whop checkout (preferred)
- Provide channel IDs for progressive unlock per tier
- Provide concierge signatures and tone guide

