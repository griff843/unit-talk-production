-- SET-BASED MLB SETTLEMENT: batter_hits
-- Settles thousands of props in seconds via set operations

WITH params AS (
  SELECT
    (NOW() - INTERVAL '7 days')::timestamptz AS from_ts,
    NOW()::timestamptz AS to_ts
),
base AS (
  SELECT
    rp.id AS prop_id,
    rp.game_id,
    rp.game_date,
    rp.player_name,
    LOWER(rp.player_name) AS player_key,
    rp.line::numeric AS line,
    CASE
      WHEN rp.selection ILIKE '%over%' THEN 'over'
      WHEN rp.selection ILIKE '%under%' THEN 'under'
      ELSE NULL
    END AS side
  FROM public.raw_props rp
  CROSS JOIN params p
  WHERE rp.sport = 'MLB'
    AND (rp.stat_type ILIKE '%hits%' OR rp.selection ILIKE '%hits%')
    AND rp.game_date BETWEEN p.from_ts AND p.to_ts
    AND rp.line IS NOT NULL
),
stats AS (
  SELECT
    ps.game_id,
    LOWER(ps.player_name) AS player_key,
    COALESCE((ps.stats->>'hits')::numeric, 0) AS actual_hits
  FROM public.player_stats ps
  WHERE ps.sport = 'MLB'
),
joined AS (
  SELECT
    b.prop_id,
    b.game_id,
    b.game_date,
    b.player_name,
    b.line,
    b.side,
    s.actual_hits AS actual
  FROM base b
  LEFT JOIN stats s
    ON s.game_id = b.game_id
    AND s.player_key = b.player_key
),
decided AS (
  SELECT
    j.*,
    CASE
      WHEN j.side IS NULL OR j.actual IS NULL THEN 'void'
      WHEN j.actual = j.line THEN 'push'
      WHEN j.side = 'over' AND j.actual > j.line THEN 'win'
      WHEN j.side = 'under' AND j.actual < j.line THEN 'loss'
      WHEN j.side = 'over' AND j.actual < j.line THEN 'loss'
      WHEN j.side = 'under' AND j.actual > j.line THEN 'win'
      ELSE 'void'
    END AS decision
  FROM joined j
)
INSERT INTO public.settled_outcomes
  (prop_id, sport, market, player, line, actual, decision, game_date, settled_at)
SELECT
  d.prop_id,
  'MLB' AS sport,
  'batter_hits' AS market,
  d.player_name AS player,
  d.line,
  d.actual,
  d.decision,
  d.game_date,
  NOW() AS settled_at
FROM decided d
WHERE d.decision IS NOT NULL
ON CONFLICT (prop_id) DO NOTHING;

-- COUNT INSERTED
SELECT COUNT(*) AS inserted_hits
FROM public.settled_outcomes o
CROSS JOIN params p
WHERE o.sport = 'MLB'
  AND o.market = 'batter_hits'
  AND o.game_date BETWEEN p.from_ts AND p.to_ts
  AND o.settled_at > NOW() - INTERVAL '30 minutes';
