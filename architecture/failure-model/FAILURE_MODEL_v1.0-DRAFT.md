# FAILURE MODEL

Invariant violations trigger Architectural Freeze.

---

## Discord Outage

- Outbox retries.
- Backlog monitored.
- Alert issued if max age exceeded.
- Canonical state unaffected.

---

## Provider Outage

- Ingestion paused.
- Confidence level reduced.
- Alert issued.
- No silent degraded mode.

---

## Settlement Surge

- Queue backpressure enforced.
- Settlement immutability preserved.
- Recap delayed but deterministic.

---

## Billing Failure

- Entitlement auto-revoked.
- Canonical lifecycle unaffected.
