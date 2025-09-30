import 'dotenv/config';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.cwd(), 'out', 'ops', 'dumps');
fs.mkdirSync(OUT, { recursive: true });

function sh(cmd: string): string {
  try {
    return execSync(cmd, {
      stdio: 'pipe',
      encoding: 'utf8',
      shell: true,
      windowsHide: true
    }).trim();
  } catch (error: any) {
    console.error(`[LOCAL DUMP] Command failed: ${cmd}`);
    console.error(`[LOCAL DUMP] Error: ${error.message}`);
    throw error;
  }
}

(async () => {
  const sinceMinutes = Number(process.argv[2] ?? 15);
  const sinceIso = new Date(Date.now() - sinceMinutes * 60_000).toISOString();
  const stamp = Date.now();

  console.log(`[LOCAL DUMP] Starting local DB dump for unified_picks`);
  console.log(`[LOCAL DUMP] Since: ${sinceMinutes} minutes (${sinceIso})`);

  // Detect timestamp column from the specified list
  const timestampColumns = ['inserted_at', 'created_at', 'timestamp', 'created_date'];
  let timestampCol: string | null = null;

  for (const col of timestampColumns) {
    try {
      const testSql = `SELECT 1 FROM information_schema.columns WHERE table_name = 'unified_picks' AND column_name = '${col}'`;
      const testCmd = `docker compose exec -T postgres psql -U postgres -d unit_talk_dev -A -t -c "${testSql}"`;
      const result = sh(testCmd);

      if (result.trim() === '1') {
        timestampCol = col;
        console.log(`[LOCAL DUMP] Found timestamp column: ${col}`);
        break;
      }
    } catch (e) {
      // Column doesn't exist, continue
    }
  }

  if (!timestampCol) {
    console.warn(`[LOCAL DUMP] No timestamp column found, using 'id' ordering`);
    timestampCol = 'id'; // Fallback to id
  }

  // Build SQL query based on whether we have a timestamp column
  let sql: string;
  if (timestampColumns.includes(timestampCol)) {
    // Use timestamp-based filtering
    sql = `SELECT row_to_json(t) FROM (SELECT id, user_id, ${timestampCol} FROM unified_picks WHERE ${timestampCol} >= '${sinceIso}' ORDER BY ${timestampCol} DESC LIMIT 500) t`;
  } else {
    // Fallback to id-based ordering
    sql = `SELECT row_to_json(t) FROM (SELECT id, user_id FROM unified_picks ORDER BY id DESC LIMIT 500) t`;
  }

  // Execute the query via docker compose exec
  const cmd = `docker compose exec -T postgres psql -U postgres -d unit_talk_dev -A -F"," -P footer=off -c "${sql}"`;

  console.log(`[LOCAL DUMP] Executing SQL query...`);
  const queryResult = sh(cmd);

  // Parse the JSON results
  const rows: any[] = [];
  const lines = queryResult.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const jsonData = JSON.parse(line);
      rows.push(jsonData);
    } catch (e) {
      // Skip non-JSON lines (headers, etc.)
    }
  }

  const result = {
    ts: new Date().toISOString(),
    sinceMinutes,
    sinceIso,
    count: rows.length,
    error: null,
    rows: rows
  };

  // Write main dump file
  const file = path.join(OUT, `unified_picks-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(result, null, 2));
  console.log(`[LOCAL DUMP] Written: ${file}`);

  // Write summary file (matching cloud dumper format)
  const summaryFile = path.join(OUT, `unified_picks-summary-${stamp}.json`);
  const summary = {
    ts: new Date().toISOString(),
    sinceIso,
    timestampColumn: timestampCol,
    count: result.count
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`[LOCAL DUMP] Summary: ${summaryFile}`);

  console.log(`[LOCAL DUMP] Completed: ${result.count} rows dumped`);
})().catch((e) => {
  console.error('[LOCAL DUMP] Fatal error:', e);
  process.exit(1);
});