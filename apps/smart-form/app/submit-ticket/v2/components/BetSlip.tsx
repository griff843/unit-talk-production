'use client';

import { useEffect, useState } from 'react';
import { BetSlipProps, BetLeg, formatOdds, calculateParlayOdds, getTicketType } from '../types';
import { UnitsInput } from './UnitsInput';
import { OddsPill } from './OddsPill';

interface Capper {
  id: string;
  name: string;
  username: string;
  active: boolean;
}

export function BetSlip({
  capper_id,
  capper_name: _capper_name,
  matchupComplete,
  matchupLabel,
  legs,
  units,
  notes,
  isSubmitting,
  submitError,
  onCapperSelect,
  onRemoveLeg,
  onEditLeg: _onEditLeg,
  onUnitsChange,
  onNotesChange,
  onSubmit,
  onClearAll,
}: BetSlipProps) {
  const [cappers, setCappers] = useState<Capper[]>([]);
  const [loadingCappers, setLoadingCappers] = useState(true);

  // Fetch cappers on mount
  useEffect(() => {
    async function fetchCappers() {
      try {
        const res = await fetch('/api/cappers');
        const data = await res.json();
        if (data.cappers) {
          setCappers(data.cappers.filter((c: Capper) => c.active));
        }
      } catch (err) {
        console.error('Failed to fetch cappers:', err);
      } finally {
        setLoadingCappers(false);
      }
    }
    fetchCappers();
  }, []);

  const ticketType = getTicketType(legs.length);
  const parlayOdds = legs.length >= 2 ? calculateParlayOdds(legs) : null;

  const canSubmit =
    capper_id && matchupComplete && legs.length > 0 && units >= 0.5 && units <= 10 && !isSubmitting;

  // Group legs by matchup (all legs have manual matchup fields)
  const legsByMatchup = legs.reduce(
    (acc, leg) => {
      const key = `${leg.manual_matchup_away} @ ${leg.manual_matchup_home}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(leg);
      return acc;
    },
    {} as Record<string, BetLeg[]>
  );

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700"
      data-testid="bet-slip"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Bet Slip</h2>
          {legs.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm text-red-500 hover:text-red-600"
              data-testid="clear-all-btn"
            >
              Clear All
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1" data-testid="slip-summary">
          {legs.length === 0
            ? matchupComplete
              ? 'Add bets from the market board'
              : 'Build a matchup to add bets'
            : legs.length === 1
              ? '1 selection (Single)'
              : `${legs.length} selections (Parlay)`}
        </div>
        {matchupLabel && (
          <div
            className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium"
            data-testid="slip-matchup-label"
          >
            {matchupLabel}
          </div>
        )}
      </div>

      {/* Capper Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Capper <span className="text-red-500">*</span>
        </label>
        {loadingCappers ? (
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ) : (
          <select
            value={capper_id || ''}
            onChange={e => {
              const selected = cappers.find(c => c.id === e.target.value);
              if (selected) {
                onCapperSelect(selected.id, selected.username);
              }
            }}
            data-testid="capper-select"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select capper...</option>
            {cappers.map(capper => (
              <option key={capper.id} value={capper.id}>
                {capper.username || capper.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Legs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" data-testid="slip-legs">
        {legs.length === 0 ? (
          <div
            className="text-center py-8 text-gray-500 dark:text-gray-400"
            data-testid="slip-empty"
          >
            <p className="text-4xl mb-2 opacity-50">+</p>
            <p>Your bet slip is empty</p>
            <p className="text-sm mt-1">
              {matchupComplete
                ? 'Add picks from the market board'
                : 'Build a matchup first, then add picks'}
            </p>
          </div>
        ) : (
          Object.entries(legsByMatchup).map(([matchupKey, matchupLegs]) => (
            <div key={matchupKey} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {matchupKey}
              </div>
              {matchupLegs.map(leg => (
                <div
                  key={leg.id}
                  data-testid="slip-leg"
                  className="flex items-start justify-between p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    {leg.player_name && (
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {leg.player_name}
                      </div>
                    )}
                    <div className="text-sm text-gray-700 dark:text-gray-300">{leg.selection}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {leg.stat_type} {leg.line !== 0 && `• Line: ${leg.line}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <OddsPill odds={leg.odds} size="sm" />
                    <button
                      onClick={() => onRemoveLeg(leg.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      aria-label="Remove leg"
                      data-testid="remove-leg-btn"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer - Units, Parlay Odds, Submit */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-4 bg-gray-50 dark:bg-gray-800">
        {/* Units Input */}
        <UnitsInput value={units} onChange={onUnitsChange} disabled={isSubmitting} />

        {/* Parlay Odds Display */}
        {parlayOdds && legs.length >= 2 && (
          <div className="flex items-center justify-between text-sm" data-testid="parlay-odds">
            <span className="text-gray-600 dark:text-gray-400">Parlay Odds:</span>
            <span
              className="font-mono font-bold text-lg text-green-600"
              data-testid="parlay-odds-value"
            >
              {formatOdds(parlayOdds)}
            </span>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => onNotesChange(e.target.value)}
            placeholder="Add notes..."
            rows={2}
            data-testid="notes-input"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm resize-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error Message */}
        {submitError && (
          <div
            className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg"
            data-testid="submit-error"
          >
            {submitError}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          data-testid="submit-btn"
          className={`
            w-full py-3 rounded-lg font-bold text-white transition-all
            ${
              canSubmit
                ? 'bg-green-600 hover:bg-green-700 shadow-lg'
                : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Submitting...
            </span>
          ) : (
            `Submit ${ticketType === 'parlay' ? 'Parlay' : 'Bet'}`
          )}
        </button>

        {/* Validation Hints */}
        {!canSubmit && legs.length > 0 && (
          <div
            className="text-xs text-gray-500 dark:text-gray-400 text-center"
            data-testid="validation-hints"
          >
            {!capper_id && 'Select a capper • '}
            {!matchupComplete && 'Complete matchup • '}
            {(units < 0.5 || units > 10) && 'Set valid units'}
          </div>
        )}
      </div>
    </div>
  );
}
