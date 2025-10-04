-- Smoke Test: End-to-End Workflow (DB-only, no app code)

-- A) Pick 1 live candidate (today+) from the board
WITH c AS (
  SELECT prop_id
  FROM public.v_daily_board
  WHERE game_date >= CURRENT_DATE
  ORDER BY tier ASC NULLS LAST, edge DESC NULLS LAST
  LIMIT 1
)
-- B) Submit → Approve using our RPCs
SELECT submit_pick((SELECT prop_id FROM c), 'smoke test', NULL) AS submitted_id;

-- Store the submitted_id for next step
-- Run approve_pick manually with the UUID returned above
-- Example: SELECT approve_pick('PASTE-UUID-HERE', gen_random_uuid(), 'smoke ok');

-- C) Verify it shows approved on the board
-- SELECT prop_id, queue_status, publish_at
-- FROM public.v_daily_board
-- WHERE prop_id = 'PASTE-UUID-HERE';
