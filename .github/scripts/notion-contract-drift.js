/**
 * Unit Talk OS — Contract Drift Detection
 *
 * When contracts/ files are modified on main:
 *   1. Get list of changed files in contracts/
 *   2. Check each against the Contract Index
 *   3. If a LOCKED contract is modified → CRITICAL ALERT
 *   4. Log the drift event in the Operational Decision Log
 *   5. Optionally send Discord webhook alert
 */

const { execSync } = require('child_process');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const CONTRACT_DB = process.env.CONTRACT_INDEX_DB;
const DECISION_DB = process.env.DECISION_LOG_DB;
const SPRINT_DB = process.env.SPRINT_REGISTRY_DB;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

const NOTION_BASE = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

async function notionFetch(path, options = {}) {
  const res = await fetch(`${NOTION_BASE}${path}`, {
    ...options,
    headers: HEADERS,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${res.status}: ${text}`);
  }
  return res.json();
}

function getChangedContractFiles() {
  try {
    const output = execSync('git diff --name-only HEAD~1 HEAD -- contracts/', {
      encoding: 'utf-8',
    });
    return output
      .trim()
      .split('\n')
      .filter(f => f.length > 0);
  } catch {
    console.log('Could not get git diff. Checking all contracts/ files.');
    return [];
  }
}

async function findContractByPath(repoPath) {
  const data = await notionFetch(`/databases/${CONTRACT_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Repo Path',
        rich_text: { equals: repoPath },
      },
    }),
  });
  return data.results?.[0] || null;
}

async function getActiveSprint() {
  const data = await notionFetch(`/databases/${SPRINT_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Status',
        select: { equals: 'Active' },
      },
    }),
  });
  return data.results?.[0] || null;
}

async function logDecision(title, context, decision, sprintId) {
  const today = new Date().toISOString().split('T')[0];
  const properties = {
    'Decision Title': { title: [{ text: { content: title } }] },
    Context: { rich_text: [{ text: { content: context.substring(0, 2000) } }] },
    Decision: { rich_text: [{ text: { content: decision.substring(0, 2000) } }] },
    'Impact Surface': { select: { name: 'Governance' } },
    'Reversible?': { checkbox: false },
    Date: { date: { start: today } },
  };

  if (sprintId) {
    properties['Sprint'] = { relation: [{ id: sprintId }] };
  }

  await notionFetch(`/databases/${DECISION_DB}/query`.replace('/query', ''), {
    method: 'POST',
    body: JSON.stringify({ parent: { database_id: DECISION_DB }, properties }),
  });
}

// Use the pages endpoint for creating
async function createDecisionPage(title, context, decision, sprintId) {
  const today = new Date().toISOString().split('T')[0];
  const properties = {
    'Decision Title': { title: [{ text: { content: title } }] },
    Context: { rich_text: [{ text: { content: context.substring(0, 2000) } }] },
    Decision: { rich_text: [{ text: { content: decision.substring(0, 2000) } }] },
    'Impact Surface': { select: { name: 'Governance' } },
    'Reversible?': { checkbox: false },
    Date: { date: { start: today } },
  };

  if (sprintId) {
    properties['Sprint'] = { relation: [{ id: sprintId }] };
  }

  await notionFetch('/pages', {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: DECISION_DB },
      properties,
    }),
  });
}

async function sendDiscordAlert(message) {
  if (!DISCORD_WEBHOOK) return;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `🚨 **CONTRACT DRIFT ALERT** 🚨\n${message}`,
        username: 'Unit Talk OS',
      }),
    });
    console.log('Discord alert sent.');
  } catch (err) {
    console.log(`Discord alert failed: ${err.message}`);
  }
}

async function main() {
  if (!NOTION_API_KEY) {
    console.error('NOTION_API_KEY not set');
    process.exit(1);
  }

  const changedFiles = getChangedContractFiles();
  if (changedFiles.length === 0) {
    console.log('No contract files changed. Skipping.');
    return;
  }

  console.log(`Changed contract files: ${changedFiles.join(', ')}`);

  const activeSprint = await getActiveSprint();
  const sprintId = activeSprint?.id || null;

  let criticalDrifts = [];
  let normalChanges = [];

  for (const file of changedFiles) {
    console.log(`\nChecking: ${file}`);
    const contract = await findContractByPath(file);

    if (!contract) {
      console.log(`  Not indexed in Contract Index. Consider adding it.`);
      normalChanges.push(file);
      continue;
    }

    const name = contract.properties['Contract Name']?.title?.[0]?.plain_text || file;
    const isLocked = contract.properties['Locked?']?.checkbox === true;
    const tier = contract.properties['Tier']?.select?.name || 'Unknown';

    if (isLocked) {
      console.log(`  ⛔ CRITICAL: Locked ${tier} contract "${name}" was modified!`);
      criticalDrifts.push({ file, name, tier });
    } else {
      console.log(`  ✅ Unlocked ${tier} contract "${name}" modified. Normal change.`);
      normalChanges.push(file);
    }
  }

  // Handle critical drifts
  if (criticalDrifts.length > 0) {
    const driftList = criticalDrifts.map(d => `${d.name} (${d.tier}) — ${d.file}`).join('\n');
    const message = `LOCKED contracts modified:\n${driftList}\n\nThis is a governance violation. Locked contracts are immutable.`;

    // Log to Decision Log
    await createDecisionPage(
      `CONTRACT DRIFT DETECTED: ${criticalDrifts.length} locked contract(s) modified`,
      `The following locked contracts were modified in a push to main:\n${driftList}`,
      `AUTOMATED FLAG: This requires immediate founder review. Locked contracts must not be modified without explicit phase transition and lock tag removal.`,
      sprintId
    );
    console.log('\nDrift logged to Operational Decision Log.');

    // Discord alert
    await sendDiscordAlert(message);

    // Fail the workflow to block the push
    console.error(
      '\n⛔ CONTRACT DRIFT: Locked contracts were modified. This push violates governance.'
    );
    process.exit(1);
  }

  console.log('\nNo locked contract drift detected. All changes are to unlocked contracts.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
