-- Database Schema Validation Script
-- Run this after migration to verify all tables exist with correct structure

-- Check if all required tables exist
SELECT 
    table_name,
    CASE 
        WHEN table_name IN (
            'user_profiles', 'game_threads', 'user_picks', 'thread_stats', 
            'thread_followers', 'user_cooldowns', 'pick_gradings', 
            'coaching_sessions', 'message_feedback', 'feedback_messages',
            'activity_logs', 'config_edit_sessions', 'config_changes',
            'agent_health_checks', 'keyword_triggers', 'emoji_triggers',
            'auto_dm_templates', 'trigger_activation_logs', 
            'vip_notification_sequences', 'vip_welcome_flows', 'notification_logs',
            'onboarding_config', 'onboarding_progress', 'dm_failures',
            'analytics_events', 'user_journeys', 'onboarding_flow_edits',
            'admin_actions', 'user_preferences', 'onboarding_templates',
            'final_picks', 'analytics_summary', 'roi_by_tier', 'trend_analysis'
        ) THEN 'REQUIRED'
        ELSE 'EXTRA'
    END as table_status
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
ORDER BY table_status, table_name;

-- Check for missing required tables
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'user_profiles', 'game_threads', 'user_picks', 'thread_stats', 
        'thread_followers', 'user_cooldowns', 'pick_gradings', 
        'coaching_sessions', 'message_feedback', 'feedback_messages',
        'activity_logs', 'config_edit_sessions', 'config_changes',
        'agent_health_checks', 'keyword_triggers', 'emoji_triggers',
        'auto_dm_templates', 'trigger_activation_logs', 
        'vip_notification_sequences', 'vip_welcome_flows', 'notification_logs',
        'onboarding_config', 'onboarding_progress', 'dm_failures',
        'analytics_events', 'user_journeys', 'onboarding_flow_edits',
        'admin_actions', 'user_preferences', 'onboarding_templates',
        'final_picks', 'analytics_summary', 'roi_by_tier', 'trend_analysis'
    ]) as table_name
),
existing_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
)
SELECT 
    r.table_name as missing_table
FROM required_tables r
LEFT JOIN existing_tables e ON r.table_name = e.table_name
WHERE e.table_name IS NULL;

-- Check critical table structures
-- User Profiles Table Structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Game Threads Table Structure  
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'game_threads' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- User Picks Table Structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_picks' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check indexes on critical tables
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('user_profiles', 'game_threads', 'user_picks', 'thread_stats')
    AND schemaname = 'public'
ORDER BY tablename, indexname;

-- Check foreign key constraints
SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Check triggers for automatic timestamp updates
SELECT 
    trigger_name,
    event_object_table,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
    AND trigger_name LIKE '%updated_at%'
ORDER BY event_object_table;

-- Verify data types for critical columns
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name IN ('user_profiles', 'game_threads', 'user_picks')
    AND column_name IN ('id', 'discord_id', 'user_id', 'game_id', 'thread_id', 'created_at', 'updated_at')
ORDER BY table_name, column_name;

-- Check for any constraint violations that might prevent the application from working
SELECT 
    conname as constraint_name,
    conrelid::regclass as table_name,
    contype as constraint_type,
    consrc as constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
    AND contype IN ('c', 'f', 'u')  -- check, foreign key, unique constraints
ORDER BY table_name, constraint_type;