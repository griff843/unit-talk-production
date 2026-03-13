# Skill: Sprint Proof Bundle

## Purpose

Prepare all evidence inputs, populate the closeout document, and hand off
cleanly to Codex OS `sprint:close` for governed verification and inventory
generation. Bridges implementation completion → governed proof → status sync.

**Authority boundary**: This skill prepares and validates inputs. Codex OS
`sprint:close` remains the authority for verification execution, inventory
generation, and sprint COMPLETE/FAILED verdict.

## Invocation

```
/sprint-proof-bundle <SPRINT-NAME>
```

Or with sprint type override:

```
/sprint-proof-bundle <SPRINT-NAME> --type <runtime|docs|build_fix|schema|e2e_lifecycle>
```

---

## Inputs Required Before Running

- [ ] Implementation is complete (no in-progress code changes)
- [ ] Sprint branch is checked out: `git branch --show-current`
- [ ] `SPRINT_PLAN.md` exists in `out/sprints/<SPRINT>/<DATE>/` (if sprint plan
      was created)

If any input is missing, **STOP** and address before proceeding.

---

## Procedure

### Step 1: Set Sprint Variables

```bash
SPRINT="<SPRINT-NAME>"
DATE=$(date +%Y-%m-%d)
SPRINT_DIR="out/sprints/$SPRINT/$DATE"
PROOF_DIR="$SPRINT_DIR/proofs"

echo "Sprint:    $SPRINT"
echo "Date:      $DATE"
echo "Directory: $SPRINT_DIR"
```

Verify the sprint name matches the current branch:

```bash
git branch --show-current
# Expected: sprint/<sprint-name-lowercase>
```

If the branch name does not correspond to the sprint name, stop and confirm
which sprint is actually being closed.

### Step 2: Create Directory Structure

```bash
mkdir -p "$SPRINT_DIR"/{proofs,diffs,notes}
```

Verify:

```bash
ls "$SPRINT_DIR"
```

### Step 3: Determine Verification Tier

Read `EVIDENCE_RULES.md §Tier Classification` and classify this sprint.

| Codex OS Sprint Type | Tier | Verification Requirements               |
| -------------------- | ---- | --------------------------------------- |
| `docs`               | T1   | Typecheck only                          |
| `build_fix`, `ui`    | T2   | Typecheck + build + lint                |
| `runtime`, `schema`  | T3   | T2 + unit tests + runtime proof         |
| `e2e_lifecycle`      | T4   | T3 + integration + e2e + lifecycle gate |

Default classification heuristics (if `--type` not provided):

- Sprint touched only `docs/`, `governance/`, or `out/` → **T1 (docs)**
- Sprint fixed build errors or TypeScript only → **T2 (build_fix)**
- Sprint changed agent logic, lifecycle, DB migrations, or env flags → **T3
  (runtime)**
- Sprint changed `unified_picks` write paths or Discord posting → **T4
  (e2e_lifecycle)**

Record the chosen tier:

```bash
echo "Verification tier: T<N> (<sprint-type>)"
```

### Step 4: Capture Baseline Git Evidence

```bash
# Initial state
git status > "$PROOF_DIR/proof_git_status.txt" 2>&1

# Staged and unstaged changes
git diff HEAD > "$SPRINT_DIR/diffs/changes.diff" 2>&1

# Summary of changed files
git diff --stat HEAD~1 2>&1 | tee "$SPRINT_DIR/notes/changed_files.txt"
```

Verify diff is non-empty for non-docs sprints:

```bash
wc -l "$SPRINT_DIR/diffs/changes.diff"
```

If diff is empty for an implementation sprint: **HALT** — no changes detected.
Either the wrong branch is checked out or changes were not committed.

### Step 5: Capture Typecheck Evidence

```bash
npm run type-check 2>&1 | tee "$PROOF_DIR/proof_typecheck.txt"
echo "Exit: $?" >> "$PROOF_DIR/proof_typecheck.txt"
```

**If typecheck fails:**

- Check if the failure is pre-existing (not caused by this sprint)
- If pre-existing AND documented in `DRIFT_REPORT.md`: proceed with scoped lane
- If caused by this sprint: **HALT** — fix before proceeding
- Scoped lane decision must be documented in `SPRINT_CLOSEOUT_REPORT.md`

For scoped typecheck (T3+ when repo-wide fails due to pre-existing issues):

```bash
# API-scoped typecheck
cd apps/api && npx tsc --noEmit 2>&1 | tee "../../$PROOF_DIR/proof_typecheck_scoped.txt"
```

### Step 6: Capture Tier-Specific Evidence

Run only the tiers required for your sprint type (cumulative):

**T2+ — Build:**

```bash
pnpm --filter api run build 2>&1 | tee "$PROOF_DIR/proof_build.txt"
echo "Exit: $?" >> "$PROOF_DIR/proof_build.txt"
```

**T3+ — Unit Tests:**

```bash
npm run test 2>&1 | tee "$PROOF_DIR/proof_tests.txt"
echo "Exit: $?" >> "$PROOF_DIR/proof_tests.txt"
```

**T3+ — Runtime Proof (if sprint enables live behavior):**

See `EVIDENCE_RULES.md §Runtime Proof Requirements` for when this is mandatory.

```bash
# Example: environment flag change verification
grep -r "PROMOTION_POLICY_V2\|ENABLE_TEMPORAL" apps/api/src/ --include="*.ts" -l \
  > "$PROOF_DIR/proof_runtime_flags.txt"

# Example: agent health endpoint
curl -s http://localhost:3000/health/agents >> "$PROOF_DIR/proof_runtime_health.txt" 2>&1
```

**T4 — Lifecycle Gate:**

```bash
cd apps/api && npm run lifecycle:single-writer -- --strict \
  2>&1 | tee "../../$PROOF_DIR/proof_gate.txt"
echo "Exit: $?" >> "../../$PROOF_DIR/proof_gate.txt"
```

**T4 — E2E/Integration:**

```bash
npm run test:e2e 2>&1 | tee "$PROOF_DIR/proof_e2e.txt"
```

### Step 7: Populate SPRINT_CLOSEOUT_REPORT.md

Using `CLOSEOUT_TEMPLATE.md`, create or update the closeout report:

```bash
# Check if report already exists
ls "$SPRINT_DIR/SPRINT_CLOSEOUT_REPORT.md"
```

The report MUST be populated before Codex OS can validate the sprint. Fill in
all sections — especially:

- Objective (what was attempted)
- Deliverables (what was completed, with ✅ or ❌ per item)
- Verification Results (from the proof files captured above)
- Status Changes table (for `/status-sync` input)
- Sign-off checklist

See `CLOSEOUT_TEMPLATE.md` for the full required format.

**Minimum required fields** (incomplete report = HALT):

- Sprint name, date, status
- At least one deliverable listed
- Verification results section filled (not left as template text)
- Sign-off checklist with actual values (not blank checkboxes)

### Step 8: Validate Bundle Completeness

Check required files per governance contract (Section 4):

```bash
echo "=== PROOF BUNDLE VALIDATION ==="
echo "Sprint: $SPRINT"
echo ""

check_file() {
  if [ -f "$PROOF_DIR/$1" ]; then
    echo "✅ $1"
  else
    echo "❌ MISSING: $1"
  fi
}

# Baseline required (all sprints)
check_file "proof_git_status.txt"
check_file "proof_typecheck.txt"

# Check closeout report
[ -f "$SPRINT_DIR/SPRINT_CLOSEOUT_REPORT.md" ] && echo "✅ SPRINT_CLOSEOUT_REPORT.md" || echo "❌ MISSING: SPRINT_CLOSEOUT_REPORT.md"
[ -f "$SPRINT_DIR/diffs/changes.diff" ] && echo "✅ diffs/changes.diff" || echo "❌ MISSING: diffs/changes.diff"

echo ""
echo "NOTE: proof_fetch_main.txt, proof_rebase_or_merge_main.txt,"
echo "      proof_tag_exists.txt, proof_git_status_clean.txt, and"
echo "      proof_proof_inventory.txt are generated by Codex OS sprint:close."
echo "      Do NOT create these manually."
```

If any ❌ appears: **HALT** — do not proceed to Codex OS until resolved.

### Step 9: Generate Codex OS Envelope (for supervised-run)

```bash
ENVELOPE_FILE="$SPRINT_DIR/claude_os_envelope.json"

cat > "$ENVELOPE_FILE" << EOF
{
  "taskId": "$SPRINT",
  "taskType": "<docs|build_fix|runtime|schema|e2e_lifecycle>",
  "summary": "<one-sentence sprint objective>",
  "touched": [
    "<list affected directories, e.g. apps/api/src/agents/>",
    "<apps/api/src/lib/lifecycle/>"
  ],
  "date": "$DATE"
}
EOF

echo "Envelope written: $ENVELOPE_FILE"
cat "$ENVELOPE_FILE"
```

Verify the envelope is valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('$ENVELOPE_FILE'))" && echo "✅ Valid JSON" || echo "❌ Invalid JSON"
```

### Step 10: Hand Off to Codex OS

**Pre-handoff checklist** (all must be ✅):

- [ ] `proof_git_status.txt` exists and non-empty
- [ ] `proof_typecheck.txt` exists (pass or documented exception)
- [ ] Tier-specific proofs exist (build/tests/gate per tier)
- [ ] `SPRINT_CLOSEOUT_REPORT.md` fully populated
- [ ] `diffs/changes.diff` exists and non-empty (or explicitly empty for docs
      sprint)
- [ ] `claude_os_envelope.json` written and valid

**Invoke Codex OS supervised-run:**

```bash
cd tools/Codex-os
node_modules/.bin/tsx src/cli.ts supervised-run \
  --envelope "$(pwd)/../../$SPRINT_DIR/claude_os_envelope.json"
```

Or via the sprint:close command:

```bash
npm run sprint:close -- "$SPRINT"
```

**Expected outcome**: Codex OS runs verification, generates
`proof_proof_inventory.txt`, prints the compliance table, and exits 0.

If Codex OS exits non-zero: do NOT proceed. Read the compliance table output,
identify the missing artifact, and fix before re-running.

---

## Post-Handoff: Ready for Status Sync

After Codex OS exits 0, the sprint is verified. Proceed to:

```bash
# Commit and tag (if not yet done by Codex OS)
git add -A
git commit -m "feat(<scope>): <description>

SPRINT: $SPRINT"

git tag "$SPRINT"
git push origin main --tags

# Then run status sync
# /status-sync $SPRINT
```

Signal: `/status-sync` may be invoked once
`git ls-remote origin refs/tags/$SPRINT` confirms the tag is on remote.

---

## Failure Protocol

| Failure                                          | Action                                              |
| ------------------------------------------------ | --------------------------------------------------- |
| Implementation not complete (dirty working tree) | HALT — finish implementation first                  |
| Diff is empty (no changes)                       | HALT — wrong branch or uncommitted changes          |
| Typecheck fails (sprint-caused)                  | HALT — fix TypeScript errors                        |
| Typecheck fails (pre-existing, undocumented)     | HALT — document in closeout as scoped exception     |
| Tests fail                                       | HALT — fix test failures                            |
| Lifecycle gate fails                             | HALT — fix single-writer violations                 |
| Closeout report incomplete                       | HALT — fill all required sections                   |
| Codex OS exits non-zero                          | HALT — read compliance table, fix missing artifacts |
| Envelope JSON invalid                            | Fix JSON, re-validate before handing off            |

**NEVER** manually create `proof_proof_inventory.txt` — this invalidates the
sprint per governance contract Section 3.

---

## Notes

- This skill captures evidence; Codex OS `sprint:close` generates the inventory
- The closeout report is the bridge between proof files and `/status-sync`
- For docs-only sprints (T1), most proof files are not required — but the report
  still is
- See `EVIDENCE_RULES.md` for complete required vs optional rules
- See `CLOSEOUT_TEMPLATE.md` for the report format
