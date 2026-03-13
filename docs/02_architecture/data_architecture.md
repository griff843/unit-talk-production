# Unit Talk Data Architecture

Version: 1.0  
Status: Canonical  
Authority: Architecture Layer

This document defines the data architecture of the Unit Talk platform.

It specifies the canonical database model, data ownership rules, and how data
flows through the system.

The database is the authoritative system state.

---

# 1. Data Philosophy

Unit Talk is designed as a **data-first intelligence platform**.

All system operations ultimately produce, transform, or consume data.

The database represents the **single source of truth** for the platform.

Application services, agents, and interfaces must treat the database as
authoritative.

---

# 2. Primary Database

The platform uses a relational database as the canonical data store.

Primary system database:

PostgreSQL (Supabase)

Responsibilities of the database include:

- storing canonical pick lifecycle state
- storing sportsbook market data
- storing scoring outputs
- storing historical results
- supporting analytics and evaluation

All critical platform data must be persisted here.

---

# 3. Canonical Pick Lifecycle Table

The core data entity of the platform is the pick.

Canonical table:

unified_picks

This table represents the **complete lifecycle of a pick**.

The table includes fields representing:

- ingestion metadata
- sportsbook data
- scoring outputs
- promotion state
- publication status
- settlement results

No other table may act as the authoritative pick state.

Legacy tables such as `daily_picks` are deprecated.

---

# 4. Provider Data Model

External sportsbook data is normalized before entering the system.

Canonical provider table:

provider_offers

Responsibilities:

- storing normalized sportsbook odds
- representing market offerings across sportsbooks
- enabling comparison between books
- supporting edge calculation

Provider data must be normalized before ingestion into the main pipeline.

---

# 5. Feature Data Layer

The scoring engine relies on feature data.

Canonical feature table:

feature_snapshots

This table stores the model inputs used when evaluating picks.

Feature snapshots may include:

- player statistics
- matchup context
- market movement
- historical performance
- external signals

Feature snapshots ensure scoring decisions remain reproducible.

---

# 6. Scoring Outputs

Scoring results are stored separately from raw pick data.

Canonical scoring table:

scored_legs

Responsibilities:

- storing scoring outputs
- recording calculated edges
- tracking confidence scores
- enabling model evaluation

Separating scoring results from raw data preserves traceability.

---

# 7. Closing Line Tracking

Tracking market efficiency is critical.

Canonical table:

closing_snapshots

This table records the final market line before event start.

Closing line tracking enables:

- closing line value (CLV) analysis
- market efficiency evaluation
- model validation

---

# 8. Historical Result Data

Historical results must be preserved.

Key historical records include:

- pick outcomes
- sportsbook closing lines
- scoring outputs
- settlement data

Historical data must be **immutable**.

Corrections must be implemented via new records rather than destructive updates.

---

# 9. Data Flow Overview

The core data flow follows this sequence.

Provider APIs ↓ FeedAgent ↓ provider_offers ↓ unified_picks ↓ feature_snapshots
↓ scored_legs ↓ PromotionEngine ↓ Discord publication ↓ SettlementAgent ↓
historical records

Each stage enriches the dataset.

---

# 10. Data Ownership Model

The system enforces a strict **single-writer ownership model**.

| Data Domain       | Owner           |
| ----------------- | --------------- |
| provider_offers   | FeedAgent       |
| unified_picks     | FeedAgent       |
| feature_snapshots | ScoringAgent    |
| scored_legs       | ScoringAgent    |
| promotion fields  | PromotionEngine |
| alert records     | AlertAgent      |
| settlement data   | SettlementAgent |

No service may write data outside its ownership domain.

---

# 11. Caching Layer

The system may use caching to improve performance.

Example caching system:

Redis

Caching rules:

- cache must never be authoritative
- cache inconsistencies must not corrupt database state
- cache failures must not impact correctness

The database always remains the source of truth.

---

# 12. Data Retention

Data retention policies must preserve historical intelligence.

Recommended tiers:

Hot data

- recent picks
- active markets

Warm data

- completed events
- recent scoring history

Cold data

- historical archives
- model training datasets

Historical data must remain queryable.

---

# 13. Data Integrity Requirements

Data integrity protections include:

- schema validation
- type-safe queries
- foreign key constraints
- controlled write access

Invalid data must never enter canonical tables.

---

# 14. Analytics and Model Training

Historical data is used for:

- model training
- edge validation
- CLV analysis
- system performance evaluation

Training datasets must be reproducible using stored historical data.

---

# Summary

The Unit Talk platform is fundamentally a **data intelligence system**.

Key principles of the data architecture:

- database as authoritative system state
- canonical pick lifecycle table
- normalized provider data
- reproducible feature snapshots
- traceable scoring outputs
- immutable historical records
