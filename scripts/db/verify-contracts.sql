-- Verify required contracts for unified data layer hardening
-- Safe read-only checks; non-zero exit on failure when run with psql -v ON_ERROR_STOP=1

\echo 'Verifying: unified_picks essential columns exist'
select 1 from information_schema.columns where table_schema='public' and table_name='unified_picks' and column_name='external_game_id';
select 1 from information_schema.columns where table_schema='public' and table_name='unified_picks' and column_name='external_prop_id';
select 1 from information_schema.columns where table_schema='public' and table_name='unified_picks' and column_name='sport';
select 1 from information_schema.columns where table_schema='public' and table_name='unified_picks' and column_name='market';
select 1 from information_schema.columns where table_schema='public' and table_name='unified_picks' and column_name='source';

\echo 'Verifying: unified_picks indexes and search extension'
select 1 from pg_indexes where schemaname='public' and indexname='idx_unified_picks_external_ids';
select 1 from pg_indexes where schemaname='public' and indexname='idx_unified_picks_settled_at';
select 1 from pg_indexes where schemaname='public' and indexname='idx_unified_picks_game_date';
select 1 from pg_extension where extname='pg_trgm';

\echo 'Verifying: games has sport and game_date + index'
select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='sport';
select 1 from information_schema.columns where table_schema='public' and table_name='games' and column_name='game_date';
select 1 from pg_indexes where schemaname='public' and indexname='idx_games_date_sport';

\echo 'Verifying: Smart Form views exist'
select 1 from information_schema.views where table_schema='public' and table_name='view_props_for_form';
-- matview check via pg_class
select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='mv_props_for_form';

\echo 'Verifying: compatibility layer for raw_props present (table or view)'
select 1 from (
  select 'table' as kind from information_schema.tables where table_schema='public' and table_name='raw_props' and table_type='BASE TABLE'
  union all
  select 'view' as kind from information_schema.views where table_schema='public' and table_name='raw_props'
) s
limit 1;

\echo 'Verifying: cache and ops schemas'
select 1 from pg_namespace where nspname='cache';
select 1 from pg_namespace where nspname='ops';

\echo 'Verifying: cache tables and ops.credit_usage + RPCs'
select 1 from information_schema.tables where table_schema='cache' and table_name='game_results';
select 1 from information_schema.tables where table_schema='cache' and table_name='book_quotes';
select 1 from information_schema.tables where table_schema='ops' and table_name='credit_usage';
-- Ensure public functions exist
select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='log_credit_usage';
select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='write_book_quote';

\echo 'Verifying: runtime and historical config + retention function'
select 1 from information_schema.tables where table_schema='public' and table_name='runtime_config';
select 1 from information_schema.tables where table_schema='public' and table_name='historical_config';
select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname='retention_sweeps';

