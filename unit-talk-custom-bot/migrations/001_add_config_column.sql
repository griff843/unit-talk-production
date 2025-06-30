-- Migration: Add config column to onboarding_config table
-- Date: 2024-01-01
-- Description: Adds the missing config column to support onboarding configuration data

-- Add config column to onboarding_config table
ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_onboarding_config_config 
ON onboarding_config USING GIN (config);

-- Add comment for documentation
COMMENT ON COLUMN onboarding_config.config IS 'JSON configuration data for onboarding settings';

-- Update existing rows with default config if needed
UPDATE onboarding_config 
SET config = '{}'::jsonb 
WHERE config IS NULL;