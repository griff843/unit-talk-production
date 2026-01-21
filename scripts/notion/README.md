# Notion Relation Wiring Automation

**Purpose**: Automatically wire relations between Notion databases that have been populated via CSV import.

**What it does**: Reads "wiring fields" (comma-separated IDs) from each page and creates proper Notion relations, eliminating manual linking.

---

## Prerequisites

- Notion databases already created and populated with CSV data
- Relation properties already exist on each database
- Node.js 18+ installed

---

## Step 1: Create Notion Integration

1. Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"+ New integration"**
3. Configure:
   - **Name**: `Unit Talk Automation`
   - **Associated workspace**: Select your workspace
   - **Capabilities**:
     - ✅ Read content
     - ✅ Update content
     - ✅ Insert content (optional)
     - ❌ No user information needed
4. Click **Submit**
5. Copy the **Internal Integration Token** (starts with `ntn_` or `secret_`)

---

## Step 2: Share Integration with Each Database

**CRITICAL**: You must share the integration with EVERY database you want to access.

For each of these databases:
- **Feature Registry**
- **Agent Registry**
- **SOPs**
- **Playbooks**

Do the following:
1. Open the database in Notion
2. Click **"..."** (three dots) in the top right
3. Click **"Add connections"** (or "Connections" → "Add connections")
4. Search for **"Unit Talk Automation"** (your integration name)
5. Click to connect

---

## Step 3: Get Database IDs

For each database, extract the ID from the URL:

**URL Format**: `https://www.notion.so/<workspace>/<database_id>?v=...`

**Example**:
```
https://www.notion.so/myworkspace/1234567890abcdef1234567890abcdef?v=...
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                  This is the database_id
```

The ID is the 32-character hexadecimal string BEFORE the `?v=` query parameter.

---

## Step 4: Configure Environment Variables

Add to your `.env.local` file:

```bash
# Notion Integration Token
NOTION_TOKEN=ntn_xxxxxxxxxxxxxxxxxxxx

# Database IDs (32 hex characters each)
NOTION_DB_FEATURES=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_AGENTS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_SOPS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NOTION_DB_PLAYBOOKS=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Step 5: Add Wiring Fields to Databases (Manual Step)

The script reads from "wiring fields" to know what relations to create. Add these **Rich Text** properties to your databases:

### Feature Registry

| Property Name | Type | Example Value |
|---------------|------|---------------|
| `Wiring: SOP IDs` | Rich Text | `SOP-001,SOP-002` |
| `Wiring: Agent Names` | Rich Text | `AlertAgent,GradingAgent` |
| `Wiring: Depends On` | Rich Text | `FEAT-003,FEAT-010` |

### Agent Registry

| Property Name | Type | Example Value |
|---------------|------|---------------|
| `Wiring: SOP IDs` | Rich Text | `SOP-002,SOP-003` |

### SOPs

| Property Name | Type | Example Value |
|---------------|------|---------------|
| `Wiring: Playbook IDs` | Rich Text | `PB-001,PB-002` |

**Tip**: You can batch-fill these using the Notion table view and copy-paste from the CSV data.

---

## Step 6: Install Dependencies

```bash
# From repo root
npm install @notionhq/client dotenv

# Or if using the scripts directory
cd scripts/notion
npm install
```

---

## Step 7: Run the Script

### Dry Run (Preview Changes)

```bash
npx tsx scripts/notion/wire-relations.ts --dry-run
```

This will:
- Query all databases
- Show what relations would be created
- NOT make any changes to Notion

### Execute Wiring

```bash
npx tsx scripts/notion/wire-relations.ts
```

This will:
- Read wiring fields from each page
- Create relations to matching pages
- Log any missing references (e.g., "SOP-999 not found")
- Skip pages that are already wired (idempotent)

---

## Runbook

### Quick Commands

```bash
# 1. Install dependencies (first time only)
npm install @notionhq/client dotenv

# 2. Dry run to preview
npx tsx scripts/notion/wire-relations.ts --dry-run

# 3. Execute wiring
npx tsx scripts/notion/wire-relations.ts

# 4. Re-run after adding new pages (safe, idempotent)
npx tsx scripts/notion/wire-relations.ts
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Could not find database" | Check that integration is shared with the database |
| "Unauthorized" | Verify NOTION_TOKEN is correct and not expired |
| "Property not found" | Ensure wiring properties exist with exact names |
| "No pages found" | Database is empty or integration not connected |

---

## Wiring Map Reference

### Relations Created by This Script

| Source Database | Relation Property | Target Database | Wiring Field |
|-----------------|-------------------|-----------------|--------------|
| Feature Registry | Related SOPs | SOPs | `Wiring: SOP IDs` |
| Feature Registry | Agent Owner | Agent Registry | `Wiring: Agent Names` |
| Feature Registry | Dependencies | Feature Registry | `Wiring: Depends On` |
| Agent Registry | Related SOPs | SOPs | `Wiring: SOP IDs` |
| SOPs | Related Playbooks | Playbooks | `Wiring: Playbook IDs` |

### Property Names (Must Match Exactly)

**Feature Registry**:
- Title: `Feature Name`
- ID: `Feature ID`
- Relations: `Related SOPs`, `Agent Owner`, `Dependencies`

**Agent Registry**:
- Title: `Agent Name`
- ID: `Agent ID`
- Relations: `Related SOPs`

**SOPs**:
- Title: `SOP Title`
- ID: `SOP ID`
- Relations: `Related Playbooks`

**Playbooks**:
- Title: `Playbook Title`
- ID: `Playbook ID`

---

## Architecture

```
┌─────────────────┐     Wiring: SOP IDs      ┌─────────────┐
│ Feature Registry│─────────────────────────▶│    SOPs     │
│                 │                          └─────────────┘
│                 │     Wiring: Agent Names  ┌─────────────┐
│                 │─────────────────────────▶│Agent Registry│
│                 │                          └─────────────┘
│                 │     Wiring: Depends On
│                 │─────────────────────────▶│ (self)      │
└─────────────────┘

┌─────────────────┐     Wiring: SOP IDs      ┌─────────────┐
│ Agent Registry  │─────────────────────────▶│    SOPs     │
└─────────────────┘                          └─────────────┘

┌─────────────────┐     Wiring: Playbook IDs ┌─────────────┐
│      SOPs       │─────────────────────────▶│  Playbooks  │
└─────────────────┘                          └─────────────┘
```

---

## Maintenance

After adding new pages to any database:

1. Fill in the wiring fields on the new pages
2. Re-run the script: `npx tsx scripts/notion/wire-relations.ts`
3. The script is idempotent - it won't duplicate existing relations

---

## Security Notes

- **Never commit** `.env.local` to version control
- The integration token has limited scope (only databases you share it with)
- Rotate the token periodically via Notion's integration settings

---

**Author**: Platform Engineering
**Last Updated**: 2026-01-21
