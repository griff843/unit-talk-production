-- Add missing config column to onboarding_config table
-- Copy and paste this into Supabase SQL Editor

ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Also add any other columns that might be expected
ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS auto_role_enabled BOOLEAN DEFAULT true;

ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS welcome_dm_enabled BOOLEAN DEFAULT false;

ALTER TABLE onboarding_config 
ADD COLUMN IF NOT EXISTS verification_required BOOLEAN DEFAULT false;