# UTRP-R3 — Lifecycle Auth Reconstruction

> **Sprint**: UTRP-R3-LIFECYCLE-AUTH-RECONSTRUCTION **Workstream**: R3
> **Status**: NOT STARTED **Dependencies**: R1 COMPLETE

---

## Objective

Command Center must be able to invoke all lifecycle operations (approve, reject,
settle, freeze) against the API service without receiving 401 or 403, using a
scoped internal service token that does not expose credentials publicly.

> Auth is the single most critical infrastructure blocker. Settlement is
> impossible, recap is always empty, and Discord posting cannot be confirmed
> without resolving the 401 between Command Center and the API.

---

## Scope

### Root Cause

`docker-compose.yml` sets `NODE_ENV=production` for the API service (lines 437,
479). `apps/api/src/middleware/operatorAuth.ts` requires a valid Bearer JWT
token in production mode. The Command Center has no mechanism to obtain or
supply a JWT. Result: every ops endpoint returns 401 from CC context.

### 1. DEFECT-15 — Internal service token mechanism

Implement a scoped internal service token for CC→API calls:

**`operatorAuth.ts` change:**

```typescript
// If request carries a valid INTERNAL_SERVICE_TOKEN header,
// treat as 'internal' operator with operator_override authority.
// Only trusted in production when the token matches the env var exactly.
const internalToken = req.headers['x-internal-service-token'];
if (internalToken && internalToken === process.env.INTERNAL_SERVICE_TOKEN) {
  req.operator = { id: 'internal-service', role: 'operator_override' };
  return next();
}
```

Security constraints:

- Token must be a minimum 32-character random string
- Token must be set via env var, never hardcoded
- The bypass applies ONLY to the `X-Internal-Service-Token` header check — the
  existing JWT path is unchanged
- Token must NOT be included in any client-facing response or log

**`docker-compose.yml` change:**

- Add `INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN}` to API service
- Add `INTERNAL_SERVICE_TOKEN=${INTERNAL_SERVICE_TOKEN}` to Command Center
  service
- The token value must be set in `.env` (local) or K8s secrets (production)

**`usePicks.ts` change (CC):**

- `approvePick` and `rejectPick` fetch calls must include
  `X-Internal-Service-Token: <token>` header
- Token read from `process.env.NEXT_PUBLIC_INTERNAL_SERVICE_TOKEN` or via a
  CC-side API proxy endpoint

### 2. DEFECT-14 — Verify settlement endpoints unblocked

After implementing the token, verify that:

- `POST /api/ops/picks/:id/approve` returns 200 from CC context
- `POST /api/ops/picks/:id/reject` returns 200 from CC context
- Any ops settlement endpoint returns 200 from CC context

### 3. DEFECT-16 — NODE_ENV audit

Review whether `NODE_ENV=production` is the correct setting for local
development docker-compose for each service. Document the decision:

- If changed to `development` for local: document the auth behavior difference
- If kept as `production`: the INTERNAL_SERVICE_TOKEN approach is the correct
  permanent fix

---

## Security Requirements

The INTERNAL_SERVICE_TOKEN mechanism must satisfy:

| Requirement                                          | Rationale                                 |
| ---------------------------------------------------- | ----------------------------------------- |
| Never logged                                         | Token in logs = credential leak           |
| Never returned in API response                       | Same                                      |
| Not included in `proof_auth_surface.md` in cleartext | Use `***REDACTED***`                      |
| Env-var only                                         | No hardcoded values in any committed file |
| Minimum 32 chars                                     | Brute-force resistance                    |
| Different value per environment                      | Local ≠ Staging ≠ Production              |

---

## Exclusions

- No changes to JWT issuance or validation logic
- No new auth middleware beyond the internal token check
- No changes to public API auth
- No user-facing auth changes
- No OAuth or session management changes

---

## Acceptance Criteria

| #       | Criterion                                                                                                                  | Proof Artifact                                      |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| AC-R3-1 | `operatorAuth.ts` accepts `X-Internal-Service-Token` header with matching env var — grants `operator_override` without JWT | `proof_auth_logic.txt` (code diff, not token value) |
| AC-R3-2 | `docker-compose.yml` passes `INTERNAL_SERVICE_TOKEN` to both API and CC services via env var reference                     | `proof_compose_diff.txt`                            |
| AC-R3-3 | `POST /api/ops/picks/:id/approve` returns 200 (not 401) when called with valid internal token                              | `proof_approve_200.txt`                             |
| AC-R3-4 | `POST /api/ops/picks/:id/reject` returns 200 (not 401) when called with valid internal token                               | `proof_reject_200.txt`                              |
| AC-R3-5 | `POST /api/ops/picks/:id/approve` still returns 401 when called without any token (public access blocked)                  | `proof_approve_401_notoken.txt`                     |
| AC-R3-6 | Token value is not present in any committed file, any proof artifact, or any log output                                    | Manual review                                       |
| AC-R3-7 | All existing tests pass — vitest ≥ R0 baseline                                                                             | `proof_tests.txt`                                   |
| AC-R3-8 | Type check passes                                                                                                          | `proof_typecheck.txt`                               |
| AC-R3-9 | Single-writer gate passes                                                                                                  | `proof_gate.txt`                                    |

---

## Kill Conditions

| Condition                                                                                                       | Action                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INTERNAL*SERVICE_TOKEN approach requires the token to be exposed in the browser bundle (e.g., `NEXT_PUBLIC*\*`) | Pause. Route all CC ops calls through a CC-side API proxy endpoint (`/api/proxy/ops`) that adds the token server-side. Token must never reach the browser. |
| Token implementation introduces a bypass that is broader than `operator_override` scope                         | Pause. Narrow the bypass to the minimum required authority.                                                                                                |
| Any committed file contains a token value                                                                       | STOP. Remove token from git history before continuing.                                                                                                     |

---

## Proxy Alternative (If Token Exposure is a Risk)

If NEXT_PUBLIC token exposure is a concern, implement a CC-side proxy:

```
CC Browser → POST /api/proxy/ops/picks/:id/approve
          → CC Next.js API Route (server-side)
          → POST http://api:3000/api/ops/picks/:id/approve
             with X-Internal-Service-Token header (server-only env var)
```

This keeps the token fully server-side. The CC browser only calls its own
Next.js API routes, which hold the token as a server-side env var.

---

## Proof Artifacts

```
out/sprints/UTRP-R3-LIFECYCLE-AUTH-RECONSTRUCTION/<DATE>/
├── proofs/
│   ├── proof_auth_logic.txt        # Code diff for operatorAuth.ts (no token values)
│   ├── proof_compose_diff.txt      # docker-compose.yml diff (env var refs, not values)
│   ├── proof_approve_200.txt       # curl/test output: 200 with valid token
│   ├── proof_reject_200.txt        # curl/test output: 200 with valid token
│   ├── proof_approve_401_notoken.txt # curl/test output: 401 without token
│   ├── proof_tests.txt
│   ├── proof_typecheck.txt
│   └── proof_gate.txt
└── SPRINT_CLOSEOUT_REPORT.md
```

---

## Dependency Order

```
R3 depends on: R1 COMPLETE
R3 must complete before: R4, R5
R3 is parallel-eligible with: R2 (no file overlap between auth and submission)
```

---

**Workstream Owner**: Engineering Team **Estimated Effort**: 1 session (targeted
auth change + docker-compose + verification)
