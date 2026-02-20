'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { MatchupBuilderProps, CatalogTeam } from '../types';

/**
 * SPRINT-SMARTFORM-V2-MATCHUP-FIRST-063
 *
 * MatchupBuilder - Manual matchup creation component
 *
 * Fetches teams from catalog API and allows user to build
 * a matchup by selecting away/home teams and date/time.
 */

interface TeamSelectorProps {
  label: string;
  teams: CatalogTeam[];
  selected: CatalogTeam | null;
  onSelect: (team: CatalogTeam | null) => void;
  disabled?: boolean;
  loading?: boolean;
  excludeTeamId?: string;
  testId: string;
}

function TeamSelector({
  label,
  teams,
  selected,
  onSelect,
  disabled,
  loading,
  excludeTeamId,
  testId,
}: TeamSelectorProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredTeams = useMemo(() => {
    let filtered = teams;
    if (excludeTeamId) {
      filtered = filtered.filter(t => t.id !== excludeTeamId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        t => t.name.toLowerCase().includes(q) || (t.abbr && t.abbr.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [teams, search, excludeTeamId]);

  const handleSelect = useCallback(
    (team: CatalogTeam) => {
      onSelect(team);
      setSearch('');
      setIsOpen(false);
    },
    [onSelect]
  );

  const handleClear = useCallback(() => {
    onSelect(null);
    setSearch('');
  }, [onSelect]);

  return (
    <div className="relative" data-testid={testId}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>

      {selected ? (
        <div className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <span
              className="font-medium text-gray-900 dark:text-white"
              data-testid={`${testId}-value`}
            >
              {selected.abbr || selected.name}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">{selected.name}</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-gray-400 hover:text-red-500 transition-colors"
            aria-label={`Clear ${label}`}
            data-testid={`${testId}-clear`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            placeholder={loading ? 'Loading teams...' : 'Search team...'}
            disabled={disabled || loading}
            data-testid={`${testId}-input`}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          {isOpen && filteredTeams.length > 0 && (
            <div
              className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
              data-testid={`${testId}-dropdown`}
            >
              {filteredTeams.slice(0, 20).map(team => (
                <button
                  key={team.id}
                  type="button"
                  onMouseDown={() => handleSelect(team)}
                  data-testid={`${testId}-option-${team.id}`}
                  className="w-full px-3 py-2 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2 transition-colors"
                >
                  <span className="font-medium text-gray-900 dark:text-white">
                    {team.abbr || team.name}
                  </span>
                  {team.abbr && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">{team.name}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {isOpen && filteredTeams.length === 0 && search.trim() && !loading && (
            <div className="absolute z-50 w-full mt-1 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg text-sm text-gray-500">
              No teams found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchupBuilder({
  sport,
  awayTeam,
  homeTeam,
  gameDate,
  gameTime,
  onAwayTeamChange,
  onHomeTeamChange,
  onDateChange,
  onTimeChange,
  disabled,
}: MatchupBuilderProps) {
  const [teams, setTeams] = useState<CatalogTeam[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch teams when sport changes
  useEffect(() => {
    let cancelled = false;

    async function fetchTeams() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/catalog/teams?sport=${sport}`);
        if (!res.ok) {
          throw new Error('Failed to fetch teams');
        }
        const data = await res.json();
        if (!cancelled) {
          setTeams(data.teams || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load teams');
          setTeams([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTeams();

    return () => {
      cancelled = true;
    };
  }, [sport]);

  // Clear team selections when sport changes
  useEffect(() => {
    // Only clear if the selected teams don't match the current sport
    if (awayTeam && awayTeam.sport !== sport) {
      onAwayTeamChange(null);
    }
    if (homeTeam && homeTeam.sport !== sport) {
      onHomeTeamChange(null);
    }
  }, [sport, awayTeam, homeTeam, onAwayTeamChange, onHomeTeamChange]);

  const isComplete = awayTeam && homeTeam && gameDate;

  return (
    <div className="space-y-4" data-testid="matchup-builder">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Build Matchup</h3>
        {isComplete && (
          <span
            className="text-xs text-green-600 dark:text-green-400 font-medium"
            data-testid="matchup-ready"
          >
            Ready
          </span>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded">
          {error}
        </div>
      )}

      {/* Away Team Selector */}
      <TeamSelector
        label="Away Team"
        teams={teams}
        selected={awayTeam}
        onSelect={onAwayTeamChange}
        disabled={disabled}
        loading={loading}
        excludeTeamId={homeTeam?.id}
        testId="away-team-select"
      />

      {/* VS Indicator */}
      <div className="flex items-center justify-center">
        <span className="text-sm font-bold text-gray-400">@</span>
      </div>

      {/* Home Team Selector */}
      <TeamSelector
        label="Home Team"
        teams={teams}
        selected={homeTeam}
        onSelect={onHomeTeamChange}
        disabled={disabled}
        loading={loading}
        excludeTeamId={awayTeam?.id}
        testId="home-team-select"
      />

      {/* Date Picker */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Game Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={gameDate}
          onChange={e => onDateChange(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          disabled={disabled}
          data-testid="game-date-input"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {/* Time Input (Optional) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Game Time <span className="text-gray-400 text-xs">(optional)</span>
        </label>
        <input
          type="time"
          value={gameTime}
          onChange={e => onTimeChange(e.target.value)}
          disabled={disabled}
          data-testid="game-time-input"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      {/* Matchup Preview */}
      {isComplete && (
        <div
          className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
          data-testid="matchup-preview"
        >
          <div className="text-sm font-semibold text-blue-800 dark:text-blue-200 text-center">
            {awayTeam.abbr || awayTeam.name} @ {homeTeam.abbr || homeTeam.name}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
            {gameDate}
            {gameTime && ` • ${gameTime}`}
          </div>
        </div>
      )}
    </div>
  );
}
