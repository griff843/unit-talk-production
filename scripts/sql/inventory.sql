-- ================================================================
-- Database Inventory & Dependency Analysis
-- ================================================================
-- Comprehensive inventory of all tables, views, functions with tagging

-- =====================================================================
-- KEEP LISTS (DO NOT DROP)
-- =====================================================================
-- KEEP_TABLES:
--   unified_picks, raw_props, scored_props, promotion_queue,
--   settled_outcomes, player_stats, players, games, users,
--   api_quota_configs, runtime_config, agent_health
--
-- KEEP_VIEWS:
--   v_daily_board, v_prop_read_model, v_open_promotions,
--   v_best_line_now, v_recent_settlement
--
-- KEEP_FUNCS:
--   submit_pick, approve_pick, deny_pick
-- =====================================================================

-- =====================================================================
-- Part 1: Table Inventory
-- =====================================================================
SELECT
  'r' AS relkind,
  c.relname AS name,
  COALESCE(c.reltuples::bigint, 0) AS est_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
  CASE
    WHEN c.relname IN (
      'unified_picks', 'raw_props', 'scored_props', 'promotion_queue',
      'settled_outcomes', 'player_stats', 'players', 'games', 'users',
      'api_quota_configs', 'runtime_config', 'agent_health'
    ) THEN 'KEEP'
    WHEN c.relname LIKE '%_old' OR c.relname LIKE '%_backup'
         OR c.relname LIKE 'tmp_%' OR c.relname LIKE 'test_%' THEN 'DROP_CANDIDATE'
    ELSE 'REVIEW'
  END AS classification,
  obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY
  CASE
    WHEN c.relname IN ('unified_picks', 'raw_props', 'scored_props', 'promotion_queue') THEN 0
    ELSE 1
  END,
  c.relname;

-- =====================================================================
-- Part 2: View Inventory
-- =====================================================================
SELECT
  'v' AS relkind,
  c.relname AS name,
  'N/A' AS est_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
  CASE
    WHEN c.relname IN (
      'v_daily_board', 'v_prop_read_model', 'v_open_promotions',
      'v_best_line_now', 'v_recent_settlement', 'v_command_center_board'
    ) THEN 'KEEP'
    WHEN c.relname LIKE '%_old' OR c.relname LIKE '%_backup'
         OR c.relname LIKE 'tmp_%' OR c.relname LIKE 'test_%' THEN 'DROP_CANDIDATE'
    ELSE 'REVIEW'
  END AS classification,
  obj_description(c.oid, 'pg_class') AS description
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
ORDER BY
  CASE
    WHEN c.relname IN ('v_daily_board', 'v_prop_read_model', 'v_open_promotions') THEN 0
    ELSE 1
  END,
  c.relname;

-- =====================================================================
-- Part 3: Function Inventory
-- =====================================================================
SELECT
  'f' AS relkind,
  p.proname AS name,
  'N/A' AS est_rows,
  'N/A' AS size,
  CASE
    WHEN p.proname IN ('submit_pick', 'approve_pick', 'deny_pick') THEN 'KEEP'
    WHEN p.proname LIKE '%_old' OR p.proname LIKE '%_backup'
         OR p.proname LIKE 'tmp_%' OR p.proname LIKE 'test_%' THEN 'DROP_CANDIDATE'
    ELSE 'REVIEW'
  END AS classification,
  obj_description(p.oid, 'pg_proc') AS description
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY
  CASE
    WHEN p.proname IN ('submit_pick', 'approve_pick', 'deny_pick') THEN 0
    ELSE 1
  END,
  p.proname;

-- =====================================================================
-- Part 4: Dependencies Analysis
-- =====================================================================
-- Find all view dependencies
SELECT DISTINCT
  dependent_view.relname AS dependent_object,
  source_table.relname AS depends_on,
  'view->table' AS dependency_type
FROM pg_depend
JOIN pg_rewrite ON pg_depend.objid = pg_rewrite.oid
JOIN pg_class AS dependent_view ON pg_rewrite.ev_class = dependent_view.oid
JOIN pg_class AS source_table ON pg_depend.refobjid = source_table.oid
JOIN pg_namespace AS dependent_ns ON dependent_view.relnamespace = dependent_ns.oid
JOIN pg_namespace AS source_ns ON source_table.relnamespace = source_ns.oid
WHERE dependent_ns.nspname = 'public'
  AND source_ns.nspname = 'public'
  AND dependent_view.relkind = 'v'
  AND source_table.relkind IN ('r', 'v')
ORDER BY dependent_view.relname, source_table.relname;

-- =====================================================================
-- Part 5: Foreign Key Dependencies
-- =====================================================================
SELECT
  tc.table_name AS dependent_table,
  kcu.column_name AS dependent_column,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column,
  'fk' AS dependency_type
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
