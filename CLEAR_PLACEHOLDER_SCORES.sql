-- Clear placeholder scores so we can apply REAL Enhanced45Factor scoring
UPDATE unified_picks
SET
  professional_score = NULL,
  confidence = NULL,
  rule_compliance_score = NULL
WHERE game_date >= '2025-10-02T04:00:00Z'
  AND game_date < '2025-10-03T04:00:00Z';

-- Verify all scores cleared
SELECT
  COUNT(*) as total_picks,
  COUNT(professional_score) as with_score
FROM unified_picks
WHERE game_date >= '2025-10-02T04:00:00Z'
  AND game_date < '2025-10-03T04:00:00Z';
-- Expected: total_picks=5251, with_score=0
