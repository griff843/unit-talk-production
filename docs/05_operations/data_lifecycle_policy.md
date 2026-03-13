# Unit Talk Data Lifecycle Policy

Version: 1.0  
Status: Canonical  
Authority: Operations Layer

This document defines how data is created, stored, retained, archived, and
eventually removed within the Unit Talk platform.

The goal is to maintain a system that remains performant, manageable, and
historically valuable without accumulating unnecessary data.

---

# 1. Data Lifecycle Philosophy

Data in the Unit Talk platform progresses through several lifecycle stages.

The system must:

- store operational data efficiently
- preserve historical intelligence
- prevent uncontrolled database growth
- maintain access to relevant historical datasets

All lifecycle policies must balance **performance**, **cost**, and **analytical
value**.

---

# 2. Data Lifecycle Stages

Data progresses through four lifecycle stages.

| Stage   | Description                                |
| ------- | ------------------------------------------ |
| Hot     | Active operational data used by the system |
| Warm    | Recent historical data used for analytics  |
| Cold    | Long-term archived data                    |
| Retired | Data that is no longer required            |

Lifecycle transitions ensure that active system storage remains efficient.

---

# 3. Hot Data

Hot data represents the operational state of the platform.

Examples include:

- active events
- current betting markets
- active picks
- real-time provider data
- active alerts
- settlement-in-progress records

Hot data must remain optimized for **fast queries and system performance**.

---

# 4. Warm Data

Warm data includes recently completed operational records.

Examples include:

- recently settled picks
- recent betting events
- recent scoring results
- recent alert activity

Warm data remains accessible for analytics and reporting.

Typical retention windows may range from **weeks to months**.

---

# 5. Cold Data

Cold data represents long-term historical records.

Examples include:

- historical betting markets
- historical scoring outputs
- historical performance metrics
- model training datasets

Cold data may be stored in:

- archival database tables
- analytics storage
- data lake environments

Cold storage enables historical analysis while keeping operational databases
efficient.

---

# 6. Retired Data

Retired data is information that no longer provides value.

Examples include:

- obsolete system artifacts
- deprecated pipeline outputs
- temporary staging data
- incomplete ingestion artifacts

Retired data should be safely removed to prevent database clutter.

---

# 7. Archival Strategy

The platform must support safe archival procedures.

Archival processes may include:

- scheduled archival jobs
- migration of historical data to archive tables
- export of long-term datasets to analytical storage

Archived data must remain accessible for research and analysis.

---

# 8. Data Retention Policies

Different datasets require different retention windows.

Examples include:

Operational data

- retained only as long as required for system functionality

Analytics data

- retained for extended historical analysis

Model training data

- retained indefinitely if useful for machine learning

Retention policies must be documented and enforced.

---

# 9. Data Integrity During Lifecycle Transitions

Lifecycle transitions must preserve data integrity.

Migration and archival processes must ensure:

- no data corruption
- no orphaned records
- consistent relationships between datasets

Lifecycle automation must include verification checks.

---

# 10. Compliance and Governance

All lifecycle policies must comply with internal governance rules.

Requirements include:

- documented retention policies
- controlled deletion procedures
- auditable lifecycle transitions

Governance ensures that lifecycle processes remain safe and predictable.

---

# 11. Lifecycle Automation

Data lifecycle transitions should be automated where possible.

Examples include:

- scheduled archival jobs
- automated cleanup of temporary data
- automated dataset migration

Automation prevents manual operational overhead.

---

# 12. Lifecycle Monitoring

The platform must monitor lifecycle operations.

Monitoring should include:

- archive job success
- data migration completion
- cleanup job execution
- storage utilization trends

Monitoring ensures lifecycle policies are functioning correctly.

---

# Summary

The Unit Talk data lifecycle policy ensures that the platform remains performant
and manageable as data volume grows.

Key principles include:

- structured lifecycle stages
- controlled retention policies
- safe archival strategies
- automated lifecycle management
- continuous monitoring
