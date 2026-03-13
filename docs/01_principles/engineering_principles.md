# Unit Talk Engineering Principles

Version: 1.0  
Status: Canonical  
Authority: Highest

This document defines the engineering philosophy and non-negotiable development
principles for the Unit Talk platform.

All systems, agents, services, workflows, and documentation must conform to
these principles.

If any implementation conflicts with these principles, the implementation is
considered incorrect.

---

# 1. Platform Mission

Unit Talk is engineered to operate as a **syndicate-grade sports intelligence
platform**.

The system must achieve:

- deterministic behavior
- high reliability
- provable correctness
- observable runtime state
- safe automated operation

The platform is designed to scale into a **data intelligence system**, not
merely a sports betting tool.

---

# 2. Fail-Closed Design

All systems must fail **closed**, not open.

This means:

- Missing configuration must stop execution
- Invalid data must halt processing
- Broken dependencies must stop workflows
- Unknown states must trigger alerts

The system must never silently continue in an undefined state.

---

# 3. Runtime Truth

Runtime state is the only authoritative truth.

Documentation, code comments, and design plans are **secondary**.

Truth must always be derived from:

- runtime system outputs
- database state
- telemetry
- system health endpoints
- execution artifacts

If documentation disagrees with runtime behavior, runtime wins.

---

# 4. Single Source of Authority

Every domain must have **one authoritative source**.

Examples:

| Domain             | Authority       |
| ------------------ | --------------- |
| Picks              | `unified_picks` |
| Odds ingestion     | FeedAgent       |
| Scoring            | ScoringEngine   |
| Promotion          | PromotionEngine |
| Alerts             | AlertAgent      |
| Settlement         | SettlementAgent |
| Discord publishing | Outbox system   |

Multiple writers to the same state are forbidden unless explicitly designed.

---

# 5. Single Writer Principle

Every data object must have **exactly one writer**.

Readers may be unlimited.

This prevents:

- race conditions
- conflicting updates
- state corruption
- undefined system behavior

Example:

FeedAgent → writes ingestion data ScoringAgent → writes scoring outputs
PromotionEngine → writes promotion state

No other system may write to those states.

---

# 6. Contract-Driven Architecture

All system boundaries must be enforced using **explicit contracts**.

Contracts include:

- database schemas
- API specifications
- event payload definitions
- Discord embed structures
- agent workflow interfaces

Contracts must be versioned and validated.

Breaking a contract requires a version migration.

---

# 7. Deterministic Execution

System behavior must be deterministic.

Given the same input, the system must produce the same result.

Sources of non-determinism must be controlled:

- time
- randomness
- external APIs
- asynchronous workflows

Determinism is required for:

- debugging
- auditing
- historical replay
- model evaluation

---

# 8. Observability First

All major system operations must be observable.

Every service must expose:

- health checks
- structured logs
- metrics
- execution traces

Key pipelines must produce verification artifacts.

Examples:

- ingestion runs
- scoring outputs
- promotion decisions
- Discord publication receipts
- settlement updates

---

# 9. No Silent Fallbacks

Fallback logic must never hide errors.

Examples of forbidden patterns:

- silent retries without logging
- default values masking missing data
- skipping failed operations without alerting

All fallback behavior must be:

- explicit
- logged
- observable

---

# 10. Proof-Based Development

Every major system change must produce **verification artifacts**.

Examples include:

- test reports
- CI validation output
- runtime verification logs
- production receipts

Artifacts must be stored under:

/out /reports /artifacts

Claims of system correctness must be backed by proof.

---

# 11. Incremental Evolution

Large architectural changes must be introduced through:

- shadow mode
- canary deployments
- phased rollouts
- controlled migrations

Breaking changes must not be deployed directly to production.

---

# 12. Documentation Hierarchy

Canonical documentation lives under:

docs/01_principles docs/02_architecture docs/03_product docs/04_roadmap
docs/05_operations docs/06_status

These documents override any conflicting documentation elsewhere in the
repository.

Other documentation directories serve as reference or historical artifacts.

---

# 13. Automation as Default

Operational tasks should be automated wherever possible.

Automation layers include:

- Claude OS orchestration
- CI enforcement
- automated verification
- agent workflows
- monitoring systems

Manual intervention should only occur during exceptional circumstances.

---

# 14. Security and Safety

The system must be designed with security and operational safety in mind.

Key protections include:

- strict environment configuration
- controlled credential management
- role-based system permissions
- safe automation boundaries

Sensitive data must never be exposed in logs or artifacts.

---

# 15. Continuous System Evolution

Unit Talk is designed as a **living system**.

Architecture will evolve as the platform grows.

However, evolution must always respect the principles defined in this document.

---

# Final Principle

The goal of Unit Talk engineering is **system truth and reliability**.

A system that appears functional but cannot prove correctness is considered
broken.
