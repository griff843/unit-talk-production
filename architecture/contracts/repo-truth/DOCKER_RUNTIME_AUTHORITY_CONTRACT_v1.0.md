# DOCKER_RUNTIME_AUTHORITY_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract establishes Docker containers as the authoritative runtime
execution environment for production. Local node execution is non-authoritative
and non-production. All production services MUST execute within Docker
containers.

---

## 2. Authority Model

### 2.1 Docker is Runtime Truth

For production and staging environments:

- Docker containers are the ONLY authoritative execution surface
- Container images built via CI are the ONLY authoritative artifacts
- Docker Compose (or equivalent orchestration) declares the authoritative
  service topology

### 2.2 Local Node is Non-Authoritative

For development:

- Local `node` execution is permitted for development convenience
- Local execution MUST NOT be considered production-equivalent
- Local execution MUST NOT access production credentials
- Local execution behavior is non-authoritative for production truth

---

## 3. Execution Modes (Closed Set)

| Mode                | Environment    | Authoritative | Notes                   |
| ------------------- | -------------- | ------------- | ----------------------- |
| Docker container    | prod / staging | YES           | Required for production |
| Docker container    | dev            | YES           | Preferred for dev       |
| Local node (direct) | dev            | NO            | Convenience only        |
| Local node (direct) | prod / staging | FORBIDDEN     | Never permitted         |

---

## 4. Prohibited Execution Modes

The following execution modes are FORBIDDEN:

| Prohibition                                       | Reason                       |
| ------------------------------------------------- | ---------------------------- |
| Raw `node` on production host                     | No container isolation       |
| `npm start` on production host without container  | No artifact authority        |
| PM2/forever/systemd running node directly in prod | Bypasses container authority |
| Any production service outside Docker             | Authority violation          |

Violation ⇒ CONTRACT FAILURE.

---

## 5. Required Runtime Declaration Surface

Docker Compose (or equivalent orchestration manifest) MUST declare:

### 5.1 Service Definitions

For each production service:

- Service name (unique identifier)
- Image reference (tagged, traceable to CI build)
- Required environment variables (declared, not valued in compose for prod)
- Port mappings (if applicable)
- Health check definition
- Dependency relationships

### 5.2 Required Services (Closed Set for Unit Talk)

| Service         | Type           | Required |
| --------------- | -------------- | -------- |
| api             | Application    | YES      |
| temporal-worker | Worker         | YES      |
| redis           | Infrastructure | YES      |

### 5.3 Environment Input Declaration

Compose MUST declare all required environment variables per service.

For production: Values MUST NOT be embedded in compose file. Values MUST come
from platform secret store.

For development: Values MAY be embedded or referenced from `.env.local`.

---

## 6. Image Authority

### 6.1 Production Images

Production images MUST:

- Be built by CI pipeline
- Be tagged with commit SHA or semantic version
- Be pushed to authorized registry
- Be traceable to source commit

Production images MUST NOT:

- Be built locally and pushed to prod
- Be tagged with mutable tags (e.g., `latest` for prod deployment)
- Contain embedded secrets

### 6.2 Development Images

Development images MAY:

- Be built locally
- Use mutable tags
- Mount source volumes for hot reload

---

## 7. Audit Requirements

The following MUST be observable for audit:

- Running production containers traceable to image SHA
- Image SHA traceable to CI build
- CI build traceable to source commit
- Compose manifest declares all services
- No production service running outside container

---

## 8. Acceptance Criteria (Binary)

| Criterion                                 | Requirement |
| ----------------------------------------- | ----------- |
| Production execution occurs inside Docker | MUST PASS   |
| No raw node execution in production       | MUST PASS   |
| Compose declares all production services  | MUST PASS   |
| Compose declares required env inputs      | MUST PASS   |
| Production images tagged and traceable    | MUST PASS   |
| No secrets embedded in images             | MUST PASS   |
| Local node marked non-authoritative       | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 9. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (image build separation)
- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (env var injection)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (boot-time config)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (image build gates)
- TEMPORAL_EXECUTION_BOUNDARY_CONTRACT_v1.0 (worker containers)

---

## 10. Final Declaration

Docker is the production runtime authority. Local node is development
convenience. There is no production execution outside containers. There is no
ambiguity.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
