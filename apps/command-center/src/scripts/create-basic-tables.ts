#!/usr/bin/env tsx

/**
 * Generate SQL for Basic Tables
 * Outputs SQL commands that need to be run in Supabase SQL Editor
 */

console.log('🚧 Command Center Database Setup\n');
console.log('Please run the following SQL commands in your Supabase SQL Editor:\n');
console.log('='.repeat(80) + '\n');

const completeSQL = `
-- Command Center Basic Tables Setup
-- Run this entire script in your Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT UNIQUE,
  username TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Free' CHECK (tier IN ('Free', 'Premium', 'VIP')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'banned')),
  last_active TIMESTAMPTZ,
  total_picks INTEGER NOT NULL DEFAULT 0,
  win_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00 CHECK (win_rate >= 0 AND win_rate <= 100),
  revenue DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('notification', 'picks', 'content', 'analytics', 'security')),
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'warning', 'error', 'inactive')),
  last_run TIMESTAMPTZ,
  success_rate DECIMAL(5,2) NOT NULL DEFAULT 100.00 CHECK (success_rate >= 0 AND success_rate <= 100),
  avg_response_time INTEGER NOT NULL DEFAULT 50,
  total_operations INTEGER NOT NULL DEFAULT 0,
  configuration JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security events table  
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  ip_address TEXT,
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_tier ON users(tier);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);

-- Insert sample agent data
INSERT INTO agents (name, type, status, last_run, success_rate, avg_response_time, total_operations, configuration) VALUES
('AlertAgent', 'notification', 'healthy', NOW() - INTERVAL '30 seconds', 98.5, 45, 15420, '{"enabled": true, "interval": "30s", "channels": ["discord", "email"]}'),
('GradingAgent', 'picks', 'healthy', NOW() - INTERVAL '2 minutes', 97.2, 125, 8934, '{"enabled": true, "auto_grade": true, "confidence_threshold": 0.85}'),
('RecapAgent', 'content', 'warning', NOW() - INTERVAL '15 minutes', 89.1, 340, 2847, '{"enabled": true, "schedule": "daily", "formats": ["summary", "detailed"]}'),
('FeedAgent', 'content', 'healthy', NOW() - INTERVAL '1 minute', 99.1, 67, 45782, '{"enabled": true, "refresh_rate": "5m", "sources": ["twitter", "reddit"]}'),
('NotificationAgent', 'notification', 'healthy', NOW() - INTERVAL '45 seconds', 96.8, 89, 12045, '{"enabled": true, "delivery_methods": ["discord", "push", "email"], "retry_attempts": 3}')
ON CONFLICT (name) DO UPDATE SET
  last_run = EXCLUDED.last_run,
  total_operations = EXCLUDED.total_operations,
  configuration = EXCLUDED.configuration;

-- Insert sample user data
INSERT INTO users (discord_id, username, tier, status, last_active, total_picks, win_rate, revenue) VALUES
('123456789012345678', 'ProCapper23', 'VIP', 'active', NOW() - INTERVAL '5 minutes', 247, 74.5, 2847.50),
('234567890123456789', 'BetMaster99', 'Premium', 'active', NOW() - INTERVAL '15 minutes', 189, 58.9, 1234.75),
('345678901234567890', 'LuckyStreak', 'Free', 'inactive', NOW() - INTERVAL '3 days', 89, 45.2, 0),
('567890123456789012', 'SharpBettor', 'Premium', 'active', NOW() - INTERVAL '2 minutes', 156, 69.1, 1876.90)
ON CONFLICT (discord_id) DO UPDATE SET
  last_active = EXCLUDED.last_active,
  total_picks = EXCLUDED.total_picks,
  win_rate = EXCLUDED.win_rate,
  revenue = EXCLUDED.revenue;

-- Insert sample security events
INSERT INTO security_events (type, severity, description, ip_address, metadata) VALUES
('login_attempt', 'high', 'Multiple failed login attempts detected', '192.168.1.100', '{"attempt_count": 5, "blocked": true}'),
('rate_limit', 'medium', 'API rate limit exceeded', '10.0.0.45', '{"request_count": 150, "endpoint": "/api/picks"}'),
('suspicious_activity', 'medium', 'Access from new geographic location', '41.203.72.15', '{"previous_location": "United States", "new_location": "Nigeria"}');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
`;

console.log(completeSQL);
console.log('\n' + '='.repeat(80));
console.log('\n📋 Steps to complete setup:');
console.log('1. Copy the SQL above');
console.log('2. Go to your Supabase project dashboard');
console.log('3. Navigate to SQL Editor');
console.log('4. Paste and run the SQL');
console.log('5. Run: npm run db:test');
console.log('\n🎉 After running the SQL, your database will be ready!');
