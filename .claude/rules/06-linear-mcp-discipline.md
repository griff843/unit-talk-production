# Rule 06: Linear MCP Context Discipline

> Authority: `docs/ops/LINEAR_MCP_CONTEXT_DISCIPLINE.md` (full policy +
> examples)

## Core Principle

**Linear is the execution-state mirror, not the source of detailed sprint
truth.** Repo docs (`docs/`, `out/sprints/`) hold detailed sprint content.
Linear holds state (status, assignee, cycle, labels, blocking relations). Claude
must fetch the minimum Linear data needed and rely on repo docs for details.

## Mandatory Rules

### 1. Prefer Exact Issue ID Lookup

When a `UNI-N` identifier is known (from repo docs, prior context, or operator
input), use `mcp__linear__get_issue` with the exact ID. Never use `list_issues`
to re-discover an issue whose ID is already known.

```
GOOD:  mcp__linear__get_issue  id="UNI-56"
BAD:   mcp__linear__list_issues query="SPRINT-LIFECYCLE-MIGRATION"
       (when UNI-56 is already known)
```

### 2. Scope All Searches

When `list_issues` is genuinely needed (ID unknown), always scope the query:

```
mcp__linear__list_issues query="<SHORT-NAME>" team="Unit Talk" limit=5
```

Never issue an unscoped `list_issues` without `team` and `limit`.

### 3. Single-Issue Retrieval Over List

If you need data for one issue, use `get_issue`. Only use `list_issues` when you
need to find or enumerate multiple issues.

### 4. Avoid Repeated Full Loads

Once you have fetched an issue's data, do not fetch it again in the same
session. Extract the fields you need (state, labels, cycle, ID) and work from
those values.

### 5. Never Pull Descriptions for Detail

If the detailed sprint scope, tasks, or acceptance criteria exist in repo docs
(sprint plan, closeout report, status doc), do not fetch the Linear issue
description for that information. The repo doc is the source of truth.

### 6. Summarize Before Storing in Context

If a Linear response is large (long description, many comments), extract only
the needed fields into a short summary. Do not hold the full response in working
memory.

### 7. Halt on Oversized Response Risk

If a query is likely to return more than 10 issues or issues with very long
descriptions, warn the operator before executing. Prefer narrowing the query.

## Issue Discovery Order

When the `UNI-N` ID is NOT known, follow this order:

1. **Check repo docs** — sprint plan, status doc, or closeout report may already
   contain the `UNI-N` reference.
2. **Ask the operator** — "Do you know the Linear issue ID?"
3. **Scoped search** —
   `list_issues query="<SHORT-NAME>" team="Unit Talk" limit=5`
4. **Never** fall through to an unscoped or keyword-expanded search without
   operator confirmation.

## Quick Reference

| Need               | Tool           | Parameters                                 |
| ------------------ | -------------- | ------------------------------------------ |
| Get known issue    | `get_issue`    | `id="UNI-N"`                               |
| Find issue by name | `list_issues`  | `query="<short>" team="Unit Talk" limit=5` |
| Update issue state | `save_issue`   | `id="<id>" state="<state>"`                |
| Get current cycle  | `list_cycles`  | `teamId="5aa1b0e9-..."` `type="current"`   |
| Post comment       | `save_comment` | `issueId="<id>" body="<md>"`               |

## All Skills Must

- Reference this rule file for Linear MCP usage
- Prefer exact ID when available
- Never issue broad `list_issues` as the default lookup strategy
- Log the `UNI-N` ID in sprint docs so future sessions can use exact lookup
