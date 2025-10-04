-- supabase/overlay/20_views.sql
-- Idempotent views for Unit Talk production deployment
-- Uses: unified_picks, scored_props, promotion_queue, settled_outcomes

-- v_daily_board: Today's props with scoring metrics
create or replace view public.v_daily_board as
select
  u.id as prop_ref,
  u.sport,
  u.market,
  u.selection,
  u.line,
  coalesce(
    u.odds,
    case
      when lower(u.selection) = 'over'  then nullif(u.over_odds, 0)
      when lower(u.selection) = 'under' then nullif(u.under_odds, 0)
    end
  ) as odds,
  coalesce(u.book, u.best_book) as bookmaker,
  u.game_date,
  u.game_time,
  u.player_name,
  u.team,
  u.opponent,
  s.edge,
  s.prob_win,
  s.tier,
  s.kelly_fraction,
  s.clv_pct
from public.unified_picks u
left join public.scored_props s on s.prop_ref = u.id
where (u.game_date at time zone 'utc')::date = (now() at time zone 'utc')::date
order by s.tier nulls last, s.edge desc nulls last, u.game_time nulls last;

-- v_prop_read_model: Complete prop + scoring data
create or replace view public.v_prop_read_model as
select
  u.id as prop_ref,
  u.sport, u.market, u.selection, u.line, u.odds, u.over_odds, u.under_odds,
  u.book as bookmaker, u.best_available_line, u.best_book,
  u.player_name, u.team, u.opponent, u.game_date, u.game_time,
  s.edge, s.prob_win, s.professional_score, s.tier, s.confidence, s.kelly_fraction, s.clv_pct
from public.unified_picks u
left join public.scored_props s on s.prop_ref = u.id;

-- v_open_promotions: Approved/published picks in promotion queue
create or replace view public.v_open_promotions as
select
  pq.id as queue_id,
  pq.prop_ref,
  pq.status,
  pq.publish_at,
  u.sport,
  u.market,
  u.selection,
  u.line,
  u.odds,
  u.player_name,
  u.team,
  u.opponent,
  u.game_date,
  u.game_time,
  s.edge,
  s.prob_win,
  s.tier
from public.promotion_queue pq
join public.unified_picks u on u.id = pq.prop_ref
left join public.scored_props s on s.prop_ref = pq.prop_ref
where pq.status in ('approved','published')
order by pq.publish_at nulls last, s.edge desc nulls last;

-- v_recent_settlement: Last 7 days of settled outcomes (regex-safe uuid cast)
create or replace view public.v_recent_settlement as
with normalized as (
  select
    case
      when (prop_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        then prop_id::uuid
      else null
    end as prop_ref,
    sport,
    market,
    coalesce(player_name, player) as player,
    line,
    coalesce(actual_value, actual) as actual,
    coalesce(outcome, decision) as decision,
    game_date,
    settled_at
  from public.settled_outcomes
  where settled_at is not null
)
select *
from normalized
where game_date > now() - interval '7 days';

-- v_best_line_now: Best available lines per prop
create or replace view public.v_best_line_now as
select
  u.id as prop_ref,
  u.sport,
  u.market,
  u.selection,
  u.player_name,
  u.team,
  u.opponent,
  u.game_date,
  u.game_time,
  u.best_available_line as line,
  u.best_book as bookmaker,
  u.odds,
  s.edge,
  s.tier
from public.unified_picks u
left join public.scored_props s on s.prop_ref = u.id
where u.best_available_line is not null
order by s.edge desc nulls last;
