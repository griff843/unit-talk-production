// SPRINT-EVENT-BUS-011: CLI entry point for emitting events
// Usage: tsx daemon/event-bus/emit-cli.ts --type repo.push --payload '{"ref":"main"}'

import { loadConfigGitHubOnly } from '../config.js';

import { EVENT_SOURCES, EVENT_TYPES, SEVERITY_LEVELS } from './event-types.js';
import { emitEvent } from './producer.js';

import type { EventSource, EventType, Severity } from './event-types.js';

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

async function main(): Promise<void> {
  const typeArg = getArg('type');
  if (!typeArg) {
    console.error(
      `Usage: tsx daemon/event-bus/emit-cli.ts --type <type> [--source <source>] [--payload '<json>'] [--dedupe-key <key>] [--severity <sev>]`
    );
    console.error(`\nTypes: ${EVENT_TYPES.join(', ')}`);
    console.error(`Sources: ${EVENT_SOURCES.join(', ')}`);
    console.error(`Severity: ${SEVERITY_LEVELS.join(', ')}`);
    process.exit(1);
  }

  if (!EVENT_TYPES.includes(typeArg as EventType)) {
    console.error(`Invalid type: "${typeArg}". Must be one of: ${EVENT_TYPES.join(', ')}`);
    process.exit(1);
  }

  const sourceArg = getArg('source');
  if (sourceArg && !EVENT_SOURCES.includes(sourceArg as EventSource)) {
    console.error(`Invalid source: "${sourceArg}". Must be one of: ${EVENT_SOURCES.join(', ')}`);
    process.exit(1);
  }

  const severityArg = getArg('severity');
  if (severityArg && !SEVERITY_LEVELS.includes(severityArg as Severity)) {
    console.error(
      `Invalid severity: "${severityArg}". Must be one of: ${SEVERITY_LEVELS.join(', ')}`
    );
    process.exit(1);
  }

  const payloadArg = getArg('payload');
  let payload: Record<string, unknown> = {};
  if (payloadArg) {
    try {
      payload = JSON.parse(payloadArg) as Record<string, unknown>;
    } catch {
      console.error(`Invalid --payload: must be valid JSON`);
      process.exit(1);
    }
  }

  const config = loadConfigGitHubOnly();

  if (!config.EVENTBUS_ENABLED) {
    console.error('EVENTBUS_ENABLED is not set to true. Set EVENTBUS_ENABLED=true in .env');
    process.exit(1);
  }

  const { entryId, event } = await emitEvent(config, {
    type: typeArg as EventType,
    source: (sourceArg as EventSource) ?? 'manual',
    payload,
    dedupeKey: getArg('dedupe-key'),
    severity: severityArg as Severity | undefined,
  });

  console.log(`Event emitted: id=${event.id} type=${event.type} entryId=${entryId}`);
  console.log(JSON.stringify(event, null, 2));
}

main().catch(err => {
  console.error(`FATAL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
