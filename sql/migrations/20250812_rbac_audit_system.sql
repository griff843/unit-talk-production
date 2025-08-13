-- RBAC & Audit System: Role-based access control with comprehensive audit logging
-- Migration: 20250812_rbac_audit_system.sql

-- =============================================================================
-- CREATE ROLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Role identification
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Role configuration
  level INTEGER NOT NULL DEFAULT 0, -- Hierarchical level (0=lowest, 100=highest)
  scope VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (scope IN ('system', 'team', 'project')),
  
  -- Role permissions
  permissions JSONB DEFAULT '[]',
  restrictions JSONB DEFAULT '{}',
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  system_role BOOLEAN DEFAULT FALSE, -- System-defined, cannot be deleted
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE USER ROLES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Assignment
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  
  -- Scope context (for team/project scoped roles)
  context_type VARCHAR(50) DEFAULT NULL CHECK (context_type IN (NULL, 'team', 'project', 'service')),
  context_id UUID DEFAULT NULL,
  
  -- Assignment metadata
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  -- Prevent duplicate assignments
  UNIQUE(user_id, role_id, context_type, context_id)
);

-- =============================================================================
-- CREATE PERMISSIONS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Permission identification
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Permission categorization
  category VARCHAR(100) NOT NULL, -- e.g., 'user_management', 'system_admin', 'data_access'
  resource_type VARCHAR(100) NOT NULL, -- e.g., 'users', 'picks', 'system_config'
  action VARCHAR(50) NOT NULL, -- e.g., 'create', 'read', 'update', 'delete', 'execute'
  
  -- Permission scope
  scope_level INTEGER DEFAULT 0, -- 0=item, 1=collection, 2=system
  inheritable BOOLEAN DEFAULT TRUE,
  
  -- Risk classification
  risk_level VARCHAR(20) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  requires_mfa BOOLEAN DEFAULT FALSE,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  system_permission BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE AUDIT LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event identification
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL, -- 'auth', 'data', 'system', 'security'
  event_action VARCHAR(50) NOT NULL,
  
  -- Actor information
  user_id UUID REFERENCES auth.users(id),
  user_email VARCHAR(255),
  session_id VARCHAR(255),
  role_names TEXT[] DEFAULT '{}',
  
  -- Context
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  resource_name VARCHAR(255),
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255),
  
  -- Change tracking
  old_values JSONB DEFAULT NULL,
  new_values JSONB DEFAULT NULL,
  changed_fields TEXT[] DEFAULT '{}',
  
  -- Operation result
  success BOOLEAN NOT NULL,
  error_message TEXT DEFAULT NULL,
  
  -- Risk and compliance
  risk_score INTEGER DEFAULT 0, -- 0-100
  compliance_tags TEXT[] DEFAULT '{}',
  sensitive_data BOOLEAN DEFAULT FALSE,
  
  -- Timing
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_ms INTEGER DEFAULT NULL,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Partitioning helper
  partition_key DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED
);

-- =============================================================================
-- CREATE SESSION TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session identification
  session_id VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Session context
  login_method VARCHAR(50) NOT NULL, -- 'password', 'oauth', 'api_key', 'service_account'
  ip_address INET NOT NULL,
  user_agent TEXT,
  location_data JSONB DEFAULT NULL,
  
  -- Security context
  mfa_verified BOOLEAN DEFAULT FALSE,
  risk_score INTEGER DEFAULT 0,
  device_fingerprint VARCHAR(255) DEFAULT NULL,
  
  -- Session lifecycle
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  terminated_by VARCHAR(50) DEFAULT NULL, -- 'logout', 'timeout', 'admin', 'security'
  terminated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Metadata
  session_metadata JSONB DEFAULT '{}'
);

-- =============================================================================
-- CREATE ACCESS CONTROL POLICIES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS access_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Policy identification
  name VARCHAR(200) NOT NULL UNIQUE,
  description TEXT,
  
  -- Policy configuration
  resource_type VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL, -- Complex conditions for access
  effect VARCHAR(10) NOT NULL CHECK (effect IN ('allow', 'deny')),
  priority INTEGER DEFAULT 100,
  
  -- Scope
  applies_to VARCHAR(50) DEFAULT 'all' CHECK (applies_to IN ('all', 'roles', 'users')),
  target_roles TEXT[] DEFAULT '{}',
  target_users UUID[] DEFAULT '{}',
  
  -- Status and metadata
  active BOOLEAN DEFAULT TRUE,
  system_policy BOOLEAN DEFAULT FALSE,
  
  -- Timing
  effective_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  effective_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- CREATE DATA CLASSIFICATION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS data_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Classification
  table_name VARCHAR(255) NOT NULL,
  column_name VARCHAR(255) DEFAULT NULL,
  
  -- Classification levels
  sensitivity_level VARCHAR(20) NOT NULL CHECK (sensitivity_level IN ('public', 'internal', 'confidential', 'restricted')),
  data_category VARCHAR(100) NOT NULL, -- 'pii', 'financial', 'authentication', 'business'
  
  -- Compliance requirements
  compliance_frameworks TEXT[] DEFAULT '{}', -- 'gdpr', 'ccpa', 'sox', etc.
  retention_period_days INTEGER DEFAULT NULL,
  encryption_required BOOLEAN DEFAULT FALSE,
  
  -- Access controls
  requires_audit BOOLEAN DEFAULT TRUE,
  requires_approval BOOLEAN DEFAULT FALSE,
  approval_workflow VARCHAR(100) DEFAULT NULL,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(table_name, column_name)
);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Roles indexes
CREATE INDEX idx_roles_active ON roles(active, level) WHERE active = TRUE;
CREATE INDEX idx_roles_name ON roles(name) WHERE active = TRUE;
CREATE INDEX idx_roles_system ON roles(system_role, active);

-- User roles indexes
CREATE INDEX idx_user_roles_user_active ON user_roles(user_id, active) WHERE active = TRUE;
CREATE INDEX idx_user_roles_role_active ON user_roles(role_id, active) WHERE active = TRUE;
CREATE INDEX idx_user_roles_context ON user_roles(context_type, context_id) WHERE context_type IS NOT NULL;
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Permissions indexes
CREATE INDEX idx_permissions_category ON permissions(category, active) WHERE active = TRUE;
CREATE INDEX idx_permissions_resource ON permissions(resource_type, action, active) WHERE active = TRUE;
CREATE INDEX idx_permissions_risk ON permissions(risk_level, active) WHERE active = TRUE;

-- Audit events indexes
CREATE INDEX idx_audit_events_user_timestamp ON audit_events(user_id, timestamp);
CREATE INDEX idx_audit_events_type_timestamp ON audit_events(event_type, timestamp);
CREATE INDEX idx_audit_events_resource ON audit_events(resource_type, resource_id);
CREATE INDEX idx_audit_events_session ON audit_events(session_id, timestamp);
CREATE INDEX idx_audit_events_risk_score ON audit_events(risk_score, timestamp) WHERE risk_score > 50;
CREATE INDEX idx_audit_events_partition ON audit_events(partition_key, event_category);

-- Sessions indexes
CREATE INDEX idx_sessions_user_active ON user_sessions(user_id, active) WHERE active = TRUE;
CREATE INDEX idx_sessions_session_id ON user_sessions(session_id) WHERE active = TRUE;
CREATE INDEX idx_sessions_last_activity ON user_sessions(last_activity) WHERE active = TRUE;
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at) WHERE expires_at IS NOT NULL;

-- Access policies indexes
CREATE INDEX idx_policies_resource_active ON access_policies(resource_type, active) WHERE active = TRUE;
CREATE INDEX idx_policies_priority ON access_policies(priority, active) WHERE active = TRUE;
CREATE INDEX idx_policies_effective ON access_policies(effective_from, effective_until) WHERE active = TRUE;

-- Data classifications indexes
CREATE INDEX idx_classifications_table ON data_classifications(table_name);
CREATE INDEX idx_classifications_sensitivity ON data_classifications(sensitivity_level, data_category);
CREATE INDEX idx_classifications_compliance ON data_classifications USING gin(compliance_frameworks);

-- =============================================================================
-- CREATE RBAC FUNCTIONS
-- =============================================================================

-- Function to check user permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_permission_name VARCHAR(100),
  p_resource_id VARCHAR(255) DEFAULT NULL,
  p_context_type VARCHAR(50) DEFAULT NULL,
  p_context_id UUID DEFAULT NULL
) RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_permission BOOLEAN := FALSE;
  v_role RECORD;
  v_permission RECORD;
  v_policy RECORD;
BEGIN
  -- Get user's active roles
  FOR v_role IN 
    SELECT r.*, ur.context_type, ur.context_id
    FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id 
      AND ur.active = TRUE 
      AND r.active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND (p_context_type IS NULL OR ur.context_type = p_context_type)
      AND (p_context_id IS NULL OR ur.context_id = p_context_id)
    ORDER BY r.level DESC
  LOOP
    -- Check if role has the permission
    IF jsonb_path_exists(v_role.permissions, ('$ ? (@ == "' || p_permission_name || '")')) THEN
      v_has_permission := TRUE;
      EXIT; -- Found permission, no need to check further
    END IF;
  END LOOP;
  
  -- If no direct permission found, check access policies
  IF NOT v_has_permission THEN
    -- Get permission details
    SELECT * INTO v_permission 
    FROM permissions 
    WHERE name = p_permission_name AND active = TRUE;
    
    IF FOUND THEN
      -- Check applicable access policies
      FOR v_policy IN
        SELECT * FROM access_policies
        WHERE resource_type = v_permission.resource_type
          AND active = TRUE
          AND effective_from <= NOW()
          AND (effective_until IS NULL OR effective_until > NOW())
          AND (
            applies_to = 'all' 
            OR (applies_to = 'users' AND p_user_id = ANY(target_users))
            OR (applies_to = 'roles' AND EXISTS (
              SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
              WHERE ur.user_id = p_user_id AND ur.active = TRUE AND r.name = ANY(target_roles)
            ))
          )
        ORDER BY priority ASC
      LOOP
        -- Evaluate policy conditions (simplified - would need complex JSON evaluation)
        IF v_policy.effect = 'allow' THEN
          v_has_permission := TRUE;
          EXIT;
        ELSIF v_policy.effect = 'deny' THEN
          v_has_permission := FALSE;
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END IF;
  
  RETURN v_has_permission;
END;
$$;

-- Function to log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_event_type VARCHAR(100),
  p_event_category VARCHAR(50),
  p_event_action VARCHAR(50),
  p_user_id UUID DEFAULT NULL,
  p_resource_type VARCHAR(100) DEFAULT NULL,
  p_resource_id VARCHAR(255) DEFAULT NULL,
  p_resource_name VARCHAR(255) DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_success BOOLEAN DEFAULT TRUE,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_audit_id UUID;
  v_user_email VARCHAR(255);
  v_session_id VARCHAR(255);
  v_role_names TEXT[];
  v_changed_fields TEXT[];
  v_risk_score INTEGER := 0;
  v_sensitive_data BOOLEAN := FALSE;
BEGIN
  -- Get user context
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;
    
    -- Get current session info
    SELECT session_id INTO v_session_id 
    FROM user_sessions 
    WHERE user_id = p_user_id AND active = TRUE 
    ORDER BY last_activity DESC LIMIT 1;
    
    -- Get user's role names
    SELECT array_agg(r.name) INTO v_role_names
    FROM roles r
    JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id AND ur.active = TRUE AND r.active = TRUE;
  END IF;
  
  -- Calculate changed fields
  IF p_old_values IS NOT NULL AND p_new_values IS NOT NULL THEN
    SELECT array_agg(key) INTO v_changed_fields
    FROM jsonb_each(p_new_values) 
    WHERE value != COALESCE(p_old_values->key, 'null'::jsonb);
  END IF;
  
  -- Calculate risk score
  IF p_event_category = 'security' THEN v_risk_score := v_risk_score + 30; END IF;
  IF p_event_action IN ('delete', 'update', 'execute') THEN v_risk_score := v_risk_score + 20; END IF;
  IF NOT p_success THEN v_risk_score := v_risk_score + 40; END IF;
  IF array_length(v_role_names, 1) > 0 AND 'admin' = ANY(v_role_names) THEN v_risk_score := v_risk_score + 10; END IF;
  
  -- Check for sensitive data
  IF p_resource_type IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM data_classifications 
      WHERE table_name = p_resource_type 
        AND sensitivity_level IN ('confidential', 'restricted')
    ) INTO v_sensitive_data;
  END IF;
  
  -- Insert audit event
  INSERT INTO audit_events (
    event_type, event_category, event_action,
    user_id, user_email, session_id, role_names,
    resource_type, resource_id, resource_name,
    ip_address, user_agent, request_id,
    old_values, new_values, changed_fields,
    success, error_message,
    risk_score, sensitive_data,
    metadata
  ) VALUES (
    p_event_type, p_event_category, p_event_action,
    p_user_id, v_user_email, v_session_id, v_role_names,
    p_resource_type, p_resource_id, p_resource_name,
    inet_client_addr(), current_setting('request.headers.user-agent', true), current_setting('request.headers.x-request-id', true),
    p_old_values, p_new_values, v_changed_fields,
    p_success, p_error_message,
    LEAST(v_risk_score, 100), v_sensitive_data,
    p_metadata
  ) RETURNING id INTO v_audit_id;
  
  -- Trigger alerts for high-risk events
  IF v_risk_score >= 70 THEN
    INSERT INTO monitoring_alerts (alert_type, severity, message, details)
    VALUES (
      'high_risk_audit_event',
      'warning',
      'High-risk audit event detected',
      jsonb_build_object(
        'audit_id', v_audit_id,
        'risk_score', v_risk_score,
        'event_type', p_event_type,
        'user_email', v_user_email
      )
    );
  END IF;
  
  RETURN v_audit_id;
END;
$$;

-- Function to create user session
CREATE OR REPLACE FUNCTION create_user_session(
  p_user_id UUID,
  p_login_method VARCHAR(50),
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL,
  p_mfa_verified BOOLEAN DEFAULT FALSE,
  p_expires_in_hours INTEGER DEFAULT 24
) RETURNS VARCHAR(255)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id VARCHAR(255);
  v_risk_score INTEGER := 0;
  v_device_fingerprint VARCHAR(255);
BEGIN
  -- Generate session ID
  v_session_id := encode(gen_random_bytes(32), 'hex');
  
  -- Calculate risk score
  IF NOT p_mfa_verified THEN v_risk_score := v_risk_score + 20; END IF;
  IF p_login_method = 'api_key' THEN v_risk_score := v_risk_score + 10; END IF;
  
  -- Generate device fingerprint (simplified)
  v_device_fingerprint := encode(digest(COALESCE(p_user_agent, '') || p_ip_address::text, 'sha256'), 'hex');
  
  -- Terminate old sessions (optional, configurable)
  UPDATE user_sessions
  SET active = FALSE, terminated_by = 'new_session', terminated_at = NOW()
  WHERE user_id = p_user_id AND active = TRUE;
  
  -- Create new session
  INSERT INTO user_sessions (
    session_id, user_id, login_method,
    ip_address, user_agent, mfa_verified,
    risk_score, device_fingerprint,
    expires_at, session_metadata
  ) VALUES (
    v_session_id, p_user_id, p_login_method,
    p_ip_address, p_user_agent, p_mfa_verified,
    v_risk_score, v_device_fingerprint,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL,
    jsonb_build_object('login_timestamp', NOW())
  );
  
  -- Log session creation
  PERFORM log_audit_event(
    'session_created',
    'auth',
    'create',
    p_user_id,
    'user_sessions',
    v_session_id,
    NULL,
    NULL,
    jsonb_build_object('session_id', v_session_id, 'login_method', p_login_method),
    TRUE,
    NULL,
    jsonb_build_object('risk_score', v_risk_score, 'mfa_verified', p_mfa_verified)
  );
  
  RETURN v_session_id;
END;
$$;

-- Function to assign role to user
CREATE OR REPLACE FUNCTION assign_user_role(
  p_user_id UUID,
  p_role_name VARCHAR(100),
  p_assigned_by UUID,
  p_context_type VARCHAR(50) DEFAULT NULL,
  p_context_id UUID DEFAULT NULL,
  p_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
) RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_role_id UUID;
  v_assignment_id UUID;
  v_role RECORD;
BEGIN
  -- Get role
  SELECT * INTO v_role FROM roles WHERE name = p_role_name AND active = TRUE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found: %', p_role_name;
  END IF;
  
  -- Check if assigner has permission to assign this role
  IF NOT check_user_permission(p_assigned_by, 'role_management:assign', p_role_name) THEN
    RAISE EXCEPTION 'Insufficient permissions to assign role: %', p_role_name;
  END IF;
  
  -- Insert or update role assignment
  INSERT INTO user_roles (
    user_id, role_id, context_type, context_id,
    assigned_by, expires_at
  ) VALUES (
    p_user_id, v_role.id, p_context_type, p_context_id,
    p_assigned_by, p_expires_at
  )
  ON CONFLICT (user_id, role_id, context_type, context_id)
  DO UPDATE SET 
    active = TRUE,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = NOW(),
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_assignment_id;
  
  -- Log role assignment
  PERFORM log_audit_event(
    'role_assigned',
    'auth',
    'create',
    p_assigned_by,
    'user_roles',
    v_assignment_id::text,
    p_role_name,
    NULL,
    jsonb_build_object(
      'assigned_user', p_user_id,
      'role_name', p_role_name,
      'context_type', p_context_type,
      'context_id', p_context_id
    ),
    TRUE
  );
  
  RETURN v_assignment_id;
END;
$$;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
  p_user_id UUID,
  p_context_type VARCHAR(50) DEFAULT NULL,
  p_context_id UUID DEFAULT NULL
) RETURNS TABLE (
  permission_name VARCHAR(100),
  permission_category VARCHAR(100),
  resource_type VARCHAR(100),
  action VARCHAR(50),
  role_name VARCHAR(100),
  context_type VARCHAR(50),
  context_id UUID
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    p.name as permission_name,
    p.category as permission_category,
    p.resource_type,
    p.action,
    r.name as role_name,
    ur.context_type,
    ur.context_id
  FROM permissions p
  CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE 
      WHEN jsonb_typeof(
        (SELECT permissions FROM roles r2 
         JOIN user_roles ur2 ON r2.id = ur2.role_id 
         WHERE ur2.user_id = p_user_id AND ur2.active = TRUE 
           AND r2.active = TRUE AND r2.id = ur.role_id)
      ) = 'array' THEN
        (SELECT permissions FROM roles r2 
         JOIN user_roles ur2 ON r2.id = ur2.role_id 
         WHERE ur2.user_id = p_user_id AND ur2.active = TRUE 
           AND r2.active = TRUE AND r2.id = ur.role_id)
      ELSE '[]'::jsonb
    END
  ) AS perm_name
  JOIN roles r ON TRUE
  JOIN user_roles ur ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.active = TRUE
    AND r.active = TRUE
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    AND (p_context_type IS NULL OR ur.context_type = p_context_type)
    AND (p_context_id IS NULL OR ur.context_id = p_context_id)
    AND p.name = perm_name
    AND p.active = TRUE;
END;
$$;

-- =============================================================================
-- CREATE MONITORING VIEWS
-- =============================================================================

-- User permissions summary view
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
  u.id as user_id,
  u.email,
  r.name as role_name,
  r.level as role_level,
  ur.context_type,
  ur.context_id,
  ur.assigned_at,
  ur.expires_at,
  ur.active as assignment_active,
  array_agg(DISTINCT perm.name) FILTER (WHERE perm.name IS NOT NULL) as permissions
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
LEFT JOIN LATERAL jsonb_array_elements_text(r.permissions) perm_json(perm_name) ON true
LEFT JOIN permissions perm ON perm.name = perm_json.perm_name AND perm.active = TRUE
WHERE ur.active = TRUE AND r.active = TRUE
GROUP BY u.id, u.email, r.name, r.level, ur.context_type, ur.context_id, ur.assigned_at, ur.expires_at, ur.active;

-- Audit events summary view
CREATE OR REPLACE VIEW audit_events_summary AS
SELECT 
  event_category,
  event_action,
  resource_type,
  COUNT(*) as event_count,
  COUNT(*) FILTER (WHERE success = FALSE) as failed_events,
  AVG(risk_score) as avg_risk_score,
  COUNT(*) FILTER (WHERE sensitive_data = TRUE) as sensitive_data_events,
  MIN(timestamp) as first_event,
  MAX(timestamp) as last_event
FROM audit_events
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY event_category, event_action, resource_type
ORDER BY event_count DESC;

-- High-risk audit events view
CREATE OR REPLACE VIEW high_risk_audit_events AS
SELECT 
  id,
  event_type,
  event_category,
  event_action,
  user_email,
  resource_type,
  resource_id,
  risk_score,
  sensitive_data,
  success,
  error_message,
  timestamp
FROM audit_events
WHERE risk_score >= 70
  AND timestamp > NOW() - INTERVAL '7 days'
ORDER BY risk_score DESC, timestamp DESC;

-- Active sessions view
CREATE OR REPLACE VIEW active_user_sessions AS
SELECT 
  us.session_id,
  u.email,
  us.login_method,
  us.ip_address,
  us.mfa_verified,
  us.risk_score,
  us.created_at,
  us.last_activity,
  us.expires_at,
  EXTRACT(EPOCH FROM (NOW() - us.last_activity)) / 60 as minutes_since_activity
FROM user_sessions us
JOIN auth.users u ON us.user_id = u.id
WHERE us.active = TRUE
  AND (us.expires_at IS NULL OR us.expires_at > NOW())
ORDER BY us.last_activity DESC;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_classifications ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "rbac_service_role" ON roles
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "user_roles_service_role" ON user_roles
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "permissions_service_role" ON permissions
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "audit_events_service_role" ON audit_events
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "sessions_service_role" ON user_sessions
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "policies_service_role" ON access_policies
  FOR ALL USING (current_setting('role') = 'service_role');

CREATE POLICY "classifications_service_role" ON data_classifications
  FOR ALL USING (current_setting('role') = 'service_role');

-- Users can read their own data
CREATE POLICY "users_own_roles" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_own_audit" ON audit_events
  FOR SELECT USING (auth.uid() = user_id);

-- Admin roles can read all (implement proper permission checking)
CREATE POLICY "admin_read_all" ON roles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = auth.uid() AND ur.active = TRUE
        AND r.name IN ('admin', 'security_admin') AND r.active = TRUE
    )
  );

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT EXECUTE ON FUNCTION check_user_permission TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION log_audit_event TO service_role;
GRANT EXECUTE ON FUNCTION create_user_session TO service_role;
GRANT EXECUTE ON FUNCTION assign_user_role TO service_role;
GRANT EXECUTE ON FUNCTION get_user_permissions TO service_role, authenticated;

GRANT SELECT ON user_permissions_summary TO authenticated, service_role;
GRANT SELECT ON audit_events_summary TO authenticated, service_role;
GRANT SELECT ON high_risk_audit_events TO service_role;
GRANT SELECT ON active_user_sessions TO service_role;

-- =============================================================================
-- CREATE INITIAL ROLES AND PERMISSIONS
-- =============================================================================

-- Insert system roles
INSERT INTO roles (name, display_name, description, level, system_role, permissions) VALUES 
  ('super_admin', 'Super Administrator', 'Full system access with all permissions', 100, TRUE,
   '["system:*", "user_management:*", "data:*", "security:*", "audit:*"]'::jsonb),
   
  ('admin', 'Administrator', 'Administrative access to most system functions', 90, TRUE,
   '["user_management:create", "user_management:update", "user_management:read", "data:read", "data:update", "system:read", "audit:read"]'::jsonb),
   
  ('moderator', 'Moderator', 'Content and user moderation capabilities', 50, TRUE,
   '["user_management:read", "data:read", "data:update", "system:read"]'::jsonb),
   
  ('analyst', 'Data Analyst', 'Read access to analytics and reports', 30, TRUE,
   '["data:read", "system:read", "reports:read"]'::jsonb),
   
  ('user', 'Standard User', 'Basic user access', 10, TRUE,
   '["data:read", "profile:update"]'::jsonb),
   
  ('readonly', 'Read Only', 'Read-only access to permitted resources', 5, TRUE,
   '["data:read"]'::jsonb),
   
  ('service_account', 'Service Account', 'Automated service access', 0, TRUE,
   '["api:execute", "data:read", "data:create"]'::jsonb)

ON CONFLICT (name) DO NOTHING;

-- Insert system permissions
INSERT INTO permissions (name, display_name, description, category, resource_type, action, scope_level, risk_level, requires_mfa) VALUES 
  ('system:admin', 'System Administration', 'Full system administrative access', 'system_admin', 'system', 'admin', 2, 'critical', TRUE),
  ('user_management:create', 'Create Users', 'Create new user accounts', 'user_management', 'users', 'create', 1, 'high', TRUE),
  ('user_management:update', 'Update Users', 'Modify user account details', 'user_management', 'users', 'update', 0, 'medium', FALSE),
  ('user_management:delete', 'Delete Users', 'Delete user accounts', 'user_management', 'users', 'delete', 0, 'high', TRUE),
  ('user_management:read', 'Read Users', 'View user account information', 'user_management', 'users', 'read', 1, 'low', FALSE),
  
  ('role_management:assign', 'Assign Roles', 'Assign roles to users', 'user_management', 'roles', 'assign', 1, 'high', TRUE),
  ('role_management:create', 'Create Roles', 'Create new roles', 'user_management', 'roles', 'create', 1, 'high', TRUE),
  ('role_management:update', 'Update Roles', 'Modify role permissions', 'user_management', 'roles', 'update', 0, 'high', TRUE),
  
  ('data:create', 'Create Data', 'Create new data records', 'data_access', 'data', 'create', 0, 'medium', FALSE),
  ('data:read', 'Read Data', 'Read data records', 'data_access', 'data', 'read', 0, 'low', FALSE),
  ('data:update', 'Update Data', 'Modify existing data records', 'data_access', 'data', 'update', 0, 'medium', FALSE),
  ('data:delete', 'Delete Data', 'Delete data records', 'data_access', 'data', 'delete', 0, 'high', FALSE),
  
  ('audit:read', 'Read Audit Logs', 'Access audit and security logs', 'security', 'audit_events', 'read', 1, 'medium', FALSE),
  ('audit:admin', 'Audit Administration', 'Manage audit settings and retention', 'security', 'audit_events', 'admin', 2, 'high', TRUE),
  
  ('security:read', 'Security Monitoring', 'View security events and alerts', 'security', 'security', 'read', 1, 'medium', FALSE),
  ('security:admin', 'Security Administration', 'Manage security policies and settings', 'security', 'security', 'admin', 2, 'critical', TRUE),
  
  ('api:execute', 'API Access', 'Execute API operations', 'api_access', 'api', 'execute', 0, 'low', FALSE),
  ('system:read', 'System Status', 'View system status and health', 'system_admin', 'system', 'read', 1, 'low', FALSE)

ON CONFLICT (name) DO NOTHING;

-- Insert data classifications
INSERT INTO data_classifications (table_name, column_name, sensitivity_level, data_category, requires_audit, encryption_required) VALUES 
  ('auth.users', 'email', 'confidential', 'pii', TRUE, TRUE),
  ('auth.users', 'phone', 'confidential', 'pii', TRUE, TRUE),
  ('user_sessions', 'ip_address', 'internal', 'authentication', TRUE, FALSE),
  ('user_sessions', 'user_agent', 'internal', 'authentication', TRUE, FALSE),
  ('audit_events', NULL, 'confidential', 'audit', TRUE, FALSE),
  ('raw_props', 'odds', 'internal', 'business', TRUE, FALSE),
  ('unified_picks', NULL, 'confidential', 'business', TRUE, FALSE),
  ('outbox_events', NULL, 'internal', 'business', TRUE, FALSE)

ON CONFLICT (table_name, column_name) DO NOTHING;

-- =============================================================================
-- MIGRATION VERIFICATION
-- =============================================================================

DO $$
DECLARE
  v_session_id VARCHAR(255);
  v_assignment_id UUID;
  v_audit_id UUID;
  v_has_permission BOOLEAN;
  v_test_user_id UUID;
BEGIN
  -- Create test user for verification
  INSERT INTO auth.users (id, email) 
  VALUES (gen_random_uuid(), 'test@example.com') 
  RETURNING id INTO v_test_user_id;
  
  -- Test session creation
  SELECT create_user_session(
    v_test_user_id,
    'password',
    '192.168.1.1'::inet,
    'Test User Agent',
    TRUE,
    24
  ) INTO v_session_id;
  
  -- Test role assignment
  SELECT assign_user_role(
    v_test_user_id,
    'user',
    v_test_user_id
  ) INTO v_assignment_id;
  
  -- Test permission checking
  SELECT check_user_permission(
    v_test_user_id,
    'data:read'
  ) INTO v_has_permission;
  
  -- Test audit logging
  SELECT log_audit_event(
    'test_event',
    'system',
    'test',
    v_test_user_id,
    'test_resource',
    'test_id',
    'Test Resource',
    NULL,
    '{"test": "value"}'::jsonb,
    TRUE,
    NULL,
    '{"verification": true}'::jsonb
  ) INTO v_audit_id;
  
  -- Test views
  PERFORM * FROM user_permissions_summary LIMIT 1;
  PERFORM * FROM audit_events_summary LIMIT 1;
  PERFORM * FROM active_user_sessions LIMIT 1;
  
  -- Cleanup test data
  DELETE FROM audit_events WHERE id = v_audit_id;
  DELETE FROM user_roles WHERE id = v_assignment_id;
  DELETE FROM user_sessions WHERE session_id = v_session_id;
  DELETE FROM auth.users WHERE id = v_test_user_id;
  
  RAISE NOTICE 'RBAC audit system verification successful';
END;
$$;

-- Migration completed
INSERT INTO audit_log (table_name, operation, details)
VALUES ('migration', 'COMPLETE', jsonb_build_object(
  'migration', '20250812_rbac_audit_system',
  'timestamp', NOW(),
  'description', 'Role-based access control system with comprehensive audit logging, session management, and data classification'
));