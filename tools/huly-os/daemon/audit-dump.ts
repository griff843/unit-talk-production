#!/usr/bin/env tsx
// SPRINT-HULY-WORKSPACE-AUDIT-BOOTSTRAP-015B: One-shot audit dump
// Dumps all issues (with space/project metadata) and all documents to JSON.

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { config as loadDotenv } from 'dotenv';

loadDotenv({ path: resolve(import.meta.dirname ?? '.', '..', '.env') });

const BASE_URL = (process.env.HULY_URL ?? 'http://localhost:8087').replace(/\/$/, '');
const EMAIL = process.env.HULY_EMAIL ?? 'user1@example.com';
const PASSWORD = process.env.HULY_PASSWORD ?? '1234';
const WORKSPACE = process.env.HULY_WORKSPACE ?? 'ws1';

interface Session {
  token: string;
  workspaceId: string;
  socialId: string;
}

async function connect(): Promise<Session> {
  const loginRes = await fetch(`${BASE_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'login', params: { email: EMAIL, password: PASSWORD } }),
  });
  const loginBody = (await loginRes.json()) as any;
  if (loginBody.error) throw new Error(`Login failed: ${loginBody.error.code}`);
  const accountToken = loginBody.result.token;
  const socialId = String(loginBody.result.socialId ?? '');

  const wsRes = await fetch(`${BASE_URL}/_accounts/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accountToken}` },
    body: JSON.stringify({ method: 'selectWorkspace', params: { workspaceUrl: WORKSPACE } }),
  });
  const wsBody = (await wsRes.json()) as any;
  if (wsBody.error) throw new Error(`selectWorkspace failed: ${wsBody.error.code}`);

  return {
    token: wsBody.result.token,
    workspaceId: wsBody.result.workspace,
    socialId,
  };
}

async function findAll(session: Session, cls: string, limit = 500): Promise<any[]> {
  const opts = JSON.stringify({ limit });
  const url =
    `${BASE_URL}/_transactor/api/v1/find-all/${session.workspaceId}` +
    `?class=${encodeURIComponent(cls)}&options=${encodeURIComponent(opts)}`;

  const res = await fetch(url, { headers: { Authorization: `Bearer ${session.token}` } });
  if (!res.ok) throw new Error(`findAll(${cls}) HTTP ${res.status}`);

  const body = await res.json();
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.value)) return body.value;
  if (Array.isArray(body?.docs)) return body.docs;
  if (Array.isArray(body?.result)) return body.result;
  return [];
}

async function main(): Promise<void> {
  const outDir = process.argv[2] || 'out/audit/huly-reality-audit-dump';
  mkdirSync(outDir, { recursive: true });

  console.log('[audit] Connecting to Huly...');
  const session = await connect();
  console.log(`[audit] Connected. workspace=${session.workspaceId}`);

  // 1. All issues with raw fields
  console.log('[audit] Fetching all issues...');
  const rawIssues = await findAll(session, 'tracker:class:Issue');
  const issues = rawIssues.map((r: any) => ({
    _id: r._id,
    identifier: r.identifier ?? '',
    title: r.title ?? '',
    status: r.status ?? '',
    space: r.space ?? '',
    _class: r._class ?? '',
    description: r.description ? String(r.description).slice(0, 200) : null,
    priority: r.priority ?? null,
    modifiedOn: r.modifiedOn ?? 0,
    createdOn: r.createdOn ?? r.createdDate ?? 0,
  }));
  writeFileSync(`${outDir}/issues.json`, JSON.stringify(issues, null, 2));
  console.log(`[audit] Issues: ${issues.length} written to issues.json`);

  // Categorize by space
  const bySpace = new Map<string, number>();
  for (const i of issues) {
    bySpace.set(i.space, (bySpace.get(i.space) ?? 0) + 1);
  }
  console.log('[audit] Issues by space:');
  for (const [space, count] of bySpace) {
    console.log(`  ${space}: ${count}`);
  }

  // 2. All documents
  console.log('\n[audit] Fetching all documents...');
  const rawDocs = await findAll(session, 'document:class:Document');
  const docs = rawDocs.map((r: any) => ({
    _id: r._id,
    title: r.title ?? '',
    space: r.space ?? '',
    _class: r._class ?? '',
    content: r.content ? String(r.content).slice(0, 200) : null,
    modifiedOn: r.modifiedOn ?? 0,
  }));
  writeFileSync(`${outDir}/docs.json`, JSON.stringify(docs, null, 2));
  console.log(`[audit] Documents: ${docs.length} written to docs.json`);

  // Categorize docs by space
  const docsBySpace = new Map<string, number>();
  for (const d of docs) {
    docsBySpace.set(d.space, (docsBySpace.get(d.space) ?? 0) + 1);
  }
  console.log('[audit] Documents by space:');
  for (const [space, count] of docsBySpace) {
    console.log(`  ${space}: ${count}`);
  }

  // 3. All spaces
  console.log('\n[audit] Fetching all spaces...');
  const rawSpaces = await findAll(session, 'core:class:Space');
  const spaces = rawSpaces.map((r: any) => ({
    _id: r._id,
    name: r.name ?? '',
    _class: r._class ?? '',
    type: r.type ?? r._class ?? '',
    archived: r.archived ?? false,
    private: r.private ?? false,
  }));
  writeFileSync(`${outDir}/spaces.json`, JSON.stringify(spaces, null, 2));
  console.log(`[audit] Spaces: ${spaces.length} written to spaces.json`);

  // 4. All teamspaces (document:class:Teamspace)
  console.log('\n[audit] Fetching teamspaces...');
  const rawTeamspaces = await findAll(session, 'document:class:Teamspace');
  const teamspaces = rawTeamspaces.map((r: any) => ({
    _id: r._id,
    name: r.name ?? '',
    _class: r._class ?? '',
    description: r.description ?? '',
  }));
  writeFileSync(`${outDir}/teamspaces.json`, JSON.stringify(teamspaces, null, 2));
  console.log(`[audit] Teamspaces: ${teamspaces.length}`);
  for (const t of teamspaces) {
    console.log(`  ${t._id}: ${t.name}`);
  }

  // 5. Projects
  console.log('\n[audit] Fetching projects...');
  const rawProjects = await findAll(session, 'tracker:class:Project');
  const projects = rawProjects.map((r: any) => ({
    _id: r._id,
    identifier: r.identifier ?? '',
    name: r.name ?? '',
    description: r.description ?? '',
    defaultIssueStatus: r.defaultIssueStatus ?? '',
  }));
  writeFileSync(`${outDir}/projects.json`, JSON.stringify(projects, null, 2));
  console.log(`[audit] Projects: ${projects.length}`);
  for (const p of projects) {
    console.log(`  ${p._id}: identifier=${p.identifier} name=${p.name}`);
  }

  console.log('\n[audit] Audit dump complete.');
}

main().catch(err => {
  console.error('FATAL:', err instanceof Error ? err.message : err);
  process.exit(1);
});
