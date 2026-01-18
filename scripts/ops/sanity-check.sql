-- Sanity check: database, user, and table existence
SELECT 
  current_database() as database,
  current_user as user,
  to_regclass('public.picks') as picks_table,
  to_regclass('public.pick_publish') as pick_publish_table;

