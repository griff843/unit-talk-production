# CI Failure Classification

**Version**: 1.0.0 **Status**: Phase A (Additive)

## Purpose

Standardized classification of CI/CD failures to enable appropriate automated
responses and escalation paths.

---

## Failure Types

### 1. FLAKE

**Definition**: Intermittent failure not caused by code changes.

**Indicators**:

- Same commit passes on retry
- No code changes in affected area
- Known flaky test patterns
- Network/timing issues

**Automated Response**:

- Retry up to 2 times
- Label: `ci:flake`
- If persists: escalate to `ci:regression`

**Severity**: P3

---

### 2. REGRESSION

**Definition**: Previously passing test/check now fails due to code change.

**Indicators**:

- Test passed on parent commit
- Code changes in test's scope
- New assertion failures
- Performance degradation > 20%

**Automated Response**:

- Label: `ci:regression`
- Generate revert PR (if feature-flagged)
- Block deployment
- Notify PR author

**Severity**: P1

---

### 3. CONFIG

**Definition**: Failure due to configuration mismatch or environment issue.

**Indicators**:

- Missing environment variables
- Invalid JSON/YAML syntax
- Dependency version conflicts
- Docker/build configuration errors

**Automated Response**:

- Label: `ci:config`
- Open auto-fix PR if safe pattern detected
- Comment with suggested fix

**Severity**: P2

**Safe Auto-Fix Patterns**:

```yaml
# Allowed auto-fixes for CONFIG failures
patterns:
  - lockfile_sync: "npm ci EUSAGE" → run npm install, commit lockfile
  - env_template: missing var in .env.example → add template entry
  - version_align: dependency version mismatch → align to workspace version
```

---

### 4. MIGRATION

**Definition**: Database migration failure or schema drift.

**Indicators**:

- SQL syntax errors
- Constraint violations
- Schema drift detected
- Migration checksum mismatch

**Automated Response**:

- Label: `ci:migration`
- **NEVER auto-fix** - escalate immediately
- Block all deployments
- Alert database team

**Severity**: P0

**Why No Auto-Fix**:

Migrations are irreversible in production. Human review is mandatory. Automation
may only:

- Detect the failure
- Preserve evidence
- File incident report
- Notify responsible parties

---

### 5. SECURITY

**Definition**: Security vulnerability or policy violation detected.

**Indicators**:

- Dependency vulnerability (npm audit, Snyk)
- Secret exposure detected
- OWASP check failure
- Permission escalation

**Automated Response**:

- Label: `ci:security`
- **NEVER auto-fix** - escalate immediately
- Trigger autopilot freeze
- Alert security team
- Block deployment

**Severity**: P0

---

### 6. POLICY

**Definition**: Violation of governance rules or Charter requirements.

**Indicators**:

- PR to protected branch without review
- Bypass of required checks
- Non-compliant commit message
- Missing required labels

**Automated Response**:

- Label: `ci:policy`
- Block merge
- Comment with policy reference
- Notify governance team

**Severity**: P1

---

## Classification Algorithm

```
function classifyFailure(failure):
    # Security checks first (highest priority)
    if failure.logs.match(/secret|vulnerability|CVE-|GHSA-/i):
        return SECURITY

    # Migration failures
    if failure.workflow.includes('migration') or
       failure.logs.match(/schema|constraint|migration/i):
        return MIGRATION

    # Policy violations
    if failure.logs.match(/protected branch|required check|policy/i):
        return POLICY

    # Regression detection
    if failure.parent_commit_passed and failure.has_code_changes:
        return REGRESSION

    # Config issues
    if failure.logs.match(/EUSAGE|missing.*variable|invalid.*config/i):
        return CONFIG

    # Flake detection
    if failure.retry_count < 2:
        return FLAKE

    # Default to regression if uncertain
    return REGRESSION
```

---

## Action Matrix

| Type       | Auto-Fix PR | Retry | Revert PR | Freeze | Escalate |
| ---------- | ----------- | ----- | --------- | ------ | -------- |
| FLAKE      | No          | Yes   | No        | No     | After 2x |
| REGRESSION | No          | No    | Yes\*     | No     | Yes      |
| CONFIG     | Yes\*       | No    | No        | No     | If fails |
| MIGRATION  | **Never**   | No    | No        | Yes    | Always   |
| SECURITY   | **Never**   | No    | No        | Yes    | Always   |
| POLICY     | No          | No    | No        | No     | Always   |

\* Feature-flagged

---

## Label Taxonomy

```
ci:flake           - Intermittent failure
ci:regression      - Code-caused failure
ci:config          - Configuration issue
ci:migration       - Database/schema issue
ci:security        - Security vulnerability
ci:policy          - Governance violation

ci:auto-fixable    - Safe for automated PR
ci:manual-required - Human intervention needed
ci:escalated       - Sent to on-call/team

severity:p0        - Critical, immediate response
severity:p1        - High, same-day response
severity:p2        - Medium, next business day
severity:p3        - Low, weekly triage
```

---

## Evidence Requirements

Each classified failure must include:

1. **Failure logs**: Full output saved to `/out/ci/{run_id}/`
2. **Classification rationale**: Why this type was selected
3. **Affected files**: List of changed files in scope
4. **Parent commit status**: Did parent pass?
5. **Retry history**: Number of attempts

---

## Related Documents

- [AUTO_RESOLUTION_POLICY.md](./AUTO_RESOLUTION_POLICY.md)
- [FORBIDDEN_ACTIONS.md](./FORBIDDEN_ACTIONS.md)
- [AUTOPILOT_FREEZE_MATRIX.md](./AUTOPILOT_FREEZE_MATRIX.md)

---

**Owner**: Platform Engineering **Last Updated**: 2026-01-18
