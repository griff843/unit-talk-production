-- Migration: Add score_enhanced column to unified_picks if it doesn't exist
-- This provides a canonical scoring column for the Enhanced45Factor system

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='unified_picks' and column_name='score_enhanced'
  ) then
    alter table public.unified_picks add column score_enhanced numeric null;

    -- Add comment to document the column purpose
    comment on column public.unified_picks.score_enhanced is 'Enhanced45Factor score from 195-factor analysis system';

    -- Add index for performance
    create index if not exists idx_unified_picks_score_enhanced on public.unified_picks(score_enhanced) where score_enhanced is not null;

    -- Log the addition
    raise notice 'Added score_enhanced column to unified_picks table';
  else
    raise notice 'score_enhanced column already exists in unified_picks table';
  end if;
end $$;