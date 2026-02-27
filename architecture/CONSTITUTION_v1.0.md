# CONSTITUTION_v1.0

Unit Talk – Clean-Room Doctrine Supreme Design-Layer Authority Status: RATIFIED
Ratified: 2026-02-26 (UTC) Enforcement State: RATIFIED

---

## 1. Purpose and Constitutional Scope

### 1.1 Governing Authority

This Constitution is the Supreme Design-Layer Authority for the Unit Talk
system. All design artifacts, contracts, enforcement mechanisms, audit
protocols, and ratification procedures derive authority from this document.

### 1.2 Scope of Governance

This Constitution governs:

- All Phase 1 through Phase 6 contracts
- All enforcement sequencing and activation
- All audit cascade behavior and triggers
- All ratification logic and prerequisites
- All versioning law and evolution rules
- All future contract creation and amendment
- All authority hierarchy relationships
- All drift detection and violation classification

### 1.3 Exclusions from Scope

This Constitution does NOT govern:

- Implementation-layer code structure
- Runtime execution behavior beyond contract boundaries
- Third-party service configurations
- Infrastructure provisioning specifics
- Personnel or organizational structure
- Business logic not codified in contracts

### 1.4 Design-Layer Authority Declaration

This Constitution is a design-layer authority document. It defines invariants,
relationships, and governance rules. It does NOT contain implementation
instructions, executable commands, or deployment procedures.

### 1.5 Enforcement Activation Rule

Enforcement of any provision within this Constitution begins only after formal
ratification. Prior to ratification, all provisions are design artifacts with no
binding enforcement authority.

### 1.6 Implementation Subordination

No implementation layer has authority over this document. Implementation MUST
conform to this Constitution. This Constitution does NOT conform to
implementation. If implementation conflicts with this Constitution,
implementation is non-compliant and MUST be corrected.

---

## 2. Definitions and Closed Enums

### 2.1 Phase Identifiers (Closed Enum)

The following Phase identifiers are the complete and closed set:

| Phase ID | Name                                      |
| -------- | ----------------------------------------- |
| Phase 1  | Core Invariants                           |
| Phase 2  | Lifecycle and Distribution                |
| Phase 3  | Operational Determinism                   |
| Phase 4  | Audit and Freeze Integrity                |
| Phase 5  | Repository Truth and Execution Boundaries |
| Phase 6  | Constitutional Binding                    |

No other Phase identifiers are permitted. Any reference to a Phase not in this
set is invalid.

### 2.2 Enforcement States (Closed Enum)

The following enforcement states are the complete and closed set:

| State              | Meaning                                             |
| ------------------ | --------------------------------------------------- |
| DESIGN_ONLY        | Contract exists as design artifact; not enforced    |
| RATIFIED           | Contract formally approved; enforcement pending     |
| ENFORCEMENT_ACTIVE | Contract actively enforced; violations are failures |

No other enforcement states are permitted. Transition between states follows the
Ratification Protocol defined in Section 10.

### 2.3 Environments (Closed Enum)

The following environment identifiers are the complete and closed set:

| Environment | Purpose                |
| ----------- | ---------------------- |
| dev         | Local development      |
| staging     | Pre-production testing |
| prod        | Production serving     |

No other environment identifiers are permitted. Any system component referencing
an environment not in this set is non-compliant.

### 2.4 Contract Version Format (Closed Format)

All contract versions MUST follow this exact format:

```
v{MAJOR}.{MINOR}
```

Where:

- MAJOR is a positive integer (1, 2, 3, ...)
- MINOR is a non-negative integer (0, 1, 2, ...)

Examples of valid versions: v1.0, v1.1, v2.0, v2.3

No other version format is permitted. Version strings not matching this format
are invalid.

### 2.5 Enum Immutability Declaration

All enums defined in Section 2 are closed and immutable. Modification of any
enum requires invocation of the Constitutional Amendment Protocol defined in
Section 11. No implicit expansion is permitted. No temporary additions are
permitted. No environment-specific variations are permitted.

---

## 3. Authority Hierarchy

### 3.1 Strict Authority Order

Authority within the Unit Talk design layer follows this strict order (highest
to lowest):

| Rank | Authority Level                 | Description                             |
| ---- | ------------------------------- | --------------------------------------- |
| 1    | Constitution                    | This document; supreme authority        |
| 2    | Phase Cluster Ratifications     | Ratification records for Phase clusters |
| 3    | Individual Contracts            | Specific contract documents             |
| 4    | Cluster Audit Sweep Definitions | Audit pattern definitions               |
| 5    | Implementation Layer            | Code and runtime systems                |

### 3.2 Conformance Direction

Authority flows downward only:

- Implementation MUST conform to Contracts
- Contracts MUST conform to Phase Cluster Ratifications
- Phase Cluster Ratifications MUST conform to Constitution
- Constitution is self-authorizing at the design layer

### 3.3 Conflict Resolution

If conflict occurs between authority levels:

- The higher authority prevails automatically
- The lower authority is invalid for the scope of conflict
- No adjudication process is required
- Conflict resolution is immediate and deterministic

### 3.4 Override Prohibition

No lower authority may override higher authority. This prohibition is absolute.
There is no exception mechanism. There is no emergency bypass. There is no
temporary suspension of hierarchy.

### 3.5 Implicit Override Prohibition

No implicit override is permitted. Any claim that implementation necessity
overrides contract requirements is invalid. Any claim that operational urgency
overrides Constitutional provisions is invalid. Override MUST be explicit via
the Amendment Protocol.

---

## 4. Constitutional Supremacy Lock

### 4.1 Automatic Invalidity Rule

If any contract contradicts this Constitution, that contract is automatically
invalid for the scope of contradiction. Invalidity is immediate upon detection.
No formal declaration is required. The contract remains invalid until amended to
remove the contradiction.

### 4.2 Enforcement Suspension Rule

If any enforcement mechanism contradicts this Constitution, enforcement via that
mechanism is suspended. Suspension is automatic. Enforcement may not resume
until the mechanism is corrected and re-validated against this Constitution.

### 4.3 Invariant Protection

No contract may weaken Constitutional invariants. Weakening includes:

- Reducing scope of protection
- Adding exceptions not present in Constitution
- Introducing ambiguity where Constitution is precise
- Permitting states prohibited by Constitution

### 4.4 Non-Optional Supremacy

Constitutional supremacy is automatic and non-optional. No contract may declare
independence from this Constitution. No Phase may exempt itself from
Constitutional governance. No enforcement mechanism may operate outside
Constitutional boundaries.

### 4.5 Binary Consequence Model

Consequences for Constitutional violation are binary:

| Condition                               | Consequence                  |
| --------------------------------------- | ---------------------------- |
| Contract contradicts Constitution       | Contract invalid for scope   |
| Enforcement contradicts Constitution    | Enforcement suspended        |
| Implementation contradicts Constitution | Implementation non-compliant |

There are no warnings. There are no grace periods. There are no partial
consequences.

---

## 5. Phase Map and Dependency DAG

### 5.1 Phase 1 – Core Invariants

**Purpose:** Defines foundational business invariants that all other phases
depend upon.

**Dependencies:** None (foundation layer)

**Enforcement Eligibility:** Phase 1 MUST be ratified before any other Phase may
reach ENFORCEMENT_ACTIVE state.

**Premature Enforcement Prohibition:** Phase 1 enforcement MUST NOT activate
before Phase 1 ratification record exists.

### 5.2 Phase 2 – Lifecycle and Distribution

**Purpose:** Defines pick lifecycle state machine, single-writer discipline, and
distribution mechanics.

**Dependencies:** Phase 1 (Core Invariants)

**Enforcement Eligibility:** Phase 2 MUST be ratified after Phase 1. Phase 2
enforcement requires Phase 1 to be in ENFORCEMENT_ACTIVE or RATIFIED state.

**Premature Enforcement Prohibition:** Phase 2 enforcement MUST NOT activate
before Phase 1 contracts are ratified.

### 5.3 Phase 3 – Operational Determinism

**Purpose:** Defines deterministic distribution, outbox contracts, retry
policies, and receipt verification.

**Dependencies:** Phase 1, Phase 2

**Enforcement Eligibility:** Phase 3 MUST be ratified after Phase 2. Phase 3
enforcement requires Phase 2 to be in ENFORCEMENT_ACTIVE or RATIFIED state.

**Premature Enforcement Prohibition:** Phase 3 enforcement MUST NOT activate
before Phase 2 contracts are ratified.

### 5.4 Phase 4 – Audit and Freeze Integrity

**Purpose:** Defines operational audit logging, freeze detection, freeze
authority, and SLO registry.

**Dependencies:** Phase 1, Phase 2, Phase 3

**Enforcement Eligibility:** Phase 4 MUST be ratified after Phase 3. Phase 4
enforcement requires Phase 3 to be in ENFORCEMENT_ACTIVE or RATIFIED state.

**Premature Enforcement Prohibition:** Phase 4 enforcement MUST NOT activate
before Phase 3 contracts are ratified.

### 5.5 Phase 5 – Repository Truth and Execution Boundaries

**Purpose:** Defines build/runtime separation, environment truth sources, Docker
authority, CI gates, and temporal boundaries.

**Dependencies:** Phase 4 (for audit format binding)

**Enforcement Eligibility:** Phase 5 MUST be ratified after Phase 4. Phase 5
enforcement requires Phase 4 to be in ENFORCEMENT_ACTIVE or RATIFIED state.

**Premature Enforcement Prohibition:** Phase 5 enforcement MUST NOT activate
before Phase 4 contracts are ratified.

### 5.6 Phase 6 – Constitutional Binding

**Purpose:** This Constitution. Binds all Phases under unified governance.

**Dependencies:** All prior Phases (Phase 1 through Phase 5)

**Enforcement Eligibility:** Phase 6 ratification requires all prior Phases to
be in RATIFIED or ENFORCEMENT_ACTIVE state.

**Premature Enforcement Prohibition:** Phase 6 enforcement MUST NOT activate
before all prior Phase cluster ratification records exist.

### 5.7 Dependency DAG Declaration

The Phase dependency structure is a Directed Acyclic Graph (DAG):

```
Phase 1 (Core Invariants)
    ↓
Phase 2 (Lifecycle & Distribution)
    ↓
Phase 3 (Operational Determinism)
    ↓
Phase 4 (Audit & Freeze Integrity)
    ↓
Phase 5 (Repository Truth)
    ↓
Phase 6 (Constitutional Binding)
```

Circular dependencies are prohibited. Reverse dependencies are prohibited.
Skip-level enforcement without intermediate ratification is prohibited.

---

## 6. Enforcement Order Model

### 6.1 Mandatory Enforcement Sequence

When transitioning from RATIFIED to ENFORCEMENT_ACTIVE, enforcement MUST
activate in this exact sequence:

| Order | Enforcement Domain            | Phase Source |
| ----- | ----------------------------- | ------------ |
| 1     | Repository Truth              | Phase 5      |
| 2     | Runtime Boundary Enforcement  | Phase 5      |
| 3     | Lifecycle Enforcement         | Phase 2      |
| 4     | Operational Freeze Automation | Phase 4      |
| 5     | Cross-Cluster Audit Cascades  | Phase 4, 6   |

### 6.2 Partial Enforcement Prohibition

Partial enforcement is not permitted. If enforcement cannot proceed for the
entire cluster, enforcement MUST NOT proceed at all. Cherry-picking individual
contracts for enforcement while leaving others unenforced is prohibited.

### 6.3 Cluster Activation Rule

Enforcement MUST activate per Phase cluster. A Phase cluster is the complete set
of contracts within a single Phase. All contracts in a cluster transition to
ENFORCEMENT_ACTIVE simultaneously or not at all.

### 6.4 Ratification Prerequisite

Enforcement MUST NOT precede ratification. The state transition from DESIGN_ONLY
to ENFORCEMENT_ACTIVE MUST pass through RATIFIED state. Direct transition from
DESIGN_ONLY to ENFORCEMENT_ACTIVE is prohibited.

### 6.5 Binary Audit Gate

Enforcement state transition requires binary audit pass. The audit result is
PASS or FAIL. There is no PARTIAL outcome. There is no CONDITIONAL outcome. FAIL
blocks transition. PASS permits transition.

---

## 7. Versioning Law

### 7.1 MAJOR Version Bump Conditions

A MAJOR version bump (e.g., v1.x to v2.0) is REQUIRED when any of the following
occurs:

| Condition                        | Reason                            |
| -------------------------------- | --------------------------------- |
| Invariant change                 | Fundamental contract modification |
| Enum expansion                   | Closed set modification           |
| Authority hierarchy modification | Governance structure change       |
| Enforcement order change         | Activation sequence modification  |
| Phase dependency modification    | DAG structure change              |
| Constitutional provision change  | Supreme authority modification    |

### 7.2 MINOR Version Bump Conditions

A MINOR version bump (e.g., v1.0 to v1.1) is REQUIRED when any of the following
occurs:

| Condition                              | Reason                     |
| -------------------------------------- | -------------------------- |
| Clarification without invariant change | Precision improvement      |
| Binding reference update               | Cross-reference correction |
| Documentation precision improvement    | Ambiguity reduction        |
| Typo correction                        | Error correction           |
| Format standardization                 | Consistency improvement    |

### 7.3 Version Bump Prohibition Violations

The following are prohibited:

| Prohibition                           | Consequence              |
| ------------------------------------- | ------------------------ |
| Silent invariant mutation             | CONSTITUTIONAL_VIOLATION |
| Retroactive contract reinterpretation | CONSTITUTIONAL_VIOLATION |
| Undeclared scope expansion            | CONSTITUTIONAL_VIOLATION |
| Version bump without ratification     | CONSTITUTIONAL_VIOLATION |
| Edit without version increment        | CONSTITUTIONAL_VIOLATION |

### 7.4 Version Immutability

Once a version is ratified, that version's content is immutable. Changes require
a new version. Retroactive editing of ratified versions is prohibited.
Historical versions MUST be preserved.

---

## 8. Drift and Violation Classification

### 8.1 Violation Classes (Closed Enum)

The following violation classes are the complete and closed set:

| Class                     | Definition                                    |
| ------------------------- | --------------------------------------------- |
| CONSTITUTIONAL_VIOLATION  | Contradiction of this Constitution            |
| CONTRACT_VIOLATION        | Contradiction of a ratified contract          |
| IMPLEMENTATION_DRIFT      | Implementation divergence from contract       |
| ENVIRONMENT_CONTAMINATION | Cross-environment credential or state leakage |
| UNAUTHORIZED_ENFORCEMENT  | Enforcement without ratification              |

No other violation classes are permitted.

### 8.2 Violation Class Definitions

**CONSTITUTIONAL_VIOLATION:** Any action, contract, or enforcement mechanism
that contradicts a provision of this Constitution. This is the highest severity
violation.

**CONTRACT_VIOLATION:** Any implementation behavior that contradicts a ratified
contract while not rising to Constitutional level. Contracts remain subordinate
to Constitution.

**IMPLEMENTATION_DRIFT:** Implementation behavior that was initially compliant
but has diverged over time due to changes not reflected in contracts. Drift
indicates synchronization failure.

**ENVIRONMENT_CONTAMINATION:** Production credentials appearing in development
configuration, development behavior affecting production state, or any
cross-environment state leakage.

**UNAUTHORIZED_ENFORCEMENT:** Enforcement of contract provisions before
ratification, or enforcement via mechanisms not authorized by this Constitution.

### 8.3 Consequence Hierarchy

Consequences escalate by violation class:

| Violation Class           | Consequence                                             |
| ------------------------- | ------------------------------------------------------- |
| CONSTITUTIONAL_VIOLATION  | Immediate enforcement suspension; mandatory remediation |
| CONTRACT_VIOLATION        | Enforcement pause; remediation required                 |
| IMPLEMENTATION_DRIFT      | Audit failure; synchronization required                 |
| ENVIRONMENT_CONTAMINATION | Environment isolation required; credential rotation     |
| UNAUTHORIZED_ENFORCEMENT  | Enforcement rollback; re-ratification required          |

### 8.4 Ambiguity Prohibition

No ambiguity is permitted in violation classification. Every detected issue MUST
map to exactly one violation class. If classification is unclear, the higher
severity class applies.

---

## 9. Cluster Audit Cascade Law

### 9.1 Cluster Audit Triggers

A cluster audit is REQUIRED when:

| Trigger                         | Audit Scope            |
| ------------------------------- | ---------------------- |
| Ratification attempt            | Target Phase cluster   |
| Enforcement activation attempt  | Target Phase cluster   |
| Contract amendment              | Affected Phase cluster |
| Drift detection                 | Affected Phase cluster |
| Cross-cluster dependency change | All dependent clusters |

### 9.2 Constitutional Audit Triggers

A full Constitutional audit is REQUIRED when:

| Trigger                          | Audit Scope                 |
| -------------------------------- | --------------------------- |
| Constitutional amendment         | All Phases and Constitution |
| Authority hierarchy modification | All Phases and Constitution |
| Enforcement order modification   | All Phases and Constitution |
| Phase dependency modification    | All Phases and Constitution |
| Multiple cluster failures        | All Phases and Constitution |

### 9.3 Binary Audit Results

Audit results are binary:

| Result | Meaning                            | Consequence                   |
| ------ | ---------------------------------- | ----------------------------- |
| PASS   | All audit criteria satisfied       | Proceed with requested action |
| FAIL   | One or more criteria not satisfied | Block requested action        |

There is no PARTIAL result. There is no CONDITIONAL result. There is no DEFERRED
result.

### 9.4 Enforcement Progression Block

Any FAIL audit result blocks enforcement progression. The specific blocking
rules:

- FAIL on cluster audit blocks cluster enforcement activation
- FAIL on Constitutional audit blocks all enforcement changes
- FAIL on dependency cluster blocks dependent cluster progression

### 9.5 Upward Cascade Rule

If a foundational layer audit fails, all dependent layers are automatically
blocked. Cascade direction is upward through the dependency DAG. A Phase 2
failure blocks Phase 3, 4, 5, and 6. A Phase 1 failure blocks all other Phases.

### 9.6 Absence and Presence Model

Cluster audits operate on two pattern types:

**Absence Patterns:** Patterns that MUST NOT appear. Any match is FAIL.

**Presence Patterns:** Patterns that MUST appear. Any absence is FAIL.

Audit definitions specify which patterns are absence-required and which are
presence-required. Pattern definitions are contained in cluster-specific audit
sweep documents, not in this Constitution.

---

## 10. Ratification Protocol

### 10.1 Ratification Prerequisites

Before ratification may proceed, the following prerequisites MUST be satisfied:

| Prerequisite                           | Verification Method           |
| -------------------------------------- | ----------------------------- |
| All cluster contracts complete         | Document existence check      |
| All contracts have acceptance criteria | Section presence verification |
| All dependencies ratified              | Dependency DAG traversal      |
| Cluster audit PASS                     | Audit execution result        |
| No blocking violations detected        | Violation scan result         |

### 10.2 Binary Ratification Checklist

Ratification requires PASS on all items:

| Check                           | Result    |
| ------------------------------- | --------- |
| All contracts exist             | PASS/FAIL |
| All acceptance criteria defined | PASS/FAIL |
| All dependencies satisfied      | PASS/FAIL |
| Cluster audit passed            | PASS/FAIL |
| No Constitutional violations    | PASS/FAIL |
| No blocking contract violations | PASS/FAIL |
| Sign-off authority present      | PASS/FAIL |

All items MUST be PASS. Any FAIL blocks ratification.

### 10.3 Sign-Off Record Structure

Ratification sign-off MUST include:

| Field                 | Description                               |
| --------------------- | ----------------------------------------- |
| Phase Cluster         | Which Phase is being ratified             |
| Contract List         | All contracts included in ratification    |
| Ratification Date     | UTC date of ratification                  |
| Ratified By           | Identity of ratifying authority           |
| Audit Result          | PASS (required for ratification)          |
| Previous State        | Prior enforcement state                   |
| New State             | RATIFIED                                  |
| Dependencies Verified | List of verified dependency ratifications |

### 10.4 Enforcement Activation Rules

Transition from RATIFIED to ENFORCEMENT_ACTIVE requires:

| Requirement                        | Description                      |
| ---------------------------------- | -------------------------------- |
| Ratification complete              | State is RATIFIED                |
| Enforcement order position reached | Prior enforcement domains active |
| Activation audit PASS              | Pre-activation audit completed   |
| No pending amendments              | No open amendment processes      |
| Activation declaration signed      | Explicit activation sign-off     |

### 10.5 Pre-Ratification Enforcement Prohibition

No enforcement begins before ratification. This prohibition is absolute. There
are no exceptions for:

- Urgent operational needs
- Partial compliance checking
- Soft enforcement or warnings
- Shadow enforcement without consequence

DESIGN_ONLY state means no enforcement. Period.

---

## 11. Amendment Protocol

### 11.1 Amendment Version Requirements

Constitutional amendments require version bumps:

| Amendment Type             | Version Bump Required |
| -------------------------- | --------------------- |
| Invariant change           | MAJOR                 |
| Enum modification          | MAJOR                 |
| Authority hierarchy change | MAJOR                 |
| Enforcement order change   | MAJOR                 |
| Clarification only         | MINOR                 |
| Reference update           | MINOR                 |

### 11.2 Amendment Audit Requirement

Amendment requires full cluster audit sweep. The audit MUST:

- Verify amendment does not introduce contradictions
- Verify amendment does not weaken existing invariants
- Verify amendment does not break dependency relationships
- Verify amendment does not orphan existing contracts
- Produce binary PASS/FAIL result

### 11.3 Amendment Ratification Requirement

Amendment requires explicit ratification record including:

| Field             | Description               |
| ----------------- | ------------------------- |
| Amendment Version | New version number        |
| Amendment Date    | UTC date of amendment     |
| Amendment Summary | Description of changes    |
| Sections Modified | List of modified sections |
| Audit Result      | PASS (required)           |
| Ratified By       | Ratifying authority       |
| Previous Version  | Version being superseded  |

### 11.4 Authority Hierarchy Revalidation

Amendment MUST revalidate authority hierarchy:

- Confirm Constitution remains supreme
- Confirm no contract claims superiority
- Confirm enforcement mechanisms remain subordinate
- Confirm implementation layer remains lowest authority

### 11.5 Partial Amendment Prohibition

Partial amendment without audit is prohibited. All of the following are
prohibited:

- Modifying one section without auditing related sections
- Updating references without verifying targets
- Changing definitions without updating usages
- Amending invariants without impact analysis

### 11.6 Silent Edit Prohibition

Silent edits are prohibited. Every change MUST:

- Increment version (MAJOR or MINOR)
- Produce audit record
- Produce ratification record
- Be traceable to amendment request

Edits without version increment are CONSTITUTIONAL_VIOLATIONS.

### 11.7 Enforcement State Reset

Amendment resets enforcement state to DESIGN_ONLY until re-ratified. The amended
Constitution enters DESIGN_ONLY state immediately upon amendment. Transition to
RATIFIED requires full ratification protocol. Transition to ENFORCEMENT_ACTIVE
requires full enforcement activation protocol.

---

## 12. Acceptance Criteria

### 12.1 Constitutional Completeness Verification

| Criterion                                          | Result    |
| -------------------------------------------------- | --------- |
| All six Phases defined                             | PASS/FAIL |
| All enums closed and complete                      | PASS/FAIL |
| Authority hierarchy defined with five levels       | PASS/FAIL |
| Constitutional supremacy lock defined              | PASS/FAIL |
| Enforcement order defined with five domains        | PASS/FAIL |
| Versioning law defined with MAJOR/MINOR rules      | PASS/FAIL |
| Drift and violation classes defined (five classes) | PASS/FAIL |
| Audit cascade law defined                          | PASS/FAIL |
| Ratification protocol defined                      | PASS/FAIL |
| Amendment protocol defined                         | PASS/FAIL |
| No non-deterministic drafting markers present      | PASS/FAIL |
| No implementation content included                 | PASS/FAIL |
| No executable patterns present                     | PASS/FAIL |
| Binary outcome model throughout                    | PASS/FAIL |

### 12.2 Acceptance Determination

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

### 12.3 Acceptance Consequence

| Result | Consequence                                        |
| ------ | -------------------------------------------------- |
| PASS   | Constitution eligible for ratification             |
| FAIL   | Constitution MUST be corrected before ratification |

---

## 13. Constitutional Completion Record Template

### 13.1 Record Structure

| Field                | Value                                       |
| -------------------- | ------------------------------------------- |
| Constitution Version | v{MAJOR}.{MINOR}                            |
| Completion Date      | YYYY-MM-DD (UTC)                            |
| Ratified By          | [Authority Identity]                        |
| Cluster Audit Result | PASS / FAIL                                 |
| Enforcement State    | DESIGN_ONLY / RATIFIED / ENFORCEMENT_ACTIVE |
| Dependent Phases     | Phase 1, Phase 2, Phase 3, Phase 4, Phase 5 |
| Amendment History    | [List of prior versions with dates]         |

### 13.2 Required Fields

All fields in Section 13.1 MUST be populated. No field may be omitted. No field
may contain placeholder values.

### 13.3 Amendment History Format

Each amendment history entry MUST contain:

| Subfield | Description                    |
| -------- | ------------------------------ |
| Version  | Version number of amendment    |
| Date     | UTC date of amendment          |
| Summary  | Brief description of amendment |
| Type     | MAJOR or MINOR                 |

### 13.4 Record Immutability

Once a Constitutional Completion Record is signed, it is immutable. Corrections
require a new record with a new version. Historical records MUST be preserved.

---

## 14. Canonical Bindings

### 14.1 Phase Contract Bindings

This Constitution binds the following Phase clusters:

| Phase   | Ratification Document                         |
| ------- | --------------------------------------------- |
| Phase 1 | PHASE_1_CORE_INVARIANTS_RATIFICATION_v1.0.md  |
| Phase 2 | PHASE_2_LIFECYCLE_RATIFICATION_v1.0.md        |
| Phase 3 | PHASE_3_DISTRIBUTION_RATIFICATION_v1.0.md     |
| Phase 4 | PHASE_4_OPERATIONAL_RATIFICATION_v1.0.md      |
| Phase 5 | PHASE_5_REPOSITORY_TRUTH_RATIFICATION_v1.0.md |
| Phase 6 | This Constitution                             |

### 14.2 Cross-Phase Dependencies

| Dependent Phase | Required Phases                             |
| --------------- | ------------------------------------------- |
| Phase 2         | Phase 1                                     |
| Phase 3         | Phase 1, Phase 2                            |
| Phase 4         | Phase 1, Phase 2, Phase 3                   |
| Phase 5         | Phase 4                                     |
| Phase 6         | Phase 1, Phase 2, Phase 3, Phase 4, Phase 5 |

### 14.3 Governance Document Bindings

| Document                               | Relationship                |
| -------------------------------------- | --------------------------- |
| governance/RATIFICATION_RECORD_v1.0.md | Record format authority     |
| governance/AMENDMENT_LOG_v1.0.md       | Amendment history authority |

---

## 15. Final Declaration

This Constitution is the Supreme Design-Layer Authority for Unit Talk.

All Phases derive authority from this Constitution.

All contracts derive authority from their Phase clusters.

All enforcement derives authority from ratification.

Authority flows downward. Conformance flows upward.

There is no implicit override. There is no emergency bypass. There is no partial
compliance.

Design-layer governance is deterministic, binary, and auditable.

This Constitution is complete.

---

**End of Document**
