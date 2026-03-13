# Unit Talk Security Principles

Version: 1.0  
Status: Canonical  
Authority: Highest

This document defines the security rules governing the Unit Talk platform.

All services, agents, infrastructure, and integrations must follow these
principles.

Violations of these principles are considered **critical security defects**.

---

# 1. Principle of Least Privilege

Every system component must operate with the **minimum permissions required**.

Examples:

- services should only access required database tables
- agents should only execute allowed workflows
- API tokens must be scoped where possible
- CI pipelines must not expose unnecessary credentials

Privileges must never be broader than required.

---

# 2. Secrets Must Never Be Committed

Sensitive information must never appear in the repository.

Forbidden items include:

- API keys
- database passwords
- provider credentials
- service tokens
- private keys

Secrets must only exist in:

environment variables secret managers secure CI configuration

If a secret is committed accidentally, it must be rotated immediately.

---

# 3. Environment Isolation

Different environments must remain isolated.

Required environments include:

development staging production

Production credentials must never be used in development environments.

Configuration must clearly separate environments.

---

# 4. Secure Configuration Management

All runtime configuration must come from controlled sources.

Approved configuration sources:

- environment variables
- secure deployment configuration
- infrastructure management systems

Configuration files containing secrets must never be committed to the
repository.

---

# 5. API Provider Protection

External data providers are critical infrastructure dependencies.

The system must protect:

- API credentials
- usage limits
- request quotas
- rate limits

Provider integrations must implement:

- retry protection
- rate limiting
- usage monitoring

Excessive usage or misuse must trigger alerts.

---

# 6. Database Protection

Database access must be restricted.

Requirements:

- secure authentication
- encrypted connections
- role-based access control
- limited write access

Direct production database access should be limited to controlled operations.

---

# 7. Logging Safety

Logs must never expose sensitive data.

Forbidden in logs:

- API tokens
- authentication headers
- credentials
- private user information

Logs should contain operational data only.

---

# 8. External Integration Safety

All external integrations must be treated as untrusted boundaries.

This includes:

- sports data providers
- Discord APIs
- third-party services

External inputs must be validated before entering internal systems.

---

# 9. Automated Safeguards

Security protections should be enforced automatically.

Examples include:

- CI checks preventing secret commits
- dependency vulnerability scanning
- environment variable validation
- container security scanning

Automation reduces human error.

---

# 10. Incident Response

Security incidents must be handled immediately.

Response procedures include:

1. isolate affected systems
2. revoke compromised credentials
3. rotate secrets
4. investigate system logs
5. deploy fixes
6. document the incident

All security incidents must be recorded.

---

# Final Principle

Security is part of system reliability.

A system that functions correctly but exposes sensitive data or credentials is
considered **unsafe and unacceptable**
