# REPO TRUTH ACCESS STANDARD

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Primary Consumers: Claude Code, Codex, Claude OS

---

## 1. Purpose

Define how repo truth is gathered, packaged, and consumed so model decisions
remain accurate.

This standard exists because architecture quality collapses when model reasoning
is detached from actual repo state.

---

## 2. Core Rule

Repo truth beats model memory, assumptions, and stale summaries.

All implementation and status work must anchor to current repo evidence.

---

## 3. Truth Sources

Priority order:

1. live repo state
2. current branch state
3. current diffs
4. test/build/runtime outputs
5. canonical governance docs
6. prior summaries

If a prior summary conflicts with current repo evidence, current repo evidence
wins.

---

## 4. Required Repo Truth Intake

Before any non-trivial sprint, the executing lane should gather:

- current branch name
- git status
- changed files
- relevant recent commits
- affected file inventory
- relevant invariants/docs
- current errors or failing checks if present

---

## 5. Context Pack Standard

For each sprint, produce a context pack containing:

- sprint identifier
- objective
- affected authority surface(s)
- relevant repo files
- recent commit references
- relevant standards/invariants
- known blockers
- expected proof classes

This context pack is the minimum truth package provided to execution and audit
lanes.

---

## 6. Repo Truth Roles

### Claude Code

May use full repo visibility to implement.

### Codex

May inspect repo state and produce factual analysis artifacts.

### GPT-5.4

May interpret repo truth artifacts but must not invent unseen repo facts.

### Gemini

May consume curated context packs for synthesis, not raw authority assumptions.

---

## 7. Required Analysis Outputs

Repo truth analysis should be able to answer:

- what changed
- what is currently broken
- what files are authoritative
- what adjacent modules are at risk
- what standards are implicated
- what receipts are required

---

## 8. Drift Prevention

To prevent stale-context drift:

- sprint context packs must be regenerated for major tasks
- stale summaries must not be reused blindly
- status judgments must cite current evidence, not old conversation memory

---

## 9. Failure Conditions

Repo truth access is inadequate if:

- branch/diff state is unknown
- critical file ownership is unclear
- sprint runs from stale assumptions
- status judgment is made without current repo evidence

---

## 10. Claude OS Requirements

Claude OS should eventually:

- generate context packs automatically
- attach them to prompt bundles
- reject execution when repo truth is incomplete for protected surfaces

---

## 11. Definition of Correct Operation

Repo truth access is correct only when:

- current repo state is captured before execution
- execution prompts are grounded in that state
- audit and status outputs reference evidence instead of assumption
- stale context never outranks live repo evidence

---

END
