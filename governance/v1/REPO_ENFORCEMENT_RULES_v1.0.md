# Repository Enforcement Rules v1.0

**Version**: 1.0 **Sprint**: SPRINT-REPO-TRUTH-LOCK-001 **Date**: 2026-02-27
**Status**: LOCKED

---

## Overview

This document defines the mandatory enforcement rules for the
`unit-talk-production` repository. These rules are enforced at the GitHub level
and cannot be bypassed by any user, including repository administrators.

---

## Branch Protection Rules for `main`

### Required Settings

| Setting                                  | Value                   | Rationale                             |
| ---------------------------------------- | ----------------------- | ------------------------------------- |
| **Require pull request reviews**         | ✅ Enabled (1 reviewer) | All changes must be reviewed          |
| **Dismiss stale reviews**                | ✅ Enabled              | Ensures reviews are current           |
| **Require review from code owners**      | ✅ Enabled              | Critical paths require owner approval |
| **Require approval of most recent push** | ✅ Enabled              | Prevents sneaking in changes          |
| **Require signed commits**               | ✅ Enabled              | Cryptographic verification            |
| **Require linear history**               | ✅ Enabled              | Clean, auditable history              |
| **Require status checks**                | ✅ Enabled              | CI must pass                          |
| **Require branches to be up to date**    | ✅ Enabled              | No stale merges                       |
| **Include administrators**               | ✅ Enabled              | **No bypass for admins**              |
| **Allow force pushes**                   | ❌ Disabled             | History is immutable                  |
| **Allow deletions**                      | ❌ Disabled             | Branch cannot be deleted              |

### Required Status Checks

The following checks MUST pass before merge:

1. `Validate Documentation`
2. `TypeScript Compile Check (apps/api)`
3. `TypeScript Compile Check (apps/command-center)`
4. `TypeScript Compile Check (apps/discord-bot)`
5. `trace-spine-acceptance-summary`
6. `autopilot-policy-acceptance-summary`

---

## Commit Signing Requirements

### Policy

**All commits to `main` MUST be signed and verified.**

### Accepted Signing Methods

1. **SSH Signing** (Recommended)
   - Ed25519 keys preferred
   - Key must be registered in GitHub as a "Signing key"

2. **GPG Signing**
   - 4096-bit RSA or Ed25519 keys
   - Key must be registered in GitHub

### Verification

GitHub will show "Verified" badge for properly signed commits. Unverified
commits will be rejected by branch protection.

---

## Direct Push Prevention

### Rule

Direct pushes to `main` are **PROHIBITED** without exception.

### Enforcement

1. Branch protection requires pull request reviews
2. `Include administrators` is enabled
3. No bypass paths exist for any user

### Verification

Attempting a direct push will result in:

```
remote: error: GH006: Protected branch update failed
remote: error: Required status check missing
```

---

## Tag Minting

### Policy

Tags for governed releases MUST be minted by CI, not locally.

### Process

1. Create PR with closeout marker (e.g.,
   `governance/closeouts/SPRINT-X-COMPLETE.md`)
2. PR passes all required checks
3. PR is reviewed and merged
4. CI workflow detects closeout marker and mints tag
5. Tag is automatically signed by CI

### Prohibited Actions

- Local tag creation for governed releases
- Force-pushing tags
- Deleting release tags

---

## Ruleset Configuration

### GitHub API Settings

To replicate this configuration:

```bash
# Enable enforce_admins (no bypass for admins)
gh api -X POST repos/OWNER/REPO/branches/main/protection/enforce_admins

# Verify settings
gh api repos/OWNER/REPO/branches/main/protection --jq '{
  enforce_admins: .enforce_admins.enabled,
  required_signatures: .required_signatures.enabled,
  required_reviews: (.required_pull_request_reviews != null),
  allow_force_pushes: .allow_force_pushes.enabled
}'
```

### Expected Output

```json
{
  "enforce_admins": true,
  "required_signatures": true,
  "required_reviews": true,
  "allow_force_pushes": false
}
```

---

## Compliance Audit

### Monthly Checklist

- [ ] Branch protection settings unchanged
- [ ] `enforce_admins` is true
- [ ] `required_signatures` is true
- [ ] No new bypass rules added
- [ ] All commits in period are verified

### Audit Command

```bash
gh api repos/OWNER/REPO/branches/main/protection \
  --jq '.enforce_admins.enabled and .required_signatures.enabled'
# Must return: true
```

---

## Incident Response

### If Bypass is Detected

1. **Immediately** re-enable `enforce_admins`
2. Document the bypass in an incident report
3. Create attestation commit for unsigned commits
4. Review who/what bypassed the protection
5. Update this document if gap found

### If Unsigned Commits Reach Main

1. Do NOT rewrite history (destabilizes production)
2. Create attestation commit acknowledging the gap
3. Ensure all future commits are signed
4. Document in sprint closeout

---

## Change Control

This document is version-controlled and changes require:

1. Pull request with detailed rationale
2. Review from repository owner
3. Increment version number
4. Update `Date` field

---

## References

- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Commit Signature Verification](https://docs.github.com/en/authentication/managing-commit-signature-verification)
- `docs/ops/sop/SOP_COMMIT_SIGNING.md`

---

**Document Owner**: Engineering Team **Locked By**: SPRINT-REPO-TRUTH-LOCK-001
**Enforcement Date**: 2026-02-27
