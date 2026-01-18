# DOCUMENTATION AUTHORITY & CONFLICT RESOLUTION

**Version**: 1.0.0 **Last Updated**: 2026-01-18 **Authority Level**:
**BINDING** - Supersedes contradictions in other docs

---

## DOCUMENT PURPOSE

This document establishes the **hierarchy of truth** for the Unit Talk platform
documentation and provides **conflict resolution rules** for AI agents (Claude
Code) and human operators when contradictions exist between documentation
sources.

---

## HIERARCHY OF AUTHORITY

### Tier 1: CANONICAL (Source of Truth)

These sources define **what must be true** in the codebase. All other
documentation must align with these.

1. **Production Charter** (`docs/PRODUCTION_CHARTER.md`)
   - Binding contract for all development
   - Schema definitions (if present)
   - Non-negotiable rules

2. **System Alignment Spec** (`docs/SYSTEM_ALIGNMENT_SPEC.yml`)
   - Machine-readable governance rules
   - Automated enforcement rules

3. **Actual Codebase** (Runtime Evidence)
   - `dev.sh` and `docker-compose.yml` - actual infrastructure
   - `package.json` scripts - actual available commands
   - Database schema (`psql \dt` output) - actual tables
   - TypeScript compilation output - actual build status
   - Test results - actual code quality

**Conflict Resolution Rule**: If documentation contradicts Tier 1 sources,
**documentation is wrong**. Update docs to match canonical reality.

---

### Tier 2: DESCRIPTIVE (Implementation Guidance)

These sources describe **how to work with** the canonical sources. They must
stay synchronized with Tier 1.

1. **Root CLAUDE.md** (Workspace-level guidance)
   - Development model (Docker-first vs Local)
   - Verification doctrine
   - Port mappings
   - Environment configuration
   - **Canonical Database Table**: `unified_picks` (defined here)

2. **Application CLAUDE.md Files** (App-level guidance)
   - `apps/api/CLAUDE.md`
   - `apps/command-center/CLAUDE.md`
   - `apps/smart-form/CLAUDE.md`
   - `apps/discord-bot/CLAUDE.md`
   - `apps/dashboard/CLAUDE.md`

3. **Operational Runbooks** (`docs/ops/`)
   - Migration procedures
   - Deployment guides
   - Troubleshooting playbooks

**Conflict Resolution Rule**: If Tier 2 sources contradict each other, **Root
CLAUDE.md wins**. If Root CLAUDE.md contradicts Tier 1, **Tier 1 wins** and Root
CLAUDE.md must be updated.

---

### Tier 3: ASPIRATIONAL (Goals & Roadmaps)

These sources describe **future state** or **quality targets**. They are not
binding constraints.

1. **Technical Implementation Plan** (`TECHNICAL_IMPLEMENTATION_PLAN.md`)
2. **Product Requirements** (`PRODUCT_REQUIREMENTS_DOCUMENT.md`)
3. **Architecture Docs** (`docs/architecture/`)

**Conflict Resolution Rule**: Tier 3 sources **never override** Tier 1 or
Tier 2. They represent goals, not current reality.

---

## CANONICAL DEFINITIONS (Updated 2026-01-18)

### Database Tables

**CANONICAL PICK TABLE**: **`unified_picks`**

**Authoritative Declaration** (Operator ruling 2026-01-18):

- `unified_picks` is the single source of truth for all pick data
- `pick_publish` is the outbox for Discord delivery
- `picks` table references in Production Charter v3.0 are superseded by this
  ruling

**Known Conflicts**:

- Production Charter v3.0 references `picks` + `pick_publish` as canonical
- Legacy docs reference `daily_picks` (deprecated)

**Resolution**:

- **Winner**: `unified_picks` (Operator ruling supersedes Charter on this point)
- **Action**: All apps MUST query `unified_picks` for pick data
- **Publish Outbox**: Use `pick_publish` for Discord delivery (unchanged)
- **Verification**: Confirm `unified_picks` table exists via `\dt unified_picks`
- **Charter Update**: Production Charter v3.0 should be updated to reflect this
  ruling

### Development Model

**CANONICAL MODE**: **Hybrid** (Docker-first with pragmatic local dev)

**Authoritative Declaration** (Root CLAUDE.md):

- Docker Mode: For full-stack integration, E2E tests, onboarding
- Local Mode: For rapid frontend iteration on single apps

**Known Conflicts**:

- Legacy sections claimed "Docker is the Only Supported Runtime"
- Package.json files have local dev scripts (`npm run dev`)

**Resolution**:

- **Winner**: Hybrid model (matches repository reality)
- **Action**: AI agents should recommend Docker first, allow local dev with
  caveats
- **Verification**: Both modes are valid, choice depends on task

### Service Port Mappings

**CANONICAL SOURCE**: Root CLAUDE.md Service Port Mappings table

| Service        | Container Port | Host Port |
| -------------- | -------------- | --------- |
| API            | 3000           | 3010      |
| Command Center | 3015           | 3004      |
| Smart Form     | 3021           | 3002      |

**Resolution**: When docs say "API is on port 3001" but docker-compose.yml maps
3010, **table above is authoritative**.

---

## CONFLICT DETECTION & RESOLUTION PROTOCOL

### For AI Agents (Claude Code)

When you encounter contradictory information:

1. **Identify the Tier** of each conflicting source (Tier 1/2/3)
2. **Apply Hierarchy**: Higher tier wins
3. **Within Same Tier**:
   - Tier 1: Actual codebase wins over docs
   - Tier 2: Root CLAUDE.md wins over app CLAUDE.md
   - Tier 3: Note conflict, request human clarification
4. **Document Decision**: Add comment explaining which source won and why
5. **Update Losers**: Flag lower-tier docs for update

**Example**:

```
# Conflict: Root CLAUDE.md says "unified_picks", API CLAUDE.md says "picks"
# Resolution: Root CLAUDE.md is Tier 2 authoritative for database tables
# Action: Update API CLAUDE.md to match Root CLAUDE.md
# Winner: unified_picks (as of 2026-01-18)
```

### For Human Operators

When reviewing AI-generated changes:

1. **Verify Tier Classification**: Is the AI using the correct hierarchy?
2. **Challenge Assumptions**: If resolution seems wrong, check:
   - Is Production Charter actually more authoritative here?
   - Does actual codebase contradict the resolution?
3. **Update This Document**: If new canonical rulings emerge, add them above
4. **Propagate Changes**: Update all losing Tier 2/3 docs to match

---

## VERIFICATION-FIRST DOCTRINE

**RULE**: Claims about system state require timestamped evidence.

### Acceptable Claims

✅ **GOOD**: "TypeScript Status: ✅ PASS (Last verified: 2026-01-18, see
logs/typecheck-20260118.log)"

✅ **GOOD**: "Database has 45 tables (verified via `\dt` on 2026-01-18)"

✅ **GOOD**: "Docker stack: ✅ VERIFIED (dev.sh and docker-compose.yml exist)"

### Unacceptable Claims

❌ **BAD**: "100/100 production ready"

❌ **BAD**: "Zero TypeScript errors" (no timestamp or evidence)

❌ **BAD**: "All tests passing" (no test run output)

### Resolution Protocol

1. **Challenge Unverified Claims**: Request evidence
2. **Run Verification Command**: Execute the command to get evidence
3. **Document Result**: Replace claim with verifiable status
4. **Add Timestamp**: Include "Last verified: YYYY-MM-DD"
5. **Link Evidence**: Reference log file or command output

---

## SMOKE PACK STATUS INTERPRETATION

When documentation references smoke pack or test status:

- ✅ **PASS**: Feature verified working with automated test evidence
  (timestamp + log)
- ⏳ **UNVERIFIED**: Feature exists in code but lacks automated test evidence
- ❌ **FAIL**: Feature tested and found broken (requires fix before deploy)
- 🚧 **IN PROGRESS**: Feature under active development (not deployment-ready)

**Rule**: Only ✅ PASS items can be claimed "production ready"

---

## CANONICAL VS ACTUAL: RECONCILIATION REQUIRED

This section tracks **known discrepancies** between canonical declarations and
actual codebase state (requires verification):

| Canonical Declaration                 | Actual State (To Verify)                         | Priority          |
| ------------------------------------- | ------------------------------------------------ | ----------------- | --- |
| Database: 45 tables                   | Run `\dt                                         | wc -l` to confirm | P1  |
| Table: `unified_picks` (canonical)    | Check if table exists in schema                  | P0                |
| TypeScript: Zero errors               | Run `docker-compose exec api npm run type-check` | P1                |
| Column: `stat_type` (not `prop_type`) | Verify via `\d raw_props`                        | P2                |
| Agent files: 101 files                | Run `find apps/api/src/agents -type f \| wc -l`  | P2                |

**Next Steps**: Run verification commands above and update this table with
results.

---

## WHEN TO UPDATE THIS DOCUMENT

This document should be updated when:

1. **New Canonical Source Identified**: E.g., a new authoritative schema
   registry
2. **Tier Re-classification Needed**: E.g., promoting a runbook to canonical
   status
3. **Conflict Resolution Established**: New binding ruling on contradictory docs
4. **Verification Doctrine Changed**: E.g., requiring CI badges in addition to
   timestamps

**Update Process**:

1. Update this document first
2. Propagate changes to affected Tier 2/3 docs
3. Commit with message: "docs(authority): update canonical ruling on [topic]"

---

## ENFORCEMENT

**For AI Agents**: This document is **binding**. You MUST follow the hierarchy
when resolving conflicts.

**For Humans**: This document is **guidance**. You have authority to override if
you have new information, but you must update this document to reflect the new
ruling.

**For CI/CD**: Consider adding automated checks to detect documentation drift
from Tier 1 sources.

---

**Document Authority**: This document itself is **Tier 2** (descriptive). If
Production Charter contradicts this document, Production Charter wins. Update
this document accordingly.

**Maintained By**: Engineering Documentation Team **Review Frequency**: Monthly,
or when major documentation conflicts arise **Last Audit**: 2026-01-18 (see
docs/audits/CLAUDE_MD_REALITY_AUDIT.md)
