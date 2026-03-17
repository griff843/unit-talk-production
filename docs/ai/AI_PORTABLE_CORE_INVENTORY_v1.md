# AI_PORTABLE_CORE_INVENTORY_v1

**Status:** Draft v1  
**Owner:** Griff / Unit Talk AI Operating System  
**Scope:** Inventory and classify the current AI operating-system assets into
Portable Core, Adapter-Based, Unit Talk-Specific, or Not Yet Mature Enough to
Classify  
**Purpose:** Turn the portability model into a concrete working inventory so
future extraction, reuse, sprint planning, and bootstrap design are grounded in
an explicit asset map rather than assumptions.

---

# 1. Why this document exists

The portability model is now defined, but a model alone is not enough.

To make the AI operating system portable across Griff’s broader project
portfolio, we need a concrete inventory of the actual assets that exist today
and a classification for each one.

Without this inventory, the system remains too conceptual. Future work would
still be forced to ask:

- what exactly do we have?
- what is truly reusable?
- what still depends on Unit Talk?
- what needs a project adapter?
- what is not mature enough yet to extract?

This document exists to answer those questions explicitly.

---

# 2. Objective

The objective of this inventory is to:

- identify the current AI operating-system assets
- classify each asset into the correct portability category
- separate real reusable infrastructure from Unit Talk-only logic
- identify which assets are mature enough for extraction
- identify which assets still need design work before classification is stable
- create a concrete basis for future bootstrap and portability work

---

# 3. Classification framework

Every asset in this inventory must be classified into one of four categories.

## 3.1 Portable Core

Reusable across projects with little or no project-specific change.

## 3.2 Adapter-Based

Reusable through the same core pattern, but dependent on project-specific docs,
truth sources, invariants, prompts, exports, or workflow context.

## 3.3 Unit Talk-Specific

Tied directly to Unit Talk domain logic, betting intelligence, Discord delivery
behavior, or Unit Talk-only workflow contracts.

## 3.4 Not Yet Mature Enough to Classify

Mentioned, partially defined, or directionally important, but not yet stable
enough to classify with confidence.

---

# 4. Inventory usage rules

## 4.1 This inventory is operational, not decorative

This document should be used in:

- sprint planning
- helper design
- hook design
- future project bootstrap work
- portability extraction planning

## 4.2 Classification should be conservative

Do not label something Portable Core just because it sounds reusable. If it
still depends heavily on Unit Talk assumptions, classify it as Adapter-Based or
Unit Talk-Specific.

## 4.3 Reclassification is allowed

As assets mature, they may move:

- from Unit Talk-Specific to Adapter-Based
- from Adapter-Based to Portable Core
- from Not Yet Mature Enough to Classify to one of the three formal classes

## 4.4 Extraction should follow maturity, not ambition

This inventory should help prevent premature extraction.

---

# 5. Inventory table

## 5.1 Governance and workflow docs

| Asset                               | Type                     | Classification | Maturity | Reasoning                                             | Notes / Next Step                                     |
| ----------------------------------- | ------------------------ | -------------- | -------- | ----------------------------------------------------- | ----------------------------------------------------- |
| AI operating doctrine               | Doc / workflow doctrine  | Portable Core  | High     | General operating discipline, not betting-specific    | Candidate for future universal bootstrap pack         |
| task routing matrix                 | Doc / routing pattern    | Portable Core  | High     | Broadly reusable workflow routing pattern             | Keep generic where possible                           |
| preflight checklist                 | Doc / workflow safeguard | Portable Core  | High     | General quality/sanity gate before work               | Strong bootstrap candidate                            |
| ChatGPT → Claude handoff template   | Doc / execution template | Portable Core  | High     | Strong cross-project implementation handoff value     | High extraction priority                              |
| ChatGPT project setup checklist     | Doc / setup pattern      | Portable Core  | High     | Core reusable project initialization asset            | Candidate for bootstrap pack                          |
| universal AI kit planning doc       | Planning doc             | Portable Core  | Medium   | Cross-project by intent                               | May need refinement into implementation-ready asset   |
| LLM decision playbook               | Decision doc             | Portable Core  | High     | Cross-project model/routing value                     | High portability value                                |
| AI enhancement remaining work map   | Roadmap / planning doc   | Adapter-Based  | Medium   | Pattern reusable, contents partly Unit Talk-shaped    | Reusable as a template more than as-is                |
| AI Skill Wave 2 plan                | Skill roadmap doc        | Adapter-Based  | Medium   | Pattern reusable, skills mixed across classifications | Split later into portable template + project instance |
| AI helper/agent architecture doc    | Architecture doc         | Portable Core  | High     | Strong cross-project helper pattern                   | One of the best extraction candidates                 |
| AI hook/automation architecture doc | Architecture doc         | Portable Core  | High     | Strong cross-project workflow glue pattern            | High extraction value                                 |
| AI portability model doc            | Architecture doc         | Portable Core  | High     | Explicitly cross-project                              | Keep canonical                                        |
| AI portable core inventory          | Inventory doc            | Portable Core  | High     | Explicitly part of portability system                 | Maintain over time                                    |

---

## 5.2 Workflow patterns and operating patterns

| Asset                                                | Type                           | Classification | Maturity | Reasoning                                | Notes / Next Step                        |
| ---------------------------------------------------- | ------------------------------ | -------------- | -------- | ---------------------------------------- | ---------------------------------------- |
| architecture → implementation → verification pattern | Workflow pattern               | Portable Core  | High     | Strong universal operating loop          | One of the foundation patterns           |
| status reconciliation pattern                        | Workflow pattern               | Portable Core  | High     | Applies everywhere                       | Good bootstrap/default inclusion         |
| context bundle generation pattern                    | Workflow pattern               | Portable Core  | High     | Broadly reusable concept                 | Needs project adapter inputs             |
| context bundle contents for Unit Talk                | Project context implementation | Adapter-Based  | High     | Same pattern, Unit Talk-specific sources | Good example adapter instance            |
| proof bundle discipline pattern                      | Workflow discipline            | Portable Core  | High     | Reusable across serious projects         | Core governance asset                    |
| artifact reviewability pattern                       | Workflow pattern               | Portable Core  | Medium   | Broadly useful                           | Needs more concrete conventions later    |
| work map / planning document pattern                 | Planning pattern               | Portable Core  | Medium   | Generalizable                            | Use as template across projects          |
| repo intelligence snapshot pattern                   | Workflow pattern               | Adapter-Based  | Medium   | Shape is reusable, inputs vary by repo   | Define adapter interface later           |
| repo map generation pattern                          | Workflow pattern               | Adapter-Based  | Medium   | Broad pattern, repo-specific inputs      | Needs template/spec later                |
| project bootstrap pattern                            | Workflow pattern               | Portable Core  | Medium   | Clearly cross-project                    | Needs concrete template and command flow |
| skill contract pattern                               | Workflow pattern               | Portable Core  | High     | Broadly reusable definition structure    | Should become part of bootstrap          |
| helper contract pattern                              | Workflow pattern               | Portable Core  | High     | Broadly reusable                         | Strong extraction candidate              |
| hook contract pattern                                | Workflow pattern               | Portable Core  | High     | Broadly reusable                         | Strong extraction candidate              |

---

## 5.3 MCP truth layer and truth-surface concepts

| Asset                          | Type                 | Classification | Maturity | Reasoning                                                   | Notes / Next Step                           |
| ------------------------------ | -------------------- | -------------- | -------- | ----------------------------------------------------------- | ------------------------------------------- |
| MCP truth layer concept        | Architecture concept | Adapter-Based  | High     | Reusable concept, project truth surfaces vary               | Core pattern should travel, instances adapt |
| mcp-ops                        | MCP surface          | Adapter-Based  | Medium   | Same diagnostic pattern can exist elsewhere, inputs differ  | Needs adapter rules                         |
| mcp-state                      | MCP surface          | Adapter-Based  | Medium   | Project-specific state sources vary                         | Good reusable pattern                       |
| mcp-intelligence               | MCP surface          | Adapter-Based  | Medium   | Useful beyond Unit Talk, but subject matter changes heavily | Likely adapter-based long term              |
| mcp-decision                   | MCP surface          | Adapter-Based  | Medium   | General pattern, project-specific decision context          | Needs stronger spec                         |
| “truth surface” operating idea | Architecture concept | Portable Core  | High     | Strong universal concept                                    | Keep as a core principle                    |

---

## 5.4 Existing skills — Wave 1

| Asset           | Type  | Classification     | Maturity | Reasoning                                              | Notes / Next Step                                     |
| --------------- | ----- | ------------------ | -------- | ------------------------------------------------------ | ----------------------------------------------------- |
| pipeline-health | Skill | Adapter-Based      | Medium   | Same health pattern reusable, pipeline specifics vary  | Candidate for generalized system health skill pattern |
| pick-trace      | Skill | Unit Talk-Specific | High     | Tied directly to Unit Talk pick lifecycle semantics    | Keep local unless generalized later                   |
| slo-report      | Skill | Adapter-Based      | Medium   | Reusable where SLOs exist, but source and outputs vary | Good candidate for adapter-based portability          |
| edge-check      | Skill | Unit Talk-Specific | High     | Betting-domain edge logic                              | Stays local for now                                   |

---

## 5.5 Existing and planned skills — Wave 2+

| Asset                       | Type          | Classification     | Maturity   | Reasoning                                                                  | Notes / Next Step                                           |
| --------------------------- | ------------- | ------------------ | ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| agent-health                | Skill         | Adapter-Based      | Medium     | Operator-health view pattern is reusable, health model is project-specific | Strong adapter-based candidate                              |
| discord-diagnose            | Skill         | Unit Talk-Specific | Medium     | First version tied to Unit Talk Discord workflows                          | Could evolve later into broader delivery-diagnose           |
| scoring-audit               | Skill         | Unit Talk-Specific | Medium     | First version tied to Unit Talk scoring/edge logic                         | Might later inform a generalized intelligence-audit pattern |
| temporal-health             | Planned skill | Adapter-Based      | Low-Medium | Workflow/runtime health pattern reusable, source/project-specific          | Needs definition                                            |
| schema-drift                | Planned skill | Adapter-Based      | Low-Medium | Very reusable pattern, implementation depends on project schema model      | Good future portability candidate                           |
| architecture-boundary-audit | Planned skill | Portable Core      | Low-Medium | Strong universal pattern                                                   | Needs formal design                                         |
| risk-snapshot               | Planned skill | Adapter-Based      | Low        | Review pattern portable, risk subject varies                               | Needs definition                                            |
| settlement-check            | Planned skill | Unit Talk-Specific | Low        | Current concept tied to Unit Talk settlement/pick workflows                | Keep local unless generalized later                         |
| market-health               | Planned skill | Unit Talk-Specific | Low        | Currently betting-domain oriented                                          | Could later split into a portable pattern + domain instance |
| complexity-audit            | Planned skill | Portable Core      | Low        | General architectural/process value                                        | Good future portable candidate                              |
| sprint-queue                | Planned skill | Adapter-Based      | Low        | Planning pattern reusable, backlog sources vary                            | Needs design                                                |

---

## 5.6 Helper / agent layer

| Asset                             | Type           | Classification | Maturity    | Reasoning                                               | Notes / Next Step                            |
| --------------------------------- | -------------- | -------------- | ----------- | ------------------------------------------------------- | -------------------------------------------- |
| Sprint Planning Agent             | Helper / agent | Adapter-Based  | Medium      | Pattern reusable, roadmap/status inputs vary by project | High near-term value                         |
| Incident Triage Agent             | Helper / agent | Portable Core  | Medium      | Strong cross-project triage pattern                     | Needs project evidence adapters              |
| Architecture Audit Agent          | Helper / agent | Portable Core  | Medium      | Very portable architecture review role                  | High extraction priority                     |
| Intelligence Review Agent         | Helper / agent | Adapter-Based  | Medium      | Pattern reusable, domain subject changes                | Good cross-project candidate with adapters   |
| Project Bootstrap Agent           | Helper / agent | Portable Core  | Medium      | Explicitly cross-project                                | One of the most important portability assets |
| Status Sync / Documentation Agent | Helper / agent | Portable Core  | Medium      | Broadly valuable across projects                        | Good early extraction target                 |
| Prompt Composer Agent             | Helper / agent | Portable Core  | Medium-High | Strong universal handoff value                          | Highest-value near-term portable helper      |

---

## 5.7 Hook / automation layer

| Asset                                          | Type | Classification     | Maturity    | Reasoning                                | Notes / Next Step                     |
| ---------------------------------------------- | ---- | ------------------ | ----------- | ---------------------------------------- | ------------------------------------- |
| context-refresh-after-sprint-close             | Hook | Portable Core      | Medium      | General workflow glue                    | Strong first implementation candidate |
| context-refresh-after-major-doc-change         | Hook | Portable Core      | Medium      | Broadly useful                           | Keep trigger criteria explicit        |
| context-refresh-before-sprint-planning         | Hook | Portable Core      | Medium      | General planning discipline              | Good portable default                 |
| architecture-approved-to-claude-handoff        | Hook | Portable Core      | Medium-High | One of the strongest reusable hooks      | High implementation priority          |
| implementation-complete-to-governance-closeout | Hook | Portable Core      | Medium-High | General rigor-preserving workflow hook   | High implementation priority          |
| verification-complete-to-status-sync           | Hook | Portable Core      | Medium-High | Broadly reusable                         | High implementation priority          |
| approved-remediation-path-to-sprint-shape      | Hook | Portable Core      | Medium      | Strong general workflow value            | Good follow-on hook                   |
| new-project-bootstrap-start                    | Hook | Portable Core      | Medium      | Cross-project by design                  | Tie to Project Bootstrap Agent        |
| bootstrap-to-adapter-definition                | Hook | Portable Core      | Medium      | Critical to portability                  | Good early design target              |
| bootstrap-to-first-sprint-selection            | Hook | Portable Core      | Medium      | Reusable flow progression                | Good bootstrap sequence hook          |
| sprint-output-to-artifact-location             | Hook | Adapter-Based      | Medium      | Pattern reusable, paths vary by repo     | Needs adapter mapping                 |
| proof-bundle-to-reviewable-state               | Hook | Portable Core      | Medium      | General artifact/state transition        | Good portable hook                    |
| completed-analysis-to-reference-doc            | Hook | Portable Core      | Medium      | Strong anti-drift pattern                | Excellent operating hook              |
| diagnosis-request-to-skill-first-path          | Hook | Portable Core      | Medium      | Broadly reusable request routing pattern | High daily value                      |
| discord-issue-to-discord-diagnose              | Hook | Unit Talk-Specific | Medium      | Bound to Unit Talk Discord skill         | Local for now                         |
| scoring-review-request-to-scoring-audit        | Hook | Unit Talk-Specific | Medium      | Bound to Unit Talk scoring skill         | Local for now                         |
| operator-check-request-to-agent-health         | Hook | Adapter-Based      | Medium      | Pattern reusable, health skill adapts    | Good adapter-based hook               |
| behavior-changing-work-to-closeout-path        | Hook | Portable Core      | Medium-High | Strong universal discipline hook         | High priority                         |
| architecture-impacting-work-to-doc-check       | Hook | Portable Core      | Medium      | General architecture governance          | Strong cross-project value            |
| phase-sensitive-work-to-roadmap-check          | Hook | Adapter-Based      | Medium      | Pattern reusable, roadmap model varies   | Needs project adapter input           |

---

## 5.8 Unit Talk domain assets referenced by the AI operating system

| Asset                                                    | Type                              | Classification     | Maturity    | Reasoning                                   | Notes / Next Step                            |
| -------------------------------------------------------- | --------------------------------- | ------------------ | ----------- | ------------------------------------------- | -------------------------------------------- |
| pick lifecycle semantics                                 | Domain architecture               | Unit Talk-Specific | High        | Core Unit Talk domain logic                 | Should not be extracted into core            |
| Discord delivery semantics                               | Domain workflow                   | Unit Talk-Specific | High        | Unit Talk-specific operational surface      | Keep local unless generalized carefully      |
| scoring / edge logic                                     | Domain intelligence               | Unit Talk-Specific | High        | Central betting-domain logic                | Remains local                                |
| CLV / calibration / betting intelligence review patterns | Domain review logic               | Unit Talk-Specific | Medium-High | Not general workflow assets in current form | Might inspire generic review templates later |
| workflow registry details                                | Domain / implementation structure | Unit Talk-Specific | High        | Repo and product specific                   | Keep local                                   |
| settlement and market-specific review logic              | Domain logic                      | Unit Talk-Specific | Medium      | Betting-specific                            | Keep local for now                           |

---

## 5.9 Assets not yet mature enough to classify confidently

| Asset                                    | Type                        | Current Temp Status               | Reasoning                                                   | Notes / Next Step                     |
| ---------------------------------------- | --------------------------- | --------------------------------- | ----------------------------------------------------------- | ------------------------------------- |
| broader reusable skill framework         | Meta-architecture           | Not Yet Mature Enough to Classify | Still directional, not concrete enough                      | Needs post-Wave-2 validation          |
| portable install/bootstrap scaffolding   | Bootstrap system            | Not Yet Mature Enough to Classify | Goal is clear, artifact not yet defined                     | Needs Project Bootstrap maturation    |
| generalized delivery-diagnose skill      | Future skill concept        | Not Yet Mature Enough to Classify | Possible future evolution of `discord-diagnose`             | Revisit after Discord skill matures   |
| generalized intelligence-audit framework | Future skill/helper concept | Not Yet Mature Enough to Classify | Could emerge from scoring-audit + Intelligence Review Agent | Revisit later                         |
| universal health-dashboard surface       | Future helper/pattern       | Not Yet Mature Enough to Classify | Depends on `agent-health` and other health skills maturing  | Revisit after adapter model is proven |
| reusable repo intelligence adapter spec  | Adapter spec                | Not Yet Mature Enough to Classify | Directionally important but not yet defined                 | Good future design doc                |

---

# 6. Extraction priority board

## 6.1 Highest-priority Portable Core extraction candidates

These are the best near-term candidates to carry across projects:

1. AI operating doctrine
2. task routing matrix
3. preflight checklist
4. ChatGPT → Claude handoff template
5. project setup checklist
6. LLM decision playbook
7. helper contract pattern
8. hook contract pattern
9. Prompt Composer Agent
10. Project Bootstrap Agent
11. Status Sync / Documentation Agent
12. architecture → implementation → verification workflow pattern
13. implementation-complete-to-governance-closeout hook
14. verification-complete-to-status-sync hook
15. diagnosis-request-to-skill-first-path hook

---

## 6.2 Highest-priority Adapter-Based candidates

These are the best assets to preserve in reusable form with project adapters:

1. context bundle implementation
2. MCP surface implementations
3. pipeline-health pattern
4. slo-report pattern
5. agent-health
6. Sprint Planning Agent
7. Intelligence Review Agent
8. artifact routing hooks
9. phase-sensitive roadmap hooks
10. schema-drift
11. temporal-health

---

## 6.3 Must remain Unit Talk-local for now

These should not be extracted yet:

1. pick-trace
2. edge-check
3. discord-diagnose
4. scoring-audit
5. pick lifecycle logic
6. Discord delivery semantics
7. scoring/edge/CLV business review logic
8. settlement and market-specific checks

---

# 7. Gaps revealed by this inventory

This inventory reveals several important gaps.

## 7.1 Some of the most valuable portable assets are still only architectural definitions

Examples:

- Project Bootstrap Agent
- Prompt Composer Agent
- Status Sync / Documentation Agent
- several major hooks

These need implementation or operating-form hardening.

## 7.2 Adapter design is still underdefined

We know many assets are adapter-based, but the adapter template itself still
needs to be formalized.

## 7.3 Some Unit Talk-specific assets may later produce portable patterns

Examples:

- `discord-diagnose` could become a broader delivery-diagnose pattern
- `scoring-audit` could inform a generalized intelligence-audit framework

But they are not there yet.

## 7.4 The stack now needs a real project adapter document

That is the clearest next architecture artifact.

---

# 8. Recommended next moves after this inventory

## 8.1 Immediate next doc

Create:

`docs/ai/AI_PROJECT_ADAPTER_TEMPLATE_v1.md`

This should define:

- what every project adapter must specify
- what inputs the portable core expects
- how a project tells the AI operating system about its docs, phases, truth
  sources, artifacts, and domain boundaries

## 8.2 Then

Create:

`docs/ai/AI_BOOTSTRAP_SEQUENCE_v1.md`

This should define:

- how a new repo/app gets the AI operating system
- what order the docs/helpers/hooks get introduced
- what is required before the first sprint

## 8.3 Then

Choose the first portability pilot outside Unit Talk.

Best candidates:

- poker project
- Madden tool
- another ops-heavy repo

That is where the portability model becomes real.

---

# 9. Acceptance criteria

This inventory is considered useful and operational when:

## 9.1 Coverage

The major current AI operating-system assets are listed.

## 9.2 Classification

Each listed asset has an explicit classification:

- Portable Core
- Adapter-Based
- Unit Talk-Specific
- Not Yet Mature Enough to Classify

## 9.3 Reasoning

Each classification includes a concise reason.

## 9.4 Actionability

The inventory clearly supports:

- extraction planning
- sprint prioritization
- adapter design
- portability governance

## 9.5 Maintenance path

This document can be updated as assets mature or reclassify.

---

# 10. Strategic conclusion

The portability model is now concrete enough to act on.

This inventory makes the key reality visible:

- a meaningful portion of the AI operating system is already strong Portable
  Core
- a large second layer is clearly Adapter-Based
- several highly valuable assets are correctly still Unit Talk-specific
- a few important ideas are still too early to classify confidently

That is exactly what a healthy portability system should reveal.

The next maturity step is not more broad theory.

It is to define the **project adapter** clearly enough that the Portable Core
can actually travel.

---

# 11. Recommended follow-on document chain

1. `AI_PROJECT_ADAPTER_TEMPLATE_v1.md`
2. `AI_BOOTSTRAP_SEQUENCE_v1.md`
3. first non-Unit Talk pilot adapter doc

---

# 12. Version notes

## v1

Initial concrete portability inventory covering:

- current docs
- workflow patterns
- MCP surfaces
- skills
- helper/agent assets
- hook assets
- domain-bound assets
- extraction priorities
- maturity gaps
