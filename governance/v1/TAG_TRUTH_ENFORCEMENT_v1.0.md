--------------------------------------------------
Governance Tier: TIER 1 — CONSTITUTIONAL LAW
Version: v1.0
Ratification Date: 2026-02-27
Approval Authority: Griff (Operator)
---

---

# TAG TRUTH ENFORCEMENT SYSTEM

Version: 1.0 Status: RATIFIED Authority: Governance Baseline Scope: All
sprint/phase/governance tags

## Purpose

Prevent incorrect tagging and eliminate "tag without commit" failure modes.

This system makes the following impossible:

- Tagging the wrong SHA
- Tagging when pre-commit/CI gates fail
- Shipping a sprint/phase tag that does not pass required gates

Tags are governance artifacts. Tags must be truth-locked.

---

## Definitions

### Tag Classes

- **Governance Tags**: `GOVERNANCE-*`
- **Phase Tags**: `PHASE*`
- **Sprint Tags**: `SPRINT*`

### Closeout Marker

A repository-tracked file proving sprint completion and gating results.

Canonical location: `governance/closeouts/<TAG>.md`

---

## Hard Rules (Non-Negotiable)

1. **Humans MUST NOT create or push Phase/Sprint/Governance tags.**
2. Phase/Sprint/Governance tags MUST be created by CI only.
3. CI MUST refuse to mint a tag unless:
   - Required checks pass
   - Closeout marker exists in the merged commit
4. Any tag that exists without a valid closeout marker is invalid and must be
   deleted.

---

## CI Auto-Mint Flow (Canonical)

### Step 1 — Sprint Closeout Commit (Human + Claude)

- The sprint work is committed to a branch.
- A **closeout marker** is added: `governance/closeouts/<TAG>.md`
- The branch is merged to `main` via PR.

### Step 2 — CI Minting (CI Only)

- CI detects the closeout marker on `main`.
- CI runs required gates.
- If all PASS:
  - CI creates the tag on the merge SHA.
  - CI pushes the tag.

### Step 3 — Tag Guard (CI Verifier)

- On any tag push matching governed patterns:
  - CI re-runs gates
  - CI validates closeout marker exists at that tag SHA
  - CI fails hard if invalid

---

## Closeout Marker Format (Required)

File: `governance/closeouts/<TAG>.md`

Must include:

- Tag Name
- Date
- Scope (what was changed)
- Gates executed
- PASS/FAIL per gate
- Proof bundle pointer (local path or CI artifact ID)
- Commit SHA (optional but recommended)

If format is missing required fields, CI must fail minting.

---

## Required Gates (v1)

Minimum:

- Typecheck (workspace)
- Lint (as configured)
- Phase gate script(s) (e.g., Phase 1 runtime truth gate)

Optional per sprint:

- targeted tests
- smoke run

The closeout marker must list the gates that were executed.

---

## Acceptance Criteria

This system is installed and active when:

1. A human attempt to push a `PHASE*` tag is rejected.
2. CI successfully mints a governed tag on merge SHA when gates PASS.
3. Tag guard fails for any governed tag missing a closeout marker.
4. No governed tags exist that were minted outside CI.

---

## Kill Conditions

- Any governed tag created by a human is a governance violation.
- Any governed tag pointing at a SHA without closeout marker is invalid.
- Any "warn-pass" in tag guard or minting logic is disallowed.

---

## Amendment Policy

Changes to tag governance require:

- Version bump of this document
- Decision log entry
- Ratification tag for governance layer
