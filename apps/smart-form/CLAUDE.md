# CLAUDE.md - Smart Form

> **Sprint**: SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A **Status**: AUTHORITATIVE
> **Role**: BRIDGE OUTBOX WRITER **Last Updated**: 2026-02-22

---

## Overview

The Smart Form is a multi-step ticket submission application. It handles form
validation and writes events to `bridge_outbox`. The API's BridgeWorker
processes these events and creates picks in `unified_picks`.

**This service writes ONLY to `bridge_outbox` - never directly to
`unified_picks`.**

---

## Service Boundaries

### This Service OWNS

- Ticket submission UI
- Form validation (Zod schemas)
- `bridge_outbox` event creation
- User input sanitization
- Multi-step form flow

### This Service MUST NOT

- Process tickets after submission (API responsibility)
- Execute grading logic
- Modify settlement status
- Update `unified_picks` directly
- Define professional betting rules
- Access service-role keys

---

## Read/Write Surfaces

### Write Authority

| Table           | Purpose       | Idempotency Key |
| --------------- | ------------- | --------------- |
| `bridge_outbox` | Ticket events | `bet_slip_id`   |

### Read Access

| Table       | Purpose                   |
| ----------- | ------------------------- |
| `cappers`   | Capper selection dropdown |
| `sports`    | Sport selection           |
| `bet_types` | Bet type selection        |

### Forbidden

```typescript
// NEVER do this:
await supabase.from('unified_picks').insert(data);

// ALWAYS do this:
await supabase.from('bridge_outbox').insert({
  event_type: 'ticket_submitted',
  payload: ticketData,
  bet_slip_id: uniqueId, // Idempotency key
  status: 'pending',
});
```

---

## Environment Requirements

### All Profiles

| Variable   | Required | Description                         |
| ---------- | -------- | ----------------------------------- |
| `NODE_ENV` | Yes      | `development`, `test`, `production` |

### Local Profile

| Variable                        | Required | Source |
| ------------------------------- | -------- | ------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | `.env` |

### Docker Profile

| Variable                        | Required | Source     |
| ------------------------------- | -------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Build args |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Build args |

**Note**: `NEXT_PUBLIC_*` vars are embedded at BUILD time, not runtime.

### CI Profile

| Variable                        | Required    | Notes      |
| ------------------------------- | ----------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Placeholder | Build-only |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Placeholder | Build-only |

### Production Profile

| Variable                        | Required | Source           |
| ------------------------------- | -------- | ---------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Yes      | Baked into image |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes      | Baked into image |

---

## Development Commands

### Development

```bash
# Local
pnpm --filter smart-form dev

# Docker
docker-compose exec smart-form npm run dev
```

### Build & Verify

```bash
pnpm --filter smart-form build
pnpm --filter smart-form type-check
pnpm --filter smart-form test
```

---

## Health Checks

### Endpoint

```
GET /api/health
```

### Expected Response

```json
{
  "status": "healthy",
  "service": "smart-form",
  "supabase": "connected",
  "timestamp": "2026-02-22T12:00:00Z"
}
```

### Verification

```bash
# Local
curl http://localhost:3021/api/health

# Docker
curl http://localhost:3021/api/health

# Production
curl https://forms.unit-talk.com/api/health
```

---

## Common Failure Modes

| Failure                    | Cause                  | Prevention                      |
| -------------------------- | ---------------------- | ------------------------------- |
| Direct unified_picks write | Wrong table target     | Code review + lint rules        |
| Duplicate submission       | Missing idempotency    | `bet_slip_id` unique constraint |
| Build-time secret access   | Requiring service-role | Only use anon key               |
| Form validation bypass     | Client-side only       | Server-side Zod validation      |
| Bridge event lost          | No retry mechanism     | BridgeWorker retry with backoff |

---

## Form Flow

### Steps

1. **Step 1: Essentials** - Capper, sport, bet type, confidence
2. **Step 2: Configuration** - Additional settings
3. **Step 3: Bet Details** - Odds, stake, selection
4. **Step 4: Game Selection** - Match selection, confirmation

### Event Flow

```
User submits form
    ↓
Ticket written to bridge_outbox (status: pending)
    ↓
BridgeWorker (API) polls and processes
    ↓
Pick created in unified_picks via lifecycle adapter
    ↓
bridge_outbox event marked processed
```

---

## Technology Stack

- Next.js 14 (App Router)
- React Hook Form
- Zod validation
- Radix UI
- Tailwind CSS

---

## References

- Root Governance: `../../CLAUDE.md`
- Execution Contract: `../../CLAUDE_EXECUTION_CONTRACT.md`
- System Invariants: `../../docs/SYSTEM_INVARIANTS.md`
- Env Contract: `../../docs/ENV_CONTRACT.md`
- Ops Wiring Plan: `../../docs/OPS_WIRING_PLAN.md`

---

**Document Owner**: Engineering Team **Last Audit**:
SPRINT-CLAUDE-CONTRACT-UNIFICATION-115A
