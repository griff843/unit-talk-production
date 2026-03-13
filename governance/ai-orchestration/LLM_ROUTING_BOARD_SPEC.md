# LLM ROUTING BOARD SPECIFICATION

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Operational Consumer: Claude OS

---

# Purpose

Define which LLM is responsible for each task type.

This prevents inconsistent model usage and ensures that each task is handled by
the most capable system.

---

# Routing Table

| Task Type           | Primary Model |
| ------------------- | ------------- |
| Architecture design | ChatGPT       |
| Repo implementation | Claude        |
| Repo analysis       | Codex         |
| Verification        | GPT           |
| Research            | Gemini        |
| Synthesis           | Gemini        |

---

# Routing Rules

1. Claude is the primary implementation model.
2. Codex is used for deep repo inspection and static analysis.
3. GPT performs verification and logic auditing.
4. Gemini is used for broad synthesis and research tasks.

---

# Protected Surface Rule

If a task modifies multiple protected surfaces:

Claude must act as the coordinating model.

Protected surfaces include:

- scoring engine
- promotion engine
- publish/outbox
- settlement
- risk enforcement
- platform status evaluation

---

# Model Substitution

If a model is unavailable:

Claude OS may substitute a model with equivalent capability but must log the
substitution in the sprint artifact.
