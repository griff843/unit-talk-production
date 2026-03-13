# Virtual Event Clock — Specification

Version: 1.0 Status: Canonical Authority: Architecture Layer Sprint:
SPRINT-VERIFICATION-DOCS-GOVERNANCE-ALIGNMENT

This document defines the specification and contract for the `VirtualEventClock`
and `RealClockProvider` clock abstraction layer.

---

# 1. Purpose

The clock abstraction layer enables the pipeline to run without depending on
wall-clock time.

In production, the pipeline uses real wall-clock time. In replay, shadow, fault,
and simulation modes, the pipeline uses a virtual clock that advances based on
event timestamps in the journal.

This makes verification runs:

- fully reproducible regardless of when they are executed
- deterministic across multiple runs of the same event journal
- independent of external time sources or NTP synchronization

---

# 2. Clock Interface

Both clock providers implement the same interface:

```typescript
interface ClockProvider {
  now(): number; // Returns Unix timestamp in milliseconds
}
```

Anywhere the pipeline needs the current time, it must call `resolveNow(clock)` —
not `Date.now()` directly.

---

# 3. RealClockProvider

**Status**: COMPLETE **File**: `apps/api/src/lib/verification/clock.ts`
**Mode**: `production`

Behavior: Returns `Date.now()` — standard wall-clock time.

Used exclusively in `production` mode.

---

# 4. VirtualEventClock

**Status**: COMPLETE **File**: `apps/api/src/lib/verification/clock.ts`
**Modes**: `replay`, `fault`, `simulation`

## 4.1 Initialization

The `VirtualEventClock` is initialized with the timestamp of the first event in
the event journal:

```
VirtualEventClock.init(events[0].timestamp)
```

After initialization, `now()` returns that timestamp.

## 4.2 Advancement

Before each event is dispatched to the lifecycle runner, the clock is advanced
to that event's timestamp:

```
VirtualEventClock.advanceTo(event.timestamp)
```

The clock only advances forward. Attempts to advance to a timestamp earlier than
the current value are rejected with a hard error. This ensures monotonic time
progression.

## 4.3 Monotonicity Guarantee

The `VirtualEventClock` provides the following guarantee:

- `now()` returns a value ≥ the previous call to `now()`
- `advanceTo(t)` where `t < current` is a hard error, not a silent no-op

This guarantee is essential for determinism: if two replay runs process the same
event journal, they will see exactly the same sequence of timestamps.

## 4.4 Clock Advancement Log

Every call to `advanceTo()` is recorded in the proof bundle's `clock-log.jsonl`:

```json
{"sequenceNumber":1,"from":"2026-03-01T10:00:00Z","to":"2026-03-01T10:01:00Z"}
{"sequenceNumber":2,"from":"2026-03-01T10:01:00Z","to":"2026-03-01T10:02:00Z"}
```

This log provides a complete audit trail of time advancement during the run.

---

# 5. resolveNow() Helper

```typescript
function resolveNow(clock: ClockProvider): number;
```

This helper resolves the current time using the provided clock provider.

Pipeline code should use `resolveNow(clock)` instead of `Date.now()` wherever
the current time is needed. This allows seamless switching between production
and non-production clock providers.

---

# 6. RunController Validation

The `RunController` enforces clock/mode compatibility:

| Mode         | Required Clock                             |
| ------------ | ------------------------------------------ |
| `production` | `RealClockProvider`                        |
| `replay`     | `VirtualEventClock`                        |
| `shadow`     | `RealClockProvider` or `VirtualEventClock` |
| `fault`      | `VirtualEventClock`                        |
| `simulation` | `VirtualEventClock`                        |

Providing a `VirtualEventClock` in `production` mode is rejected at
initialization time. Providing a `RealClockProvider` in `replay` mode is also
rejected.

---

# 7. What the Clock Does NOT Control

- The clock does not control real wall-clock progression in the host process.
- The clock does not affect database timestamps written outside the pipeline
  (e.g., Supabase `created_at` fields in production mode).
- The clock does not affect Temporal workflow scheduling.

In replay mode, all pick mutations go to `IsolatedPickStore` — so Supabase
timestamp behavior is irrelevant. But this constraint must be remembered when
designing replay scenarios that include complex timestamp-dependent logic.

---

# 8. Canonical References

| Document                         | Path                                                                   |
| -------------------------------- | ---------------------------------------------------------------------- |
| Master verification architecture | `docs/02_architecture/verification_architecture.md`                    |
| Replay framework                 | `docs/02_architecture/DETERMINISTIC_REPLAY_AND_SHADOW_FRAMEWORK_v1.md` |
| Fault injection                  | `docs/02_architecture/SCENARIO_AND_FAILURE_INJECTION_SPEC_v1.md`       |
