-- Fix onboarding_config table schema
-- Add missing config column

-- Add the config column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'onboarding_config' 
                   AND column_name = 'config') THEN
        ALTER TABLE onboarding_config ADD COLUMN config JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added config column to onboarding_config table';
    ELSE
        RAISE NOTICE 'Config column already exists in onboarding_config table';
    END IF;
END $$;

-- Update existing records to have default config if null
UPDATE onboarding_config 
SET config = '{}'::jsonb 
WHERE config IS NULL;

-- Verify the column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'onboarding_config' 
AND column_name = 'config';