# 🤝 Contributor Guide

Branch names – feat/<agent>-<desc> or fix/<agent>-<issue>.

pnpm lint && pnpm test must be 🟢 before PR.

No duplicate types – always import from @shared/types/*.

## Agent rules

Extend BaseAgent – never reinvent lifecycle / metrics / retry.

Config must match BaseAgentConfigSchema.

PR template lives at .github/pull_request_template.md. 