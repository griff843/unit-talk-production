# CLAUDE OS UPGRADE ROADMAP

Status: Proposed  
Owner: Griff  
Design Authority: ChatGPT  
Primary Implementer: Claude Code  
Support Implementer: Codex (bounded subtasks only)

---

## 1. Purpose

Upgrade Claude OS from a Claude-centered sprint runner into a governed,
multi-model execution kernel for Unit Talk.

Claude OS must become capable of:

- routing work by task type
- enforcing authority boundaries
- compiling model-specific prompt packs
- validating required proof receipts
- rejecting unsafe parallelism
- maintaining structured status outputs
- feeding future Command Center routing/status surfaces

This roadmap exists to ensure Claude OS evolves into an elite orchestration
system rather than a loose prompt launcher.

---

## 2. Design Law

Claude OS must remain:

- fail-closed
- proof-gated
- authority-aware
- repo-truth grounded
- deterministic in completion standards

Claude OS must never:

- declare completion without evidence
- permit cross-authority collisions
- treat model outputs as truth without receipts
- bypass governance contracts
- rely on unstamped or ad hoc prompts

---

## 3. Strategic Outcome

When this roadmap is complete, Claude OS will govern:

- sprint planning intake
- model routing
- authority-surface conflict detection
- artifact contract enforcement
- status truth updates
- multi-model handoff structure

Claude OS will be the execution kernel of the Unit Talk AI engineering system.

---

## 4. Upgrade Phases

### Phase A — Governance Substrate

Objective: Install the control documents required for elite orchestration.

Required artifacts:

- `LLM_AUTHORITY_MAP.md`
- `STATUS_RUBRIC.md`
- `PROOF_RECEIPT_STANDARD.md`
- `REPO_TRUTH_ACCESS_STANDARD.md`
- `PROMPT_STANDARDIZATION_SPEC.md`

Acceptance criteria:

- All files exist
- Each defines deterministic standards
- No critical orchestration concept is undocumented

---

### Phase B — Authority Awareness

Objective: Teach Claude OS to understand and enforce authority surfaces.

Claude OS must be able to:

- classify a task by authority surface
- detect whether parallel execution is allowed
- reject concurrent writes to protected surfaces
- require elevated proof for protected surfaces

Acceptance criteria:

- task classification step exists
- authority conflict detection exists
- unsafe parallel tasks are blocked before execution

---

### Phase C — Prompt Pack Compilation

Objective: Generate model-specific prompt bundles from one sprint contract.

Claude OS must output, per sprint:

- Claude implementation prompt
- Codex support-task prompt(s)
- GPT audit prompt
- Gemini synthesis prompt (optional)

Acceptance criteria:

- prompt packs are generated from a single contract source
- each prompt is role-specific
- each prompt includes verification criteria

---

### Phase D — Proof Contract Enforcement

Objective: Claude OS must validate evidence before allowing completion.

Claude OS must support proof bundles that include:

- git proof
- test proof
- typecheck proof
- runtime proof where applicable
- DB proof where applicable
- Discord proof where applicable
- closeout summary

Acceptance criteria:

- sprint completion fails if required receipts are missing
- proof requirements are task-type aware
- receipts are stored in predictable locations

---

### Phase E — Status Engine

Objective: Claude OS writes structured status truth after each sprint.

Status output must include:

- sprint identifier
- affected app(s)
- affected phase(s)
- maturity claim requested
- maturity claim supported
- evidence references
- unresolved blockers
- next required sprint(s)

Acceptance criteria:

- post-sprint status artifact is generated
- unsupported status claims are blocked
- gaps are explicit

---

### Phase F — Command Center Readiness

Objective: Prepare Claude OS outputs for future UI consumption.

Claude OS should emit machine-readable artifacts for:

- routing state
- proof state
- sprint state
- status state

Acceptance criteria:

- JSON or structured markdown snapshots exist
- fields are stable enough for later Supabase/UI integration

---

## 5. Ownership Model

### ChatGPT

Owns:

- architecture
- standards
- acceptance criteria
- audit framing
- maturity judgment logic

### Claude Code

Owns:

- Claude OS implementation
- execution flow changes
- prompt compiler implementation
- proof enforcement logic
- status output generation

### Codex

Owns only bounded support work:

- tests
- docs sync
- CI assertions
- helper scripts
- non-authority-safe utilities

Codex must not independently redesign Claude OS architecture.

---

## 6. Non-Negotiable Constraints

1. Claude OS must not allow protected authority surfaces to be modified in
   parallel.
2. Claude OS must not mark a sprint complete without required receipts.
3. Claude OS must not invent repo truth; it may only consume verified
   repo/runtime evidence.
4. Claude OS must not permit freeform prompt execution without a contract.
5. Claude OS must treat status claims as evidence-backed outputs, not narrative
   opinions.

---

## 7. Protected Authority Surfaces

These require strict single-writer governance:

- scoring authority
- promotion authority
- settlement authority
- Discord publish authority
- outbox state machine
- canonical schema contract
- environment truth contract
- routing/status truth engine

Any sprint touching one of these surfaces must be classified as protected.

---

## 8. Required Outputs Per Protected Sprint

Minimum:

- sprint contract
- affected surface declaration
- implementation diff
- typecheck proof
- test proof
- runtime proof if executable path touched
- DB proof if storage contract touched
- incident/failure notes if partial
- status delta artifact

---

## 9. Kill Conditions

Claude OS upgrade work fails immediately if:

- it introduces ungoverned autonomous execution
- it weakens proof requirements
- it permits unsupported completion claims
- it obscures authority ownership
- it reduces auditability

---

## 10. Definition of Done

Claude OS is considered upgraded only when:

- authority-aware routing is active
- proof-gated completion is active
- standardized prompt packs are generated
- status truth artifacts are generated
- unsafe parallelism is blocked
- outputs are structured for future Command Center integration

---

## 11. Next Execution Order

1. Ratify governance docs
2. Implement authority classification in Claude OS
3. Implement proof receipt validation
4. Implement prompt pack generation
5. Implement status output generation
6. Add tests and CI guards
7. Run supervised proof-gated sprint to validate the upgrade

---

END
