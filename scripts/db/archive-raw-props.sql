-- Manual archival script for raw_props legacy rows
-- Safe to run multiple times; moves rows to archive.raw_props based on policy

begin;

-- Ensure archive schema/table exists (non-destructive)
create schema if not exists archive;

do $$
declare
  v_is_table boolean;
  v_is_view boolean;
begin
  select exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='raw_props' and c.relkind='r'
  ) into v_is_table;
  select exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='raw_props' and c.relkind in ('v','m')
  ) into v_is_view;

  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='archive' and c.relname='raw_props' and c.relkind='r'
  ) then
    if v_is_table then
      execute 'create table archive.raw_props (like public.raw_props including all)';
    elsif v_is_view then
      execute 'create table archive.raw_props as select * from public.raw_props with no data';
    end if;
  end if;

  if exists (
    select 1 from information_schema.columns where table_schema='archive' and table_name='raw_props' and column_name='id'
  ) then
    execute 'create unique index if not exists ux_archive_raw_props_id on archive.raw_props(id)';
  end if;
end $$;

-- Move rows: source is null OR inserted_at < now()-30d (fallback created_at)

do $$
declare
  v_has_id boolean;
  v_has_source boolean;
  v_has_inserted_at boolean;
  v_has_created_at boolean;
  v_condition text := '';
begin
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='raw_props' and c.relkind='r'
  ) then
    select exists(
      select 1 from information_schema.columns where table_schema='public' and table_name='raw_props' and column_name='id'
    ) into v_has_id;
    if not v_has_id then
      raise notice 'archive-raw-props: skipping, no id column on public.raw_props';
      return;
    end if;

    select exists(
      select 1 from information_schema.columns where table_schema='public' and table_name='raw_props' and column_name='source'
    ) into v_has_source;
    select exists(
      select 1 from information_schema.columns where table_schema='public' and table_name='raw_props' and column_name='inserted_at'
    ) into v_has_inserted_at;
    select exists(
      select 1 from information_schema.columns where table_schema='public' and table_name='raw_props' and column_name='created_at'
    ) into v_has_created_at;

    if v_has_source then
      v_condition := '(p.source is null)';
    end if;
    if v_has_inserted_at then
      v_condition := case when v_condition <> '' then v_condition || ' or ' else '' end ||
                     '(p.inserted_at < now() - interval ''30 days'')';
    elsif v_has_created_at then
      v_condition := case when v_condition <> '' then v_condition || ' or ' else '' end ||
                     '(p.created_at < now() - interval ''30 days'')';
    end if;

    if v_condition = '' then
      raise notice 'archive-raw-props: no qualifying columns present; nothing to do';
      return;
    end if;

    execute 'with to_move as (
               select p.* from public.raw_props p
               left join archive.raw_props a on a.id = p.id
               where a.id is null and (' || v_condition || ')
             ), ins as (
               insert into archive.raw_props select * from to_move
               on conflict do nothing
               returning id
             )
             delete from public.raw_props p using ins where p.id = ins.id';
  else
    raise notice 'archive-raw-props: public.raw_props is not a table; skipping move';
  end if;
end $$;

commit;

