-- Add dataset_label columns (idempotent)
alter table raw_props add column if not exists dataset_label text default 'unknown';
alter table raw_props add column if not exists expired_at timestamptz;
alter table games add column if not exists dataset_label text default 'unknown';
alter table shadow_decisions add column if not exists dataset_label text default 'unknown';

-- Classification function (72h live, 14d futures, 6h after start = expire)
create or replace function classify_prop_labels() returns void as $$
begin
  -- Classify games
  update games set dataset_label = case
    when start_time < now() - interval '6 hours' then 'stale'
    when start_time > now() + interval '14 days' then 'futures'
    else 'live'
  end
  where dataset_label != 'demo';

  -- Classify raw_props
  update raw_props set 
    dataset_label = case
      when event_time < now() - interval '6 hours' then 'stale'
      when event_time > now() + interval '14 days' then 'futures'
      else 'live'
    end,
    expired_at = case
      when event_time < now() - interval '6 hours' then now()
      else null
    end
  where dataset_label != 'demo';

  -- Classify shadow_decisions
  update shadow_decisions set dataset_label = case
    when event_time < now() - interval '6 hours' then 'stale'
    when event_time > now() + interval '14 days' then 'futures'
    else 'live'
  end
  where dataset_label != 'demo';
end;
$$ language plpgsql;

-- Live data views (point dashboards/workers at these)
create or replace view live_games as
  select * from games 
  where coalesce(dataset_label,'live') not in ('stale','demo','futures');

create or replace view live_raw_props as
  select * from raw_props 
  where coalesce(dataset_label,'live') not in ('stale','demo','futures') 
    and expired_at is null;

create or replace view live_shadow_decisions as
  select * from shadow_decisions 
  where coalesce(dataset_label,'live') not in ('stale','demo','futures');

-- Monitoring queries
create or replace view settlement_monitoring as
select 
  'unsettled_live' as metric,
  count(*)::text as value
from live_shadow_decisions 
where settled_at is null

union all

select 
  'settled_24h' as metric,
  count(*)::text as value
from shadow_decisions 
where settled_at >= now() - interval '24 hours'

union all

select 
  'props_without_game' as metric,
  count(*)::text as value
from live_raw_props rp
left join live_games g on g.external_game_id = rp.external_game_id
where g.external_game_id is null

union all

select 
  'total_live_props' as metric,
  count(*)::text as value
from live_raw_props;

-- Settlement heartbeat table
create table if not exists settlement_heartbeat (
  id serial primary key,
  pipeline_name text not null,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  last_run timestamptz not null default now(),
  status text not null default 'success',
  created_at timestamptz not null default now()
);