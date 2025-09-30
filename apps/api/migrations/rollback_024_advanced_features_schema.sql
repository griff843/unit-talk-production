-- Rollback Migration 024: Advanced Features Schema
-- Removes Steam Detection, Line Shopping, Injury Analysis, and Arbitrage Scanner tables

-- ============================================================================
-- DROP VIEWS FIRST
-- ============================================================================
DROP VIEW IF EXISTS profitable_arbitrage;
DROP VIEW IF EXISTS active_injury_impacts;
DROP VIEW IF EXISTS current_best_odds;
DROP VIEW IF EXISTS active_steam_moves;

-- ============================================================================
-- REMOVE COLUMN ADDED TO RAW_PROPS
-- ============================================================================
ALTER TABLE raw_props DROP COLUMN IF EXISTS player_id;

-- ============================================================================
-- DROP TABLES IN REVERSE ORDER (respecting foreign key dependencies)
-- ============================================================================
DROP TABLE IF EXISTS arbitrage_opportunities;
DROP TABLE IF EXISTS injury_impacts;
DROP TABLE IF EXISTS best_odds;
DROP TABLE IF EXISTS steam_moves;
DROP TABLE IF EXISTS players;

-- Migration rollback completed successfully