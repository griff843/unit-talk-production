-- =============================================================================
-- CHECK ACTUAL CAPPER DATA
-- =============================================================================

-- First, let's see what's actually in the cappers table
SELECT 
  'Cappers table data:' as info,
  id,
  name,
  role,
  status,
  is_active,
  created_at
FROM cappers 
ORDER BY created_at DESC
LIMIT 10;

-- Check what unique roles exist
SELECT 
  'Unique roles in cappers:' as info,
  role,
  COUNT(*) as count
FROM cappers 
GROUP BY role
ORDER BY count DESC;
