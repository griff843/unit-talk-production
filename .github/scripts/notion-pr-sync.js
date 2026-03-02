/**
 * Unit Talk OS — PR → Task Status Sync
 *
 * Maps PR events to Notion Task Registry status updates:
 *   PR Opened/Reopened → Task Status = Active
 *   PR Merged          → Task Status = Awaiting Proof
 *   PR Closed (no merge)→ Task Status = Blocked
 *
 * Task matching:
 *   1. Looks for "Notion-Task: <url>" in PR body
 *   2. Falls back to matching PR title against Task Titles in the registry
 */

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const TASK_DB = process.env.TASK_REGISTRY_DB;
const PR_ACTION = process.env.PR_ACTION;
const PR_MERGED = process.env.PR_MERGED === 'true';
const PR_TITLE = process.env.PR_TITLE;
const PR_URL = process.env.PR_URL;
const PR_BODY = process.env.PR_BODY || '';

const NOTION_BASE = 'https://api.notion.com/v1';
const HEADERS = {
  Authorization: `Bearer ${NOTION_API_KEY}`,
  'Notion-Version': '2022-06-28',
  'Content-Type': 'application/json',
};

function getTargetStatus() {
  if (PR_ACTION === 'closed' && PR_MERGED) return 'Awaiting Proof';
  if (PR_ACTION === 'closed' && !PR_MERGED) return 'Blocked';
  return 'Active'; // opened or reopened
}

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

async function findTaskByUrl() {
  const match = PR_BODY.match(/Notion-Task:\s*(https:\/\/www\.notion\.so\/\S+)/i);
  if (!match) return null;

  const url = match[1];
  // Extract page ID from URL (last 32 hex chars)
  const idMatch = url.match(/([a-f0-9]{32})$/);
  if (!idMatch) return null;

  const rawId = idMatch[1];
  const pageId = `${rawId.slice(0, 8)}-${rawId.slice(8, 12)}-${rawId.slice(12, 16)}-${rawId.slice(16, 20)}-${rawId.slice(20)}`;

  try {
    const page = await notionFetch(`/pages/${pageId}`);
    return page;
  } catch {
    console.log(`Could not fetch page ${pageId} from PR body link`);
    return null;
  }
}

async function findTaskByTitle() {
  const data = await notionFetch(`/databases/${TASK_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Task Title',
        title: { contains: PR_TITLE.substring(0, 50) },
      },
    }),
  });

  if (data.results && data.results.length > 0) {
    return data.results[0];
  }
  return null;
}

async function updateTaskStatus(pageId, status) {
  const updates = {
    properties: {
      Status: { select: { name: status } },
    },
  };

  // Also set the Git PR Link if not already set
  if (PR_URL) {
    updates.properties['Git PR Link'] = { url: PR_URL };
  }

  await notionFetch(`/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

async function main() {
  if (!NOTION_API_KEY) {
    console.error('NOTION_API_KEY not set');
    process.exit(1);
  }

  const status = getTargetStatus();
  console.log(`PR Action: ${PR_ACTION}, Merged: ${PR_MERGED} → Target Status: ${status}`);
  console.log(`PR Title: ${PR_TITLE}`);

  // Try to find the task
  let task = await findTaskByUrl();
  if (!task) {
    console.log('No Notion-Task link in PR body, searching by title...');
    task = await findTaskByTitle();
  }

  if (!task) {
    console.log('No matching task found in Task Registry. Skipping.');
    return;
  }

  const taskTitle = task.properties['Task Title']?.title?.[0]?.plain_text || task.id;
  console.log(`Found task: "${taskTitle}" (${task.id})`);
  console.log(`Updating status to: ${status}`);

  await updateTaskStatus(task.id, status);
  console.log('Task updated successfully.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
