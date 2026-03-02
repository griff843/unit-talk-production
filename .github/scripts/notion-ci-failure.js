/**
 * Unit Talk OS — CI Failure → Sprint Blocked
 *
 * When CI fails on a branch:
 *   1. Find the sprint with matching Git Branch field
 *   2. Add a note about the failure
 *   3. If the sprint was Active, keep it Active but flag tasks
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const SPRINT_DB = process.env.SPRINT_REGISTRY_DB;
const TASK_DB = process.env.TASK_REGISTRY_DB;
const BRANCH_NAME = process.env.BRANCH_NAME;
const RUN_URL = process.env.RUN_URL;
const CONCLUSION = process.env.CONCLUSION;

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

async function findSprintByBranch(branch) {
  const data = await notionFetch(`/databases/${SPRINT_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Git Branch',
        rich_text: { equals: branch },
      },
    }),
  });
  return data.results?.[0] || null;
}

async function appendSprintNote(pageId, currentNotes, message) {
  const timestamp = new Date().toISOString().split('T')[0];
  const newNote = `[${timestamp}] CI FAILURE: ${message}`;
  const updatedNotes = currentNotes ? `${currentNotes}\n${newNote}` : newNote;

  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        Notes: { rich_text: [{ text: { content: updatedNotes.substring(0, 2000) } }] },
      },
    }),
  });
}

async function getTasksForSprint(sprintId) {
  const data = await notionFetch(`/databases/${TASK_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Sprint',
        relation: { contains: sprintId },
      },
    }),
  });
  return data.results || [];
}

async function flagTaskAsBlocked(pageId) {
  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'Blocked' } },
        'Blocking?': { checkbox: true },
      },
    }),
  });
}

async function main() {
  if (!NOTION_API_KEY) {
    console.error('NOTION_API_KEY not set');
    process.exit(1);
  }

  console.log(`CI failure detected on branch: ${BRANCH_NAME}`);
  console.log(`Conclusion: ${CONCLUSION}`);
  console.log(`Run URL: ${RUN_URL}`);

  // Find the sprint
  const sprint = await findSprintByBranch(BRANCH_NAME);
  if (!sprint) {
    console.log(`No sprint found with Git Branch = "${BRANCH_NAME}". Skipping.`);
    return;
  }

  const sprintTitle = sprint.properties['Sprint ID']?.title?.[0]?.plain_text || sprint.id;
  const currentNotes = sprint.properties['Notes']?.rich_text?.[0]?.plain_text || '';
  console.log(`Found sprint: "${sprintTitle}" (${sprint.id})`);

  // Append failure note to sprint
  await appendSprintNote(
    sprint.id,
    currentNotes,
    `Branch ${BRANCH_NAME} failed CI. See: ${RUN_URL}`
  );
  console.log('Sprint notes updated with CI failure.');

  // Get active tasks and flag them as blocked
  const tasks = await getTasksForSprint(sprint.id);
  const activeTasks = tasks.filter(t => t.properties['Status']?.select?.name === 'Active');

  console.log(`Found ${activeTasks.length} active tasks to flag as blocked.`);

  for (const task of activeTasks) {
    const taskTitle = task.properties['Task Title']?.title?.[0]?.plain_text || task.id;
    await flagTaskAsBlocked(task.id);
    console.log(`  Blocked: "${taskTitle}"`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
