-- Hotfix to add missing columns observed in API runtime
ALTER TABLE IF EXISTS raw_props ADD COLUMN IF NOT EXISTS external_prop_id text;
ALTER TABLE IF EXISTS agent_health ADD COLUMN IF NOT EXISTS agent_name text;
ALTER TABLE IF EXISTS agent_metrics ADD COLUMN IF NOT EXISTS metric_data jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'system_incidents'
    ) THEN
        CREATE TABLE system_incidents (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            status text,
            severity text,
            acknowledgment_delay_minutes integer,
            affected_services text[],
            created_at timestamptz DEFAULT now()
        );
    ELSE
        ALTER TABLE system_incidents ADD COLUMN IF NOT EXISTS severity text;
        ALTER TABLE system_incidents ADD COLUMN IF NOT EXISTS acknowledgment_delay_minutes integer;
        ALTER TABLE system_incidents ADD COLUMN IF NOT EXISTS affected_services text[];
    END IF;
END $$;

