# Repository Hygiene & Artifact Management

**Status**: PRODUCTION-GRADE STANDARD **Owner**: Engineering Team **Last
Updated**: 2025-01-17

---

## Executive Summary

This document establishes Fortune-100 grade repository hygiene standards for the
Unit Talk Production platform. **All generated artifacts, proof bundles, test
outputs, and logs must be quarantined in designated directories and NEVER
committed to version control.**

## Core Principles

### 1. Source Code vs. Artifacts

**What SHOULD be committed:**

- ✅ Source code (.ts, .tsx, .js, .jsx)
- ✅ Configuration templates (.env.example, config templates)
- ✅ Documentation (intentional .md files in docs/)
- ✅ Infrastructure as Code (terraform, k8s manifests)
- ✅ Database migrations (supabase/migrations/\*.sql)
- ✅ Tests and test fixtures
- ✅ Build configurations (package.json, tsconfig.json, etc.)
- ✅ CI/CD workflows (.github/workflows/\*.yml)

**What should NEVER be committed:**

- ❌ Proof bundles and phase artifacts
- ❌ Test output files (.txt, .log)
- ❌ Generated scripts at root level
- ❌ Temporary SQL files
- ❌ Build outputs (dist/, build/, out/)
- ❌ Node modules
- ❌ Environment files with secrets
- ❌ Playwright reports and screenshots
- ❌ Any file in out/, artifacts/, analytics/

### 2. Artifact Quarantine Convention

All generated outputs must go into designated quarantine directories:

```
unit-talk-production-main/
├── out/                          # Primary artifact quarantine
│   ├── _quarantine/             # Archived untracked files
│   │   └── <timestamp>/         # Time-stamped archives
│   ├── phase5-prod-validation/  # Workflow artifacts
│   ├── proof-bundles/           # Proof bundles
│   └── test-outputs/            # Test outputs
├── artifacts/                    # Alternative artifact location
└── analytics/                    # Analytics outputs
```

**Directory Structure:**

- `out/_quarantine/<timestamp>/` - Archived files from git status cleanup
- `out/proof-bundles/` - Generated proof bundles
- `out/test-outputs/` - Test execution outputs
- `out/validation/` - Validation script outputs
- `out/logs/` - Application logs (if not using logs/)

### 3. Naming Conventions

**Proof Bundles:**

```
out/proof-bundles/PHASE<N>_<DESCRIPTION>_<DATE>.md
out/proof-bundles/PHASE5_PROD_VALIDATION_20250117.md
```

**Test Outputs:**

```
out/test-outputs/smoke-pack-<env>-<date>.txt
out/test-outputs/smoke-pack-prod-20250117.txt
```

**Validation Scripts:**

```
out/validation/verify-<component>-<date>.log
out/validation/verify-schema-20250117.log
```

**Quarantine Archives:**

```
out/_quarantine/20250117-143022/  # ISO timestamp format
```

## Workflow Integration

### Running Validations Without Pollution

**CORRECT Pattern:**

```bash
# Always output to out/ directory
npm run test > out/test-outputs/test-run-$(date +%Y%m%d-%H%M%S).txt

# Playwright tests should use configured output
cd apps/smart-form
npm run test:smoke  # Outputs to out/test-outputs/ via config
```

**INCORRECT Pattern:**

```bash
# DON'T output to root or app root
npm run test > test-output.txt  # ❌ Will pollute repo
cd apps/smart-form
npm run test > smoke-pack.txt   # ❌ Will pollute repo
```

### GitHub Actions Artifact Management

**Workflow Artifact Download:**

```bash
# Download to quarantine directory
mkdir -p out/phase5-prod-validation/<run-id>
gh run download <run-id> --dir out/phase5-prod-validation/<run-id>
```

**Artifact Upload in Workflows:**

```yaml
- name: Upload proof bundle
  uses: actions/upload-artifact@v4
  with:
    name: phase5-proof-bundle
    path: |
      PHASE5_PROD_PROOF_BUNDLE.md  # Generated in workflow
      phase5-artifacts/
    retention-days: 90
```

## Maintenance Procedures

### Cleaning Untracked Files

**Use the quarantine script:**

```powershell
# Move untracked files to quarantine (preserves structure)
.\scripts\ops\quarantine-artifacts.ps1

# Or manually:
git status --short | Select-String "^\?\?" | ForEach-Object {
    $file = $_.Line.Substring(3)
    $dest = "out\_quarantine\$(Get-Date -Format 'yyyyMMdd-HHmmss')\$file"
    New-Item -ItemType Directory -Force -Path (Split-Path $dest)
    Move-Item $file $dest
}
```

**Verify clean state:**

```bash
git status --short  # Should only show intentional changes
```

### Periodic Cleanup

**Weekly:**

- Review out/\_quarantine/ and archive old files
- Clean out/test-outputs/ older than 30 days
- Verify no artifacts in git status

**Monthly:**

- Audit .gitignore rules against new file patterns
- Update docs/REPO_HYGIENE.md if conventions change
- Review CI/CD artifact retention policies

## Documentation Validation

### CLAUDE.md Requirements

**Required CLAUDE.md locations:**

- ✅ `apps/api/CLAUDE.md`
- ✅ `apps/discord-bot/CLAUDE.md`
- ✅ `apps/smart-form/CLAUDE.md`
- ✅ `apps/command-center/CLAUDE.md`
- ✅ Root `CLAUDE.md`

**Required Sections:** All CLAUDE.md files must contain:

1. Purpose/Overview
2. Architecture
3. Development Workflow
4. Testing
5. Deployment

### Docs Validator Exceptions

The docs validator (`scripts/validate-documentation.js`) enforces CLAUDE.md
presence for main applications only. Generated directories and proof artifacts
are excluded:

- `out/`
- `artifacts/`
- `analytics/`
- `docs/ai/`, `docs/analytics/`, `docs/audit/`
- App-level proof bundles

## Git Workflow Best Practices

### Pre-Commit Checklist

Before committing:

1. ✅ Run `git status` - verify no artifacts
2. ✅ Check all changes are intentional source code
3. ✅ Ensure test outputs went to out/
4. ✅ Verify no secrets in .env files
5. ✅ Confirm proof bundles are in out/proof-bundles/

### Commit Message Standards

```
feat(component): brief description

- Detailed change 1
- Detailed change 2

Refs: #issue-number (if applicable)
```

**Examples:**

```
chore(repo): add comprehensive .gitignore rules

- Added artifact quarantine patterns
- Excluded proof bundles and test outputs
- Prevented root-level script pollution

Refs: #hygiene-phase-b
```

### Branch Hygiene

**Before merging:**

1. Ensure branch is up to date with main
2. Run full test suite
3. Verify no untracked artifacts in git status
4. Confirm all proof bundles are in out/
5. Review .gitignore if new file patterns emerged

## Common Pitfalls

### ❌ DON'T

```bash
# Generating outputs at root
npm run test > test-output.txt
node scripts/verify.js > result.json
pwsh scripts/validate.ps1 > validation.log

# Committing proof bundles
git add PHASE5_PROOF_BUNDLE.md
git add smoke-pack-results.txt

# Creating scripts at root
echo "SELECT * FROM picks;" > query.sql
```

### ✅ DO

```bash
# Generate outputs in out/
npm run test > out/test-outputs/test-$(date +%Y%m%d).txt
node scripts/verify.js > out/validation/verify-$(date +%Y%m%d).json
pwsh scripts/validate.ps1 > out/logs/validate-$(date +%Y%m%d).log

# Archive proof bundles
mv PHASE5_PROOF_BUNDLE.md out/proof-bundles/
mv smoke-pack-results.txt out/test-outputs/

# Create scripts in appropriate directories
echo "SELECT * FROM picks;" > scripts/ops/queries/picks-query.sql
```

## Enforcement

### Automated Checks

**Pre-commit hook (.pre-commit-config.yaml):**

```yaml
- id: check-added-large-files
  args: ['--maxkb=500']
- id: check-case-conflict
- id: check-merge-conflict
- id: no-commit-to-branch
  args: ['--branch', 'main', '--branch', 'master']
```

**CI/CD validation:**

```yaml
- name: Verify no artifacts in PR
  run: |
    if git diff --name-only origin/main | grep -E "(PHASE.*\.md|.*-output\.txt|smoke-pack.*)"; then
      echo "❌ Artifacts detected in PR"
      exit 1
    fi
```

### Manual Reviews

**PR Review Checklist:**

- [ ] No proof bundles or test outputs
- [ ] No root-level generated scripts
- [ ] No SQL files at root (unless supabase/migrations/)
- [ ] No .txt or .log files
- [ ] All changes are intentional source code
- [ ] .gitignore updated if new patterns emerged

## Recovery Procedures

### If Artifacts Were Committed

```bash
# Remove from staging
git reset HEAD <file>

# Move to quarantine
mkdir -p out/_quarantine/$(date +%Y%m%d-%H%M%S)
mv <file> out/_quarantine/$(date +%Y%m%d-%H%M%S)/

# If already committed (before push)
git reset --soft HEAD~1
# Then move to quarantine and recommit clean changes
```

### If Pushed to Remote

```bash
# Contact team lead - force push may be required
# For feature branches:
git revert <commit-hash>
git push

# For main branch - NEVER force push
# Create cleanup commit instead
```

## References

- [Production Charter](./PRODUCTION_CHARTER.md) - Governance rules
- [System Alignment Spec](./SYSTEM_ALIGNMENT_SPEC.yml) - Machine-readable rules
- [.gitignore](./.gitignore) - Artifact exclusion patterns
- [quarantine-artifacts.ps1](../scripts/ops/quarantine-artifacts.ps1) - Cleanup
  script

---

**Questions?** Contact Engineering Team **Last Audit**: 2025-01-17 **Next
Review**: Monthly
