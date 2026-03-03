'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GameSelection } from '../types';
import type { Game } from './GamesList';

interface GamePickFormProps {
  game: Game;
  sport?: string;
  betType?: string;
  ticketType?: string;
  existingSelections: GameSelection[];
  onAddSelection: (selection: GameSelection) => void;
}

// Bet type options for per-leg selection in parlays (excludes player_prop — that's in PlayerPropsPanel)
const LEG_BET_TYPES = [
  { value: 'spread', label: 'Point Spread' },
  { value: 'moneyline', label: 'Moneyline' },
  { value: 'total', label: 'Over/Under' },
  { value: 'team_total', label: 'Team Total' },
  { value: 'team_prop', label: 'Team Props' },
] as const;

export function GamePickForm({
  game,
  sport,
  betType,
  ticketType,
  existingSelections: _existingSelections,
  onAddSelection,
}: GamePickFormProps) {
  // For parlays/teasers, allow per-leg bet type selection
  const isMultiLegTicket = ticketType && ticketType !== 'single';
  const [legBetType, setLegBetType] = useState(betType || 'spread');

  // Use leg-specific bet type for multi-leg tickets, otherwise use ticket-level bet type
  const effectiveBetType = isMultiLegTicket ? legBetType : betType;

  const [selection, setSelection] = useState('');
  const [odds, setOdds] = useState('');
  const [line, setLine] = useState('');

  const getAvailableSelections = () => {
    if (!effectiveBetType) return [];

    switch (effectiveBetType) {
      case 'spread':
        return [
          {
            value: 'home',
            label: `${game.homeTeam} ${game.spread.home > 0 ? '+' : ''}${game.spread.home}`,
          },
          {
            value: 'away',
            label: `${game.awayTeam} ${game.spread.away > 0 ? '+' : ''}${game.spread.away}`,
          },
        ];
      case 'moneyline':
        return [
          { value: 'home', label: `${game.homeTeam} ML` },
          { value: 'away', label: `${game.awayTeam} ML` },
        ];
      case 'total':
        return [
          { value: 'over', label: `Over ${game.total}` },
          { value: 'under', label: `Under ${game.total}` },
        ];
      case 'team_total':
        return [
          { value: 'home_over', label: `${game.homeTeam} Over ${Math.round(game.total / 2)}` },
          { value: 'home_under', label: `${game.homeTeam} Under ${Math.round(game.total / 2)}` },
          { value: 'away_over', label: `${game.awayTeam} Over ${Math.round(game.total / 2)}` },
          { value: 'away_under', label: `${game.awayTeam} Under ${Math.round(game.total / 2)}` },
        ];
      default:
        return [
          { value: 'home', label: game.homeTeam },
          { value: 'away', label: game.awayTeam },
        ];
    }
  };

  // Auto-populate odds/line when selection changes
  const handleSelectionChange = (value: string) => {
    setSelection(value);

    if (effectiveBetType) {
      switch (effectiveBetType) {
        case 'spread':
          setOdds(game.spread.odds?.toString() || '-110');
          setLine(
            value === 'home'
              ? game.spread.home?.toString() || '0'
              : game.spread.away?.toString() || '0'
          );
          break;
        case 'moneyline':
          setOdds(
            value === 'home'
              ? game.moneyline.home?.toString() || '-110'
              : game.moneyline.away?.toString() || '+110'
          );
          setLine('');
          break;
        case 'total':
          setOdds('-110');
          setLine(game.total?.toString() || '50');
          break;
      }
    }
  };

  const handleAdd = () => {
    if (!selection || !odds) return;

    const selectedOption = getAvailableSelections().find(o => o.value === selection);

    // SMARTFORM-ENTITY-RESOLUTION-001: Resolve team_id based on selection
    // For home selections, use home_team_uuid; for away, use away_team_uuid
    let team_id: string | undefined;
    if (selection.includes('home') || selection === 'over' || selection === 'under') {
      // For totals, no specific team - but for team-specific bets:
      if (selection.includes('home')) {
        team_id = (game as any).home_team_uuid || undefined;
      } else if (selection.includes('away')) {
        team_id = (game as any).away_team_uuid || undefined;
      }
    } else if (selection.includes('away')) {
      team_id = (game as any).away_team_uuid || undefined;
    }

    // CLV-COVERAGE-SCALE-001: Explicitly set source:'api' and game_id for Games mode
    // SMARTFORM-ENTITY-RESOLUTION-001: Include team_id for entity resolution
    const newSelection: GameSelection = {
      id: crypto.randomUUID(),
      game_id: game.id,
      game: game.matchup || `${game.awayTeam} @ ${game.homeTeam}`,
      selection: selectedOption?.label || selection,
      odds,
      line: line || undefined,
      bet_type: effectiveBetType, // Per-leg bet type for parlays
      sport, // Per-leg sport for cross-sport parlays
      source: 'api', // CLV-COVERAGE-SCALE-001: Explicit source for game_start_time tracking
      // SMARTFORM-ENTITY-RESOLUTION-001: Include team_id for game-level bets
      ...(team_id && { team_id }),
    };

    console.log('[ENTITY-RESOLUTION] Adding game selection with entity IDs:', {
      team_id: newSelection.team_id,
      game_id: newSelection.game_id,
      selection: newSelection.selection,
    });

    onAddSelection(newSelection);
    setSelection('');
    setOdds('');
    setLine('');
  };

  const availableSelections = getAvailableSelections();

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">
        Pick: {game.awayTeam} @ {game.homeTeam}
      </h4>

      {/* Bet type selector for parlays */}
      {isMultiLegTicket && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bet Type</label>
          <select
            value={legBetType}
            onChange={e => setLegBetType(e.target.value)}
            className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {LEG_BET_TYPES.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Selection</label>
        <select
          value={selection}
          onChange={e => handleSelectionChange(e.target.value)}
          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Choose your pick</option>
          {availableSelections.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Odds</label>
          <Input
            type="number"
            placeholder="-110"
            value={odds}
            onChange={e => setOdds(e.target.value)}
          />
        </div>
        {(effectiveBetType === 'spread' ||
          effectiveBetType === 'total' ||
          effectiveBetType === 'team_total' ||
          effectiveBetType === 'player_prop') && (
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Line</label>
            <Input
              type="number"
              step="0.5"
              placeholder="8.5"
              value={line}
              onChange={e => setLine(e.target.value)}
            />
          </div>
        )}
      </div>

      <Button onClick={handleAdd} disabled={!selection || !odds} className="w-full">
        Add Selection
      </Button>
    </div>
  );
}
