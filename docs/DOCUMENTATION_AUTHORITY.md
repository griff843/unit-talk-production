# DOCUMENTATION AUTHORITY

**Last Updated**: 2026-01-21
**Purpose**: Establish clear authority hierarchy for Unit Talk documentation to prevent drift and confusion.

---

## AUTHORITATIVE DOCUMENTS

These documents are canonical and must be kept accurate. Changes require review.

| Document | Authority Level | Purpose |
|----------|----------------|---------|
| `docs/contracts/SYSTEM_CONTRACT.md` | **HIGHEST** | Canonical data model, lifecycle, invariants |
| `docs/contracts/EXECUTION_PLAN.md` | HIGH | Gate definitions, CI verification scripts |
| `docs/contracts/GATE_VERIFICATION.md` | HIGH | Pass/fail criteria for gates |
| `CLAUDE.md` (root) | HIGH | Development rules, Docker-first mandate, secrets governance |
| `apps/*/CLAUDE.md` | MEDIUM | App-specific implementation guidance |
| `TECHNICAL_IMPLEMENTATION_PLAN.md` | MEDIUM | 4-phase roadmap reference |
| `PRODUCT_REQUIREMENTS_DOCUMENT.md` | MEDIUM | Product strategy source |

---

## NON-AUTHORITATIVE DOCUMENTS

These documents are informational, historical, or superseded. They may be archived without approval.

### Categories of Non-Authoritative Docs
- `*AUDIT*.md` - One-time audit artifacts
- `*DEBUG*.md` - Debug session notes
- `*TRACE*.md` - Tracing/proof artifacts
- `*DISCOVERY*.md` - Exploratory findings
- PR-specific documents (e.g., `PR7_*`, `PR8_*`, `PR9_*`)

### Archive Location
Non-authoritative documents are archived to `docs/_archive/` with a manifest explaining:
- Original path
- Reason for archival
- Date archived
- Whether safe to delete permanently

---

## DOCUMENTATION RULES

### Rule 1: Single Source of Truth
`SYSTEM_CONTRACT.md` is the single source of truth for:
- Canonical tables and columns
- Data lifecycle
- Invariants and constraints
- Environment governance

### Rule 2: No Drift Allowed
If a document contradicts `SYSTEM_CONTRACT.md`, the document is wrong and must be corrected or archived.

### Rule 3: Gate Scripts Are Canonical Verification
The scripts referenced in `EXECUTION_PLAN.md` are the canonical way to verify system health. Manual verification or ad-hoc scripts are not authoritative.

### Rule 4: Archive Over Delete
When removing documentation, prefer archiving to `docs/_archive/` over deletion. This preserves historical context.

### Rule 5: CI Is The Only Proof Mechanism
E2E proofs must run in GitHub Actions with secrets injection. Local script executions are not authoritative proof.

---

## HOW TO UPDATE AUTHORITATIVE DOCUMENTS

1. **SYSTEM_CONTRACT.md**: Requires Chief Systems Architect approval
2. **EXECUTION_PLAN.md**: Requires Release Engineer approval
3. **Root CLAUDE.md**: Requires Engineering Team approval
4. **App CLAUDE.md**: Requires app owner approval

---

## ARCHIVE POLICY

### When to Archive
- Document served a one-time purpose (audit, debug, PR-specific)
- Document is superseded by authoritative source
- Document contains outdated information that could cause confusion

### Archive Process
1. Move document to `docs/_archive/`
2. Update `docs/_archive/ARCHIVE_MANIFEST.md` with entry
3. Update any links pointing to the archived document
4. Commit with message: `docs: archive {filename} - {reason}`

### Restoration Process
If an archived document needs to be restored:
1. Move from `docs/_archive/` back to original location
2. Update `ARCHIVE_MANIFEST.md` with restoration note
3. Verify document accuracy against current `SYSTEM_CONTRACT.md`
4. Update any broken links

---

## REFERENCED BY

This document is referenced by:
- `CLAUDE.md` (root) - Development rules section
- `docs/contracts/SYSTEM_CONTRACT.md` - Authority section
