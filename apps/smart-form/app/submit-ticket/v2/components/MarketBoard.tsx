'use client';

import { useState } from 'react';
import { BetCategory } from '../../types';
import { MarketBoardProps, BetLeg, getMatchupDisplayLabel } from '../types';
import { OddsPill } from './OddsPill';

/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * MarketBoard - Manual market entry for selected matchup
 *
 * Displays quick bet buttons and player prop builder.
 * All bets are manual entry (no odds feed).
 */

const MARKET_CATEGORIES: Array<{ key: BetCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'spread', label: 'Spread' },
  { key: 'moneyline', label: 'ML' },
  { key: 'total', label: 'O/U' },
  { key: 'player_prop', label: 'Props' },
];

// Common stat types for player props
const STAT_TYPES = [
  { key: 'PTS', label: 'Points' },
  { key: 'REB', label: 'Rebounds' },
  { key: 'AST', label: 'Assists' },
  { key: 'PRA', label: 'Pts+Reb+Ast' },
  { key: '3PM', label: '3-Pointers' },
  { key: 'STL', label: 'Steals' },
  { key: 'BLK', label: 'Blocks' },
];

export function MarketBoard({
  sport,
  awayTeam,
  homeTeam,
  gameDate,
  onAddLeg,
  marketCategory,
  onCategoryChange,
}: MarketBoardProps) {
  // Player prop form state
  const [selectedStatType, setSelectedStatType] = useState<string | null>(null);
  const [customLine, setCustomLine] = useState<string>('');
  const [customOdds, setCustomOdds] = useState<string>('-110');
  const [selectedDirection, setSelectedDirection] = useState<'over' | 'under'>('over');
  const [playerSearch, setPlayerSearch] = useState('');

  // Team bet form state
  const [spreadLine, setSpreadLine] = useState<string>('');
  const [spreadOdds, setSpreadOdds] = useState<string>('-110');
  const [totalLine, setTotalLine] = useState<string>('');
  const [totalOdds, setTotalOdds] = useState<string>('-110');
  const [mlHomeOdds, setMlHomeOdds] = useState<string>('-110');
  const [mlAwayOdds, setMlAwayOdds] = useState<string>('-110');

  const displayLabel = getMatchupDisplayLabel({
    sport,
    away_team: awayTeam,
    home_team: homeTeam,
    game_date: gameDate,
  });

  // Add spread bet
  const handleAddSpread = (team: 'home' | 'away') => {
    if (!spreadLine) return;
    const line = parseFloat(spreadLine);
    const isHome = team === 'home';
    const teamData = isHome ? homeTeam : awayTeam;
    const adjustedLine = isHome ? line : -line;

    const leg: Omit<BetLeg, 'id'> = {
      sport,
      bet_type: 'spread',
      stat_type: 'SPREAD',
      selection: `${teamData.abbr || teamData.name} ${adjustedLine > 0 ? '+' : ''}${adjustedLine}`,
      line: adjustedLine,
      odds: parseInt(spreadOdds) || -110,
      team_id: teamData.id,
      team_name: teamData.name,
      source: 'manual',
      manual_matchup_home: homeTeam.name,
      manual_matchup_away: awayTeam.name,
      manual_game_date: gameDate,
      confidence: 0,
    };
    onAddLeg(leg);
  };

  // Add moneyline bet
  const handleAddMoneyline = (team: 'home' | 'away') => {
    const isHome = team === 'home';
    const teamData = isHome ? homeTeam : awayTeam;
    const odds = isHome ? mlHomeOdds : mlAwayOdds;

    const leg: Omit<BetLeg, 'id'> = {
      sport,
      bet_type: 'moneyline',
      stat_type: 'ML',
      selection: teamData.abbr || teamData.name,
      line: 0,
      odds: parseInt(odds) || -110,
      team_id: teamData.id,
      team_name: teamData.name,
      source: 'manual',
      manual_matchup_home: homeTeam.name,
      manual_matchup_away: awayTeam.name,
      manual_game_date: gameDate,
      confidence: 0,
    };
    onAddLeg(leg);
  };

  // Add total bet
  const handleAddTotal = (direction: 'over' | 'under') => {
    if (!totalLine) return;

    const leg: Omit<BetLeg, 'id'> = {
      sport,
      bet_type: 'total',
      stat_type: 'TOTAL',
      selection: `${direction === 'over' ? 'Over' : 'Under'} ${totalLine}`,
      direction,
      line: parseFloat(totalLine),
      odds: parseInt(totalOdds) || -110,
      source: 'manual',
      manual_matchup_home: homeTeam.name,
      manual_matchup_away: awayTeam.name,
      manual_game_date: gameDate,
      confidence: 0,
    };
    onAddLeg(leg);
  };

  // Add player prop
  const handlePlayerPropAdd = () => {
    if (!selectedStatType || !customLine || !playerSearch) return;

    const leg: Omit<BetLeg, 'id'> = {
      sport,
      bet_type: 'player_prop',
      stat_type: selectedStatType,
      selection: `${selectedDirection === 'over' ? 'Over' : 'Under'} ${customLine}`,
      direction: selectedDirection,
      line: parseFloat(customLine),
      odds: parseInt(customOdds) || -110,
      player_name: playerSearch,
      source: 'manual',
      manual_matchup_home: homeTeam.name,
      manual_matchup_away: awayTeam.name,
      manual_game_date: gameDate,
      confidence: 0,
    };
    onAddLeg(leg);

    // Reset form
    setSelectedStatType(null);
    setCustomLine('');
    setPlayerSearch('');
  };

  return (
    <div className="space-y-4" data-testid="market-board">
      {/* Matchup Header */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{displayLabel}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">{gameDate} • Manual Entry</p>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {MARKET_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(cat.key)}
            className={`
              px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors
              ${
                marketCategory === cat.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }
            `}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Spread Builder */}
      {(marketCategory === 'all' || marketCategory === 'spread') && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Spread</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Home Spread (e.g., -3.5)
              </label>
              <input
                type="number"
                value={spreadLine}
                onChange={e => setSpreadLine(e.target.value)}
                placeholder="-3.5"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Odds</label>
              <input
                type="number"
                value={spreadOdds}
                onChange={e => setSpreadOdds(e.target.value)}
                placeholder="-110"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddSpread('away')}
              disabled={!spreadLine}
              className="py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <span className="font-medium">{awayTeam.abbr || awayTeam.name}</span>
              {spreadLine && (
                <span className="ml-1 text-gray-500">
                  {parseFloat(spreadLine) > 0 ? '-' : '+'}
                  {Math.abs(parseFloat(spreadLine))}
                </span>
              )}
            </button>
            <button
              onClick={() => handleAddSpread('home')}
              disabled={!spreadLine}
              className="py-2 px-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <span className="font-medium">{homeTeam.abbr || homeTeam.name}</span>
              {spreadLine && (
                <span className="ml-1 text-gray-500">
                  {parseFloat(spreadLine) > 0 ? '+' : ''}
                  {spreadLine}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Moneyline Builder */}
      {(marketCategory === 'all' || marketCategory === 'moneyline') && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Moneyline</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {awayTeam.abbr || awayTeam.name} Odds
              </label>
              <input
                type="number"
                value={mlAwayOdds}
                onChange={e => setMlAwayOdds(e.target.value)}
                placeholder="+110"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={() => handleAddMoneyline('away')}
                className="w-full mt-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
              >
                {awayTeam.abbr || awayTeam.name}
                <OddsPill odds={parseInt(mlAwayOdds) || -110} size="sm" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {homeTeam.abbr || homeTeam.name} Odds
              </label>
              <input
                type="number"
                value={mlHomeOdds}
                onChange={e => setMlHomeOdds(e.target.value)}
                placeholder="-110"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={() => handleAddMoneyline('home')}
                className="w-full mt-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-sm font-medium"
              >
                {homeTeam.abbr || homeTeam.name}
                <OddsPill odds={parseInt(mlHomeOdds) || -110} size="sm" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Total (Over/Under) Builder */}
      {(marketCategory === 'all' || marketCategory === 'total') && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-white">Total (O/U)</h4>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Total Line
              </label>
              <input
                type="number"
                value={totalLine}
                onChange={e => setTotalLine(e.target.value)}
                placeholder="225.5"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Odds</label>
              <input
                type="number"
                value={totalOdds}
                onChange={e => setTotalOdds(e.target.value)}
                placeholder="-110"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAddTotal('over')}
              disabled={!totalLine}
              className="py-2 px-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-green-700 dark:text-green-300"
            >
              Over {totalLine || '...'}
            </button>
            <button
              onClick={() => handleAddTotal('under')}
              disabled={!totalLine}
              className="py-2 px-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium text-red-700 dark:text-red-300"
            >
              Under {totalLine || '...'}
            </button>
          </div>
        </div>
      )}

      {/* Player Props Builder */}
      {(marketCategory === 'all' || marketCategory === 'player_prop') && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">Player Prop</h4>

          {/* Player Search */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Player Name
            </label>
            <input
              type="text"
              value={playerSearch}
              onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Enter player name..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Stat Type Buttons */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Market</label>
            <div className="flex flex-wrap gap-2">
              {STAT_TYPES.map(stat => (
                <button
                  key={stat.key}
                  onClick={() => setSelectedStatType(stat.key)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${
                      selectedStatType === stat.key
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                    }
                  `}
                >
                  {stat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Line and Direction */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Line</label>
              <input
                type="number"
                value={customLine}
                onChange={e => setCustomLine(e.target.value)}
                placeholder="25.5"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                Direction
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setSelectedDirection('over')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    selectedDirection === 'over'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  Over
                </button>
                <button
                  onClick={() => setSelectedDirection('under')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    selectedDirection === 'under'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  Under
                </button>
              </div>
            </div>
          </div>

          {/* Odds */}
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Odds</label>
            <input
              type="number"
              value={customOdds}
              onChange={e => setCustomOdds(e.target.value)}
              placeholder="-110"
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Add Button */}
          <button
            onClick={handlePlayerPropAdd}
            disabled={!selectedStatType || !customLine || !playerSearch}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Add to Slip
          </button>
        </div>
      )}
    </div>
  );
}
