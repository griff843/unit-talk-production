# Linear MCP Context Discipline

> **Authority**: This document is the canonical policy for Linear MCP usage
> across all Claude workflow skills. Referenced by
> `.claude/rules/06-linear-mcp-discipline.md`.

---

## Why This Policy Exists

Linear MCP tool calls (`list_issues`, `get_issue`, `list_comments`, etc.) return
full issue objects including descriptions, comment threads, and metadata. When
Claude issues broad queries (e.g., `list_issues` with a long title string and no
scope), the responses can consume significant context window space, degrading
performance for the rest of the session.

**The fix**: Use Linear for what it's good at — execution state tracking — and
keep detailed sprint content in repo docs where it belongs.

---

## Architecture

```
┌─────────────────────────────┐
│   Repo Docs (Source of Truth)│
│   - Sprint plans            │
│   - Closeout reports        │
│   - Status docs             │
│   - Proof artifacts         │
└─────────────┬───────────────┘
              │ detailed content
              ▼
┌─────────────────────────────┐
│   Linear (Execution Mirror) │
│   - Issue state (workflow)  │
│   - Assignee / cycle        │
│   - Labels / priority       │
│   - Blocking relations      │
│   - Brief comments (syncs)  │
└─────────────────────────────┘
```

**Rule**: Always read details from repo docs. Only read Linear for state,
assignment, and workflow data.

---

## Policy Rules

### Rule 1: Prefer Exact Issue ID Lookup

When the `UNI-N` identifier is known, always use:

```
mcp__linear__get_issue  id="UNI-56"
```

Never use `list_issues` to re-discover an issue whose ID is already known.

**Where to find the ID**:

- Sprint status docs (`docs/status/...`)
- Sprint plan output (`out/sprints/...`)
- Previous session context
- Operator input ("sync UNI-56")

### Rule 2: Single-Issue Retrieval Over List

| Need                            | Correct Tool                                     |
| ------------------------------- | ------------------------------------------------ |
| Get one issue                   | `get_issue` with `id`                            |
| Find issue by name (ID unknown) | `list_issues` with `query` + `team` + `limit`    |
| Enumerate project issues        | `list_issues` with `project` + `state` + `limit` |

Never use `list_issues` when `get_issue` would suffice.

### Rule 3: Always Scope Search Queries

When `list_issues` is necessary, always include:

- `team="Unit Talk"` — prevents cross-team collisions
- `limit=5` (or the minimum needed) — prevents oversized responses
- Short query string — use sprint short-name, not full objective text

```
GOOD:  mcp__linear__list_issues query="LIFECYCLE-MIGRATION" team="Unit Talk" limit=5
BAD:   mcp__linear__list_issues query="SPRINT-LIFECYCLE-MIGRATION — Migrate all write surfaces to lifecycle adapters"
```

### Rule 4: No Repeated Fetches

Once an issue is fetched in a session, extract the needed fields and work from
memory. Do not re-fetch the same issue unless the state may have changed
externally.

### Rule 5: Repo Docs for Details, Linear for State

| Information                               | Source    |
| ----------------------------------------- | --------- |
| Sprint scope, tasks, acceptance criteria  | Repo docs |
| Sprint state (In Progress, Done, Blocked) | Linear    |
| Detailed implementation notes             | Repo docs |
| Assignee, cycle, priority, labels         | Linear    |
| Closeout proof artifacts                  | Repo docs |
| Blocking relations between sprints        | Linear    |

### Rule 6: Summarize Large Responses

If a Linear response contains a long description or many comments, immediately
extract only the needed fields into a short summary. Do not retain the full
response as working context.

### Rule 7: Halt on Oversized Risk

Before executing a query likely to return >10 issues or issues with very long
descriptions, warn the operator and propose a narrower query.

---

## Issue Discovery Order

When the `UNI-N` ID is NOT known, follow this escalation:

```
1. Check repo docs (sprint plan, status doc, closeout) for UNI-N reference
         ↓ not found
2. Ask the operator: "Do you know the Linear issue ID?"
         ↓ not known
3. Scoped search: list_issues query="<SHORT-NAME>" team="Unit Talk" limit=5
         ↓ zero results
4. Wider scoped search: list_issues query="<keywords>" team="Unit Talk" limit=5
         ↓ zero results
5. HALT — ask operator to provide ID or create issue manually
```

**Never** skip to step 3 or 4 when step 1 or 2 can resolve the ID.

---

## Examples

### Bad Pattern: Broad Title Search

```
# Wastes context — returns full issue objects for all partial matches
mcp__linear__list_issues query="SPRINT-LIFECYCLE-MIGRATION-038 — Migrate all write surfaces"
```

**Problems**:

- Long query string, may not match title exactly
- No team scoping — could match issues in other teams
- No limit — could return many results
- Full issue objects (with descriptions) loaded into context

### Good Pattern: Exact ID Lookup

```
# Minimal context — fetches only the one issue needed
mcp__linear__get_issue id="UNI-56"
```

### Good Pattern: Scoped Search (ID Unknown)

```
# Short query, scoped to team, limited results
mcp__linear__list_issues query="LIFECYCLE-MIGRATION" team="Unit Talk" limit=5
```

### Good Pattern: Repo Docs for Details, Linear for State

```
# Step 1: Read sprint details from repo
Read file: docs/status/SPRINT-LIFECYCLE-MIGRATION-038.md
→ Contains: scope, tasks, acceptance criteria, UNI-56 reference

# Step 2: Check Linear only for current execution state
mcp__linear__get_issue id="UNI-56"
→ Extract: state="In Progress", cycle="Sprint 4", labels=["sprint","infra"]

# Step 3: Update state based on repo verification
mcp__linear__save_issue id="UNI-56" state="Done"
```

### Bad Pattern: Fetching Description for Sprint Details

```
# Wrong — reading Linear for information that lives in repo docs
mcp__linear__get_issue id="UNI-56"
→ Reading the full description to understand sprint scope
```

### Good Pattern: Post-Sync ID Logging

After finding or creating a Linear issue, always log the ID in the repo doc:

```markdown
**Linear**: UNI-56
```

This ensures future sessions can use exact ID lookup (Rule 1).

---

## Skill Compliance

All workflow skills that interact with Linear must:

1. Reference `.claude/rules/06-linear-mcp-discipline.md`
2. Implement the Issue Discovery Order (check repo docs first)
3. Never use `list_issues` as the default/first lookup strategy
4. Always include `team` and `limit` on `list_issues` calls
5. Log the `UNI-N` ID in repo docs for future sessions

### Skills Affected

| Skill                  | Linear Usage                    | Compliance Notes                              |
| ---------------------- | ------------------------------- | --------------------------------------------- |
| `/linear-sync`         | Read + Write                    | Primary Linear skill — must enforce all rules |
| `/status-sync`         | Read + Write (Step 7)           | Delegates to linear-sync rules                |
| `/sprint-plan`         | Read-only                       | Looks up ID for prompt template               |
| `/sprint-proof-bundle` | None (delegates to status-sync) | No direct compliance needed                   |
| `/system-status`       | None                            | Explicitly read-only, no Linear calls         |

---

## Governance

- **Owner**: Engineering Team
- **Rule file**: `.claude/rules/06-linear-mcp-discipline.md`
- **Full policy**: This document (`docs/ops/LINEAR_MCP_CONTEXT_DISCIPLINE.md`)
- **Sprint**: SPRINT-LINEAR-MCP-CONTEXT-DISCIPLINE-HARDENING
