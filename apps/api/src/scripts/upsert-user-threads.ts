import fs from 'fs';
import path from 'path';
import { requireSupabase } from '../utils/supabaseUtils';

interface ThreadRow {
  discord_id: string;
  capper_handle?: string;
  thread_type: 'picks' | 'qa';
  thread_id: string;
  metadata?: Record<string, any>;
}

async function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: tsx src/scripts/upsert-user-threads.ts <path-to-json>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  let rows: ThreadRow[];
  try {
    rows = JSON.parse(raw);
  } catch (e: any) {
    console.error('Invalid JSON:', e?.message);
    process.exit(1);
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('JSON must be a non-empty array of rows');
    process.exit(1);
  }

  const supabase = requireSupabase();

  let upserted = 0;
  for (const row of rows) {
    if (!row.discord_id || !row.thread_type || !row.thread_id) {
      console.warn('Skipping invalid row (missing required fields):', row);
      continue;
    }

    const metadata = {
      capper_handle: row.capper_handle || null,
      ...(row.metadata || {}),
      imported_at: new Date().toISOString(),
      imported_by: 'upsert-user-threads.ts',
    };

    const { error } = await supabase.from('user_threads').upsert(
      {
        discord_id: row.discord_id,
        thread_type: row.thread_type,
        thread_id: row.thread_id,
        metadata,
      },
      { onConflict: 'discord_id,thread_type' }
    );

    if (error) {
      console.error('Upsert failed:', { row, error: error.message });
      process.exitCode = 2;
      continue;
    }

    upserted++;
  }

  console.log(JSON.stringify({ upserted, total: rows.length }, null, 2));
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
