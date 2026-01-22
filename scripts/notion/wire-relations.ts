#!/usr/bin/env npx tsx
/**
 * Notion Relation Wiring Script
 *
 * Automatically wires relations between Notion databases based on "wiring fields".
 * Reads comma-separated IDs from rich text properties and creates proper relations.
 *
 * This script wires relations ONLY; it does not create data.
 *
 * Usage:
 *   npx tsx scripts/notion/wire-relations.ts --dry-run  # Preview changes
 *   npx tsx scripts/notion/wire-relations.ts            # Execute wiring
 *
 * @author Platform Engineering
 * @version 2.2.0
 */

import { Client } from '@notionhq/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================================
// Default Database IDs (from AUTHORITATIVE configuration)
// ============================================================================

const DEFAULT_DB_IDS = {
  features: '2ef5f8bee34480b59181e4650cf9aa02',
  agents: '2ef5f8bee34480eba23ce234f46ba192',
  sops: '2ef5f8bee34480f0855ef08dea2ffe52',
  playbooks: '2ef5f8bee3448082aae2c53e35f69a7c',
};

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
    console.error('ERROR: NOTION_TOKEN is not set.');
    console.error('Set NOTION_TOKEN in .env.local or as an environment variable.');
    process.exit(1);
  }

  const databaseIds = {
    features: process.env.NOTION_DB_FEATURES || DEFAULT_DB_IDS.features,
    agents: process.env.NOTION_DB_AGENTS || DEFAULT_DB_IDS.agents,
    sops: process.env.NOTION_DB_SOPS || DEFAULT_DB_IDS.sops,
    playbooks: process.env.NOTION_DB_PLAYBOOKS || DEFAULT_DB_IDS.playbooks,
  };

  const dryRun = process.argv.includes('--dry-run');

  return { notionToken, databaseIds, dryRun };
}

// ============================================================================
// Types
// ============================================================================

interface PageInfo {
  id: string;
  title: string;
  customId: string;
  normalizedTitle: string;
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

interface Stats {
  featuresProcessed: number;
  agentsProcessed: number;
  sopsProcessed: number;
  playbooksProcessed: number;
  relationsWritten: number;
  relationsSkipped: number;
  missingReferences: number;
}

// ============================================================================
// Notion Client
// ============================================================================

let notion: Client;

async function initNotionClient(token: string): Promise<void> {
  notion = new Client({ auth: token });

  try {
    await notion.users.me({});
    console.log('Connected to Notion API');
  } catch (error: any) {
    console.error(`Failed to connect to Notion: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// Database ID Resolution
// ============================================================================

interface ChildDatabase {
  id: string;
  title: string;
}

/** Fetches all child databases from a page block with pagination */
async function fetchChildDatabases(pageId: string): Promise<ChildDatabase[]> {
  const childDatabases: ChildDatabase[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: startCursor,
      page_size: 100,
    });

    for (const block of response.results) {
      if ('type' in block && block.type === 'child_database') {
        const dbBlock = block as any;
        childDatabases.push({ id: block.id, title: dbBlock.child_database?.title || '' });
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  return childDatabases;
}

/** Matches a database by title (exact or partial) */
function matchDatabaseByTitle(
  databases: ChildDatabase[],
  expectedTitle: string
): ChildDatabase | undefined {
  const normalized = expectedTitle.toLowerCase().trim();

  // Exact match first
  const exact = databases.find((db) => db.title.toLowerCase().trim() === normalized);
  if (exact) return exact;

  // Partial match fallback
  return databases.find(
    (db) =>
      db.title.toLowerCase().trim().includes(normalized) ||
      normalized.includes(db.title.toLowerCase().trim())
  );
}

/** Throws a fatal error when no inline database is found */
function throwNoDatabaseError(pageId: string): never {
  throw new Error(
    `FATAL: No inline database found in page ${pageId}.\n` +
      `To fix: Open the database in Notion, click "..." → "Copy link to view", extract the ID.`
  );
}

/** Throws a fatal error when multiple databases exist but none match */
function throwMultipleDatabasesError(pageId: string, databases: ChildDatabase[], expected: string): never {
  const dbList = databases.map((db) => `  - "${db.title}" (${db.id})`).join('\n');
  throw new Error(
    `FATAL: Multiple inline databases in page ${pageId}, none match "${expected}".\n${dbList}`
  );
}

/**
 * Resolves an input ID to a valid database ID.
 * Handles both direct database IDs and page IDs containing inline databases.
 */
// eslint-disable-next-line max-lines-per-function
async function resolveDatabaseId(inputId: string, expectedTitle?: string): Promise<string> {
  // Try to retrieve as a database directly
  try {
    await notion.databases.retrieve({ database_id: inputId });
    return inputId;
  } catch (error: any) {
    const msg = error?.body?.message || error?.message || '';
    if (!msg.includes('is a page, not a database')) throw error;
    // eslint-disable-next-line no-console
    console.log(`   ID ${inputId} is a page. Searching for inline database...`);
  }

  const childDatabases = await fetchChildDatabases(inputId);
  if (childDatabases.length === 0) throwNoDatabaseError(inputId);

  // Match by title if expected
  if (expectedTitle) {
    const match = matchDatabaseByTitle(childDatabases, expectedTitle);
    if (match) {
      const matchType = match.title.toLowerCase().trim() === expectedTitle.toLowerCase().trim() ? '' : ' via partial match';
      // eslint-disable-next-line no-console
      console.log(`   Found inline database "${match.title}" (${match.id})${matchType}`);
      return match.id;
    }
  }

  // Single database - use it
  if (childDatabases.length === 1) {
    // eslint-disable-next-line no-console
    console.log(`   Found single inline database "${childDatabases[0].title}" (${childDatabases[0].id})`);
    return childDatabases[0].id;
  }

  // Multiple databases, no match - fatal
  throwMultipleDatabasesError(inputId, childDatabases, expectedTitle || '(none)');
}

// ============================================================================
// Database Title Verification (Fail-Closed Guard)
// ============================================================================

interface VerifiedDatabase {
  id: string;
  title: string;
  expectedTitle: string;
}

/**
 * Retrieves database metadata and verifies its title matches expected.
 * FAIL-CLOSED: Throws fatal error if title does not match, preventing incorrect wiring.
 *
 * @param databaseId - The resolved database ID
 * @param expectedTitle - The expected database title
 * @returns Verified database info
 * @throws Error if title does not match expected
 */
async function verifyDatabaseTitle(
  databaseId: string,
  expectedTitle: string
): Promise<VerifiedDatabase> {
  const db = await notion.databases.retrieve({ database_id: databaseId });

  // Extract title from database object
  let actualTitle = '';
  if ('title' in db && Array.isArray(db.title)) {
    actualTitle = db.title.map((t: any) => t.plain_text).join('');
  }

  const normalizedActual = actualTitle.toLowerCase().trim();
  const normalizedExpected = expectedTitle.toLowerCase().trim();

  // Exact match
  if (normalizedActual === normalizedExpected) {
    return { id: databaseId, title: actualTitle, expectedTitle };
  }

  // Partial match (e.g., "Feature Registry" contains "feature")
  if (
    normalizedActual.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedActual)
  ) {
    console.log(`   WARN: Title "${actualTitle}" partially matches expected "${expectedTitle}"`);
    return { id: databaseId, title: actualTitle, expectedTitle };
  }

  // FAIL-CLOSED: No match - abort before any writes
  throw new Error(
    `FATAL: Database title mismatch (FAIL-CLOSED GUARD).\n` +
      `  Database ID: ${databaseId}\n` +
      `  Actual title: "${actualTitle}"\n` +
      `  Expected title: "${expectedTitle}"\n` +
      `\nThis guard prevents wiring to the wrong database.\n` +
      `To fix: Verify the configured ID points to the correct database.`
  );
}

// ============================================================================
// Database Query Helpers
// ============================================================================

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

function extractRichText(property: any): string {
  if (!property || property.type !== 'rich_text') return '';
  return property.rich_text.map((t: any) => t.plain_text).join('');
}

function extractTitle(property: any): string {
  if (!property || property.type !== 'title') return '';
  return property.title.map((t: any) => t.plain_text).join('');
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().trim();
}

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

async function loadFeatureRegistry(dbId: string): Promise<{
  byId: Map<string, PageInfo>;
  byNormalizedTitle: Map<string, PageInfo>;
  count: number;
}> {
  console.log('Loading Feature Registry...');
  const pages = await queryAllPages(dbId);
  const byId = new Map<string, PageInfo>();
  const byNormalizedTitle = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Feature Name']);
    const customId = extractRichText(props['Feature ID']);
    const normalizedTitle = normalizeTitle(title);

    const info: PageInfo = { id: page.id, title, customId, normalizedTitle };

    if (customId) {
      byId.set(customId, info);
    }
    if (normalizedTitle) {
      byNormalizedTitle.set(normalizedTitle, info);
    }
  }

  console.log(`   Found ${pages.length} features`);
  return { byId, byNormalizedTitle, count: pages.length };
}

async function loadAgentRegistry(dbId: string): Promise<{
  byId: Map<string, PageInfo>;
  byNormalizedTitle: Map<string, PageInfo>;
  count: number;
}> {
  console.log('Loading Agent Registry...');
  const pages = await queryAllPages(dbId);
  const byId = new Map<string, PageInfo>();
  const byNormalizedTitle = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Agent Name']);
    const customId = extractRichText(props['Agent ID']);
    const normalizedTitle = normalizeTitle(title);

    const info: PageInfo = { id: page.id, title, customId, normalizedTitle };

    if (customId) {
      byId.set(customId, info);
    }
    if (normalizedTitle) {
      byNormalizedTitle.set(normalizedTitle, info);
    }
  }

  console.log(`   Found ${pages.length} agents`);
  return { byId, byNormalizedTitle, count: pages.length };
}

async function loadSOPs(dbId: string): Promise<{
  byId: Map<string, PageInfo>;
  byNormalizedTitle: Map<string, PageInfo>;
  count: number;
}> {
  console.log('Loading SOP Library...');
  const pages = await queryAllPages(dbId);
  const byId = new Map<string, PageInfo>();
  const byNormalizedTitle = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['SOP Title']);
    const customId = extractRichText(props['SOP ID']);
    const normalizedTitle = normalizeTitle(title);

    const info: PageInfo = { id: page.id, title, customId, normalizedTitle };

    if (customId) {
      byId.set(customId, info);
    }
    if (normalizedTitle) {
      byNormalizedTitle.set(normalizedTitle, info);
    }
  }

  console.log(`   Found ${pages.length} SOPs`);
  return { byId, byNormalizedTitle, count: pages.length };
}

async function loadPlaybooks(dbId: string): Promise<{
  byId: Map<string, PageInfo>;
  byNormalizedTitle: Map<string, PageInfo>;
  count: number;
}> {
  console.log('Loading Playbooks...');
  const pages = await queryAllPages(dbId);
  const byId = new Map<string, PageInfo>();
  const byNormalizedTitle = new Map<string, PageInfo>();

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Playbook Title']);
    const customId = extractRichText(props['Playbook ID']);
    const normalizedTitle = normalizeTitle(title);

    const info: PageInfo = { id: page.id, title, customId, normalizedTitle };

    if (customId) {
      byId.set(customId, info);
    }
    if (normalizedTitle) {
      byNormalizedTitle.set(normalizedTitle, info);
    }
  }

  console.log(`   Found ${pages.length} playbooks`);
  return { byId, byNormalizedTitle, count: pages.length };
}

// ============================================================================
// Lookup Helper
// ============================================================================

function lookupPage(
  reference: string,
  byId: Map<string, PageInfo>,
  byNormalizedTitle: Map<string, PageInfo>
): PageInfo | undefined {
  // First try exact ID match (preferred)
  const byIdMatch = byId.get(reference);
  if (byIdMatch) return byIdMatch;

  // Then try normalized title match
  const normalized = normalizeTitle(reference);
  return byNormalizedTitle.get(normalized);
}

// ============================================================================
// Wiring Data Extraction
// ============================================================================

async function extractFeatureWiring(dbId: string): Promise<WiringData[]> {
  const pages = await queryAllPages(dbId);
  const results: WiringData[] = [];

  for (const page of pages) {
    const props = page.properties;
    const title = extractTitle(props['Feature Name']);

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
  sopLookup: { byId: Map<string, PageInfo>; byNormalizedTitle: Map<string, PageInfo> },
  agentLookup: { byId: Map<string, PageInfo>; byNormalizedTitle: Map<string, PageInfo> },
  featureLookup: { byId: Map<string, PageInfo>; byNormalizedTitle: Map<string, PageInfo> }
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    // Feature -> SOPs
    if (wiring.sopIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];
      let allResolved = true;

      for (const sopId of wiring.sopIds) {
        const sop = lookupPage(sopId, sopLookup.byId, sopLookup.byNormalizedTitle);
        if (sop) {
          targetIds.push(sop.id);
          targetTitles.push(sop.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'SOP', reference: sopId });
          allResolved = false;
        }
      }

      // Only wire if ALL references resolved (no partial wiring)
      if (allResolved && targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Related SOPs',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }

    // Feature -> Agents
    if (wiring.agentNames.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];
      let allResolved = true;

      for (const agentName of wiring.agentNames) {
        const agent = lookupPage(agentName, agentLookup.byId, agentLookup.byNormalizedTitle);
        if (agent) {
          targetIds.push(agent.id);
          targetTitles.push(agent.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Agent', reference: agentName });
          allResolved = false;
        }
      }

      if (allResolved && targetIds.length > 0) {
        actions.push({
          source: { pageId: wiring.pageId, title: wiring.pageTitle },
          relationProperty: 'Agent Owner',
          targetPageIds: targetIds,
          targetTitles,
        });
      }
    }

    // Feature -> Features (Dependencies)
    if (wiring.dependsOn.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];
      let allResolved = true;

      for (const featId of wiring.dependsOn) {
        const feat = lookupPage(featId, featureLookup.byId, featureLookup.byNormalizedTitle);
        if (feat) {
          targetIds.push(feat.id);
          targetTitles.push(feat.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Feature', reference: featId });
          allResolved = false;
        }
      }

      if (allResolved && targetIds.length > 0) {
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
  sopLookup: { byId: Map<string, PageInfo>; byNormalizedTitle: Map<string, PageInfo> }
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    if (wiring.sopIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];
      let allResolved = true;

      for (const sopId of wiring.sopIds) {
        const sop = lookupPage(sopId, sopLookup.byId, sopLookup.byNormalizedTitle);
        if (sop) {
          targetIds.push(sop.id);
          targetTitles.push(sop.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'SOP', reference: sopId });
          allResolved = false;
        }
      }

      if (allResolved && targetIds.length > 0) {
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
  playbookLookup: { byId: Map<string, PageInfo>; byNormalizedTitle: Map<string, PageInfo> }
): ResolutionResult {
  const actions: WiringAction[] = [];
  const missing: { source: string; type: string; reference: string }[] = [];

  for (const wiring of wirings) {
    if (wiring.playbookIds.length > 0) {
      const targetIds: string[] = [];
      const targetTitles: string[] = [];
      let allResolved = true;

      for (const pbId of wiring.playbookIds) {
        const pb = lookupPage(pbId, playbookLookup.byId, playbookLookup.byNormalizedTitle);
        if (pb) {
          targetIds.push(pb.id);
          targetTitles.push(pb.title);
        } else {
          missing.push({ source: wiring.pageTitle, type: 'Playbook', reference: pbId });
          allResolved = false;
        }
      }

      if (allResolved && targetIds.length > 0) {
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
// Relation Writing (SET behavior - replaces existing relations)
// ============================================================================

async function applyWiringAction(
  action: WiringAction,
  dryRun: boolean,
  stats: Stats
): Promise<void> {
  const targetList = action.targetTitles.join(', ');

  if (dryRun) {
    console.log(
      `   [DRY-RUN] Would SET "${action.source.title}" -> ${action.relationProperty} -> [${targetList}]`
    );
    stats.relationsWritten++;
    return;
  }

  try {
    // SET behavior: replace the entire relation with the wiring field values
    await notion.pages.update({
      page_id: action.source.pageId,
      properties: {
        [action.relationProperty]: {
          relation: action.targetPageIds.map((id) => ({ id })),
        },
      },
    });

    console.log(`   SET "${action.source.title}" -> ${action.relationProperty} -> [${targetList}]`);
    stats.relationsWritten++;
  } catch (error: any) {
    console.error(
      `   FAILED "${action.source.title}" -> ${action.relationProperty}: ${error.message}`
    );
  }
}

// ============================================================================
// Main Orchestration
// ============================================================================

async function main(): Promise<void> {
  console.log('================================================================');
  console.log('       Notion Relation Wiring Script v2.2.0');
  console.log('       This script wires relations ONLY; it does not create');
  console.log('       data. All operations are idempotent and safe to re-run.');
  console.log('================================================================');
  console.log('');

  const config = loadConfig();
  const stats: Stats = {
    featuresProcessed: 0,
    agentsProcessed: 0,
    sopsProcessed: 0,
    playbooksProcessed: 0,
    relationsWritten: 0,
    relationsSkipped: 0,
    missingReferences: 0,
  };

  if (config.dryRun) {
    console.log('MODE: DRY-RUN (no changes will be made to Notion)\n');
  } else {
    console.log('MODE: EXECUTE (will update Notion relations)\n');
  }

  // Display configured input IDs
  console.log('Configured IDs (may be page or database IDs):');
  console.log(`   Features:  ${config.databaseIds.features}`);
  console.log(`   Agents:    ${config.databaseIds.agents}`);
  console.log(`   SOPs:      ${config.databaseIds.sops}`);
  console.log(`   Playbooks: ${config.databaseIds.playbooks}`);
  console.log('');

  await initNotionClient(config.notionToken);
  console.log('');

  // -------------------------------------------------------------------------
  // Step 0: Resolve database IDs (handles page IDs with inline databases)
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 0: Resolving database IDs');
  console.log('================================================================\n');

  console.log('Resolving Features database...');
  const featuresDbId = await resolveDatabaseId(config.databaseIds.features, 'Feature Registry');

  console.log('Resolving Agents database...');
  const agentsDbId = await resolveDatabaseId(config.databaseIds.agents, 'Agent Registry');

  console.log('Resolving SOPs database...');
  const sopsDbId = await resolveDatabaseId(config.databaseIds.sops, 'SOP Library');

  console.log('Resolving Playbooks database...');
  const playbooksDbId = await resolveDatabaseId(config.databaseIds.playbooks, 'Playbooks');

  console.log('');
  console.log('Resolved Database IDs:');
  console.log(`   Features:  ${featuresDbId}`);
  console.log(`   Agents:    ${agentsDbId}`);
  console.log(`   SOPs:      ${sopsDbId}`);
  console.log(`   Playbooks: ${playbooksDbId}`);
  console.log('');

  // -------------------------------------------------------------------------
  // Step 0b: Verify database titles (FAIL-CLOSED GUARD)
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 0b: Verifying database titles (fail-closed guard)');
  console.log('================================================================\n');

  const verifiedDbs: VerifiedDatabase[] = [];

  console.log('Verifying Features database title...');
  verifiedDbs.push(await verifyDatabaseTitle(featuresDbId, 'Feature Registry'));
  console.log(`   ✓ Verified: "${verifiedDbs[0].title}"`);

  console.log('Verifying Agents database title...');
  verifiedDbs.push(await verifyDatabaseTitle(agentsDbId, 'Agent Registry'));
  console.log(`   ✓ Verified: "${verifiedDbs[1].title}"`);

  console.log('Verifying SOPs database title...');
  verifiedDbs.push(await verifyDatabaseTitle(sopsDbId, 'SOP Library'));
  console.log(`   ✓ Verified: "${verifiedDbs[2].title}"`);

  console.log('Verifying Playbooks database title...');
  verifiedDbs.push(await verifyDatabaseTitle(playbooksDbId, 'Playbooks'));
  console.log(`   ✓ Verified: "${verifiedDbs[3].title}"`);

  console.log('');
  console.log('All database titles verified. Proceeding with wiring.');
  console.log('');

  // -------------------------------------------------------------------------
  // Step 1: Load all databases into lookup maps
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 1: Loading database indexes');
  console.log('================================================================\n');

  const featureLookup = await loadFeatureRegistry(featuresDbId);
  const agentLookup = await loadAgentRegistry(agentsDbId);
  const sopLookup = await loadSOPs(sopsDbId);
  const playbookLookup = await loadPlaybooks(playbooksDbId);

  stats.featuresProcessed = featureLookup.count;
  stats.agentsProcessed = agentLookup.count;
  stats.sopsProcessed = sopLookup.count;
  stats.playbooksProcessed = playbookLookup.count;

  console.log('');

  const allMissing: { source: string; type: string; reference: string }[] = [];

  // -------------------------------------------------------------------------
  // Step 2a: Feature -> SOPs
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 2a: Wiring Feature Registry -> SOPs');
  console.log('================================================================\n');

  const featureWirings = await extractFeatureWiring(featuresDbId);
  const featureResolution = resolveFeatureRelations(
    featureWirings,
    sopLookup,
    agentLookup,
    featureLookup
  );

  // Filter to only SOP-related actions for this step
  const sopActions = featureResolution.actions.filter((a) => a.relationProperty === 'Related SOPs');
  for (const action of sopActions) {
    await applyWiringAction(action, config.dryRun, stats);
  }
  allMissing.push(...featureResolution.missing.filter((m) => m.type === 'SOP'));
  console.log('');

  // -------------------------------------------------------------------------
  // Step 2b: Feature -> Agents
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 2b: Wiring Feature Registry -> Agent Registry');
  console.log('================================================================\n');

  const agentActions = featureResolution.actions.filter((a) => a.relationProperty === 'Agent Owner');
  for (const action of agentActions) {
    await applyWiringAction(action, config.dryRun, stats);
  }
  allMissing.push(...featureResolution.missing.filter((m) => m.type === 'Agent'));
  console.log('');

  // -------------------------------------------------------------------------
  // Step 2c: Feature -> Feature (Dependencies)
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 2c: Wiring Feature Registry -> Feature Registry (Dependencies)');
  console.log('================================================================\n');

  const depActions = featureResolution.actions.filter((a) => a.relationProperty === 'Dependencies');
  for (const action of depActions) {
    await applyWiringAction(action, config.dryRun, stats);
  }
  allMissing.push(...featureResolution.missing.filter((m) => m.type === 'Feature'));
  console.log('');

  // -------------------------------------------------------------------------
  // Step 2d: Agent -> SOPs
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 2d: Wiring Agent Registry -> SOPs');
  console.log('================================================================\n');

  const agentWirings = await extractAgentWiring(agentsDbId);
  const agentResolution = resolveAgentRelations(agentWirings, sopLookup);

  for (const action of agentResolution.actions) {
    await applyWiringAction(action, config.dryRun, stats);
  }
  allMissing.push(...agentResolution.missing);
  console.log('');

  // -------------------------------------------------------------------------
  // Step 2e: SOP -> Playbooks
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('STEP 2e: Wiring SOP Library -> Playbooks');
  console.log('================================================================\n');

  const sopWirings = await extractSOPWiring(sopsDbId);
  const sopResolution = resolveSOPRelations(sopWirings, playbookLookup);

  for (const action of sopResolution.actions) {
    await applyWiringAction(action, config.dryRun, stats);
  }
  allMissing.push(...sopResolution.missing);
  console.log('');

  stats.missingReferences = allMissing.length;

  // -------------------------------------------------------------------------
  // Final Summary
  // -------------------------------------------------------------------------
  console.log('================================================================');
  console.log('                        FINAL SUMMARY');
  console.log('================================================================\n');

  console.log('Rows Processed:');
  console.log(`   Features:  ${stats.featuresProcessed}`);
  console.log(`   Agents:    ${stats.agentsProcessed}`);
  console.log(`   SOPs:      ${stats.sopsProcessed}`);
  console.log(`   Playbooks: ${stats.playbooksProcessed}`);
  console.log('');

  console.log('Relations:');
  console.log(`   Written:   ${stats.relationsWritten}`);
  console.log(`   Skipped:   ${stats.relationsSkipped} (no wiring data)`);
  console.log('');

  if (allMissing.length > 0) {
    console.log(`Missing References (${allMissing.length}):\n`);
    for (const m of allMissing) {
      console.log(`   WARNING: "${m.source}" references ${m.type} "${m.reference}" -> NOT FOUND`);
    }
    console.log('');
    console.log('   These references could not be resolved. Check that:');
    console.log('   1. The referenced ID/name exists in the target database');
    console.log('   2. The ID matches exactly (case-sensitive for IDs like SOP-001)');
    console.log('   3. If using names, they match when lowercased and trimmed');
    console.log('');
  } else {
    console.log('No missing references - all wiring data resolved successfully\n');
  }

  if (config.dryRun) {
    console.log('================================================================');
    console.log('DRY-RUN COMPLETE - No changes were made to Notion.');
    console.log('Run without --dry-run to apply changes.');
    console.log('================================================================');
  } else {
    console.log('================================================================');
    console.log('WIRING COMPLETE - Relations have been updated in Notion.');
    console.log('This script is idempotent and safe to re-run at any time.');
    console.log('================================================================');
  }
}

// ============================================================================
// Entry Point
// ============================================================================

main().catch((error) => {
  console.error('\nFatal error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
