# PROOF RECEIPT STANDARD

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Primary Enforcement Surface: Claude OS

---

## 1. Purpose

Define the minimum proof receipts required for AI-assisted work to count as real
progress.

This standard exists because completion claims without receipts are not trusted.

No pass without verification.

This is consistent with Unit Talk’s roadmap requirement that no phase advances
without proof and no pass exists without runtime verification.
:contentReference[oaicite:4]{index=4}

---

## 2. Core Rule

A receipt is a concrete artifact proving that a claimed action or result
actually occurred.

Narrative summaries are not receipts.

---

## 3. Receipt Classes

### 3.1 Repo Receipts

Examples:

- git diff
- changed file list
- commit SHA
- branch state
- clean/dirty working tree evidence

---

### 3.2 Build Receipts

Examples:

- typecheck output
- build output
- lint output

---

### 3.3 Test Receipts

Examples:

- unit test output
- integration test output
- e2e output
- targeted contract test output

---

### 3.4 Runtime Receipts

Examples:

- server logs
- runtime request/response evidence
- job execution evidence
- service start success

---

### 3.5 Database Receipts

Examples:

- migration apply output
- schema diff
- query result proving expected state
- foreign key / constraint validation

---

### 3.6 Distribution Receipts

Examples:

- Discord post receipt
- publish token evidence
- snowflake ID
- outbox row state transition proof

---

### 3.7 Status Receipts

Examples:

- status delta file
- maturity review artifact
- blocker inventory generated after sprint

---

## 4. Required Receipt Matrix

| Task Type                | Minimum Required Receipts                            |
| ------------------------ | ---------------------------------------------------- |
| Docs-only                | repo receipt                                         |
| Test-only                | repo + test receipt                                  |
| Build/config             | repo + build receipt                                 |
| Protected code path      | repo + build + test receipt                          |
| Runtime behavior change  | repo + build + test + runtime receipt                |
| Schema/storage change    | repo + build + test + DB receipt                     |
| Discord publish path     | repo + build + test + runtime + distribution receipt |
| Status/maturity judgment | status receipt + supporting evidence references      |

---

## 5. Protected Surface Requirements

Protected surfaces require elevated proof.

Minimum:

- repo receipt
- build receipt
- test receipt
- runtime or DB receipt depending on surface
- status delta artifact

---

## 6. Proof Bundle Layout

Default location pattern:

`out/sprints/<SPRINT>/<DATE>/`

Suggested contents:

- `proof_git_status.txt`
- `proof_diff_summary.txt`
- `proof_typecheck.txt`
- `proof_tests.txt`
- `proof_runtime.txt`
- `proof_db.txt`
- `proof_distribution.txt`
- `STATUS_DELTA.md`
- `SPRINT_CLOSEOUT.md`

Not every file is required for every sprint, but required receipts must exist
for the task type.

---

## 7. Receipt Quality Rules

A valid receipt must be:

- specific
- timestampable
- attributable to the sprint/task
- human-auditable
- difficult to fake accidentally

---

## 8. Invalid Proof

The following do not count as proof:

- “it should work now”
- “tests likely pass”
- screenshots without context where text receipts are needed
- vague summaries without command outputs
- inferred repo state without inspection

---

## 9. Enforcement Rules

Claude OS must:

- determine required receipt classes before execution
- block completion if required receipts are missing
- record which receipts were supplied
- distinguish hard-required from optional receipts

---

## 10. Failure Conditions

A sprint fails proof governance if:

- required receipts are missing
- receipts do not map to the changed surface
- status claims exceed the receipts supplied
- protected surface work lacks elevated proof

---

## 11. Definition of Done

A sprint is complete only when:

- required receipts exist
- receipts map to the claimed work
- evidence supports the closeout summary
- any remaining blockers are explicit

---

12. Proof Authenticity

If a receipt can be fabricated without executing the claimed action, it is not
considered valid proof.

## Example: manually written logs.

END
