# Forbidden Actions

**Version**: 1.0.0 **Status**: Enforced **Violations**: Blocking + Incident
Report

## Purpose

This document defines actions that automated systems are **absolutely
forbidden** from performing. These restrictions exist to protect system
integrity, maintain audit trails, and ensure human oversight for critical
operations.

**Violation of any forbidden action is a P0 incident.**

---

## Forbidden Actions List

### 1. AUTO-MERGE

**Forbidden**: Automatically merging any pull request.

```
NEVER: gh pr merge --auto
NEVER: GitHub auto-merge feature for protected branches
NEVER: Merge via API without human approval
```

**Rationale**: Human review is mandatory for all code entering protected
branches. Automation may prepare, label, and route PRs but never merge them.

**Allowed Alternative**: Add `ready-for-review` label, assign reviewers, comment
with summary.

---

### 2. PUSH TO PROTECTED BRANCHES

**Forbidden**: Direct push to `main`, `release/*`, or any protected branch.

```
NEVER: git push origin main
NEVER: git push --force origin release/v*
NEVER: Bypass branch protection via admin override
```

**Rationale**: All changes to protected branches must flow through the PR
process with required reviews and checks.

**Allowed Alternative**: Create PR branch, push to PR branch, request review.

---

### 3. DISABLE REQUIRED CHECKS

**Forbidden**: Removing, skipping, or bypassing required status checks.

```
NEVER: gh api repos/{owner}/{repo}/branches/main/protection -X DELETE
NEVER: Remove check from branch protection rules
NEVER: Mark check as "success" without actual execution
```

**Rationale**: Required checks exist for safety. If checks are blocking, fix the
root cause—don't remove the check.

**Allowed Alternative**: File issue to discuss check removal, escalate to
governance team.

---

### 4. EDIT APPLIED MIGRATIONS

**Forbidden**: Modifying migration files that have been applied to any
environment.

```
NEVER: Edit supabase/migrations/2024*.sql after deployment
NEVER: Change migration checksum
NEVER: Delete applied migration files
```

**Rationale**: Migration history must be immutable for rollback safety and audit
compliance.

**Allowed Alternative**: Create new corrective migration that fixes the issue.

---

### 5. MODIFY PRODUCTION DATA DIRECTLY

**Forbidden**: Direct manipulation of production database tables via automation.

```
NEVER: INSERT/UPDATE/DELETE on unified_picks via automation
NEVER: Modify pick_publish outbox directly
NEVER: Alter user data without audit trail
```

**Rationale**: Production data changes must flow through application code with
proper validation, logging, and idempotency.

**Allowed Alternative**: Use application APIs, Temporal workflows, or approved
admin tools with audit logging.

---

### 6. COMMIT SECRETS

**Forbidden**: Adding secrets, tokens, or credentials to version control.

```
NEVER: Commit .env files with real values
NEVER: Hardcode API keys in source code
NEVER: Include tokens in PR descriptions or comments
```

**Rationale**: Secret exposure is a critical security incident. GitHub push
protection should block, but automation must also validate.

**Allowed Alternative**: Use GitHub Secrets, environment variables, or vault
services.

---

### 7. FORCE PUSH TO SHARED BRANCHES

**Forbidden**: Force pushing to any branch with multiple contributors.

```
NEVER: git push --force on PR branches with co-authors
NEVER: git push --force-with-lease without coordination
NEVER: Rewrite history on branches others are working on
```

**Rationale**: Force push can destroy work and break collaborator workflows.

**Allowed Alternative**: Coordinate with contributors, use new branch if history
rewrite needed.

---

### 8. BYPASS CODEOWNERS

**Forbidden**: Merging changes to owned paths without CODEOWNERS approval.

```
NEVER: Merge PR affecting /supabase/migrations without DBA review
NEVER: Merge PR affecting /apps/api/src/agents without agent-team review
NEVER: Override CODEOWNERS requirement
```

**Rationale**: Domain experts must review changes to their areas.

**Allowed Alternative**: Request review from appropriate CODEOWNERS, escalate if
blocked.

---

### 9. SILENT FAILURES

**Forbidden**: Suppressing, hiding, or ignoring CI failures.

```
NEVER: exit 0 after known failure
NEVER: || true to mask errors
NEVER: Delete failure evidence
```

**Rationale**: All failures must be visible, classified, and addressed.

**Allowed Alternative**: Proper error handling with classification and
escalation.

---

### 10. PRODUCTION DEPLOYMENT WITHOUT GREEN MAIN

**Forbidden**: Deploying to production when `main` branch has failing checks.

```
NEVER: Deploy with red CI status
NEVER: Skip staging validation
NEVER: Deploy during autopilot freeze
```

**Rationale**: Production stability requires all checks passing.

**Allowed Alternative**: Fix the failure first, then deploy.

---

## Enforcement

### Detection

Forbidden actions are detected via:

- Branch protection rules
- GitHub Actions workflow guards
- Pre-commit hooks
- Audit log monitoring
- Secret scanning

### Response

When a forbidden action is detected:

1. **Block**: Action is prevented if possible
2. **Alert**: P0 incident created immediately
3. **Audit**: Full context captured for review
4. **Notify**: Security and governance teams alerted
5. **Review**: Post-incident analysis required

### Exceptions

There are **no exceptions** to forbidden actions via automation.

Human operators may request emergency exceptions through:

1. File incident ticket explaining necessity
2. Obtain approval from 2+ senior engineers
3. Document exception in incident report
4. Implement prevention for future

---

## Violation Severity

| Action                   | Severity | Response Time |
| ------------------------ | -------- | ------------- |
| Auto-merge               | P0       | Immediate     |
| Push to protected        | P0       | Immediate     |
| Disable required checks  | P0       | Immediate     |
| Edit applied migrations  | P0       | Immediate     |
| Modify production data   | P0       | Immediate     |
| Commit secrets           | P0       | Immediate     |
| Force push shared branch | P1       | 1 hour        |
| Bypass CODEOWNERS        | P1       | 1 hour        |
| Silent failures          | P2       | 4 hours       |
| Deploy with red main     | P0       | Immediate     |

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md)
- [CI_FAILURE_CLASSIFICATION.md](./CI_FAILURE_CLASSIFICATION.md)
- [PRODUCTION_CHARTER.md](../PRODUCTION_CHARTER.md)

---

**Owner**: Security & Governance Team **Last Updated**: 2026-01-18
