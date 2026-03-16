# AI_BOOTSTRAP_READINESS_CHECKLIST_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Readiness checklist for turning the AI operating-system document
stack into an execution-ready rollout plan  
**Purpose:** Convert the current architecture/planning docs into a practical
implementation sequence by identifying what is complete, what is still
draft-only, what should be operationalized first, and what the next real rollout
steps should be.

---

# 1. Why this document exists

The AI operating-system document stack now exists in meaningful form.

Current docs include:

- `AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md`
- `AI_SKILL_WAVE_2_PLAN_v1.md`
- `AI_HELPER_AGENT_ARCHITECTURE_v1.md`
- `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`
- `AI_PORTABILITY_MODEL_v1.md`
- `AI_PORTABLE_CORE_INVENTORY_v1.md`
- `AI_PROJECT_ADAPTER_TEMPLATE_v1.md`
- `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`
- `AI_BOOTSTRAP_SEQUENCE_v1.md`

That means the architecture layer is no longer the main missing piece.

What is missing now is a clean answer to:

- what is actually ready
- what is still just defined on paper
- what should be implemented first
- what should be pressure-tested first
- whether Unit Talk itself is fully bootstrapped
- what the first portability pilot should be

This document exists to bridge **architecture** into **execution**.

---

# 2. Objective

The objective of this checklist is to determine:

- which AI operating-system assets are drafted vs operational
- which items are ready for implementation
- which implementation order gives the highest leverage
- which pieces are blocked
- whether Unit Talk is bootstrap-complete
- what the next real rollout sprint(s) should be

---

# 3. Readiness categories

Every item in this checklist should be evaluated using one of the following
readiness states.

## 3.1 Defined

The concept/document exists, but is not yet operationalized.

## 3.2 Ready for implementation

Clear enough to turn into a sprint, helper, hook, skill, or workflow.

## 3.3 Partially operational

Used in some real workflow, but not yet stable or formalized enough to be
treated as complete.

## 3.4 Operational

Actively used in a governed and repeatable way.

## 3.5 Needs ratification / reconciliation

Exists, but should be reviewed against current repo truth, status docs, or
governance before being treated as stable.

---

# 4. Current document stack readiness

## 4.1 Core AI architecture docs

| Doc                                       | Current State | Readiness                           | Notes                                                                        | Next Action                                       |
| ----------------------------------------- | ------------- | ----------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- |
| `AI_ENHANCEMENT_REMAINING_WORK_MAP_v1.md` | Created       | Ready for implementation            | Governing map for unfinished work                                            | Use as top-level roadmap for AI enhancement stack |
| `AI_SKILL_WAVE_2_PLAN_v1.md`              | Created       | Ready for implementation            | Strong immediate execution value                                             | Use to shape first skill sprint(s)                |
| `AI_HELPER_AGENT_ARCHITECTURE_v1.md`      | Created       | Ready for implementation            | Clear enough to choose first helper                                          | Select first helper to operationalize             |
| `AI_HOOK_AUTOMATION_ARCHITECTURE_v1.md`   | Created       | Ready for implementation            | Clear enough to choose first hooks                                           | Select first workflow hooks to operationalize     |
| `AI_PORTABILITY_MODEL_v1.md`              | Created       | Defined                             | Good architecture-level guidance                                             | Use to constrain extraction decisions             |
| `AI_PORTABLE_CORE_INVENTORY_v1.md`        | Created       | Defined / Needs ratification        | Strong inventory, but should be kept current as implementation begins        | Reconcile after first operationalization pass     |
| `AI_PROJECT_ADAPTER_TEMPLATE_v1.md`       | Created       | Ready for implementation            | Good reusable template                                                       | Use for future project adapters                   |
| `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`      | Created       | Needs ratification / reconciliation | Strong first instance, but should be checked against live current-state docs | Reconcile against latest repo truth/status docs   |
| `AI_BOOTSTRAP_SEQUENCE_v1.md`             | Created       | Ready for implementation            | Good rollout model                                                           | Use to assess Unit Talk and future pilots         |

---

# 5. Unit Talk bootstrap readiness assessment

## 5.1 Question

Is Unit Talk fully bootstrapped as an AI operating-system project yet?

## 5.2 Answer

**Not fully.**  
Unit Talk is **architecturally bootstrapped**, but not yet **fully
operationalized**.

## 5.3 Why

Unit Talk now has:

- the core doc stack
- portability framing
- project adapter definition
- bootstrap sequence
- helper/hook/skill plans
- **7 operational skills (Wave 1 + Wave 2 complete, 2026-03-16)**
- **2 new specialist agents (intelligence-scoring-specialist,
  temporal-workflow-guardian)**

Still needs:

- first hook set operationalized in governed form
- a readiness-verified first portability extraction pass
- a pressure-tested AI operating-system loop using these new assets end-to-end

## 5.4 Conclusion

Unit Talk is currently best described as:

**Skills Layer Operational / Hook Layer Still Defined / Portability In
Progress**

> Updated 2026-03-16: Wave 2 skills complete. Skills layer is now OPERATIONAL.

---

# 6. Helper readiness checklist

## 6.1 Current helper readiness

| Helper                            | Readiness                | Why                                                             | Recommended Priority |
| --------------------------------- | ------------------------ | --------------------------------------------------------------- | -------------------- |
| Prompt Composer Agent             | Ready for implementation | Highest immediate leverage; improves handoff quality fast       | 1                    |
| Sprint Planning Agent             | Ready for implementation | Strong planning leverage; depends on current-status truth       | 2                    |
| Status Sync / Documentation Agent | Ready for implementation | Helps prevent drift after sprint closeout                       | 3                    |
| Incident Triage Agent             | Ready for implementation | Valuable, but benefits from stronger skill usage patterns       | 4                    |
| Architecture Audit Agent          | Ready for implementation | High value, but not the first leverage point                    | 5                    |
| Project Bootstrap Agent           | Defined / Ready soon     | Important, but best after first helper/hook patterns are proven | 6                    |
| Intelligence Review Agent         | Defined / Ready soon     | Valuable, but more domain-adapter dependent                     | 7                    |

## 6.2 First helper to operationalize

**Prompt Composer Agent**

### Why first

- immediate leverage
- directly improves Claude implementation quality
- lowest friction to begin using
- sharpens architecture → implementation transition
- helps the rest of the system become more consistent

---

# 7. Hook readiness checklist

## 7.1 Current hook readiness

| Hook                                             | Readiness                | Why                                          | Recommended Priority |
| ------------------------------------------------ | ------------------------ | -------------------------------------------- | -------------------- |
| `architecture-approved-to-claude-handoff`        | Ready for implementation | Strongest immediate workflow value           | 1                    |
| `implementation-complete-to-governance-closeout` | Ready for implementation | Protects proof discipline                    | 2                    |
| `verification-complete-to-status-sync`           | Ready for implementation | Prevents post-sprint drift                   | 3                    |
| `context-refresh-after-sprint-close`             | Ready for implementation | High leverage against stale context          | 4                    |
| `behavior-changing-work-to-closeout-path`        | Ready for implementation | Important governance hook                    | 5                    |
| `diagnosis-request-to-skill-first-path`          | Ready for implementation | Important once skills are actively used      | 6                    |
| `completed-analysis-to-reference-doc`            | Ready for implementation | High anti-drift value                        | 7                    |
| `phase-sensitive-work-to-roadmap-check`          | Ready for implementation | Important for Unit Talk’s roadmap discipline | 8                    |

## 7.2 First hook set to operationalize

The best first hook set is:

1. `architecture-approved-to-claude-handoff`
2. `implementation-complete-to-governance-closeout`
3. `verification-complete-to-status-sync`

### Why this set first

Because it operationalizes the core loop:

**Plan → Implement → Verify → Reconcile**

That is the most important workflow spine.

---

# 8. Skill readiness checklist

## 8.1 Current skill readiness

> **Updated 2026-03-16 — Wave 2 COMPLETE**

| Skill                         | Readiness       | Why                                                    | Recommended Priority |
| ----------------------------- | --------------- | ------------------------------------------------------ | -------------------- |
| `system-status`               | **Operational** | Wave 1 — platform status skill                         | Wave 1 ✅            |
| `sprint-plan`                 | **Operational** | Wave 1 — sprint planning skill                         | Wave 1 ✅            |
| `agent-health`                | **Operational** | Wave 2 — AI OS layer health review (2026-03-16)        | Wave 2 ✅            |
| `prompt-compose`              | **Operational** | Wave 2 — implementation prompt composer (2026-03-16)   | Wave 2 ✅            |
| `discord-diagnose`            | **Operational** | Wave 2 — Discord delivery triage (2026-03-16)          | Wave 2 ✅            |
| `incident-triage`             | **Operational** | Wave 2 — production incident triage (2026-03-16)       | Wave 2 ✅            |
| `scoring-audit`               | **Operational** | Wave 2 — scoring/intelligence layer audit (2026-03-16) | Wave 2 ✅            |
| `temporal-health`             | Defined         | Wave 3 — needs fuller specification                    | Wave 3               |
| `schema-drift`                | Defined         | Wave 3 — good candidate, but not first                 | Wave 3               |
| `architecture-boundary-audit` | Defined         | Wave 3 — strong portable candidate                     | Wave 3               |
| `complexity-audit`            | Defined         | Wave 4 — useful, but later                             | Wave 4               |

**Skills layer status: OPERATIONAL — Wave 1 + Wave 2 complete (7 skills as of
2026-03-16)**

## 8.2 Current state

**Wave 1 + Wave 2 complete.** All seven skills are operational as non-empty
`SKILL.md` procedures in `.claude/skills/`.

Next: Wave 3 skills (`temporal-health`, `schema-drift`,
`architecture-boundary-audit`) when platform phase progress warrants it.

---

# 9. Portability readiness checklist

## 9.1 Current portability readiness

| Area                        | Readiness    | Notes                                | Next Action                                           |
| --------------------------- | ------------ | ------------------------------------ | ----------------------------------------------------- |
| Portable Core architecture  | Defined      | Strong conceptual foundation         | Begin real operationalization                         |
| Adapter model               | Defined      | Template + Unit Talk instance exist  | Ratify Unit Talk adapter                              |
| Portable asset inventory    | Defined      | Good starting inventory              | Update as helpers/hooks/skills go live                |
| First extraction candidates | Ready        | Several strong candidates identified | Choose first real extraction targets                  |
| First non-Unit Talk pilot   | Not selected | Still pending                        | Choose candidate after first operationalization cycle |

## 9.2 Best first portability extraction targets

The best first portability-ready assets are:

1. Prompt Composer Agent
2. ChatGPT → Claude handoff template
3. task routing matrix
4. preflight checklist
5. Status Sync / Documentation Agent pattern
6. `architecture-approved-to-claude-handoff` hook
7. `implementation-complete-to-governance-closeout` hook
8. `verification-complete-to-status-sync` hook

---

# 10. Ratification / reconciliation checklist

## 10.1 Items that should be checked against live current state

Before declaring the AI operating-system layer stable, review:

- `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`
- `AI_PORTABLE_CORE_INVENTORY_v1.md`

## 10.2 Why

These two are the most likely to drift as:

- current system status evolves
- the active phase changes
- assets move from defined to operational
- some supposed portable assets turn out to still be too Unit Talk-shaped

## 10.3 Immediate reconciliation targets

Check against:

- latest `CURRENT_SYSTEM_STATUS.md`
- latest `PHASE_STATUS.md`
- latest `NEXT_5_SPRINTS.md`
- latest sprint closeout truth
- latest AI operating docs

---

# 11. Recommended first rollout sequence

## 11.1 Immediate next implementation order

### Step 1

Operationalize **Prompt Composer Agent**

### Step 2

Operationalize the first hook set:

- `architecture-approved-to-claude-handoff`
- `implementation-complete-to-governance-closeout`
- `verification-complete-to-status-sync`

### Step 3

Operationalize **`agent-health`**

### Step 4

Run one real pressure-test workflow:

- choose sprint
- compose handoff
- implement
- verify
- reconcile

### Step 5

Update:

- Unit Talk adapter
- portable core inventory
- readiness checklist
- status docs if needed

---

# 12. Pressure-test checklist

## 12.1 Required first pressure test

Run one real workflow through the new AI operating layer.

## 12.2 Suggested scenario

A real Unit Talk sprint where you use:

- Sprint Planning logic or manual approved sprint selection
- Prompt Composer Agent
- first hook set
- Claude implementation lane
- Claude OS closeout lane
- status reconciliation

## 12.3 What to evaluate

- Was the handoff better than before?
- Did the hooks clarify workflow transitions?
- Did status sync happen more cleanly?
- Did any helper/hook hardcode Unit Talk assumptions incorrectly?
- Did anything remain too manual?
- What should be added to the next helper/hook/skill sprint?

---

# 13. First portability pilot checklist

## 13.1 Is the system ready for a non-Unit Talk pilot now?

**Not yet.**

## 13.2 Why not yet

Before selecting a portability pilot, the system should first prove that:

- at least one helper is operational
- at least one hook set is operational
- at least one Wave 2 skill is operational
- Unit Talk adapter works in practice
- the portable core inventory survives one real implementation cycle

## 13.3 Pilot readiness condition

A non-Unit Talk pilot becomes appropriate after the first operationalization
cycle succeeds and is reconciled.

---

# 14. Blockers and cautions

## 14.1 Current blockers

Not hard blockers, but readiness constraints:

- helper layer is still defined, not operational
- hook layer is still defined, not operational
- Wave 2 skills are still defined, not operational
- Unit Talk adapter has not yet been reality-checked through a full use cycle
- portability is still architecture-first, not field-tested

## 14.2 Cautions

- do not start another large theory-doc branch before operationalizing
- do not attempt a portability pilot before at least one helper/hook/skill cycle
  is proven
- do not treat “docs exist” as equivalent to “system installed”
- do not let current phase truth drift while building the AI layer

---

# 15. Readiness verdict

## 15.1 Overall verdict

**Ready for first operationalization cycle**

## 15.2 Meaning

The AI operating-system architecture stack is now sufficiently complete to stop
expanding broad design docs and begin implementation of the first working AI
operating layer.

## 15.3 What this means in practice

You should now move into:

1. first helper operationalization
2. first hook operationalization
3. first skill operationalization
4. first real pressure-test sprint
5. reconciliation pass

---

# 16. Recommended next action

## 16.1 Best next implementation target

**Prompt Composer Agent**

## 16.2 Why

It offers:

- the fastest practical leverage
- immediate improvement to Claude execution quality
- a natural bridge from architecture docs into real sprint work

## 16.3 Best next supporting implementation targets

Immediately after that:

- `architecture-approved-to-claude-handoff`
- `implementation-complete-to-governance-closeout`
- `verification-complete-to-status-sync`
- `agent-health`

---

# 17. Strategic conclusion

The AI operating-system document stack is now complete enough to begin real
rollout work.

That means the right next move is no longer:

- more broad architecture
- more portability theory
- more high-level planning

The right next move is:

**operationalize → pressure test → reconcile → then expand**

This checklist exists to enforce that transition.

---

# 18. Recommended follow-on artifacts

After the first operationalization cycle, update:

- `AI_PROJECT_ADAPTER_UNIT_TALK_v1.md`
- `AI_PORTABLE_CORE_INVENTORY_v1.md`
- `AI_BOOTSTRAP_READINESS_CHECKLIST_v1.md`

Possible next artifact after that:

- `AI_OPERATIONALIZATION_SPRINT_PLAN_v1.md`

---

# 19. Version notes

## v1

Initial readiness checklist covering:

- document stack readiness
- Unit Talk bootstrap assessment
- helper/hook/skill implementation order
- portability readiness
- first operationalization sequence
- first pressure-test criteria
