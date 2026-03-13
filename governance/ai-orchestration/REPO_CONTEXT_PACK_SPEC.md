# REPO CONTEXT PACK SPECIFICATION

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Operational Consumer: Claude OS

---

# Purpose

Ensure that all LLM tasks operate with correct repository context.

Without accurate repo context, LLM reasoning becomes unreliable.

Claude OS must generate a context pack before executing any sprint task.

---

# Required Context Fields

Every context pack must include:

- repository name
- current branch
- git status
- recent commits
- diff summary
- changed files
- affected directories

---

# Governance Context

The context pack must also include relevant governance documents:

- SYSTEM_INVARIANTS.md
- LLM_AUTHORITY_MAP.md
- PROMPT_STANDARDIZATION_SPEC.md
- PROOF_RECEIPT_STANDARD.md
- STATUS_RUBRIC.md

---

# Task Context

Claude OS must also include:

- sprint contract
- affected subsystem
- expected proof artifacts
- authority surfaces

---

# Context Freshness

Context packs must be generated immediately before task execution.

Cached context older than 5 minutes is invalid.

---

# Validation

Claude OS must verify that the context pack contains all required fields before
execution.

If required fields are missing, the task must fail.
