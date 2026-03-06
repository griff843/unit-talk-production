#!/usr/bin/env tsx
/**
 * Provider Offers Historical Data Audit
 * Audit: HISTORICAL_BACKFILL_FEASIBILITY
 *
 * Queries provider_offers via the pg pooler (direct SQL) to produce:
 *   1. Total row count
 *   2. Row count by day (last 90 days)
 *   3. Distinct market count by day
 *   4. Distinct provider/book count by day
 *   5. Date range (min/max snapshot_at)
 *   6. Top 10 providers by total row count
 *
 * Usage:
 *   npx tsx scripts/analysis/db-audit-provider-offers.ts
 *
 * Environment:
 *   SUPABASE_DB_URL_POOLER (from .env)
 */

/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';

import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pg = require('pg');

const poolerUrl = process.env['SUPABASE_DB_URL_POOLER'];
if (!poolerUrl) {
  console.error('[FATAL] Missing SUPABASE_DB_URL_POOLER in .env');
  process.exit(1);
}

const OUT_DIR = path.resolve(
  __dirname,
  '../../out/audits/HISTORICAL_BACKFILL_FEASIBILITY/2026-03-05'
);

// Ensure output directory exists
fs.mkdirSync(OUT_DIR, { recursive: true });

interface QueryResult {
  totalRowCount: number;
  dateRange: { min_snapshot: string | null; max_snapshot: string | null };
  rowCountByDay: Array<{ day: string; row_count: number }>;
  distinctMarketsByDay: Array<{ day: string; distinct_markets: number }>;
  distinctProvidersByDay: Array<{ day: string; distinct_providers: number }>;
  topProviders: Array<{ provider: string; row_count: number }>;
}

async function runAudit(): Promise<void> {
  console.log('[AUDIT] Connecting to Supabase pg pooler...');

  const client = new pg.Client({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('[AUDIT] Connected. Setting statement_timeout = 120s');

    await client.query("SET statement_timeout = '120s'");

    // 1. Total row count
    console.log('[AUDIT] Query 1/6: Total row count...');
    const totalRes = await client.query('SELECT COUNT(*)::int AS cnt FROM provider_offers');
    const totalRowCount: number = totalRes.rows[0].cnt;
    console.log(`  Total rows: ${totalRowCount}`);

    // 2. Date range (min/max snapshot_at)
    console.log('[AUDIT] Query 2/6: Date range...');
    const rangeRes = await client.query(`
      SELECT
        MIN(snapshot_at)::text AS min_snapshot,
        MAX(snapshot_at)::text AS max_snapshot
      FROM provider_offers
    `);
    const dateRange = rangeRes.rows[0];
    console.log(`  Min: ${dateRange.min_snapshot}  Max: ${dateRange.max_snapshot}`);

    // 3. Row count by day (last 90 days)
    console.log('[AUDIT] Query 3/6: Row count by day (last 90 days)...');
    const rowsByDayRes = await client.query(`
      SELECT
        date_trunc('day', snapshot_at)::date::text AS day,
        COUNT(*)::int AS row_count
      FROM provider_offers
      WHERE snapshot_at >= NOW() - INTERVAL '90 days'
      GROUP BY 1
      ORDER BY 1
    `);
    const rowCountByDay = rowsByDayRes.rows;
    console.log(`  Days with data: ${rowCountByDay.length}`);

    // 4. Distinct market count by day
    console.log('[AUDIT] Query 4/6: Distinct markets by day (last 90 days)...');
    const marketsByDayRes = await client.query(`
      SELECT
        date_trunc('day', snapshot_at)::date::text AS day,
        COUNT(DISTINCT (event_id, participant_id, market_type_id))::int AS distinct_markets
      FROM provider_offers
      WHERE snapshot_at >= NOW() - INTERVAL '90 days'
      GROUP BY 1
      ORDER BY 1
    `);
    const distinctMarketsByDay = marketsByDayRes.rows;
    console.log(`  Days with market data: ${distinctMarketsByDay.length}`);

    // 5. Distinct provider/book count by day
    console.log('[AUDIT] Query 5/6: Distinct providers by day (last 90 days)...');
    const provsByDayRes = await client.query(`
      SELECT
        date_trunc('day', snapshot_at)::date::text AS day,
        COUNT(DISTINCT provider)::int AS distinct_providers
      FROM provider_offers
      WHERE snapshot_at >= NOW() - INTERVAL '90 days'
      GROUP BY 1
      ORDER BY 1
    `);
    const distinctProvidersByDay = provsByDayRes.rows;
    console.log(`  Days with provider data: ${distinctProvidersByDay.length}`);

    // 6. Top 10 providers by total row count
    console.log('[AUDIT] Query 6/6: Top 10 providers...');
    const topProvsRes = await client.query(`
      SELECT
        provider,
        COUNT(*)::int AS row_count
      FROM provider_offers
      GROUP BY provider
      ORDER BY row_count DESC
      LIMIT 10
    `);
    const topProviders = topProvsRes.rows;
    console.log(`  Providers found: ${topProviders.length}`);

    // Assemble results
    const results: QueryResult = {
      totalRowCount,
      dateRange,
      rowCountByDay,
      distinctMarketsByDay,
      distinctProvidersByDay,
      topProviders,
    };

    // Write JSON output
    const jsonPath = path.join(OUT_DIR, 'provider_offers_counts.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(`\n[AUDIT] JSON written: ${jsonPath}`);

    // Write Markdown summary
    const mdPath = path.join(OUT_DIR, 'db_audit_summary.md');
    const md = buildMarkdown(results);
    fs.writeFileSync(mdPath, md);
    console.log(`[AUDIT] Markdown written: ${mdPath}`);

    console.log('\n[AUDIT] Done.');
  } finally {
    await client.end();
  }
}

function buildMarkdown(r: QueryResult): string {
  const lines: string[] = [];

  lines.push('# Provider Offers Historical Data Audit');
  lines.push('');
  lines.push(`**Date**: 2026-03-05`);
  lines.push(`**Audit**: HISTORICAL_BACKFILL_FEASIBILITY`);
  lines.push('');

  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Rows | ${r.totalRowCount.toLocaleString()} |`);
  lines.push(`| Earliest snapshot_at | ${r.dateRange.min_snapshot ?? 'N/A'} |`);
  lines.push(`| Latest snapshot_at | ${r.dateRange.max_snapshot ?? 'N/A'} |`);
  lines.push(`| Days with data (last 90d) | ${r.rowCountByDay.length} |`);
  lines.push('');

  lines.push('## Top 10 Providers by Row Count');
  lines.push('');
  lines.push('| Rank | Provider | Row Count |');
  lines.push('|------|----------|-----------|');
  r.topProviders.forEach((p, i) => {
    lines.push(`| ${i + 1} | ${p.provider} | ${p.row_count.toLocaleString()} |`);
  });
  lines.push('');

  lines.push('## Row Count by Day (Last 90 Days)');
  lines.push('');
  lines.push('| Day | Rows | Distinct Markets | Distinct Providers |');
  lines.push('|-----|------|------------------|--------------------|');

  // Build lookup maps for markets and providers by day
  const marketsMap = new Map<string, number>();
  r.distinctMarketsByDay.forEach(m => marketsMap.set(m.day, m.distinct_markets));

  const provsMap = new Map<string, number>();
  r.distinctProvidersByDay.forEach(p => provsMap.set(p.day, p.distinct_providers));

  r.rowCountByDay.forEach(d => {
    const markets = marketsMap.get(d.day) ?? 0;
    const provs = provsMap.get(d.day) ?? 0;
    lines.push(
      `| ${d.day} | ${d.row_count.toLocaleString()} | ${markets.toLocaleString()} | ${provs} |`
    );
  });
  lines.push('');

  return lines.join('\n');
}

runAudit().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
