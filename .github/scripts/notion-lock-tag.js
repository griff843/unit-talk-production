/**
 * Unit Talk OS — Lock Tag → Sprint Locked
 *
 * When a LOCK-* tag is pushed:
 *   1. Find the sprint with matching Lock Tag field
 *   2. Set Sprint Status = Locked
 *   3. Check if ALL sprints for that phase are now locked
 *   4. If yes, set Phase Status = Locked
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SPRINT_DB = process.env.SPRINT_REGISTRY_DB;
const PHASE_DB = process.env.PHASE_REGISTRY_DB;
const TAG_NAME = process.env.TAG_NAME;

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

async function findSprintByLockTag(tag) {
  const data = await notionFetch(`/databases/${SPRINT_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Lock Tag',
        rich_text: { equals: tag },
      },
    }),
  });
  return data.results?.[0] || null;
}

async function lockSprint(pageId) {
  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'Locked' } },
      },
    }),
  });
}

async function getPhaseFromSprint(sprint) {
  const phaseRelation = sprint.properties['Phase']?.relation;
  if (!phaseRelation || phaseRelation.length === 0) return null;
  return phaseRelation[0].id;
}

async function getAllSprintsForPhase(phaseId) {
  const data = await notionFetch(`/databases/${SPRINT_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Phase',
        relation: { contains: phaseId },
      },
    }),
  });
  return data.results || [];
}

async function lockPhase(phaseId) {
  await notionFetch(`/pages/${phaseId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'Locked' } },
      },
    }),
  });
}

async function main() {
  if (!NOTION_API_KEY) {
    console.error('NOTION_API_KEY not set');
    process.exit(1);
  }

  console.log(`Lock tag detected: ${TAG_NAME}`);

  // Find the sprint
  const sprint = await findSprintByLockTag(TAG_NAME);
  if (!sprint) {
    console.log(`No sprint found with Lock Tag = "${TAG_NAME}". Skipping.`);
    return;
  }

  const sprintTitle = sprint.properties['Sprint ID']?.title?.[0]?.plain_text || sprint.id;
  console.log(`Found sprint: "${sprintTitle}" (${sprint.id})`);

  // Lock the sprint
  await lockSprint(sprint.id);
  console.log(`Sprint "${sprintTitle}" locked.`);

  // Check phase cascade
  const phaseId = await getPhaseFromSprint(sprint);
  if (!phaseId) {
    console.log('No phase linked to this sprint. Done.');
    return;
  }

  console.log(`Checking phase cascade for phase ${phaseId}...`);
  const allSprints = await getAllSprintsForPhase(phaseId);
  const allLocked = allSprints.every(s => s.properties['Status']?.select?.name === 'Locked');

  if (allLocked) {
    console.log(`All ${allSprints.length} sprints for this phase are locked. Locking phase...`);
    await lockPhase(phaseId);
    console.log('Phase locked.');
  } else {
    const lockedCount = allSprints.filter(
      s => s.properties['Status']?.select?.name === 'Locked'
    ).length;
    console.log(`${lockedCount}/${allSprints.length} sprints locked. Phase remains active.`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
