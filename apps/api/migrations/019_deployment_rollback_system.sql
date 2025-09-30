-- =============================================
-- Database Migration Ordering and Rollback System
-- Comprehensive migration management with ordering and safety
-- =============================================

-- Migration execution log
CREATE TABLE IF NOT EXISTS migration_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name TEXT NOT NULL,
    migration_version TEXT NOT NULL,
    execution_order INTEGER NOT NULL,
    execution_type TEXT NOT NULL CHECK (execution_type IN ('forward', 'rollback')),
    
    -- Execution details
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    executed_by TEXT DEFAULT 'system',
    execution_time_ms INTEGER NOT NULL,
    
    -- Status
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'rolled_back')),
    error_message TEXT,
    
    -- Dependency tracking
    depends_on TEXT[], -- Array of migration names this depends on
    blocks TEXT[], -- Array of migration names this blocks
    
    -- Safety and validation
    pre_validation_passed BOOLEAN DEFAULT false,
    post_validation_passed BOOLEAN DEFAULT false,
    rollback_available BOOLEAN DEFAULT true,
    
    -- Metadata
    migration_sql TEXT, -- The actual migration SQL
    rollback_sql TEXT, -- The rollback SQL
    metadata JSONB DEFAULT '{}',
    
    -- Checksum for integrity
    checksum TEXT NOT NULL
);

-- Migration dependencies for proper ordering
CREATE TABLE IF NOT EXISTS migration_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name TEXT NOT NULL,
    depends_on_migration TEXT NOT NULL,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('hard', 'soft', 'data')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(migration_name, depends_on_migration)
);

-- Rollback execution plans
CREATE TABLE IF NOT EXISTS rollback_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_name TEXT NOT NULL UNIQUE,
    target_migration TEXT, -- Roll back to this migration (null = rollback all)
    
    -- Plan details
    migrations_to_rollback TEXT[] NOT NULL,
    rollback_order INTEGER[] NOT NULL,
    estimated_duration_minutes INTEGER,
    
    -- Safety checks
    data_loss_risk TEXT NOT NULL CHECK (data_loss_risk IN ('none', 'low', 'medium', 'high')),
    backup_required BOOLEAN DEFAULT true,
    validation_required BOOLEAN DEFAULT true,
    
    -- Execution
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT NOT NULL,
    executed_at TIMESTAMPTZ,
    execution_status TEXT CHECK (execution_status IN ('pending', 'running', 'completed', 'failed')),
    
    metadata JSONB DEFAULT '{}'
);

-- Database backup records for rollback safety
CREATE TABLE IF NOT EXISTS database_backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_name TEXT NOT NULL UNIQUE,
    backup_type TEXT NOT NULL CHECK (backup_type IN ('full', 'incremental', 'schema_only', 'pre_migration')),
    
    -- Backup details
    created_at TIMESTAMPTZ DEFAULT NOW(),
    backup_size_bytes BIGINT,
    compression_ratio DECIMAL(4,3),
    
    -- Storage information
    storage_location TEXT NOT NULL,
    storage_provider TEXT NOT NULL DEFAULT 'local',
    retention_days INTEGER DEFAULT 30,
    
    -- Validation
    backup_valid BOOLEAN DEFAULT true,
    last_validated_at TIMESTAMPTZ,
    validation_error TEXT,
    
    -- Migration context
    related_migration TEXT,
    pre_migration_state BOOLEAN DEFAULT false,
    
    metadata JSONB DEFAULT '{}'
);

-- Migration validation results
CREATE TABLE IF NOT EXISTS migration_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name TEXT NOT NULL,
    validation_type TEXT NOT NULL CHECK (validation_type IN ('pre_execution', 'post_execution', 'rollback_test')),
    
    -- Validation results
    validation_passed BOOLEAN NOT NULL,
    validation_score DECIMAL(5,2), -- 0-100 score
    
    -- Test details
    tests_run INTEGER DEFAULT 0,
    tests_passed INTEGER DEFAULT 0,
    tests_failed INTEGER DEFAULT 0,
    
    -- Specific validations
    schema_integrity_passed BOOLEAN DEFAULT false,
    data_integrity_passed BOOLEAN DEFAULT false,
    performance_impact_acceptable BOOLEAN DEFAULT false,
    rollback_test_passed BOOLEAN DEFAULT false,
    
    -- Timing
    validation_start TIMESTAMPTZ DEFAULT NOW(),
    validation_end TIMESTAMPTZ,
    validation_duration_ms INTEGER,
    
    -- Results
    validation_details JSONB DEFAULT '{}',
    error_details JSONB DEFAULT '{}',
    
    metadata JSONB DEFAULT '{}'
);

-- Performance impact tracking for migrations
CREATE TABLE IF NOT EXISTS migration_performance_impact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    migration_name TEXT NOT NULL,
    
    -- Performance metrics
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_mb INTEGER,
    disk_io_mb_per_sec DECIMAL(10,2),
    network_io_mb_per_sec DECIMAL(10,2),
    
    -- Database specific metrics
    active_connections INTEGER,
    locked_tables TEXT[],
    query_execution_time_ms INTEGER,
    index_rebuild_time_ms INTEGER,
    
    -- Application impact
    api_response_time_ms INTEGER,
    error_rate_percent DECIMAL(5,2),
    throughput_requests_per_sec DECIMAL(10,2),
    
    -- Timing
    measured_at TIMESTAMPTZ DEFAULT NOW(),
    measurement_duration_seconds INTEGER,
    
    metadata JSONB DEFAULT '{}'
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_migration_executions_name ON migration_executions(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_executions_version ON migration_executions(migration_version);
CREATE INDEX IF NOT EXISTS idx_migration_executions_order ON migration_executions(execution_order);
CREATE INDEX IF NOT EXISTS idx_migration_executions_status ON migration_executions(status);
CREATE INDEX IF NOT EXISTS idx_migration_executions_executed_at ON migration_executions(executed_at);

CREATE INDEX IF NOT EXISTS idx_migration_dependencies_name ON migration_dependencies(migration_name);
CREATE INDEX IF NOT EXISTS idx_migration_dependencies_depends_on ON migration_dependencies(depends_on_migration);

CREATE INDEX IF NOT EXISTS idx_rollback_plans_name ON rollback_plans(plan_name);
CREATE INDEX IF NOT EXISTS idx_rollback_plans_status ON rollback_plans(execution_status);

CREATE INDEX IF NOT EXISTS idx_backups_name ON database_backups(backup_name);
CREATE INDEX IF NOT EXISTS idx_backups_created_at ON database_backups(created_at);
CREATE INDEX IF NOT EXISTS idx_backups_valid ON database_backups(backup_valid);

CREATE INDEX IF NOT EXISTS idx_validations_migration ON migration_validations(migration_name);
CREATE INDEX IF NOT EXISTS idx_validations_type ON migration_validations(validation_type);
CREATE INDEX IF NOT EXISTS idx_validations_passed ON migration_validations(validation_passed);

-- =============================================
-- VIEWS FOR MIGRATION MANAGEMENT
-- =============================================

-- Migration execution status view
CREATE OR REPLACE VIEW migration_status AS
SELECT 
    me.migration_name,
    me.migration_version,
    me.execution_order,
    me.status,
    me.executed_at,
    me.execution_time_ms,
    me.rollback_available,
    
    -- Validation status
    COALESCE(mv_pre.validation_passed, false) as pre_validation_passed,
    COALESCE(mv_post.validation_passed, false) as post_validation_passed,
    
    -- Dependency information
    array_length(me.depends_on, 1) as dependency_count,
    array_length(me.blocks, 1) as blocks_count,
    
    -- Performance impact
    COALESCE(mpi.api_response_time_ms, 0) as performance_impact_ms
    
FROM migration_executions me
LEFT JOIN migration_validations mv_pre ON me.migration_name = mv_pre.migration_name 
    AND mv_pre.validation_type = 'pre_execution'
LEFT JOIN migration_validations mv_post ON me.migration_name = mv_post.migration_name 
    AND mv_post.validation_type = 'post_execution'
LEFT JOIN LATERAL (
    SELECT * FROM migration_performance_impact 
    WHERE migration_name = me.migration_name 
    ORDER BY measured_at DESC 
    LIMIT 1
) mpi ON true
ORDER BY me.execution_order;

-- Rollback readiness view
CREATE OR REPLACE VIEW rollback_readiness AS
SELECT 
    me.migration_name,
    me.rollback_available,
    
    -- Backup availability
    CASE 
        WHEN db.id IS NOT NULL THEN true 
        ELSE false 
    END as backup_available,
    
    -- Validation status
    COALESCE(mv.validation_passed, false) as rollback_test_passed,
    
    -- Risk assessment
    CASE 
        WHEN NOT me.rollback_available THEN 'high'
        WHEN db.id IS NULL THEN 'high'
        WHEN NOT COALESCE(mv.validation_passed, false) THEN 'medium'
        ELSE 'low'
    END as rollback_risk,
    
    -- Dependencies that need rollback
    (
        SELECT array_agg(dependent.migration_name)
        FROM migration_executions dependent
        WHERE me.migration_name = ANY(dependent.depends_on)
        AND dependent.status = 'completed'
    ) as dependent_migrations
    
FROM migration_executions me
LEFT JOIN database_backups db ON db.related_migration = me.migration_name 
    AND db.pre_migration_state = true
    AND db.backup_valid = true
LEFT JOIN migration_validations mv ON mv.migration_name = me.migration_name 
    AND mv.validation_type = 'rollback_test'
WHERE me.status = 'completed'
ORDER BY me.execution_order DESC;

-- Migration dependency graph view
CREATE OR REPLACE VIEW migration_dependency_graph AS
WITH RECURSIVE dependency_tree AS (
    -- Base case: migrations with no dependencies
    SELECT 
        migration_name,
        0 as depth,
        ARRAY[migration_name] as path,
        migration_name as root_migration
    FROM migration_executions me
    WHERE NOT EXISTS (
        SELECT 1 FROM migration_dependencies md 
        WHERE md.migration_name = me.migration_name
    )
    
    UNION ALL
    
    -- Recursive case: migrations that depend on others
    SELECT 
        md.migration_name,
        dt.depth + 1,
        dt.path || md.migration_name,
        dt.root_migration
    FROM migration_dependencies md
    JOIN dependency_tree dt ON md.depends_on_migration = dt.migration_name
    WHERE NOT (md.migration_name = ANY(dt.path)) -- Prevent cycles
)
SELECT 
    migration_name,
    depth,
    path,
    root_migration,
    array_length(path, 1) as dependency_chain_length
FROM dependency_tree
ORDER BY depth, migration_name;

-- =============================================
-- FUNCTIONS FOR MIGRATION MANAGEMENT
-- =============================================

-- Function to validate migration dependencies
CREATE OR REPLACE FUNCTION validate_migration_dependencies(migration_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    missing_deps TEXT[];
    dep TEXT;
BEGIN
    -- Get all dependencies for this migration
    SELECT array_agg(depends_on_migration)
    INTO missing_deps
    FROM migration_dependencies md
    WHERE md.migration_name = validate_migration_dependencies.migration_name
    AND NOT EXISTS (
        SELECT 1 FROM migration_executions me
        WHERE me.migration_name = md.depends_on_migration
        AND me.status = 'completed'
    );
    
    -- If any dependencies are missing, return false
    IF array_length(missing_deps, 1) > 0 THEN
        RAISE NOTICE 'Missing dependencies for %: %', migration_name, missing_deps;
        RETURN false;
    END IF;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate rollback order
CREATE OR REPLACE FUNCTION calculate_rollback_order(target_migration TEXT DEFAULT NULL)
RETURNS TABLE(migration_name TEXT, rollback_order INTEGER) AS $$
BEGIN
    RETURN QUERY
    WITH completed_migrations AS (
        SELECT me.migration_name, me.execution_order
        FROM migration_executions me
        WHERE me.status = 'completed'
        AND (target_migration IS NULL OR me.execution_order >= (
            SELECT execution_order FROM migration_executions 
            WHERE migration_name = target_migration
        ))
    )
    SELECT 
        cm.migration_name,
        ROW_NUMBER() OVER (ORDER BY cm.execution_order DESC)::INTEGER as rollback_order
    FROM completed_migrations cm
    ORDER BY cm.execution_order DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to create backup before migration
CREATE OR REPLACE FUNCTION create_pre_migration_backup(migration_name TEXT)
RETURNS UUID AS $$
DECLARE
    backup_id UUID;
    backup_name TEXT;
BEGIN
    backup_name := 'pre_migration_' || migration_name || '_' || extract(epoch from now())::TEXT;
    
    INSERT INTO database_backups (
        backup_name,
        backup_type,
        storage_location,
        related_migration,
        pre_migration_state
    ) VALUES (
        backup_name,
        'pre_migration',
        '/backups/' || backup_name || '.sql',
        migration_name,
        true
    ) RETURNING id INTO backup_id;
    
    -- Here you would integrate with actual backup system
    -- For now, we just log the backup creation
    RAISE NOTICE 'Created backup % for migration %', backup_name, migration_name;
    
    RETURN backup_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS FOR AUTOMATIC TRACKING
-- =============================================

-- Update migration execution metrics
CREATE OR REPLACE FUNCTION update_migration_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate execution time when migration completes
    IF NEW.status IN ('completed', 'failed') AND OLD.status = 'running' THEN
        NEW.execution_time_ms := extract(epoch from (NOW() - OLD.executed_at)) * 1000;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_migration_metrics
    BEFORE UPDATE ON migration_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_metrics();

-- =============================================
-- INITIAL DATA SEEDING
-- =============================================

-- Define dependencies for feature flag migrations
INSERT INTO migration_dependencies (migration_name, depends_on_migration, dependency_type) VALUES
('015_feature_flags_system', '014_comprehensive_indexes_optimization', 'hard'),
('016_grading_comparison_table', '015_feature_flags_system', 'hard'),
('017_alert_comparison_table', '015_feature_flags_system', 'hard'),
('018_data_pipeline_comparison_table', '015_feature_flags_system', 'hard'),
('019_deployment_rollback_system', '015_feature_flags_system', 'soft')
ON CONFLICT (migration_name, depends_on_migration) DO NOTHING;

-- Create initial rollback plans for each major component
INSERT INTO rollback_plans (plan_name, migrations_to_rollback, rollback_order, data_loss_risk, created_by) VALUES
(
    'rollback_feature_flags_system',
    ARRAY['019_deployment_rollback_system', '018_data_pipeline_comparison_table', '017_alert_comparison_table', '016_grading_comparison_table', '015_feature_flags_system'],
    ARRAY[1, 2, 3, 4, 5],
    'low',
    'system'
),
(
    'rollback_to_pre_syndicate_upgrade',
    ARRAY['019_deployment_rollback_system', '018_data_pipeline_comparison_table', '017_alert_comparison_table', '016_grading_comparison_table', '015_feature_flags_system', '014_comprehensive_indexes_optimization'],
    ARRAY[1, 2, 3, 4, 5, 6],
    'medium',
    'system'
)
ON CONFLICT (plan_name) DO NOTHING;

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE ON migration_executions TO service_role;
GRANT SELECT, INSERT, UPDATE ON migration_dependencies TO service_role;
GRANT SELECT, INSERT, UPDATE ON rollback_plans TO service_role;
GRANT SELECT, INSERT, UPDATE ON database_backups TO service_role;
GRANT SELECT, INSERT, UPDATE ON migration_validations TO service_role;
GRANT SELECT, INSERT, UPDATE ON migration_performance_impact TO service_role;

GRANT SELECT ON migration_status TO service_role;
GRANT SELECT ON rollback_readiness TO service_role;
GRANT SELECT ON migration_dependency_graph TO service_role;

GRANT EXECUTE ON FUNCTION validate_migration_dependencies(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION calculate_rollback_order(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_pre_migration_backup(TEXT) TO service_role;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE migration_executions IS 'Complete log of all migration executions with dependency tracking and rollback capability';
COMMENT ON TABLE migration_dependencies IS 'Defines dependencies between migrations for proper execution ordering';
COMMENT ON TABLE rollback_plans IS 'Pre-defined rollback plans for safe migration reversal';
COMMENT ON TABLE database_backups IS 'Database backup records for migration safety and rollback procedures';
COMMENT ON TABLE migration_validations IS 'Validation test results for migrations including rollback testing';
COMMENT ON TABLE migration_performance_impact IS 'Performance impact tracking during migration execution';

COMMENT ON VIEW migration_status IS 'Comprehensive view of migration execution status with validation and performance data';
COMMENT ON VIEW rollback_readiness IS 'Assessment of rollback readiness for each completed migration';
COMMENT ON VIEW migration_dependency_graph IS 'Visual representation of migration dependencies for planning purposes';