# Unknown Folders Analysis - BEFORE Migration

Date: 2026-02-26
Sprint: DOC_TAXONOMY_LOCK

## Folders Outside Canonical Structure

### governance/ (Non-Canonical)
- `governance/artifacts/` - NOT in canonical, needs evaluation
- `governance/audit/` - NOT in canonical, needs evaluation
- `governance/finalized/` - NOT in canonical, needs evaluation
- `governance/runbooks/` - NOT in canonical, needs evaluation
- `governance/master-roadmap/phase-b-platform-integrity/` - Legacy phase naming

### architecture/ (Non-Canonical)
- `architecture/canonical-data-model/` - Should be `architecture/data-model/`
- `architecture/distribution/` - Contains contracts that belong in `architecture/contracts/distribution/`

### docs/ (Non-Canonical - Most Should Move)
- `docs/adr/` - ADRs could stay or move to architecture
- `docs/analytics/` - Not in canonical
- `docs/architecture/` - Should be in `architecture/`
- `docs/audit/` - Not in canonical
- `docs/claude/` - Claude-specific docs
- `docs/contracts/` - Should be in `architecture/contracts/`
- `docs/migrations/` - Not in canonical
- `docs/ops/` - Not in canonical
- `docs/phase4/` - Legacy, should move to `architecture/phases/`
- `docs/phases/` - Should move to `architecture/phases/`
- `docs/runbooks/` - Not in canonical
- `docs/screenshots/` - Not in canonical
- `docs/smart-form/` - Not in canonical
- `docs/sprints/` - Should be in `out/sprints/`

## Missing Canonical Folders

### governance/
- [ ] `governance/vision/`

### architecture/
- [ ] `architecture/overview/`
- [ ] `architecture/data-model/` (canonical-data-model exists)
- [ ] `architecture/contracts/` (root)
- [ ] `architecture/contracts/runtime/`
- [ ] `architecture/contracts/canonical/`
- [ ] `architecture/contracts/distribution/`
- [ ] `architecture/contracts/discord/`
- [ ] `architecture/phases/`

### templates/
- [ ] `templates/` (root)
- [ ] `templates/audits/`
- [ ] `templates/sprints/`
- [ ] `templates/governance/`

### out/
- [ ] `out/closeouts/`
