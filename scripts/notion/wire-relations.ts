#!/usr/bin/env npx tsx
/**
 * Notion Relation Wiring Script
 *
 * Automatically wires relations between Notion databases based on "wiring fields".
 * Reads comma-separated IDs from rich text properties and creates proper relations.
 *
 * Usage:
 *   npx tsx scripts/notion/wire-relations.ts --dry-run  # Preview changes
 *   npx tsx scripts/notion/wire-relations.ts            # Execute wiring
 *
 * @author Platform Engineering
 * @version 1.0.0
 */

import { Client } from '@notionhq/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================================
// Configuration
// ============================================================================

interface Config {
  notionToken: string;
  databaseIds: {
    features: string;
    agents: string;
    sops: string;
    playbooks: string;
  };
  dryRun: boolean;
}

function loadConfig(): Config {
  const notionToken = process.env.NOTION_TOKEN;
  if (!notionToken) {
    throw new Error('NOTION_TOKEN is not set in .env.local');
  }

  const databaseIds = {
    features: process.env.NOTION_DB_FEATURES || '',
    agents: process.env.NOTION_DB_AGENTS || '',
    sops: process.env.NOTION_DB_SOPS || '',
    playbooks: process.env.NOTION_DB_PLAYBOOKS || '',
  };

  // Validate at least some DBs are configured
  const configuredDbs = Object.entries(databaseIds).filter(([_, v]) => v);
  if (configuredDbs.length === 0) {
    throw new Error(
      'No database IDs configured. Set NOTION_DB_FEATURES, NOTION_DB_AGENTS, etc. in .env.local'
    );
  }

  const dryRun = process.argv.includes('--dry-run');

  return { notionToken, databaseIds, dryRun };
}

// ============================================================================
// Types
// ============================================================================

interface PageInfo {
  id: string; // Notion page ID
  title: string; // Page title
  customId: string; // e.g., FEAT-001, AGENT-001, SOP-001
}

interface WiringData {
  pageId: string;
  pageTitle: string;
  sopIds: string[];
  agentNames: string[];
  dependsOn: string[];
  playbookIds: string[];
}

interface WiringAction {
  source: { pageId: string; title: string };
  relationProperty: string;
  targetPageIds: string[];
  targetTitles: string[];
}

// ============================================================================
// Notion Client
// ============================================================================

let notion: Client;

async function initNotionClient(token: string): Promise<void> {
  notion = new Client({ auth: token });

  // Test connection
  try {
    await notion.users.me({});
    console.log('✅ Connected to Notion API');
  } catch (error: any) {
    throw new Error(`Failed to connect to Notion: ${error.message}`);
  }
}

// ============================================================================
// Database Query Helpers
// ============================================================================

/**
 * Query all pages from a database with pagination
 */
async function queryAllPages(databaseId: string): Promise<any[]> {
  const pages: any[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: startCursor,
      page_size: 100,
    });

    pages.push(...response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return pages;
}

/**
 * Extract text from a rich_text property
 */
function extractRichText(property: any): string {
  if (!property || property.type !== 'rich_text') return '';
  return property.rich_text.map((t: any) => t.plain_text).join('');
}

/**
 * Extract text from a title property
 */
function extractTitle(property: any): string {
  if (!property || property.type !== 'title') return '';
  return property.title.map((t: any) => t.plain_text).join('');
}

/**
 * Extract existing relation IDs from a relation property
 */
function extractRelationIds(property: any): string[] {
  if (!property || property.type !== 'relation') return [];
  return property.relation.map((r: any) => r.id);
}

/**
 * Parse comma-separated IDs from a wiring field
 */
function parseWiringField(value: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ============================================================================
// Database Loaders
// ============================================================================

async function loadFeatureRegistry(dbId: string): Promise<Map<string, PageInfo>> {
  if (!dbId) return new Map();

  console.log('📖 Loading Feature Registry...');
  const pages = await queryAllPages(dbId);
  const map = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Feature Name']);
    const customId = extractRichText(props['Feature ID']);

    if (customId) {
      map.set(customId, { id: page.id, title, customId });
    }
    // Also index by title for name-based lookups
    if (title) {
      map.set(title, { id: page.id, title, customId });
    }
  }

  console.log(`   Found ${map.size} features`);
  return map;
}

async function loadAgentRegistry(dbId: string): Promise<Map<string, PageInfo>> {
  if (!dbId) return new Map();

  console.log('📖 Loading Agent Registry...');
  const pages = await queryAllPages(dbId);
  const map = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Agent Name']);
    const customId = extractRichText(props['Agent ID']);

    if (customId) {
      map.set(customId, { id: page.id, title, customId });
    }
    // Also index by name for name-based lookups
    if (title) {
      map.set(title, { id: page.id, title, customId });
    }
  }

  console.log(`   Found ${map.size} agents`);
  return map;
}

async function loadSOPs(dbId: string): Promise<Map<string, PageInfo>> {
  if (!dbId) return new Map();

  console.log('📖 Loading SOPs...');
  const pages = await queryAllPages(dbId);
  const map = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['SOP Title']);
    const customId = extractRichText(props['SOP ID']);

    if (customId) {
      map.set(customId, { id: page.id, title, customId });
    }
  }

  console.log(`   Found ${map.size} SOPs`);
  return map;
}

async function loadPlaybooks(dbId: string): Promise<Map<string, PageInfo>> {
  if (!dbId) return new Map();

  console.log('📖 Loading Playbooks...');
  const pages = await queryAllPages(dbId);
  const map = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Playbook Title']);
    const customId = extractRichText(props['Playbook ID']);

    if (customId) {
      map.set(customId, { id: page.id, title, customId });
    }
  }

  console.log(`   Found ${map.size} playbooks`);
  return map;
}

// ============================================================================
// Wiring Data Extraction
// ============================================================================

async function extractFeatureWiring(dbId: string): Promise<WiringData[]> {
  if (!dbId) return [];

  const pages = await queryAllPages(dbId);
  const results: WiringData[] = [];

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Feature Name']);

    // Read wiring fields
    const sopIdsRaw = extractRichText(props['Wiring: SOP IDs']);
    const agentNamesRaw = extractRichText(props['Wiring: Agent Names']);
    const dependsOnRaw = extractRichText(props['Wiring: Depends On']);

    results.push({
      pageId: page.id,
      pageTitle: title,
      sopIds: parseWiringField(sopIdsRaw),
      agentNames: parseWiringField(agentNamesRaw),
      dependsOn: parseWiringField(dependsOnRaw),
      playbookIds: [],
    });
  }

  return results;
}

async function extractAgentWiring(dbId: string): Promise<WiringData[]> {
  if (!dbId) return [];

  const pages = await queryAllPages(dbId);
  const results: WiringData[] = [];

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Agent Name']);

    const sopIdsRaw = extractRichText(props['Wiring: SOP IDs']);

    results.push({
      pageId: page.id,
      pageTitle: title,
      sopIds: parseWiringField(sopIdsRaw),
      agentNames: [],
      dependsOn: [],
      playbookIds: [],
    });
  }

  return results;
}

async function extractSOPWiring(dbId: string): Promise<WiringData[]> {
  if (!dbId) return [];

  const pages = await queryAllPages(dbId);
  const results: WiringData[] = [];

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['SOP Title']);

    const playbookIdsRaw = extractRichText(props['Wiring: Playbook IDs']);

    results.push({
      pageId: page.id,
      pageTitle: title,
      sopIds: [],
      agentNames: [],
      dependsOn: [],
      playbookIds: parseWiringField(playbookIdsRaw),
    });
  }

  return results;
}

// ============================================================================
// Relation Resolution
// ============================================================================

interface ResolutionResult {
  actions: WiringAction[];
  missing: { source: string; type: string; reference: string }[];
}

function resolveFeatureRelations(
  wirings: WiringData[],
  sopMap: Map<string, PageInfo>,
  agentMap: Map<string, PageInfo>,
  featureMap: Map<string, PageInfo>
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    // Feature → SOPs
    if (wiring.sopIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];

      for (const sopId of wiring.sopIds) {
        const sop = sopMap.get(sopId);
        if (sop) {
          targetIds.push(sop.id);
          targetTitles.push(sop.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'SOP', reference: sopId });
        }
      }

      if (targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Related SOPs',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }

    // Feature → Agents
    if (wiring.agentNames.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];

      for (const agentName of wiring.agentNames) {
        const agent = agentMap.get(agentName);
        if (agent) {
          targetIds.push(agent.id);
          targetTitles.push(agent.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Agent', reference: agentName });
        }
      }

      if (targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Agent Owner',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }

    // Feature → Features (Dependencies)
    if (wiring.dependsOn.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];

      for (const featId of wiring.dependsOn) {
        const feat = featureMap.get(featId);
        if (feat) {
          targetIds.push(feat.id);
          targetTitles.push(feat.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Feature', reference: featId });
        }
      }

      if (targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Dependencies',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }
  }

  return { actions, missing };
}

function resolveAgentRelations(
  wirings: WiringData[],
  sopMap: Map<string, PageInfo>
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    if (wiring.sopIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];

      for (const sopId of wiring.sopIds) {
        const sop = sopMap.get(sopId);
        if (sop) {
          targetIds.push(sop.id);
          targetTitles.push(sop.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'SOP', reference: sopId });
        }
      }

      if (targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Related SOPs',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }
  }

  return { actions, missing };
}

function resolveSOPRelations(
  wirings: WiringData[],
  playbookMap: Map<string, PageInfo>
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    if (wiring.playbookIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];

      for (const pbId of wiring.playbookIds) {
        const pb = playbookMap.get(pbId);
        if (pb) {
          targetIds.push(pb.id);
          targetTitles.push(pb.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Playbook', reference: pbId });
        }
      }

      if (targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Related Playbooks',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }
  }

  return { actions, missing };
}

// ============================================================================
// Relation Writing
// ============================================================================

async function applyWiringAction(action: WiringAction, dryRun: boolean): Promise<void> {
  const targetList = action.targetTitles.join(', ');

  if (dryRun) {
    console.log(
      `   [DRY-RUN] Would wire "${action.source.title}" → ${action.relationProperty} → [${targetList}]`
    );
    return;
  }

  try {
    // Get current page to check existing relations
    const page = await notion.pages.retrieve({ page_id: action.source.pageId });
    const props = (page as any).properties;
    const existingRelation = props[action.relationProperty];

    // Get existing relation IDs
    const existingIds = extractRelationIds(existingRelation);
    const existingSet = new Set(existingIds);

    // Filter to only new relations
    const newTargetIds = action.targetPageIds.filter((id) => !existingSet.has(id));

    if (newTargetIds.length === 0) {
      console.log(`   ⏭️  "${action.source.title}" → ${action.relationProperty} (already wired)`);
      return;
    }

    // Merge existing + new
    const allRelationIds = [...existingIds, ...newTargetIds];

    // Update the page
    await notion.pages.update({
      page_id: action.source.pageId,
      properties: {
        [action.relationProperty]: {
          relation: allRelationIds.map((id) => ({ id })),
        },
      },
    });

    console.log(`   ✅ Wired "${action.source.title}" → ${action.relationProperty} → [${targetList}]`);
  } catch (error: any) {
    console.error(
      `   ❌ Failed to wire "${action.source.title}" → ${action.relationProperty}: ${error.message}`
    );
  }
}

// ============================================================================
// Main Orchestration
// ============================================================================

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Notion Relation Wiring Script v1.0.0                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Load configuration
  const config = loadConfig();

  if (config.dryRun) {
    console.log('🔍 Running in DRY-RUN mode (no changes will be made)\n');
  } else {
    console.log('🔧 Running in EXECUTE mode (will update Notion)\n');
  }

  // Initialize Notion client
  await initNotionClient(config.notionToken);
  console.log('');

  // Load all databases into lookup maps
  console.log('📚 Loading database indexes...\n');
  const featureMap = await loadFeatureRegistry(config.databaseIds.features);
  const agentMap = await loadAgentRegistry(config.databaseIds.agents);
  const sopMap = await loadSOPs(config.databaseIds.sops);
  const playbookMap = await loadPlaybooks(config.databaseIds.playbooks);
  console.log('');

  // Track all missing references
  const allMissing: { source: string; type: string; reference: string }[] = [];
  let totalActions = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Wire Feature Registry
  // ─────────────────────────────────────────────────────────────────────────
  if (config.databaseIds.features) {
    console.log('🔗 Processing Feature Registry...\n');
    const featureWirings = await extractFeatureWiring(config.databaseIds.features);
    const { actions, missing } = resolveFeatureRelations(
      featureWirings,
      sopMap,
      agentMap,
      featureMap
    );

    for (const action of actions) {
      await applyWiringAction(action, config.dryRun);
      totalActions++;
    }
    allMissing.push(...missing);
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Wire Agent Registry
  // ─────────────────────────────────────────────────────────────────────────
  if (config.databaseIds.agents) {
    console.log('🔗 Processing Agent Registry...\n');
    const agentWirings = await extractAgentWiring(config.databaseIds.agents);
    const { actions, missing } = resolveAgentRelations(agentWirings, sopMap);

    for (const action of actions) {
      await applyWiringAction(action, config.dryRun);
      totalActions++;
    }
    allMissing.push(...missing);
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Wire SOPs
  // ─────────────────────────────────────────────────────────────────────────
  if (config.databaseIds.sops) {
    console.log('🔗 Processing SOPs...\n');
    const sopWirings = await extractSOPWiring(config.databaseIds.sops);
    const { actions, missing } = resolveSOPRelations(sopWirings, playbookMap);

    for (const action of actions) {
      await applyWiringAction(action, config.dryRun);
      totalActions++;
    }
    allMissing.push(...missing);
    console.log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log('════════════════════════════════════════════════════════════════');
  console.log('                         SUMMARY                                ');
  console.log('════════════════════════════════════════════════════════════════\n');

  console.log(`Total wiring actions: ${totalActions}`);

  if (allMissing.length > 0) {
    console.log(`\n⚠️  Missing references (${allMissing.length}):\n`);
    for (const m of allMissing) {
      console.log(`   - "${m.source}" references ${m.type} "${m.reference}" (not found)`);
    }
  } else {
    console.log('\n✅ No missing references');
  }

  if (config.dryRun) {
    console.log('\n📝 This was a DRY-RUN. No changes were made to Notion.');
    console.log('   Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Wiring complete!');
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((error) => {
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
