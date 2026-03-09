# CLAUDE OS — Fail-Closed Rules

**Version**: 1.0.0 **Purpose**: Enumerates the specific conditions under which
Claude OS must halt execution. These are not guidelines — they are hard stops.

**Governing principle**: When in doubt, stop. The cost of investigating a false
alarm is low. The cost of proceeding past a real problem is high.

---

## Rule 1: Missing Truth Source

**Trigger**: A truth source listed in the sprint contract (Section 4) or context
manifest (`always_load` or `required_when_relevant`) does not exist or cannot be
read.

**Action**: HALT. Report which truth source is missing and its expected path.

**Rationale**: Operating without a required truth source means operating on
assumptions. Assumptions produce incorrect implementations.

**Example**: Sprint contract references
`docs/system/current/ingestion-source-of-truth.md` but the file has been
renamed. HALT — do not guess at the new location.

---

## Rule 2: Conflicting Truth Sources

**Trigger**: Two truth sources at the same priority level (per truth hierarchy
in Blueprint Section 4) provide contradictory information about the same
architectural decision.

**Action**: HALT. Report both sources, the conflict, and the architectural
decision in question. Escalate to human for resolution.

**Rationale**: Contradictory truth cannot be resolved by Claude OS. Choosing one
source over another is an architectural decision that requires human judgment.

**Example**: `table-contracts.md` says FeedAgent writes to `unified_picks`, but
`agent-responsibility-matrix.md` says FeedAgent is read-only. HALT —
contradiction requires human resolution.

---

## Rule 3: Missing Acceptance Criteria

**Trigger**: A sprint's contract has no acceptance criteria (Section 10 is empty
or contains only generic items like "code works").

**Action**: HALT. Report that the sprint cannot be verified without specific,
testable acceptance criteria.

**Rationale**: Without acceptance criteria, there is no definition of "done."
Verification becomes subjective. The sprint could produce any output and claim
success.

**Example**: Sprint contract acceptance criteria says only "Implementation
complete." HALT — this is not testable.

---

## Rule 4: Undefined Artifact Path

**Trigger**: The sprint's artifact output path (Section 9 of sprint contract) is
not defined, or the path cannot be created.

**Action**: HALT. Report that proof artifacts cannot be stored.

**Rationale**: Without an artifact path, proof cannot be bundled. Without proof,
the sprint cannot be ratified.

**Example**: Sprint contract has no artifact output path section. HALT — define
the path before proceeding.

---

## Rule 5: Verification Recipe Missing

**Trigger**: The sprint contract declares a verification requirement (Section 7)
that references a recipe ID not found in
`governance/claude-os/recipes/verification-recipes.json`, or the recipe has no
command defined (`command_placeholder` is still a placeholder and no actual
command has been provided).

**Action**: HALT for missing recipe. WARN for placeholder command (proceed with
manual verification if human confirms).

**Rationale**: A verification requirement without a recipe means the
verification cannot be executed. Claiming verification passed without actually
running it is a lie.

**Example**: Sprint contract requires `discord_canary` verification but the
recipe has `"command_placeholder": "TODO: define canary command"`. HALT —
verification cannot be automated. Human must confirm manual verification path.

---

## Rule 6: Runtime Evidence Required But Unavailable

**Trigger**: Sprint contract declares runtime proof is required (Section 8), but
runtime evidence cannot be collected (e.g., no access to running environment,
database unreachable, Discord bot offline).

**Action**: HALT. Report which runtime evidence cannot be collected and why.

**Rationale**: Runtime proof is required because build-time verification is
insufficient for the sprint's scope. Proceeding without runtime proof means the
sprint has not been adequately verified.

**Example**: Sprint changes SettlementAgent logic. Runtime proof requires
querying settlement records, but the database is unreachable. HALT — runtime
evidence is mandatory for this sprint type.

---

## Rule 7: Ambiguous Canonical Target

**Trigger**: Implementation requires writing to a table or path, but it is
unclear which is the canonical target. Multiple candidates exist, or the
canonical path is not documented.

**Action**: HALT. Report the ambiguity and the candidates. Escalate to human for
canonical target designation.

**Rationale**: Writing to the wrong table is a data integrity violation. If the
canonical target is ambiguous, the implementation may reinforce the wrong path.

**Example**: A new ingestion feature needs to write market data. Both
`provider_offers` and `raw_props` contain market data. The sprint contract does
not specify which to target. HALT — clarify canonical target.

---

## Rule 8: Deprecated-Path Ambiguity

**Trigger**: Implementation requires interacting with a path that may or may not
be deprecated. The deprecation status is unclear — no migration status document
exists, or the document is ambiguous about whether the path is still in active
migration.

**Action**: HALT. Report the ambiguous path and request human clarification on
deprecation status.

**Rationale**: Writing to a deprecated path extends technical debt. Reading from
a deprecated path creates new migration dependencies. If the deprecation status
is unclear, the safest action is to stop.

**Example**: Sprint needs to read player data. `participants` is canonical, but
the code also references `players`. No clear migration status doc says whether
`players` reads are still acceptable in this code path. HALT — clarify.

---

## Rule 9: Cross-Boundary Changes Without Authorization

**Trigger**: Implementation requires changing files outside the sprint
contract's file boundary (Section 5), and no contract amendment has been
approved.

**Action**: HALT. Report which files need to change and why they are outside the
boundary. Request sprint contract amendment.

**Rationale**: File boundaries exist to limit blast radius. Changing files
outside the boundary means the sprint's scope has expanded beyond what was
planned and verified. Unplanned changes are unverified changes.

**Example**: Sprint contract allows changes only in
`apps/api/src/agents/FeedAgent/`. During implementation, a type needs to change
in `packages/contracts/`. HALT — request boundary amendment to include the type
change.

---

## Rule 10: Single-Writer Gate Failure

**Trigger**: The lifecycle single-writer gate
(`npm run lifecycle:single-writer -- --strict`) fails after implementation,
indicating a direct write to `unified_picks` outside lifecycle adapters.

**Action**: HALT. Report the specific file and line where the violation occurs.
Do not proceed to proof bundling.

**Rationale**: Single-writer discipline is a non-negotiable invariant from
`CLAUDE_EXECUTION_CONTRACT.md`. A gate failure means the implementation violates
hard law.

**Example**: A new utility function in `apps/api/src/services/` contains
`supabase.from('unified_picks').update(...)`. Gate fails. HALT — refactor to use
lifecycle adapter.

---

## Rule 11: Pre-Sprint Baseline Failure

**Trigger**: The session baseline (`pnpm session:baseline`) or pre-sprint check
(`pnpm pre-sprint-check`) fails, indicating blocking diagnostics or schema
drift.

**Action**: HALT. Report the specific failures. Address blocking diagnostics
before starting sprint implementation.

**Rationale**: Starting a sprint on a broken baseline means the sprint starts
from an unknown state. Any verification results would be unreliable.

**Example**: `pnpm session:baseline` reports 3 TypeScript errors in existing
code. HALT — these must be acknowledged (fix or explicitly justify exclusion)
before starting sprint work.

---

## Summary Table

| Rule                            | Trigger                               | Severity      | Recovery                                     |
| ------------------------------- | ------------------------------------- | ------------- | -------------------------------------------- |
| 1. Missing truth source         | Required file not found               | BLOCKING      | Locate or create the truth source            |
| 2. Conflicting truth            | Same-tier sources disagree            | BLOCKING      | Human resolves conflict                      |
| 3. Missing acceptance criteria  | No testable criteria defined          | BLOCKING      | Define criteria before proceeding            |
| 4. Undefined artifact path      | No proof output path                  | BLOCKING      | Define path in sprint contract               |
| 5. Verification recipe missing  | Recipe ID not found or placeholder    | BLOCKING/WARN | Define recipe or manual confirmation         |
| 6. Runtime evidence unavailable | Cannot collect required runtime proof | BLOCKING      | Restore runtime access or amend requirements |
| 7. Ambiguous canonical target   | Unclear which table/path to target    | BLOCKING      | Human designates canonical target            |
| 8. Deprecated-path ambiguity    | Unclear deprecation status            | BLOCKING      | Human clarifies status                       |
| 9. Cross-boundary changes       | Files outside sprint contract         | BLOCKING      | Amend sprint contract                        |
| 10. Single-writer gate failure  | Direct write detected                 | BLOCKING      | Refactor to use lifecycle adapter            |
| 11. Pre-sprint baseline failure | Diagnostics or drift detected         | BLOCKING      | Address diagnostics before sprint            |
