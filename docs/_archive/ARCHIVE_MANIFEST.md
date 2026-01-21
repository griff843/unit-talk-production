# Documentation Archive Manifest

**Created**: 2026-01-21
**Purpose**: Track archived documents for historical reference and potential restoration.

---

## Archive Policy

Documents are archived (not deleted) when they:
- Served a one-time purpose (audits, debug sessions, PR-specific work)
- Are superseded by authoritative sources (SYSTEM_CONTRACT.md)
- Could cause confusion if left in active documentation

## How to Restore

1. Move the file from `docs/_archive/` back to the original path
2. Update this manifest with a restoration note
3. Verify content accuracy against current SYSTEM_CONTRACT.md
4. Update any links that may have been broken

---

## Archived Documents

| Original Path | Archive Path | Reason | Date | Safe to Delete |
|--------------|--------------|--------|------|----------------|
| `docs/APP_SCOPE_AND_ALIGNMENT_AUDIT.md` | `docs/_archive/APP_SCOPE_AND_ALIGNMENT_AUDIT.md` | One-time PR audit artifact | 2026-01-21 | Yes, after 90 days |
| `docs/CAPPER_THREAD_ROUTING_DISCOVERY.md` | `docs/_archive/CAPPER_THREAD_ROUTING_DISCOVERY.md` | Debug discovery document | 2026-01-21 | Yes, after 90 days |
| `docs/COMPREHENSIVE_SYSTEM_AUDIT_2025.md` | `docs/_archive/COMPREHENSIVE_SYSTEM_AUDIT_2025.md` | Historical audit, superseded | 2026-01-21 | No, historical reference |
| `docs/db/AUDIT_REPORT.md` | `docs/_archive/db/AUDIT_REPORT.md` | DB audit artifact | 2026-01-21 | Yes, after 90 days |
| `docs/DISCORD_CANARY_VISIBILITY_DEBUG.md` | `docs/_archive/DISCORD_CANARY_VISIBILITY_DEBUG.md` | Debug session notes | 2026-01-21 | Yes, after 90 days |
| `docs/INTEGRITY_AUDIT_REPORT.md` | `docs/_archive/INTEGRITY_AUDIT_REPORT.md` | PR9 integrity audit | 2026-01-21 | Yes, after 90 days |
| `docs/SMART_FORM_E2E_TRACE.md` | `docs/_archive/SMART_FORM_E2E_TRACE.md` | E2E proof artifact, now in CI | 2026-01-21 | Yes, after 90 days |
| `docs/SYSTEMS_ARCHITECT_AUDIT_REPORT.md` | `docs/_archive/SYSTEMS_ARCHITECT_AUDIT_REPORT.md` | Architecture audit artifact | 2026-01-21 | No, architectural reference |
| `docs/SYSTEM_AUDIT_REPORT.md` | `docs/_archive/SYSTEM_AUDIT_REPORT.md` | System audit artifact | 2026-01-21 | No, historical reference |

---

## Restoration History

| Document | Restored Date | Restored By | Reason |
|----------|--------------|-------------|--------|
| (none yet) | | | |

---

## Notes

- All archived documents remain accessible for historical reference
- Authoritative information has been consolidated into `docs/contracts/SYSTEM_CONTRACT.md`
- E2E proofs are now generated via CI (GitHub Actions run 21223971525 is canonical)
- Debug/audit documents are superseded by production validation in CI
