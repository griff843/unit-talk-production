-- Query: Verify unified_picks row exists for submitted pick
-- Sprint: SPRINT-E2E-PICK-SUBMIT-TO-DISCORD-PROOF-LOCK-107A
-- Date: 2026-02-22

SELECT *
FROM unified_picks
WHERE id = 'f130a32a-0792-4dc8-bb2b-af30b132d5e0';

-- Alternative: Query by bet_slip_id
SELECT *
FROM unified_picks
WHERE bet_slip_id = '8070cf8b-193f-40a3-9f82-a83a5d56ce82';
