# PACKAGING_AND_STANDALONE_TRUTH_CONTRACT_v1.0

Unit Talk – Clean-Room Doctrine Phase 5 — Repository Truth (Design Only) Status:
RATIFIED

---

## 1. Purpose

This contract defines requirements for standalone packaging (Windows
executables, desktop apps, CLI distributions). All packaging modes MUST follow
build/runtime separation. Packaging MUST NOT access runtime secrets at build
time.

---

## 2. Scope

This contract governs:

- Windows executable packaging (if supported)
- macOS application bundling (if supported)
- Linux standalone binaries (if supported)
- CLI distribution packaging
- Electron or similar desktop app packaging

---

## 3. Packaging Modes (Declared Surface)

### 3.1 Supported Packaging Modes

Each packaging mode MUST be explicitly declared as:

| Mode               | Status    | Description                          |
| ------------------ | --------- | ------------------------------------ |
| Docker container   | SUPPORTED | Primary production mode              |
| npm package        | SUPPORTED | Library distribution                 |
| Windows executable | DECLARED  | Must follow this contract if enabled |
| macOS app bundle   | DECLARED  | Must follow this contract if enabled |
| Linux binary       | DECLARED  | Must follow this contract if enabled |

### 3.2 Unsupported Surfaces

Any packaging mode not listed above is UNSUPPORTED and MUST NOT be used for
distribution.

---

## 4. Build/Runtime Separation in Packaging

### 4.1 Packaging Build Phase

Packaging build MUST NOT:

- Embed runtime secrets in binary
- Embed production credentials in binary
- Embed environment-specific configuration in binary
- Execute runtime initialization during packaging
- Connect to external services during packaging

Packaging build MUST:

- Use only source + lockfile + build-only env
- Produce deterministic output for identical inputs
- Exclude `.env` files from packaged artifact
- Exclude secret files from packaged artifact

### 4.2 Packaging Runtime Phase

Packaged applications at runtime MUST:

- Read configuration from external source (env vars, config file, user input)
- Validate configuration at startup
- Fail-closed if required configuration missing
- Not contain embedded secrets

---

## 5. Determinism Requirements

### 5.1 Reproducible Builds

Packaging MUST be reproducible:

Given:

- Same source commit
- Same lockfile
- Same packaging tool version
- Same base dependencies

Result:

- Identical binary output (excluding non-deterministic metadata)

### 5.2 Determinism Verification

Packaging pipelines MUST:

- Log all input versions
- Log packaging tool version
- Produce manifest of included files
- Support rebuild verification

---

## 6. Credential Handling

### 6.1 Forbidden Credential Embedding

The following MUST NOT be embedded in packaged artifacts:

| Credential Type           | Reason                |
| ------------------------- | --------------------- |
| SUPABASE_SERVICE_ROLE_KEY | Secret                |
| DATABASE_URL              | Connection credential |
| DISCORD_TOKEN             | Secret                |
| Any API key               | Secret                |
| Any password              | Secret                |
| Any private key           | Secret                |

### 6.2 Permitted Embedded Values

The following MAY be embedded:

| Value Type                 | Condition                    |
| -------------------------- | ---------------------------- |
| Public API endpoints       | Non-secret, version-specific |
| Version identifiers        | Build metadata               |
| Feature flags (non-secret) | Build-time configuration     |
| Default non-secret config  | Overridable at runtime       |

---

## 7. Platform-Specific Requirements

### 7.1 Windows Executable

If Windows packaging is supported:

- Code signing MUST use authorized certificate
- Installer MUST NOT request unnecessary permissions
- Uninstaller MUST cleanly remove all artifacts
- Auto-update (if any) MUST verify signatures

### 7.2 macOS Application

If macOS packaging is supported:

- Application MUST be signed with authorized certificate
- Application MUST be notarized if distributed outside App Store
- Sandbox requirements MUST be declared
- Entitlements MUST be minimal

### 7.3 Linux Binary

If Linux packaging is supported:

- Binary MUST NOT require root for normal operation
- Dependencies MUST be declared or bundled
- Installation path MUST follow FHS conventions

---

## 8. Distribution Surface Declaration

Any packaging mode MUST declare:

| Declaration                    | Description                        |
| ------------------------------ | ---------------------------------- |
| Target platforms               | OS and architecture                |
| Required runtime dependencies  | What user must have installed      |
| Configuration injection method | How user provides credentials      |
| Update mechanism               | How updates are delivered          |
| Support status                 | Active, deprecated, or unsupported |

---

## 9. Audit Requirements

The following MUST be observable for audit:

| Audit Signal                            | Purpose                   |
| --------------------------------------- | ------------------------- |
| No secrets in packaged binary           | Proves secret separation  |
| Build reproducible from declared inputs | Proves determinism        |
| Packaging mode explicitly declared      | Proves surface control    |
| Signing certificate traceable           | Proves authenticity       |
| Configuration injection documented      | Proves runtime separation |

---

## 10. Acceptance Criteria (Binary)

| Criterion                                  | Requirement |
| ------------------------------------------ | ----------- |
| Packaging follows build/runtime separation | MUST PASS   |
| No runtime secrets embedded at build       | MUST PASS   |
| Packaging is deterministic                 | MUST PASS   |
| Supported/unsupported modes declared       | MUST PASS   |
| Configuration injection method declared    | MUST PASS   |
| Signing requirements met (if applicable)   | MUST PASS   |

PASS: All criteria satisfied. FAIL: Any criterion not satisfied.

---

## 11. Canonical Bindings

- BUILD_RUNTIME_SEPARATION_LAW_v1.0 (core separation law)
- ENVIRONMENT_TRUTH_SOURCE_CONTRACT_v1.0 (credential authority)
- CI_DETERMINISM_AND_GATES_CONTRACT_v1.0 (packaging gate)
- CONFIG_INJECTION_DETERMINISM_CONTRACT_v1.0 (runtime config)

---

## 12. Final Declaration

Packaging follows build/runtime separation. Secrets are never embedded. Builds
are deterministic. Surfaces are declared. There is no exception for packaging
convenience.

---

## Constitutional Binding

This document operates under the authority of CONSTITUTION_v1.0.

---

**End of Document**
