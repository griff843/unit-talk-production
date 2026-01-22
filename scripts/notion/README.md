# Notion Relation Wiring Automation

**This script wires relations ONLY; it does not create data.**

All operations are idempotent and safe to re-run at any time.

---

## Page ID vs Database ID

Notion IDs can refer to either **pages** or **databases**. This script handles both:

| ID Type | Description | Example URL |
|---------|-------------|-------------|
| Database ID | Direct link to a database | `notion.so/workspace/2ef5f8bee34480b59181e4650cf9aa02?v=...` |
| Page ID | Link to a page containing an inline database | `notion.so/workspace/Feature-Registry-2ef5f8bee34480b59181e4650cf9aa02` |

### Auto-Resolution

The script automatically detects which type of ID you provide:

1. **If it's a database ID** → Uses it directly
2. **If it's a page ID** → Searches for inline (child) databases within the page
   - Matches by expected title (e.g., "Feature Registry", "SOP Library")
   - Falls back to the first database if only one exists
   - Fails with clear error if multiple databases exist and none match

This means you can use either the page URL or the database URL when configuring IDs.

### Fail-Closed Guard

After resolving database IDs, the script **verifies each database title** before any wiring occurs:

```
STEP 0b: Verifying database titles (fail-closed guard)
   ✓ Verified: "Feature Registry"
   ✓ Verified: "Agent Registry"
   ✓ Verified: "SOP Library"
   ✓ Verified: "Playbooks & How-Tos"
```

**If a title does not match the expected value, the script aborts immediately** with a fatal error—no relations are written. This prevents accidental wiring to the wrong database.

| Expected Title | Matches |
|----------------|---------|
| Feature Registry | Exact or partial match |
| Agent Registry | Exact or partial match |
| SOP Library | Exact or partial match |
| Playbooks | Exact or partial match (e.g., "Playbooks & How-Tos") |

---

## What This Script Does

Reads "wiring fields" (comma-separated IDs or names) from each Notion page and creates proper Notion relations.

**Relations wired:**
| Source | Relation Property | Target | Wiring Field |
|--------|-------------------|--------|--------------|
| Feature Registry | Related SOPs | SOP Library | `Wiring: SOP IDs` |
| Feature Registry | Agent Owner | Agent Registry | `Wiring: Agent Names` |
| Feature Registry | Dependencies | Feature Registry | `Wiring: Depends On` |
| Agent Registry | Related SOPs | SOP Library | `Wiring: SOP IDs` |
| SOP Library | Related Playbooks | Playbooks | `Wiring: Playbook IDs` |

---

## Prerequisites

1. **Notion databases exist** and are populated with data
2. **Relation properties exist** on each database (matching names exactly)
3. **Notion integration created** and shared with all databases
4. **NOTION_TOKEN** available (from GitHub Secrets or .env.local)
5. **Node.js 18+** installed

---

## Environment Variables Required

| Variable | Description | Required |
|----------|-------------|----------|
| `NOTION_TOKEN` | Notion integration token (starts with `ntn_` or `secret_`) | **Yes** |
| `NOTION_DB_FEATURES` | Feature Registry database ID | No (has default) |
| `NOTION_DB_AGENTS` | Agent Registry database ID | No (has default) |
| `NOTION_DB_SOPS` | SOP Library database ID | No (has default) |
| `NOTION_DB_PLAYBOOKS` | Playbooks database ID | No (has default) |

**Default Database IDs (hardcoded):**
```
Features:  2ef5f8bee34480b59181e4650cf9aa02
Agents:    2ef5f8bee34480eba23ce234f46ba192
SOPs:      2ef5f8bee34480f0855ef08dea2ffe52
Playbooks: 2ef5f8bee3448082aae2c53e35f69a7c
```

---

## How to Run

### Dry-Run (Preview Changes)

```bash
# From repo root
npm run notion:wire:dry-run

# Or directly
npx tsx scripts/notion/wire-relations.ts --dry-run
```

This will:
- Query all databases
- Show what relations would be created
- **NOT make any changes to Notion**

### Execute Wiring (Live)

```bash
# From repo root
npm run notion:wire

# Or directly
npx tsx scripts/notion/wire-relations.ts
```

This will:
- Read wiring fields from each page
- **SET** relations to exactly match wiring field values
- Log any missing references
- Update Notion in real-time

---

## Interpreting Output

### Success Messages

```
SET "Smart Form Submission" -> Related SOPs -> [Submission Operations, Error Handling]
```
Relation was successfully set.

### Dry-Run Messages

```
[DRY-RUN] Would SET "Smart Form Submission" -> Related SOPs -> [Submission Operations]
```
Shows what would happen; no changes made.

### Warning Messages

```
WARNING: "Smart Form Submission" references SOP "SOP-999" -> NOT FOUND
```
The referenced ID/name does not exist in the target database.

**What to do:**
1. Verify the ID exists in the target database
2. Check for typos (IDs are case-sensitive: `SOP-001` not `sop-001`)
3. If using names, ensure they match when lowercased and trimmed

### Error Messages

```
FAILED "Feature Name" -> Related SOPs: API error message
```
Notion API call failed. Check:
- Integration has access to the database
- Relation property exists with exact name
- Network connectivity

---

## Property Name Requirements

Property names **MUST** match exactly as listed below.

### Feature Registry
| Property | Type | Purpose |
|----------|------|---------|
| `Feature ID` | Rich Text | Unique identifier (e.g., FEAT-001) |
| `Feature Name` | Title | Feature display name |
| `Related SOPs` | Relation | Links to SOP Library |
| `Agent Owner` | Relation | Links to Agent Registry |
| `Dependencies` | Relation | Links to other Features |
| `Wiring: SOP IDs` | Rich Text | e.g., `SOP-001,SOP-002` |
| `Wiring: Agent Names` | Rich Text | e.g., `AlertAgent,GradingAgent` |
| `Wiring: Depends On` | Rich Text | e.g., `FEAT-003,FEAT-010` |

### Agent Registry
| Property | Type | Purpose |
|----------|------|---------|
| `Agent ID` | Rich Text | Unique identifier (e.g., AGENT-001) |
| `Agent Name` | Title | Agent display name |
| `Related SOPs` | Relation | Links to SOP Library |
| `Wiring: SOP IDs` | Rich Text | e.g., `SOP-002,SOP-003` |

### SOP Library
| Property | Type | Purpose |
|----------|------|---------|
| `SOP ID` | Rich Text | Unique identifier (e.g., SOP-001) |
| `SOP Title` | Title | SOP display name |
| `Related Playbooks` | Relation | Links to Playbooks |
| `Wiring: Playbook IDs` | Rich Text | e.g., `PB-001,PB-002` |

### Playbooks
| Property | Type | Purpose |
|----------|------|---------|
| `Playbook ID` | Rich Text | Unique identifier (e.g., PB-001) |
| `Playbook Title` | Title | Playbook display name |

---

## Lookup Behavior

The script resolves references in this order:

1. **Exact ID match** (preferred): `SOP-001` matches page with `SOP ID = "SOP-001"`
2. **Normalized title match**: `submission operations` matches page with title "Submission Operations" (case-insensitive, trimmed)

**Recommendation:** Always use IDs (e.g., `SOP-001`) for deterministic wiring.

---

## Idempotency

This script uses **SET behavior**:
- Relations are replaced entirely with wiring field values
- Running multiple times produces the same result
- Safe to re-run after adding new pages or updating wiring fields

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "NOTION_TOKEN is not set" | Set `NOTION_TOKEN` in `.env.local` or as environment variable |
| "Could not find database" | Verify integration is shared with the database |
| "Unauthorized" | Check token is valid and not expired |
| "Property not found" | Ensure property names match exactly (case-sensitive) |
| "No pages found" | Database is empty or integration not connected |
| Missing references | Verify IDs exist and match exactly in target database |
| "is a page, not a database" | The script auto-resolves this; if it fails, see below |
| "No inline database found" | The page doesn't contain a database. Copy the database link directly |
| "Multiple inline databases" | Page has multiple DBs; use the specific database ID from the error message |

### Getting the Correct Database ID

If you encounter ID resolution errors:

1. Open the specific database (not the parent page) in Notion
2. Click the `...` menu in the top-right
3. Select **"Copy link to view"**
4. Extract the 32-character hex ID from the URL:
   ```
   https://www.notion.so/workspace/2ef5f8bee34480b59181e4650cf9aa02?v=...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    This is the database ID
   ```
5. Update your environment variable with this ID

---

## Quick Reference

```bash
# Install dependencies (first time)
npm install

# Preview changes
npm run notion:wire:dry-run

# Apply changes
npm run notion:wire

# Re-run after adding pages (safe, idempotent)
npm run notion:wire
```

---

## Security Notes

- NOTION_TOKEN should be stored in GitHub Secrets for CI/CD
- Never commit real tokens to version control
- The integration token has limited scope (only databases you share it with)

---

**Author**: Platform Engineering
**Version**: 2.2.0
**Last Updated**: 2026-01-21
