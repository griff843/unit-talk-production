-- =============================================================================
-- CHECK ALERT TABLE STRUCTURES BEFORE MIGRATION
-- =============================================================================

-- Check injury_alert_log structure
SELECT 
  'injury_alert_log columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'injury_alert_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check line_movement_log structure  
SELECT 
  'line_movement_log columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'line_movement_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check hedge_alert_log structure
SELECT 
  'hedge_alert_log columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'hedge_alert_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check ai_alerts_log structure
SELECT 
  'ai_alerts_log columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'ai_alerts_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check unit_talk_alerts_log structure
SELECT 
  'unit_talk_alerts_log columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'unit_talk_alerts_log' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check history table structures
SELECT 
  'mlb_history columns:' as table_info,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'mlb_history' 
  AND table_schema = 'public'
ORDER BY ordinal_position
LIMIT 10; -- Just show first 10 columns

-- Sample data from each alert table to understand structure
SELECT 'injury_alert_log sample:' as sample_info, * FROM injury_alert_log LIMIT 1;
SELECT 'line_movement_log sample:' as sample_info, * FROM line_movement_log LIMIT 1;
SELECT 'hedge_alert_log sample:' as sample_info, * FROM hedge_alert_log LIMIT 1;
SELECT 'ai_alerts_log sample:' as sample_info, * FROM ai_alerts_log LIMIT 1;
SELECT 'unit_talk_alerts_log sample:' as sample_info, * FROM unit_talk_alerts_log LIMIT 1;
