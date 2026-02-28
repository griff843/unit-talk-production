# Attestation: Unsigned Commits in SPRINT-P0-003

**Date**: 2026-02-27 **Sprint**: SPRINT-REPO-TRUTH-LOCK-001 **Status**: ATTESTED

---

## Summary

This document attests to the presence of unsigned commits that were merged to
`main` during SPRINT-STRUCTURAL-REINFORCEMENT-P0-003. These commits were created
before commit signing was properly configured.

---

## Affected Commits

| Commit Hash | Date       | Description                                                  |
| ----------- | ---------- | ------------------------------------------------------------ |
| `c8ab9cfc`  | 2026-02-27 | feat(security): operator + discord idempotency truth locks   |
| `e5f6416d`  | 2026-02-27 | fix(security): crash window safety patch for publish_token   |
| `3acdb836`  | 2026-02-27 | docs: update closeout with crash window safety patch details |

---

## Root Cause

1. `commit.gpgsign` was set to `false` in global git config
2. No signing key was configured
3. `enforce_admins` was `false` on branch protection, allowing bypass

---

## Remediation Actions

1. **SSH signing configured**: `gpg.format=ssh`, `commit.gpgsign=true`
2. **SSH key added to GitHub** as signing key
3. **`enforce_admins` enabled**: No more admin bypass
4. **SOP created**: `docs/ops/sop/SOP_COMMIT_SIGNING.md`
5. **Enforcement rules documented**:
   `governance/v1/REPO_ENFORCEMENT_RULES_v1.0.md`

---

## Decision: No History Rewrite

**Rationale**: Rewriting history on `main` would:

- Destabilize any deployments referencing these commits
- Invalidate CI/CD cache keys
- Require coordination across all team members
- Risk data loss or merge conflicts

**Instead**: This attestation documents the gap for audit purposes.

---

## Verification

All commits from this point forward are signed. Verify with:

```bash
git log --show-signature HEAD
```

---

## Sign-off

- [x] Root cause identified
- [x] Signing configured
- [x] Branch protection hardened
- [x] Documentation created
- [x] This attestation filed

**Attested By**: Claude Opus 4.5 + griff843 **Effective Date**: 2026-02-27
