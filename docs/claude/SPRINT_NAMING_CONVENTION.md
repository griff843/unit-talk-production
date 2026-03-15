# Sprint Naming Convention

**Status**: CANONICAL **Authority**: CLAUDE.md §6 (Sprint Protocol)
**Established**: SPRINT-053-GOVERNANCE-NAMING-CONVENTION **Resolves**: DRIFT-H2

---

## Canonical Patterns

### Pattern A — Sequenced Sprints (Main Execution Queue)

```
SPRINT-NNN-DESCRIPTIVE-NAME
```

- `NNN` = 3-digit zero-padded integer (021, 052, 053, …)
- `DESCRIPTIVE-NAME` = uppercase hyphen-separated words describing the sprint
  goal
- Use for all sprints in the main Layer/Phase execution queue
- Optionally include layer/phase in the name for traceability:
  `SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION`

**Examples:**

```
SPRINT-053-GOVERNANCE-NAMING-CONVENTION
SPRINT-054-LAYER3-PHASE10-REPLAY-ENDPOINT
SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION
```

### Pattern B — Non-Sequenced Sprints (Governance / Claude OS / Infrastructure)

```
SPRINT-DOMAIN-DESCRIPTOR
```

- `DOMAIN` = uppercase domain prefix (e.g., `COS`, `CLAUDE-OS`,
  `CLAUDE-CONTRACT`)
- `DESCRIPTOR` = description of scope
- Use for Claude OS upgrades, governance tooling, hotfixes, and infrastructure
  sprints that are not part of the main numbered sequence

**Examples:**

```
SPRINT-COS-007-SPRINT-CLOSE-VALIDATION
SPRINT-CLAUDE-OS-MULTI-LLM-ORCHESTRATION-BLUEPRINT
SPRINT-GITHUB-LINEAR-INTEGRATION
SPRINT-JEST-QUARANTINE-CLEANUP
```

---

## Validation Rules

| Rule          | Requirement                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| **Format**    | Must match Pattern A or Pattern B                                           |
| **Case**      | All uppercase                                                               |
| **Separator** | Hyphens only — no underscores, spaces, or dots                              |
| **Number**    | Pattern A: 3-digit, zero-padded (`021` not `21`)                            |
| **Suffix**    | No `-COMPLETE`, `-PARTIAL`, `-CLOSURE` suffixes on new sprints              |
| **Tag**       | Minted by CI only — never by humans manually                                |
| **Branch**    | `sprint/<lowercase-name>` (e.g., `sprint/053-governance-naming-convention`) |

---

## Deprecated Patterns (Do Not Use for New Sprints)

| Pattern            | Example                           | Replaced By                            |
| ------------------ | --------------------------------- | -------------------------------------- |
| Number at end      | `SPRINT-LIFECYCLE-MIGRATION-038`  | `SPRINT-038-LIFECYCLE-MIGRATION`       |
| Letter prefix      | `SPRINT-B1-ENV-HARDENING-001`     | `SPRINT-DOMAIN-DESCRIPTOR` (Pattern B) |
| `-COMPLETE` suffix | `SPRINT-028-PICK-ENGINE-COMPLETE` | No suffix — tag presence = complete    |
| Partial number     | `SPRINT-044G`, `SPRINT-044H`      | `SPRINT-044-DESCRIPTOR`                |

These patterns exist in legacy tags and MUST NOT be used for new sprints. They
remain as historical artifacts and are documented in the Legacy Tag Mapping
section below.

---

## Governance Tag Flow

Sprint tags are **CI-minted only** via `mint-governed-tag.yml`:

1. Sprint code merged to `main`
2. `governance/closeouts/<SPRINT-TAG>.md` committed and merged to `main`
3. CI detects new closeout file → runs `mint-governed-tag.yml`
4. Tag minted at HEAD of `main`

**Humans MUST NOT** create or push `SPRINT-*`, `PHASE-*`, or `GOVERNANCE-*`
tags. See `.github/workflows/mint-governed-tag.yml`.

---

## Sprint Gate Validation

The sprint gate (`tools/governance/sprint-gate.js`) validates:

1. The requested sprint name matches the locked next sprint in
   `docs/status/NEXT_5_SPRINTS.md`
2. Falls back to `docs/roadmap/INTELLIGENCE_PIPELINE_SPRINT_ORDER.md` for legacy
   intelligence pipeline sprints (SPRINT-031–040)

Run the gate before starting any sprint:

```bash
pnpm sprint:gate
node tools/governance/sprint-gate.js <SPRINT-ID>
```

---

## Legacy Tag Mapping (Main Sequence: SPRINT-021–052)

The following table maps git tags to their sprint descriptions. All are
complete; the tags are historical artifacts.

| Git Tag                                                  | Description                                                               | Layer/Phase |
| -------------------------------------------------------- | ------------------------------------------------------------------------- | ----------- |
| `SPRINT-021-DATA-FOUNDATION-GATE`                        | Data foundation & type gates                                              | L1/Ph 0     |
| `SPRINT-022-V3-SHADOW-SCORING`                           | V3 shadow scoring shadow mode                                             | L1/Ph 1     |
| `SPRINT-023-PRODUCTION-SURFACE-LOCK`                     | Production surface lock                                                   | L1/Ph 1     |
| `SPRINT-023B-CC-WRITE-BAN-ENFORCEMENT`                   | Command center write ban                                                  | L1/Ph 1     |
| `SPRINT-024-SCORING-ENHANCEMENT-LAYERING`                | Scoring enhancement layering                                              | L1/Ph 2     |
| `SPRINT-025-CLV-CLOSING-SNAPSHOT`                        | CLV closing snapshot                                                      | L1/Ph 2     |
| `SPRINT-026-CANONICAL-SCORING-ACTIVATION`                | Canonical scoring activation                                              | L1/Ph 2     |
| `SPRINT-028-PICK-ENGINE-COMPLETE`                        | Pick engine complete                                                      | L1/Ph 2     |
| SPRINT-031–039                                           | Intelligence pipeline (model separation through CLV validation)           | L1/Ph 3     |
| `SPRINT-042-LAYER2-PHASE6-OPERATOR-CONTROL-PLANE`        | Operator control plane                                                    | L2/Ph 6     |
| `SPRINT-043-LAYER2-PHASE7-RELIABILITY-MONITORING`        | Reliability & monitoring                                                  | L2/Ph 7     |
| `SPRINT-044-LAYER2-PHASE8-RECOVERY-REPLAY`               | Recovery & replay                                                         | L2/Ph 8     |
| `SPRINT-044G-COMPLETE` … `SPRINT-044R-COMPLETE`          | Layer 2 architecture migration sub-sprints (legacy letter-suffix pattern) | L2          |
| `SPRINT-046-OPERATOR-AUDIT-TRAIL`                        | Operator audit trail                                                      | L2/Sec      |
| `SPRINT-047-INGESTION-UNIT-COVERAGE-LOCK`                | Ingestion unit test coverage                                              | L2/Ph 7     |
| `SPRINT-048-TRUTH-RECONCILIATION-LAYER3-QUEUE`           | Layer 3 truth reconciliation                                              | Meta        |
| `SPRINT-049-LAYER3-PHASE10-CC-AUTH-FOUNDATION`           | CC auth identity foundation                                               | L3/Ph 10    |
| `SPRINT-050-LAYER3-PHASE10-CC-PERMISSION-ENFORCEMENT`    | CC RBAC permission enforcement                                            | L3/Ph 10    |
| `SPRINT-051-LAYER3-PHASE9-SMARTFORM-UX-POLISH`           | Smart Form UX/accessibility                                               | L3/Ph 9     |
| `SPRINT-052-LAYER3-PHASE11-OPERATOR-WORKFLOW-FOUNDATION` | Operator workflow registry & CLI                                          | L3/Ph 11    |

---

## References

- `CLAUDE.md §6` — Sprint Protocol (references this document)
- `docs/CLAUDE_OS_GOVERNANCE_CONTRACT.md` — Sprint execution authority
- `tools/governance/sprint-gate.js` — Sprint order enforcement
- `docs/status/NEXT_5_SPRINTS.md` — Current sprint queue (gate authority)
- `docs/status/DRIFT_REPORT.md` — DRIFT-H2 (resolved by this sprint)
