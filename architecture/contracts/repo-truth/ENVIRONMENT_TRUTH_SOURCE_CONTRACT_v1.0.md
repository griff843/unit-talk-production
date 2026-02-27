# ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines the single authoritative source for environment
configuration per deployment environment. Each environment MUST have exactly one
truth source for critical variables. No competing definitions are permitted.

---

## 2. Environment Identity Model (Closed Set)

Environments are a closed set:

| Environment | Identity Value | Purpose                |
| ----------- | -------------- | ---------------------- |
| dev         | `dev`          | Local development      |
| staging     | `staging`      | Pre-production testing |
| prod        | `prod`         | Production serving     |

No other environment identities are permitted.

Environment identity MUST be explicit at runtime via `APP_ENV` or equivalent
single-source variable.

---

## 3. Critical Variables (Closed Set)

The following variables MUST have exactly one authoritative source per
environment:

| Variable                  | Description                |
| ------------------------- | -------------------------- |
| SUPABASE_URL              | Supabase project endpoint  |
| SUPABASE_SERVICE_ROLE_KEY | Service role secret        |
| SUPABASE_ANON_KEY         | Anonymous/public key       |
| DATABASE_URL              | Direct database connection |
| REDIS_URL                 | Redis connection string    |
| DISCORD_TOKEN             | Bot authentication         |
| APP_ENV                   | Environment identity       |

---

## 4. Truth Source Law (Single Authority)

### 4.1 Production Environment

For `prod`:

- Truth source MUST be the deployment platform secret store (e.g., Railway,
  Fly.io secrets)
- Docker Compose environment declarations are non-authoritative for prod
- `.env` files are non-authoritative for prod
- CI variables are non-authoritative for prod runtime (authoritative for prod
  build only)

### 4.2 Staging Environment

For `staging`:

- Truth source MUST be the staging deployment platform secret store
- Staging MUST NOT share truth source with prod
- Staging MUST NOT use prod credentials

### 4.3 Development Environment

For `dev`:

- Truth source MUST be Docker Compose environment declarations OR a single
  `.env.local` file
- If both exist, Docker Compose takes precedence
- `.env.local` MUST NOT contain prod or staging credentials

---

## 5. Override Prohibitions

The following overrides are FORBIDDEN:

| Prohibition                                      | Reason                          |
| ------------------------------------------------ | ------------------------------- |
| `.env.local` overriding production configuration | Cross-environment contamination |
| CI env vars overriding runtime platform secrets  | Authority confusion             |
| Multiple `.env` files with competing definitions | Ambiguous precedence            |
| Hardcoded values in source overriding env vars   | Audit failure                   |
| Runtime mutation of `process.env` after boot     | Non-determinism                 |

---

## 6. Precedence Law (When Multiple Sources Exist)

If multiple sources exist for a single variable, precedence MUST be:

1. Platform secret store (highest precedence)
2. Docker Compose environment declaration
3. `.env.local` file (lowest precedence, dev only)

This precedence MUST be declared and enforced. Ambiguous resolution is
forbidden.

---

## 7. Cross-Environment Contamination Rules

| Rule ID | Rule                                                  |
| ------- | ----------------------------------------------------- |
| CEC-001 | Prod credentials MUST NOT appear in dev configuration |
| CEC-002 | Dev credentials MUST NOT appear in prod configuration |
| CEC-003 | Staging MUST use isolated Supabase project            |
| CEC-004 | Environment identity MUST match actual deployment     |
| CEC-005 | No shared DATABASE_URL across environments            |

Violation ⇒ CONTRACT FAILURE.

---

## 8. Supabase Endpoint Singularity

Each environment MUST connect to exactly one Supabase project:

- SUPABASE_URL for prod MUST differ from staging and dev
- SUPABASE_URL for staging MUST differ from prod and dev
- SUPABASE_URL for dev MUST differ from prod and staging

Environment identity MUST be provable by comparing runtime SUPABASE_URL against
known project endpoints.

---

## 9. Audit Requirements

The following MUST be observable for audit:

- Each environment declares its truth source location
- No variable appears in multiple competing layers without declared precedence
- Runtime logs show which truth source was used at boot
- Environment identity is logged at service startup
- Supabase project ID is derivable from SUPABASE_URL

---

## 10. Acceptance Criteria (Binary)

| Criterion                                          | Requirement |
| -------------------------------------------------- | ----------- |
| Each env has exactly one truth source per variable | MUST PASS   |
| `.env.local` cannot override prod                  | MUST PASS   |
| No competing definitions without precedence law    | MUST PASS   |
| Supabase endpoint singular per environment         | MUST PASS   |
| Environment identity provable at runtime           | MUST PASS   |
| No cross-environment credential sharing            | MUST PASS   |
| Precedence law declared and followed               | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 11. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (build vs runtime variable access)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (compose env declarations)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (resolution order)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (CI env var scope)

---

## 12. Final Declaration

Each environment has one truth source. There is no override. There is no
competing definition. Environment identity is explicit, singular, and provable.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
