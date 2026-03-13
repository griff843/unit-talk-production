# STATUS RUBRIC

Status: Required  
Owner: Griff  
Design Authority: ChatGPT  
Operational Consumer: Claude OS

---

## 1. Purpose

Define the only valid maturity language for Unit Talk and its apps.

This rubric prevents status inflation, vague claims, and inconsistent
evaluation.

No system, app, or feature may be called:

- production-ready
- elite
- syndicate-grade
- dominant

without satisfying the required evidence standard.

---

## 2. Status Classes

The permitted maturity classes are:

1. Design
2. Prototype
3. Operational
4. Production-Ready
5. Elite
6. Syndicate-Grade

No unofficial labels are permitted in governance outputs.

---

## 3. Global Rule

Status is not a feeling.

Status is an evidence-backed judgment produced from:

- repo truth
- runtime truth
- proof receipts
- invariant compliance
- roadmap phase alignment

If evidence is missing, the lower status applies.

---

## 4. Status Definitions

### 4.1 Design

Meaning: The concept/spec exists, but implementation is absent or
non-authoritative.

Minimum indicators:

- design artifact exists
- scope defined
- no production proof required yet

Cannot claim:

- operational use
- production readiness
- elite behavior

---

### 4.2 Prototype

Meaning: Basic implementation exists, but correctness, hardening, or governance
is incomplete.

Indicators:

- code exists
- some paths work
- limited or informal testing exists
- invariants may still be weak

Cannot claim:

- reliable production behavior
- repeatable safe operation

---

### 4.3 Operational

Meaning: The system runs in practice and supports active workflows, but is not
yet fully hardened.

Indicators:

- executable in real workflows
- known limitations documented
- proof exists for core path
- failures do not imply full trust

Cannot claim:

- production-ready
- elite
- syndicate-grade

---

### 4.4 Production-Ready

Meaning: The system is safe for intended production use within defined scope.

Required evidence:

- core path passes tests
- typecheck/build proof exists
- runtime proof exists
- critical invariants enforced
- failure modes documented
- proof bundle complete
- no known blocking corruption vector remains in scope

Cannot claim:

- elite without exceeding baseline expectations
- syndicate-grade without superior capability proof

---

### 4.5 Elite

Meaning: The system is not merely stable; it demonstrates superior operational
quality, discipline, and decision support relative to normal production systems
in its category.

Required evidence:

- Production-Ready criteria all satisfied
- strong observability
- fail-closed behavior in critical paths
- low-drift governance
- superior operator leverage
- reduced manual burden
- measurable quality above baseline peers

Examples of qualifying signals:

- status truth maintained continuously
- duplicate-proof publish path
- reproducible scoring inputs
- strong execution telemetry
- disciplined routing and proof gates

Cannot claim:

- syndicate-grade without measurable strategic edge capability

---

### 4.6 Syndicate-Grade

Meaning: The system demonstrates institutional-quality betting intelligence and
disciplined operational capability that approaches professional advantage
standards.

Required evidence:

- Elite criteria all satisfied
- calibrated probability discipline
- CLV-aware execution discipline
- structured loss attribution
- portfolio/risk discipline
- measurable evidence of edge process quality
- model governance and drift controls
- superior intelligence workflow over retail-grade tools

Syndicate-grade does not mean guaranteed profit. It means the system operates
with professional-grade intelligence and controls.

This aligns with Unit Talk’s defined intelligence superiority standards: trusted
probabilities, CLV lift, disciplined sizing, and structured loss attribution.
:contentReference[oaicite:3]{index=3}

---

## 5. App-by-App Evaluation Dimensions

Each app or subsystem must be judged across:

1. Structural Integrity
2. Runtime Reliability
3. Proof Coverage
4. Observability
5. Operator Leverage
6. Strategic Capability
7. Drift Resistance

Each dimension receives one of the maturity classes above.

Overall app status equals the lowest materially blocking dimension unless
explicitly waived by documented scope.

---

## 6. Platform-Level Status Rules

Platform-level Unit Talk status cannot exceed the weakest critical subsystem
among:

- scoring
- promotion
- publish/outbox
- settlement
- routing/status truth
- risk enforcement
- telemetry/truth monitoring

If any critical subsystem is below Production-Ready, the platform cannot be
called Elite.

If intelligence/risk/postmortem/calibration standards are not proven, the
platform cannot be called Syndicate-Grade.

---

## 7. Required Evidence by Status

| Status           | Required Evidence                                                         |
| ---------------- | ------------------------------------------------------------------------- |
| Design           | design doc                                                                |
| Prototype        | code exists + limited validation                                          |
| Operational      | runnable workflow + basic proof                                           |
| Production-Ready | full scoped proof bundle + invariants enforced                            |
| Elite            | production proof + superior observability/governance/operational leverage |
| Syndicate-Grade  | elite proof + intelligence/risk/CLV/loss-attribution discipline           |

---

## 8. Prohibited Behavior

The following are forbidden:

- claiming status from intuition
- claiming Elite because the UI looks polished
- claiming Production-Ready without runtime proof
- claiming Syndicate-Grade without intelligence evidence
- skipping lower-status failures because another subsystem is strong

---

## 9. Status Artifact Requirements

Every status judgment must include:

- subject under review
- current status claimed
- evidence cited
- blockers
- why higher statuses are not yet justified
- next steps required to advance

---

## 10. Status Review Questions

Every review must answer:

1. What is the current verified maturity class?
2. What evidence supports that class?
3. What blocks the next class?
4. Which dimensions lag most?
5. Is the platform ahead of, equal to, or behind retail-grade standards?
6. Is there evidence of elite-only behavior?
7. Is there evidence of syndicate-grade intelligence discipline?

---

## 11. Definition of Correct Status Governance

Status governance is correct only when:

- every claim maps to evidence
- unsupported higher claims are rejected
- subsystem weakness caps platform-level claims
- progress and gaps are both explicit
- status language stays consistent across sprints

---

END
