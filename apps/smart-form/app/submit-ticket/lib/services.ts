/**
 * SMARTFORM-V1.1-ENTERPRISE-COMPLIANCE-036 (HARDENED)
 * Services Module
 *
 * Extracted endpoint orchestration from PickWizard.tsx for:
 * - Unit testability
 * - Centralized API logic
 * - SPEC-TRUE endpoint enforcement
 *
 * APPROVED ENDPOINTS ONLY:
 * - /api/catalog/*
 * - /api/registry/*
 * - /api/cappers
 * - /api/submit-ticket
 */

import { apiClient, Game } from '@/lib/api-client';
import { Sport, TicketLeg } from '../types';
import { parseLine, parseOdds } from './validation';

// SPRINT-DB-TYPE-ALLOWLIST-BURN-004: Renamed to avoid conflict with canonical DB types
export interface ServiceCapper {
  id: string;
  name: string;
}

export interface ServiceTeam {
  id: string;
  name: string;
  abbr?: string;
}

export interface ServiceGame {
  id: string;
  home_team: string;
  away_team: string;
  start_time?: string;
}

/**
 * Fetches cappers from /api/cappers
 * V1.1 HARDENED: No fallback, fail-closed
 */
export async function fetchCappers(): Promise<ServiceCapper[]> {
  const response = await fetch('/api/cappers');
  if (!response.ok) {
    throw new Error(`Failed to fetch cappers: HTTP ${response.status}`);
  }
  const data = await response.json();
  if (!data.cappers || data.cappers.length === 0) {
    throw new Error('No cappers found');
  }
  return data.cappers;
}

/**
 * Fetches teams from /api/catalog/teams
 * V1.1 HARDENED: SPEC-TRUE endpoint only
 */
export async function fetchTeams(sport: Sport): Promise<ServiceTeam[]> {
  const response = await fetch(`/api/catalog/teams?sport=${sport}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch teams: HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.teams || [];
}

/**
 * Fetches stat types from /api/registry/stat-types
 * V1.1 HARDENED: SPEC-TRUE endpoint only
 */
export async function fetchStatTypes(sport: Sport, betType: string): Promise<string[]> {
  const response = await fetch(`/api/registry/stat-types?sport=${sport}&bet_type=${betType}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stat types: HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.stat_types || [];
}

/**
 * Fetches games via apiClient
 * V1.1 HARDENED: Uses catalog endpoint internally
 */
export async function fetchGames(sport: Sport): Promise<Game[]> {
  return apiClient.fetchGames(sport);
}

/**
 * Builds selection string for display
 */
export function buildSelectionString(leg: TicketLeg): string {
  if (leg.bet_category === 'player_prop') {
    return `${leg.player_name} ${leg.direction || 'over'} ${leg.line || '0'} ${leg.prop_type || 'PTS'}`;
  }
  if (leg.bet_category === 'spread') {
    const lineValue = parseFloat(leg.line || '0');
    return `${leg.team} ${lineValue >= 0 ? '+' : ''}${lineValue}`;
  }
  if (leg.bet_category === 'total') {
    return `${leg.direction || 'over'} ${leg.line || '0'}`;
  }
  if (leg.bet_category === 'moneyline') {
    return leg.team || 'Team';
  }
  return leg.team || leg.player_name || 'Selection';
}

/**
 * Submits ticket to /api/submit-ticket
 * V1.1 HARDENED: Contract validated
 */
export async function submitTicket(
  capperId: string,
  legs: TicketLeg[]
): Promise<{ bet_slip_id: string }> {
  if (legs.length === 0) {
    throw new Error('No legs to submit');
  }

  if (!capperId) {
    throw new Error('No capper selected');
  }

  const ticketData = {
    capper_id: capperId,
    sport: legs[0].sport,
    ticket_type: legs.length > 1 ? 'parlay' : 'single',
    selections: legs.map(leg => ({
      sport: leg.sport,
      bet_type: leg.bet_category || 'moneyline',
      stat_type: leg.prop_type || leg.bet_category || 'unknown',
      line: parseLine(leg.line || '0'),
      leg_odds: parseOdds(leg.odds || '-110'),
      source: 'manual' as const,
      selection: buildSelectionString(leg),
      direction: leg.direction?.toLowerCase() as 'over' | 'under' | undefined,
      team: leg.team,
      player_name: leg.player_name,
      confidence: 7,
    })),
    total_units: 1,
    notes: '',
  };

  const result = await apiClient.submitTicket(ticketData);
  return result as { bet_slip_id: string };
}
