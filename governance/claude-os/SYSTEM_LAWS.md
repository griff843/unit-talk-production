# CLAUDE OS — SYSTEM LAWS

**Version**: 1.0.0 **Authority**: These laws govern all Claude OS execution.
They are subordinate only to `CLAUDE_EXECUTION_CONTRACT.md` and
`docs/SYSTEM_INVARIANTS.md`. No sprint, no agent, no automation may violate
these laws.

**Enforcement**: Fail-closed. Violation of any law halts execution immediately.

---

## Law 1: Source-of-Truth Law

**Statement**: The repository governance documents are the sole source of truth
for system architecture, contracts, and invariants. No external system (Linear,
Slack, verbal agreement, cached memory) may override repo-committed truth.

**Why it exists**: Distributed truth leads to contradictions. When Claude
operates on stale or external truth, it produces changes that conflict with the
ratified system state. A single, versioned, reviewable truth source eliminates
this class of error.

**Enforcement expectation**: Before any sprint execution, Claude OS must verify
that all referenced truth sources exist in the repo and are readable. If a truth
source is referenced but missing, execution halts.

**Example violation**: Claude reads a Linear issue description that says "use
`raw_props` for ingestion" but the repo's `ingestion-source-of-truth.md`
designates `provider_offers` as canonical. Acting on the Linear description
would violate this law.

---

## Law 2: Fail-Closed Law

**Statement**: When a precondition is unmet, a truth source is missing, or a
verification step fails, Claude OS must halt execution and report the specific
failure. There is no degraded mode, no retry-with-weaker-criteria, no "best
effort" continuation.

**Why it exists**: Silent continuation past a failed gate produces work that may
be fundamentally wrong. The cost of stopping is low (time to diagnose). The cost
of continuing is high (wrong code merged, wrong architecture reinforced, trust
in governance eroded).

**Enforcement expectation**: Every phase gate checks its preconditions
explicitly. Failure produces a structured error identifying what failed and why.
No phase transition occurs until the gate passes.

**Example violation**: Verification recipe for `unit_tests` fails, but Claude OS
proceeds to proof bundling with a note "tests had some failures, likely flaky."
This violates fail-closed -- the correct action is STOP.

---

## Law 3: No-Silent-Fallback Law

**Statement**: No Claude OS operation may silently substitute a weaker behavior
when the intended behavior fails. If a system cannot perform its designed
function, it must fail visibly, not degrade invisibly.

**Why it exists**: Silent fallbacks are the most dangerous class of bug in
governed systems. They produce output that appears correct but is based on
degraded logic. In a sports intelligence platform, silent fallback in grading or
settlement could produce wrong outcomes that propagate to users.

**Enforcement expectation**: All fallback paths must be explicitly declared in
the sprint contract. Undeclared fallbacks trigger a fail-closed halt. If a
declared fallback activates, it must be logged in the proof bundle as a
limitation.

**Example violation**: A data ingestion path falls back from `provider_offers`
to `raw_props` without explicit declaration. The sprint appears to complete, but
it used a deprecated path. This is a silent fallback violation.

---

## Law 4: Build/Runtime Separation Law

**Statement**: Build-time verification (typecheck, lint, unit tests,
compilation) and runtime verification (API smoke tests, database state checks,
Discord delivery confirmation) are distinct categories. A sprint that changes
runtime behavior must include runtime evidence. Build-time evidence alone is
insufficient for runtime sprints.

**Why it exists**: TypeScript compiling does not mean the system works. A build
passing proves syntax and type correctness. It does not prove that data flows
correctly, that Discord messages render properly, or that settlement produces
correct outcomes.

**Enforcement expectation**: The sprint contract declares whether runtime proof
is required. If declared required, the proof bundle must contain runtime
evidence. If runtime evidence is missing from a runtime sprint, the proof bundle
fails the completeness check.

**Example violation**: A sprint modifies the FeedAgent's promotion logic. The
implementer runs `npm run type-check` and `npm run test:unit`, both pass. But no
runtime evidence shows that promotion actually produces correct `unified_picks`
rows. This violates build/runtime separation.

---

## Law 5: Canonical-Path Law

**Statement**: All implementation must target canonical tables and paths.
Deprecated paths (`raw_props`, `daily_picks`, `players`, `teams`) must not be
used as implementation targets. They exist only for backward compatibility reads
during migration and must be explicitly marked as deprecated in any code that
touches them.

**Why it exists**: Deprecated paths are technical debt being retired. New work
targeting deprecated paths extends their lifetime and creates migration
obstacles. The canonical path (`provider_offers` for ingestion, `unified_picks`
for picks, `participants` for entities) is the only valid target.

**Enforcement expectation**: The audit agent checks all changed files for
references to deprecated tables. Any INSERT, UPDATE, or new read dependency on a
deprecated table in new code triggers a fail-closed halt unless the sprint
contract explicitly authorizes compatibility work.

**Example violation**: A sprint adds a new ingestion pathway that writes to
`raw_props` instead of `provider_offers`. Even if it "works," it targets a
deprecated path and violates canonical-path law.

---

## Law 6: Proof-Before-Ratification Law

**Statement**: No sprint may be considered ratifiable until its proof bundle is
complete, honest, and located at the canonical artifact path. "Complete" means
all required artifacts per the artifact contract are present. "Honest" means
limitations and gaps are explicitly stated.

**Why it exists**: Proof bundles are the forensic record that allows any
reviewer to independently verify sprint outcomes. Without proof, ratification is
rubber-stamping. With proof, ratification is evidence-based review.

**Enforcement expectation**: The proof agent verifies bundle completeness
against the artifact contract before declaring the sprint ready for
ratification. Missing artifacts block ratification.

**Example violation**: A sprint closeout report says "All tests pass" but the
`proof_tests.txt` file is missing from the proof bundle. The claim is
unverifiable and the sprint is not ratifiable.

---

## Law 7: Role-Boundary Law

**Statement**: Each Claude OS agent role has defined responsibilities and
constraints. No agent may exceed its role boundaries. The architect cannot write
code. The implementer cannot skip verification. The verifier cannot modify
implementation. The proof bundler cannot fabricate evidence.

**Why it exists**: Role separation prevents the common failure mode where the
same entity that writes code also evaluates it. Separation of concerns produces
higher-quality output because each role optimizes for its specific mission.

**Enforcement expectation**: Agent definitions in `governance/claude-os/agents/`
specify allowed and forbidden actions. Phase gates verify that outputs came from
the correct agent role.

**Example violation**: The implementer agent decides that a test is "probably
fine" and skips running the verification suite. This crosses into the verifier's
domain and violates role boundaries.

---

## Law 8: Drift Detection Law

**Statement**: Claude OS must detect and report when the actual state of the
system diverges from the governed expectations. Drift includes: schema
differences from type definitions, runtime behavior differences from documented
contracts, file structure differences from repo maps, and deprecated paths still
active past their sunset date.

**Why it exists**: Governance documents describe intended state. The system may
have drifted from that state due to prior work, manual changes, or incomplete
migrations. Operating on the assumption that governance docs match reality,
without verification, produces incorrect plans and implementations.

**Enforcement expectation**: The audit agent runs drift checks as part of every
sprint. Detected drift is reported in the audit report. Critical drift (e.g.,
schema mismatch affecting sprint scope) triggers a fail-closed halt.

**Example violation**: The `table-contracts.md` says `provider_offers` has a
`normalized_market` column, but the actual database schema does not include it.
Claude OS plans implementation assuming the column exists. This is undetected
drift leading to runtime failure.

---

## Law 9: Artifact Path Law

**Statement**: All sprint artifacts must be stored at their canonical path:
`out/sprints/<SPRINT>/<YYYY-MM-DD>/`. Artifacts stored elsewhere are not
discoverable by governance tooling and do not count toward proof bundle
completeness.

**Why it exists**: Consistent artifact paths enable automated tooling,
historical audit, and reproducible review. Scattered artifacts are effectively
lost artifacts.

**Enforcement expectation**: The proof agent writes all artifacts to the
canonical path. The artifact contract defines the required directory structure.
Sprint closeout verifies artifacts are at the correct path.

**Example violation**: Proof files are saved to `out/temp/my-sprint/` instead of
`out/sprints/SPRINT-NAME-###/2026-03-08/proofs/`. The governance tooling cannot
find them, and the sprint fails the artifact completeness check.

---

## Law 10: Human Ratification Law

**Statement**: No Claude OS sprint is complete until a human has reviewed and
ratified the changes via PR merge. Claude OS may prepare the PR, generate the
proof bundle, and recommend ratification, but it cannot merge to main without
human approval.

**Why it exists**: Claude is an execution tool, not a decision authority. Human
review is the final quality gate that catches errors in judgment, scope, and
priority that automated systems cannot evaluate. Removing human ratification
converts Claude from a tool into an unsupervised autonomous agent, which is
explicitly not the design intent.

**Enforcement expectation**: Sprint closeout includes PR creation via
`gh pr create`. The sprint is not tagged as complete until the PR is merged by a
human. Force-push to main is forbidden.

**Example violation**: Claude OS merges its own PR using `gh pr merge` without
human review. Even if the code is correct, this violates human ratification law.

---

## Law 11: Linear-Not-Truth Law

**Statement**: Linear is a workflow and visibility surface. It is not a source
of truth for architecture, contracts, or system state. When Linear content
conflicts with repo governance documents, the repo wins. Linear reflects intent
and progress; the repo reflects ratified state.

**Why it exists**: Linear issues are mutable, may contain stale information, and
are not version-controlled. Repo documents are version-controlled, PR-reviewed,
and represent the ratified state of the system. Using Linear as truth creates a
class of errors where Claude acts on information that was never ratified.

**Enforcement expectation**: Claude OS reads Linear for sprint context and
planning but verifies all architectural and contractual claims against repo
documents. Conflicts are reported and halted, not silently resolved in Linear's
favor.

**Example violation**: A Linear issue says "Settlement uses ESPN API directly"
but `docs/system/current/runtime-dataflow.md` describes a different settlement
data path. Claude OS implements the Linear description, introducing an
architecture divergence.

---

## Law 12: Deprecated-Path Handling Law

**Statement**: Deprecated tables, APIs, and code paths must be handled according
to their documented deprecation status. New code must not create new
dependencies on deprecated paths. Existing dependencies may be maintained only
during active migration sprints that explicitly authorize compatibility work.

**Why it exists**: Deprecated paths represent technical debt being retired.
Every new dependency on a deprecated path extends its lifetime and increases
migration cost. The platform's evolution toward canonical architecture requires
discipline in avoiding deprecated paths.

**Enforcement expectation**: The audit agent maintains awareness of deprecated
paths (documented in `docs/system/current/` migration status files). Any sprint
that introduces a new reference to a deprecated path without explicit sprint
contract authorization triggers a fail-closed halt.

**Example violation**: A new agent is built that reads from `daily_picks`
(deprecated) instead of `unified_picks` (canonical). The agent works, but it
creates a new dependency on a table scheduled for removal.

---

## Appendix: Law Precedence

When laws conflict (which should be rare given their design), precedence
follows:

1. Laws derived from `CLAUDE_EXECUTION_CONTRACT.md` take absolute precedence.
2. Laws derived from `docs/SYSTEM_INVARIANTS.md` take second precedence.
3. Claude OS system laws take third precedence.
4. Within Claude OS laws, lower-numbered laws take precedence over
   higher-numbered laws.

Conflicts between laws at the same level require human resolution before
execution continues.
