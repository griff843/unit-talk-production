# Unit Talk System Invariants

Version: 1.0  
Status: Canonical  
Authority: Absolute

System invariants are conditions that must **always remain true** for the
platform to function correctly.

If an invariant is violated, the system is considered **in an invalid state**.

Invariant violations must trigger investigation and remediation.

---

# 1. Canonical Data Authority

The platform must maintain a single canonical source for pick lifecycle state.

Invariant:

The canonical pick lifecycle table is:

unified_picks

No alternative tables may act as the authoritative state for picks.

Legacy tables such as `daily_picks` must not be reintroduced.

---

# 2. Single Writer Enforcement

Each major system domain must have **exactly one writer**.

Invariant mapping:

| Domain              | Writer          |
| ------------------- | --------------- |
| Market ingestion    | FeedAgent       |
| Pick scoring        | ScoringAgent    |
| Promotion decisions | PromotionEngine |
| Alert generation    | AlertAgent      |
| Settlement          | SettlementAgent |
| Discord publication | Discord Outbox  |

Multiple writers to the same state are forbidden.

---

# 3. Deterministic Pick Lifecycle

Every pick must pass through a deterministic lifecycle.

Lifecycle stages:

ingested → scored → promotion_evaluated → promoted → published → settled

A pick may not skip lifecycle stages.

---

# 4. Promotion Authority Boundary

Only the Promotion Engine may change a pick’s promotion state.

Invariant:

promotion_status

may only be written by the Promotion Engine.

All other systems must treat this field as read-only.

---

# 5. Discord Delivery Contract

All Discord messages must originate from the **outbox delivery system**.

Direct publishing from application services is forbidden.

Invariant:

Application Service → Outbox → Discord Worker → Discord

This ensures:

- retry capability
- delivery guarantees
- observability

---

# 6. Environment Configuration Integrity

The system must not start if required environment variables are missing.

Invariant:

Required configuration must exist for:

- database connections
- provider APIs
- Discord integration
- Redis cache
- service authentication

Startup must fail if configuration is incomplete.

---

# 7. Schema Compatibility

Application code must remain compatible with the production database schema.

Invariant:

The database schema is the **source of truth**.

Code must not assume fields that do not exist in the database.

Type definitions must be generated from the database schema.

---

# 8. Observability Coverage

Every major subsystem must expose health signals.

Required observability surfaces:

- service health endpoint
- structured logs
- error telemetry
- runtime metrics

Critical pipelines must produce verification artifacts.

---

# 9. Idempotent Processing

All asynchronous processing must be idempotent.

Examples include:

- settlement jobs
- alert generation
- ingestion tasks
- Discord delivery

Running the same job multiple times must not corrupt system state.

---

# 10. Immutable Historical Data

Historical betting data must never be overwritten.

Immutable data includes:

- pick outcomes
- historical odds snapshots
- scoring outputs
- settlement results

Corrections must be implemented through **new records**, not destructive
updates.

---

# 11. Cache as Acceleration Layer

Caching layers must never become authoritative.

Invariant:

Redis cache may only serve as a **performance layer**.

If cache and database disagree, the database is authoritative.

---

# 12. Runtime Over Documentation

If documentation conflicts with runtime behavior:

Runtime state is considered authoritative.

Documentation must be corrected.

---

# 13. No Silent Failure

All failures must be visible.

Forbidden patterns:

- swallowed exceptions
- silent retries without logging
- hidden fallback behavior

Errors must be logged and observable.

---

# 14. Proof-Based Verification

Major workflows must produce verification artifacts.

Examples:

- ingestion runs
- scoring executions
- promotion decisions
- Discord publication receipts
- settlement results

Artifacts must be stored under:

/out /reports /artifacts

---

# 15. Platform Integrity Rule

If any invariant is violated, the system must be treated as degraded until the
violation is resolved.

Temporary workarounds must not bypass invariant enforcement.

System integrity takes priority over feature delivery.
