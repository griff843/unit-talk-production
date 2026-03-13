# PROMPT STANDARDIZATION SPEC

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Primary Enforcement Surface: Claude OS

---

## 1. Purpose

Standardize prompts across all model lanes so outputs are deterministic,
auditable, and role-correct.

This document exists because elite orchestration depends on prompt consistency,
not just model quality.

---

## 2. Core Rule

Every important prompt must follow a governed structure.

Freeform prompts are allowed only for low-risk exploration, never for protected
implementation or status judgment.

---

## 3. Required Prompt Sections

Every governed prompt must contain:

1. Role
2. Objective
3. Scope
4. Authority surface(s)
5. Constraints
6. Required outputs
7. Verification criteria
8. Stop conditions
9. Artifact expectations

---

## 4. Canonical Prompt Skeleton

```text
ROLE
You are [assigned role].

OBJECTIVE
[what must be achieved]

SCOPE
[included systems/files/surfaces]

AUTHORITY SURFACES
[protected/standard surfaces touched]

CONSTRAINTS
[non-negotiable rules]

REQUIRED OUTPUTS
[deliverables]

VERIFICATION
[how success is proven]

STOP CONDITIONS
[what must cause halt/escalation]

ARTIFACTS
[required receipts/files]
5. Role-Specific Prompt Standards
GPT-5.4 Prompt Type

Use for:

sprint contracts

architecture judgments

status reviews

audit framing

Must emphasize:

reasoning quality

tradeoff clarity

evidence thresholds

blocked claims

Claude Code Prompt Type

Use for:

implementation

refactors

protected surface changes

Claude OS upgrades

Must emphasize:

exact scope

authority protection

no uncontrolled changes

required proof receipts

Codex Prompt Type

Use for:

bounded support work

repo inspection

tests

CI helpers

docs sync

Must emphasize:

no protected surface redesign

strict file/task boundaries

factual outputs

Gemini Prompt Type

Use for:

large-context synthesis

external comparison

terminology drift mapping

Must emphasize:

synthesis only

no authoritative repo-state claims beyond provided inputs

6. Prompt Quality Rules

A prompt is elite only when it is:

role-specific

bounded

evidence-aware

explicit about constraints

explicit about deliverables

explicit about stop conditions

7. Prompt Anti-Patterns

Forbidden for governed work:

“fix this”

“make this better”

“review the repo”

“build the best version”

“finish this feature”

without scope, constraints, and proof requirements

8. Standard Verification Language

Prompts should specify expected proof, such as:

typecheck must pass

tests must pass

runtime receipt required

DB proof required

status artifact required

stop if authority collision is detected

9. Claude OS Requirements

Claude OS should eventually compile prompts from structured sprint contracts rather than relying on manual prompt writing.

The sprint contract should be the source of truth.
The prompts should be generated derivatives.

10. Definition of Correct Prompt Governance

Prompt governance is correct only when:

prompts are standardized

prompts align with task role

protected work uses governed prompt format

outputs map cleanly to required receipts

prompt ambiguity is minimized before execution

END
```
