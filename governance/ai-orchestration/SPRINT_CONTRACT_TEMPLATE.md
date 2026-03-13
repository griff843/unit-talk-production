# SPRINT CONTRACT TEMPLATE

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Operational Consumer: Claude OS

---

# Sprint Identification

Sprint ID:

Subsystem:

Authority Surface:

---

# Objective

Define the problem the sprint solves.

---

# Desired Outcome

Describe the intended system change or improvement.

---

# Scope

Files expected to change:

Directories affected:

Subsystems touched:

---

# Protected Surfaces

Indicate if the sprint touches any protected surfaces:

- scoring engine
- promotion engine
- publish/outbox
- settlement
- risk enforcement
- platform status evaluation

If yes, Claude must coordinate execution.

---

# Required Proof

The sprint cannot be completed unless the following proof artifacts exist:

- typecheck logs
- test results
- runtime logs
- artifact receipts

---

# Completion Criteria

A sprint is complete only when:

- code changes implemented
- tests pass
- proof artifacts generated
- status artifact produced

---

# Status Impact

After completion Claude OS must evaluate whether subsystem maturity changes
according to STATUS_RUBRIC.md.
