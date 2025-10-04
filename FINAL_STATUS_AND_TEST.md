# Final Status - Database Schema Fixed ✅

## All SQL Migrations Applied Successfully

1. ✅ `external_prop_id` made nullable
2. ✅ `selection` column added
3. ✅ `odds` column added
4. ✅ Unique index created: `idx_unified_picks_final_unique`

The unique constraint allows:
```
(external_game_id, external_prop_id, market, selection, odds, bookmaker_key)
```

## Current Issue

FeedAgent still getting error 23505, which means:
- Either the batch contains TRUE duplicates (same game, prop, market, selection, odds, AND bookmaker)
- OR the Supabase `.upsert()` call doesn't know to use our unique index for ON CONFLICT

## Manual Test

Run this SQL to manually insert a test pick:

```sql
INSERT INTO public.unified_picks (
  id,
  external_game_id,
  external_prop_id,
  market,
  selection,
  odds,
  metadata,
  created_at
) VALUES (
  gen_random_uuid(),
  'test_game_123',
  NULL,
  'h2h',
  'Boston Red Sox',
  210,
  '{"bookmaker": "DraftKings", "bookmaker_key": "draftkings"}'::jsonb,
  NOW()
);
```

If this works, try inserting with DIFFERENT bookmaker:

```sql
INSERT INTO public.unified_picks (
  id,
  external_game_id,
  external_prop_id,
  market,
  selection,
  odds,
  metadata,
  created_at
) VALUES (
  gen_random_uuid(),
  'test_game_123',
  NULL,
  'h2h',
  'Boston Red Sox',
  210,
  '{"bookmaker": "FanDuel", "bookmaker_key": "fanduel"}'::jsonb,
  NOW()
);
```

Both should insert successfully (same pick, different bookmaker).

If manual inserts work, the issue is in the FeedAgent code's `.upsert()` call.

## Next Steps

1. Verify manual inserts work
2. If they do, check UnifiedPicksWriter code for `.upsert()` onConflict parameter
3. The upsert might need to specify which columns to check for conflicts

