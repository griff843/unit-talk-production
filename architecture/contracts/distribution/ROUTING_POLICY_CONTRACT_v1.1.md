# ROUTING_POLICY_CONTRACT_v1.1.md

Unit Talk – Clean-Room Doctrine  
Phase 3 — Distribution Determinism (Design Only)  
Status: DRAFT

---

# 1. Purpose

This contract defines the deterministic routing system that maps canonical
entities to distribution targets under a specific `policy_version`.

Routing must be:

- Pure
- Deterministic
- Immutable per version
- Fully reconstructable historically
- Fail-closed

---

# 2. Policy Definition Model (Immutable Source of Truth)

## 2.1 Policy Storage

Each policy_version MUST correspond to:

- A version-controlled, immutable policy definition file
- Stored within repository under:
  architecture/distribution/policies/<policy_version>.md (design reference)
- Policy content must be content-addressable via: policy_hash =
  SHA256(policy_definition_content)

policy_version MUST uniquely map to one policy_hash.

If policy_hash does not match expected content for policy_version ⇒ FROZEN.

---

# 3. Routing Rule Schema (Closed Set)

Each policy_version defines a list of routing rules.

Each rule must be structured as:

- rule_id (string, immutable)
- match:
  - env (exact)
  - canonical_visibility (exact)
  - sport (exact)
  - league (exact)
  - event_type (exact)
  - market_type (optional exact)
  - distribution_band (optional exact)
- targets: ordered list of target descriptors

Partial matches are forbidden.

Wildcard matching is forbidden.

If rule does not match exactly on all defined match fields ⇒ no match.

---

# 4. Rule Evaluation Semantics

Routing MUST use:

Exact-match only.

Procedure:

1. Compute routing_inputs
2. Identify rules where match fields EXACTLY equal routing_inputs
3. If exactly one rule matches ⇒ success
4. If zero rules match ⇒ FROZEN
5. If more than one rule matches ⇒ FROZEN

No ordered fallback. No priority evaluation. No partial matching.

---

# 5. Target Descriptor Schema

Each target in rule.targets must define:

- logical_channel_name
- target_kind (DISCORD_WEBHOOK / DISCORD_CHANNEL)
- target_id (explicit string)
- delivery_priority (integer, for deterministic ordering)

target_id MUST be embedded in policy definition.

No indirection. No runtime lookup. No environment variable resolution.

Changing target_id requires new policy_version.

---

# 6. Fan-Out Determinism

If rule.targets contains multiple entries:

- Order MUST be deterministic by ascending delivery_priority
- Outbox MUST generate one record per target
- Ordering of Outbox record creation MUST follow sorted delivery_priority

If fan-out count at replay differs from stored count ⇒ FROZEN.

---

# 7. Environment Isolation

Each policy_version MUST explicitly declare allowed environments.

Targets for PROD MUST NOT appear in STAGING policy.

Targets for STAGING MUST NOT appear in PROD policy.

Cross-environment reuse of target_id forbidden.

Detection ⇒ FROZEN.

---

# 8. Routing Key Determinism

routing_key MUST equal:

SHA256(env + policy_version + canonical_visibility + sport + league +
event_type)

routing_key MUST match recomputed value at replay.

Mismatch ⇒ FROZEN.

---

# 9. Policy Immutability

Once policy_version is used:

- Policy definition cannot change
- target descriptors cannot change
- match rules cannot change

Any change requires new policy_version.

---

# 10. Drift Detection

Freeze if:

- policy_hash mismatch
- rule match count ≠ 1
- target_id mismatch under same policy_version
- routing_key mismatch
- fan-out ordering mismatch
- policy_version missing
- policy_version reused across environments improperly

---

# 11. Kill Conditions (Closed Set)

System MUST FROZEN if:

- Routing resolution differs between insert-time and replay
- Policy content unavailable
- policy_hash mismatch
- rule match ambiguous
- rule match missing
- target resolution differs
- fan-out ordering differs

---

# 12. Binary Acceptance Criteria

Contract is accepted only if:

- Policy storage model defined
- Rule schema closed
- Exact-match semantics enforced
- Fan-out ordering deterministic
- target_id embedded
- No runtime resolution exists
- policy_hash binding defined
- Drift detection exhaustive

Otherwise ⇒ FAIL.

---

# 13. Final Declaration

Routing under Clean-Room Doctrine is:

- Exact-match only
- Version-locked
- Content-hash bound
- Environment-isolated
- Fan-out ordered
- Replay-stable

There is no fallback. There is no wildcard. There is no runtime override.
