# BUILD_RUNTIME_SEPARATION_LAW_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines the strict separation between build-time and runtime
execution phases. Build artifacts MUST be reproducible and MUST NOT depend on
runtime state, secrets, or connections.

---

## 2. Scope

This contract governs:

- All build processes (Docker builds, CI builds, local builds)
- All runtime processes (container execution, worker startup, API boot)
- The boundary between these two phases

---

## 3. Definitions

### 3.1 BUILD Phase

The BUILD phase is defined as:

- Any execution that produces artifacts (images, bundles, binaries)
- Executes in CI or local development toolchain
- Has access only to: source code, lockfiles, build-only environment variables,
  base image hashes

### 3.2 RUNTIME Phase

The RUNTIME phase is defined as:

- Any execution that serves requests or processes work
- Executes inside deployed containers or authorized execution environments
- Has access to: runtime environment variables, secrets, external service
  connections

### 3.3 Build-Only Environment Variables (Closed Set)

Variables permitted at build time:

- NODE_ENV (for build optimization flags)
- CI (boolean indicator)
- BUILD_ID (traceability)
- IMAGE_TAG (output naming)

### 3.4 Runtime-Only Environment Variables (Partial List)

Variables forbidden at build time:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY
- DATABASE_URL
- REDIS_URL
- DISCORD_TOKEN
- DISCORD_WEBHOOK_URL
- Any secret or credential

---

## 4. Invariants

| ID      | Invariant                                                    |
| ------- | ------------------------------------------------------------ |
| BRS-001 | Build phase MUST NOT initialize Supabase client              |
| BRS-002 | Build phase MUST NOT connect to Redis                        |
| BRS-003 | Build phase MUST NOT perform HTTP calls to external services |
| BRS-004 | Build phase MUST NOT access runtime-only env vars            |
| BRS-005 | Build phase MUST NOT read runtime secrets                    |
| BRS-006 | Build artifacts MUST be reproducible                         |
| BRS-007 | Runtime-only variables MUST NOT be required during build     |

Violation of any invariant ⇒ CONTRACT FAILURE.

---

## 5. Forbidden Behaviors

Build phase MUST NOT:

1. Import and execute Supabase client initialization
2. Import and execute Redis client initialization
3. Execute `fetch()`, `axios()`, or any HTTP client against external URLs
4. Read `process.env.SUPABASE_URL` or any runtime-only variable
5. Read secrets from any secret store
6. Connect to any database
7. Start any server or listener
8. Execute Temporal worker registration
9. Send Discord messages or webhook calls
10. Write to any external state

---

## 6. Required Behaviors

Build phase MUST:

1. Complete successfully with only: source + lockfile + build-only env + base
   image hash
2. Produce identical artifacts given identical inputs (reproducibility)
3. Fail immediately if runtime-only variables are accessed
4. Declare all build-time dependencies in lockfile
5. Use deterministic dependency resolution

Runtime phase MUST:

1. Initialize all external connections only after container/process start
2. Validate environment completeness at boot before serving
3. Fail-closed if required runtime variables are missing

---

## 7. Audit Signals

The following MUST be observable for audit:

- Build logs MUST NOT contain runtime secret values
- Build logs MUST NOT contain Supabase connection strings
- Build logs MUST NOT contain Redis connection activity
- Artifact manifest MUST include: commit SHA, build timestamp, image hash
- Runtime boot logs MUST show environment validation checkpoint

---

## 8. Acceptance Criteria (Binary)

| Criterion                                      | Requirement |
| ---------------------------------------------- | ----------- |
| Build completes without runtime env vars       | MUST PASS   |
| Build produces identical output for same input | MUST PASS   |
| No Supabase client init in build phase         | MUST PASS   |
| No Redis client init in build phase            | MUST PASS   |
| No HTTP calls in build phase                   | MUST PASS   |
| No secret access in build phase                | MUST PASS   |
| Runtime validates env at boot                  | MUST PASS   |
| Artifact traceable to commit                   | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 9. Canonical Bindings

- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (env var authority)
- DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0 (runtime execution authority)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (config resolution order)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (build gate enforcement)
- TEMPORAL_EXECUTION_BOUNDARY_CONTRACT_v1.0 (worker separation)
- PACKAGING_AND_STANDALONE_TRUTH_CONTRACT_v1.0 (packaging separation)

---

## 10. Final Declaration

Build and runtime are strictly separated phases. Build MUST NOT touch runtime
state. Runtime MUST validate before serving. There is no warn-pass. There is no
partial compliance.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
