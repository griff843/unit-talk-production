/**
 * Ticket Embed Builder
 *
 * SPRINT-SMARTFORM-ENTITY-AUTOFILL-088
 *
 * Helper functions for building Discord embeds from ticket outbox items.
 * Extracted from DiscordTicketWorker to reduce file size.
 */

import { buildProductionFooter } from './embedPresentationContract';

// ---- TYPES ----

export interface OutboxItem {
  outbox_id: string;
  ticket_id: string;
  bet_slip_id: string;
  ticket_type: string;
  total_stake: number;
  source: string;
  meta: {
    capper_id?: string;
    capper_name?: string;
    entry_mode?: string;
    [key: string]: unknown;
  };
  legs: LegData[];
  created_at: string;
}

export interface LegData {
  leg_index: number;
  selection: string;
  provider: string;
  provider_line: number | null;
  provider_odds: number | null;
  provider_value: {
    sport?: string;
    bet_type?: string;
    home_team?: string;
    away_team?: string;
    home_team_id?: string;
    away_team_id?: string;
    matchup_text?: string;
    player_name?: string;
    player_id?: string;
    prop_type?: string;
    line?: number;
    odds?: number;
    selection?: string;
    provider?: string;
    entry_mode?: string;
  };
}

// ---- CONTRACT VALIDATION ----

export interface TicketContractValidation {
  valid: boolean;
  missingFields: string[];
  capper_name?: string;
  matchup_text?: string;
}

/**
 * SPRINT-SMARTFORM-ENTITY-AUTOFILL-088: Contract validation
 * Fail-closed if capper or matchup is missing.
 */
export function validateTicketContract(item: OutboxItem): TicketContractValidation {
  const missingFields: string[] = [];

  // Extract capper from meta
  const capper_name = item.meta?.capper_name;
  if (!capper_name) {
    missingFields.push('capper');
  }

  // Extract matchup from first leg's provider_value
  const firstLeg = item.legs?.[0];
  const matchup_text =
    firstLeg?.provider_value?.matchup_text ||
    (firstLeg?.provider_value?.away_team && firstLeg?.provider_value?.home_team
      ? `${firstLeg.provider_value.away_team} @ ${firstLeg.provider_value.home_team}`
      : null);

  if (!matchup_text) {
    missingFields.push('matchup');
  }

  return {
    valid: missingFields.length === 0,
    missingFields,
    capper_name: capper_name || undefined,
    matchup_text: matchup_text || undefined,
  };
}

// ---- HELPERS ----

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : odds.toString();
}

export function formatTicketType(ticketType: string): string {
  switch (ticketType.toLowerCase()) {
    case 'single':
      return 'Single Bet';
    case 'parlay':
      return 'Parlay';
    case 'teaser':
      return 'Teaser';
    default:
      return ticketType;
  }
}

export function calculateCombinedOdds(legs: LegData[]): number {
  let decimalProduct = 1;
  for (const leg of legs) {
    const odds = leg.provider_odds ?? leg.provider_value?.odds;
    if (odds == null) continue;
    const decimal = odds > 0 ? odds / 100 + 1 : 100 / Math.abs(odds) + 1;
    decimalProduct *= decimal;
  }
  if (decimalProduct === 1) return 0;
  if (decimalProduct >= 2) {
    return Math.round((decimalProduct - 1) * 100);
  } else {
    return Math.round(-100 / (decimalProduct - 1));
  }
}

// eslint-disable-next-line complexity -- Leg formatting requires handling multiple bet types
export function formatLegSummary(leg: LegData): string {
  const pv = leg.provider_value;
  if (!pv) {
    return `Leg ${leg.leg_index + 1}: ${leg.selection} @ ${formatOdds(leg.provider_odds ?? 0)}`;
  }

  const sel = pv.selection || leg.selection || '';
  const odds = formatOdds(pv.odds ?? leg.provider_odds ?? 0);
  const line = pv.line ?? leg.provider_line;
  const team = sel.toLowerCase() === 'home' ? pv.home_team || '' : pv.away_team || '';
  const lineStr = line != null ? (line > 0 ? `+${line}` : `${line}`) : '';
  const bt = pv.bet_type || '';
  const sport = pv.sport || '';

  if (bt === 'player_prop') {
    return `${pv.player_name || 'Player'} ${sel.toUpperCase()} ${line ?? ''} ${pv.prop_type || ''} (${odds})`;
  }
  if (bt === 'team_total') {
    return `${pv.home_team || ''} TT ${sel.toUpperCase()} ${line ?? ''} (${odds})`;
  }
  if (['spread', 'puck_line', 'run_line'].includes(bt)) {
    return `${team} ${lineStr} (${odds})`;
  }
  if (bt === 'moneyline') {
    return `${team} ML (${odds})`;
  }
  if (['total', 'game_total'].includes(bt)) {
    return `Total ${sel.toUpperCase()} ${line ?? ''} (${odds})`;
  }
  if (['nrfi', 'yrfi'].includes(bt)) {
    return `${bt.toUpperCase()} ${pv.matchup_text || ''} (${odds})`;
  }
  return `${sport} ${bt}: ${sel} ${line ?? ''} (${odds})`;
}

// eslint-disable-next-line complexity -- Embed building requires multiple conditional fields
export function buildTicketEmbed(item: OutboxItem, contract: TicketContractValidation) {
  const ticketType = formatTicketType(item.ticket_type);
  const legCount = item.legs?.length || 0;
  const combinedOdds =
    legCount > 1
      ? calculateCombinedOdds(item.legs)
      : (item.legs?.[0]?.provider_odds ?? item.legs?.[0]?.provider_value?.odds ?? 0);
  const stake = item.total_stake || 1;
  const provider = item.legs?.[0]?.provider ?? item.legs?.[0]?.provider_value?.provider ?? 'N/A';

  // Build legs display with matchup context
  const legsDisplay = (item.legs || [])
    .slice(0, 10)
    .map((leg, i) => `${i + 1}. ${formatLegSummary(leg)}`)
    .join('\n');

  const color = legCount >= 5 ? 0xffd700 : legCount >= 3 ? 0x00ff00 : 0x5865f2;
  const footer = buildProductionFooter();

  // Build fields array with capper and matchup prominently displayed
  const fields: Array<{ name: string; value: string; inline: boolean }> = [];

  // Capper field - REQUIRED by contract
  if (contract.capper_name) {
    fields.push({ name: 'Capper', value: contract.capper_name, inline: true });
  }

  // Matchup field - REQUIRED by contract
  if (contract.matchup_text) {
    fields.push({ name: 'Matchup', value: contract.matchup_text, inline: true });
  }

  // Standard fields
  fields.push({ name: 'Combined Odds', value: formatOdds(combinedOdds), inline: true });
  fields.push({ name: 'Stake', value: `${stake}U`, inline: true });
  fields.push({ name: 'Provider', value: String(provider).toUpperCase(), inline: true });

  return {
    title: `🎟️ ${ticketType}${legCount > 1 ? ` (${legCount} Legs)` : ''}`,
    color,
    description: legsDisplay || 'No legs data',
    fields,
    footer: { text: `${footer} | Bet Slip: ${item.bet_slip_id?.slice(0, 8) || 'N/A'}...` },
    timestamp: new Date().toISOString(),
  };
}
