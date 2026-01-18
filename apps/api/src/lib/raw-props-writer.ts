/**
 * Direct Postgres Writer for raw_props
 *
 * Bypasses Supabase/PostgREST to avoid schema cache issues.
 * Uses native pg Pool for direct database writes.
 */

import { Pool, PoolClient } from 'pg';

let pool: Pool | null = null;

/**
 * Initialize direct Postgres connection pool
 */
export function initRawPropsWriter(): void {
  const databaseUrl = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_DIRECT_URL or DATABASE_URL must be set for raw_props writer');
  }

  // Parse connection string to log destination (without password)
  const urlMatch = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^/]+)\/(.+)/);
  if (urlMatch) {
    const [, user, , hostPort, dbName] = urlMatch;
    console.log('[RawPropsWriter] 🔧 Initializing direct Postgres writer');
    console.log(`[RawPropsWriter] 📍 Target: ${hostPort} | Database: ${dbName} | User: ${user}`);
    console.log('[RawPropsWriter] ✅ Bypassing PostgREST - writing directly to Postgres');
  } else {
    console.log('[RawPropsWriter] ✅ Direct Postgres writer initialized (bypassing PostgREST)');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Get or create pool instance
 */
function getPool(): Pool {
  if (!pool) {
    initRawPropsWriter();
  }
  return pool!;
}

/**
 * Insert raw props directly via Postgres
 * Returns number of rows inserted
 */
export async function insertRawPropsDirectly(props: any[]): Promise<number> {
  if (props.length === 0) {
    return 0;
  }

  const client: PoolClient = await getPool().connect();

  try {
    // Build bulk insert query
    const columns = Object.keys(props[0]);
    const columnList = columns.join(', ');

    // Build parameterized values
    const values: any[] = [];
    const valuePlaceholders: string[] = [];

    props.forEach((prop, rowIndex) => {
      const rowPlaceholders: string[] = [];
      columns.forEach((col, colIndex) => {
        const paramIndex = rowIndex * columns.length + colIndex + 1;
        rowPlaceholders.push(`$${paramIndex}`);

        // Handle JSONB columns
        if (col === 'metadata' || col === 'raw_data') {
          values.push(typeof prop[col] === 'string' ? prop[col] : JSON.stringify(prop[col] || {}));
        } else {
          values.push(prop[col]);
        }
      });
      valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const query = `
      INSERT INTO raw_props (${columnList})
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        event_time = EXCLUDED.event_time,
        line = EXCLUDED.line,
        over_odds = EXCLUDED.over_odds,
        under_odds = EXCLUDED.under_odds
      RETURNING id, event_time, updated_at
    `;

    const result = await client.query(query, values);

    // Log success with timestamp details
    const maxEventTime = result.rows.length > 0 ? result.rows[0].event_time : null;
    const maxUpdatedAt = result.rows.length > 0 ? result.rows[0].updated_at : null;

    console.log(`[RawPropsWriter] ✅ WRITE SUCCESSFUL: ${result.rowCount} props persisted`);
    console.log(`[RawPropsWriter] 📊 Max event_time: ${maxEventTime} | Max updated_at: ${maxUpdatedAt}`);

    return result.rowCount || 0;
  } catch (error) {
    console.error('[RawPropsWriter] ❌ Direct insert failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Insert in batches for large datasets
 */
export async function insertRawPropsBatch(props: any[], batchSize: number = 200): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < props.length; i += batchSize) {
    const batch = props.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(props.length / batchSize);

    console.log(`[RawPropsWriter] Inserting batch ${batchNum}/${totalBatches} (${batch.length} rows)`);

    try {
      const inserted = await insertRawPropsDirectly(batch);
      totalInserted += inserted;

      console.log(`[RawPropsWriter] ✅ Batch ${batchNum}/${totalBatches} complete: ${inserted} rows`);
    } catch (error) {
      console.error(`[RawPropsWriter] ❌ Batch ${batchNum} failed:`, error);
      throw error;
    }
  }

  return totalInserted;
}

/**
 * Close the connection pool
 */
export async function closeRawPropsWriter(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[RawPropsWriter] Connection pool closed');
  }
}
