# SPRINT-CI-GOVERNANCE-DEBT-NORMALIZATION

**Status**: COMPLETE **Date**: 2026-03-18 **PR**: #310 **Merge Commit**:
f0cafed2

## Summary

Fixed 3 pre-existing CI gate failures exposed after
SPRINT-CONTROL-PLANE-TRUTH-RECONCILIATION:

1. **Quarantine Enforcement Gate**: Cleared 58 stale manifest entries for files
   permanently deleted in SPRINT-040
2. **Smart Form V1.1 Compliance**: Added @unit-talk/contracts to \_ci-core.yml
   shared packages build
3. **Quality Assurance (partial)**: Fixed npm workspace→pnpm filter; expanded
   shared package builds (2→8); gate now passes workspace build + type-check but
   fails on pre-existing Prettier drift in MCP packages (separate debt)

## Files Changed

- `.github/workflows/ci-cd-pipeline.yml`
- `.github/workflows/_ci-core.yml`
- `.github/workflows/ci.yml`
- `governance/quality/QUARANTINE_MANIFEST.json`
- `apps/api/test/__quarantine__/MANIFEST.json`
