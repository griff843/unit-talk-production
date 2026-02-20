'use client';

import { useState, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Sport } from '../types';
import {
  V2FormState,
  BetLeg,
  CatalogTeam,
  V2SubmitPayload,
  validateV2Form,
  getTicketType,
  calculateParlayOdds,
  generateLegId,
  isMatchupComplete,
  getMatchupDisplayLabel,
} from './types';
import { SportPills, MatchupBuilder, MarketBoard, BetSlip } from './components';

/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * One-Page Sportsbook Builder (Manual-First)
 *
 * Layout:
 * - Left: Sport pills, matchup builder (away/home team, date)
 * - Center: Market board (only visible after matchup complete)
 * - Right: Bet slip (always visible)
 *
 * Key principles:
 * - Matchup REQUIRED for every ticket
 * - Units REQUIRED before submit
 * - All bets are manual entry
 */

const initialState: V2FormState = {
  capper_id: null,
  capper_name: null,
  sport: 'NBA',
  matchup: {
    away_team: null,
    home_team: null,
    game_date: new Date().toISOString().split('T')[0],
    game_time: '',
  },
  legs: [],
  units: 1,
  ticket_type: 'single',
  notes: '',
  isSubmitting: false,
  submitError: null,
  marketCategory: 'all',
};

export function V2Builder() {
  const [state, setState] = useState<V2FormState>(initialState);

  // Derived state - combine sport with matchup for completeness check
  const matchupComplete = useMemo(
    () => isMatchupComplete({ ...state.matchup, sport: state.sport }),
    [state.matchup, state.sport]
  );

  const matchupLabel = useMemo(() => {
    if (!matchupComplete) return null;
    return getMatchupDisplayLabel({
      sport: state.sport,
      away_team: state.matchup.away_team!,
      home_team: state.matchup.home_team!,
      game_date: state.matchup.game_date,
    });
  }, [matchupComplete, state.sport, state.matchup]);

  // Update state helper
  const updateState = useCallback((updates: Partial<V2FormState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Sport selection - clears matchup when sport changes
  const handleSportChange = useCallback((sport: Sport) => {
    setState(prev => ({
      ...prev,
      sport,
      matchup: {
        away_team: null,
        home_team: null,
        game_date: prev.matchup.game_date,
        game_time: prev.matchup.game_time,
      },
      legs: [],
      marketCategory: 'all',
    }));
  }, []);

  // Matchup builder handlers
  const handleAwayTeamChange = useCallback((team: CatalogTeam | null) => {
    setState(prev => ({
      ...prev,
      matchup: { ...prev.matchup, away_team: team },
    }));
  }, []);

  const handleHomeTeamChange = useCallback((team: CatalogTeam | null) => {
    setState(prev => ({
      ...prev,
      matchup: { ...prev.matchup, home_team: team },
    }));
  }, []);

  const handleDateChange = useCallback((date: string) => {
    setState(prev => ({
      ...prev,
      matchup: { ...prev.matchup, game_date: date },
    }));
  }, []);

  const handleTimeChange = useCallback((time: string) => {
    setState(prev => ({
      ...prev,
      matchup: { ...prev.matchup, game_time: time },
    }));
  }, []);

  // Add leg to slip
  const handleAddLeg = useCallback((legData: Omit<BetLeg, 'id'>) => {
    const newLeg: BetLeg = {
      ...legData,
      id: generateLegId(),
    };
    setState(prev => ({
      ...prev,
      legs: [...prev.legs, newLeg],
      ticket_type: getTicketType(prev.legs.length + 1),
    }));
  }, []);

  // Remove leg from slip
  const handleRemoveLeg = useCallback((legId: string) => {
    setState(prev => {
      const newLegs = prev.legs.filter(l => l.id !== legId);
      return {
        ...prev,
        legs: newLegs,
        ticket_type: getTicketType(newLegs.length),
      };
    });
  }, []);

  // Edit leg
  const handleEditLeg = useCallback((legId: string, updates: Partial<BetLeg>) => {
    setState(prev => ({
      ...prev,
      legs: prev.legs.map(l => (l.id === legId ? { ...l, ...updates } : l)),
    }));
  }, []);

  // Clear all legs
  const handleClearAll = useCallback(() => {
    updateState({
      legs: [],
      ticket_type: 'single',
    });
  }, [updateState]);

  // Submit ticket
  const handleSubmit = useCallback(async () => {
    // Validate
    const validation = validateV2Form(state);
    if (!validation.isValid) {
      updateState({ submitError: validation.errors.join('. ') });
      return;
    }

    updateState({ isSubmitting: true, submitError: null });

    try {
      const parlayOdds = state.legs.length >= 2 ? calculateParlayOdds(state.legs) : undefined;

      const payload: V2SubmitPayload = {
        capper_id: state.capper_id!,
        sport: state.sport,
        ticket_type: getTicketType(state.legs.length),
        total_units: state.units,
        notes: state.notes || undefined,
        idempotency_key: uuidv4(),
        selections: state.legs.map(leg => ({
          sport: leg.sport,
          team_id: leg.team_id,
          player_id: leg.player_id,
          player_name: leg.player_name,
          bet_type: leg.bet_type,
          team: leg.team_name,
          stat_type: leg.stat_type,
          line: leg.line,
          leg_odds: leg.odds,
          source: leg.source,
          is_live: false,
          selection: leg.selection,
          direction: leg.direction,
          confidence: leg.confidence,
          manual_matchup_home: leg.manual_matchup_home,
          manual_matchup_away: leg.manual_matchup_away,
          manual_game_date: leg.manual_game_date,
        })),
      };

      // Add parlay_odds if applicable
      if (parlayOdds) {
        (payload as any).parlay_odds = parlayOdds;
      }

      const res = await fetch('/api/submit-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Submission failed');
      }

      // Success! Reset form but keep matchup
      updateState({
        legs: [],
        ticket_type: 'single',
        notes: '',
        isSubmitting: false,
        submitError: null,
      });

      // Show success message (could use toast here)
      alert(`Ticket submitted successfully! ID: ${data.bet_slip_id}`);
    } catch (err) {
      updateState({
        isSubmitting: false,
        submitError: err instanceof Error ? err.message : 'Submission failed',
      });
    }
  }, [state, updateState]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950" data-testid="v2-builder">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Smart Form V2</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Manual Entry • Matchup First</p>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto flex">
        {/* Left Column - Sport/Matchup Builder */}
        <div className="w-80 flex-shrink-0 p-4 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 min-h-[calc(100vh-89px)]">
          {/* Sport Pills */}
          <div className="mb-6">
            <SportPills selected={state.sport} onSelect={handleSportChange} />
          </div>

          {/* Matchup Builder */}
          <MatchupBuilder
            sport={state.sport}
            awayTeam={state.matchup.away_team}
            homeTeam={state.matchup.home_team}
            gameDate={state.matchup.game_date}
            gameTime={state.matchup.game_time}
            onAwayTeamChange={handleAwayTeamChange}
            onHomeTeamChange={handleHomeTeamChange}
            onDateChange={handleDateChange}
            onTimeChange={handleTimeChange}
            disabled={state.isSubmitting}
          />
        </div>

        {/* Center Column - Market Board */}
        <div className="flex-1 p-4 min-h-[calc(100vh-89px)]">
          {matchupComplete ? (
            <MarketBoard
              sport={state.sport}
              awayTeam={state.matchup.away_team!}
              homeTeam={state.matchup.home_team!}
              gameDate={state.matchup.game_date}
              onAddLeg={handleAddLeg}
              marketCategory={state.marketCategory}
              onCategoryChange={cat => updateState({ marketCategory: cat })}
            />
          ) : (
            <div
              className="flex flex-col items-center justify-center h-full text-center"
              data-testid="market-board-placeholder"
            >
              <div className="text-6xl mb-4 opacity-30">+</div>
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Build a Matchup
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                Select away team, home team, and game date to start adding picks to your slip.
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Bet Slip */}
        <div className="w-80 flex-shrink-0 min-h-[calc(100vh-89px)]">
          <BetSlip
            capper_id={state.capper_id}
            capper_name={state.capper_name}
            matchupComplete={matchupComplete}
            matchupLabel={matchupLabel}
            legs={state.legs}
            units={state.units}
            notes={state.notes}
            isSubmitting={state.isSubmitting}
            submitError={state.submitError}
            onCapperSelect={(id, name) => updateState({ capper_id: id, capper_name: name })}
            onRemoveLeg={handleRemoveLeg}
            onEditLeg={handleEditLeg}
            onUnitsChange={units => updateState({ units })}
            onNotesChange={notes => updateState({ notes })}
            onSubmit={handleSubmit}
            onClearAll={handleClearAll}
          />
        </div>
      </div>
    </div>
  );
}
