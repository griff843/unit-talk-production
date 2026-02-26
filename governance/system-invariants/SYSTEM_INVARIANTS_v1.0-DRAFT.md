# SYSTEM INVARIANTS

Version: 1.0  
Status: Draft  
Binding Over: All services, agents, and infrastructure

These invariants are non-negotiable.

Violation of any invariant triggers Architectural Freeze.

---

1. Production runtime must be Docker-only.
2. Boot must fail closed on missing required environment variables.
3. Exactly one writer per canonical table.
4. All external side effects must originate from outbox.
5. Settlement records immutable post-finalization.
6. Lifecycle transitions must be deterministic and replay-safe.
7. Replay must reproduce identical final state.
8. No silent failure permitted.
9. Billing truth exclusively governs entitlement.
10. Discord is rendering surface only.
11. Manual database modification prohibited outside versioned migration.
12. All privileged actions logged.
13. All timestamps server-generated and immutable.
14. Model versioning mandatory.
15. Backtest artifact required before deployment.
