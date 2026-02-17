'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Input } from './input';
import { searchTeams, searchPlayers } from '@/lib/supabase-queries';

interface SmartSearchItem {
  id: string;
  name: string;
  type: 'team' | 'player' | 'game';
  sport?: string;
  abbreviation?: string;
  position?: string;
  team?: string; // SMART-PICK-BUILDER-027: Player's team for auto-fill
}

interface SmartSearchProps {
  onSelect: (item: SmartSearchItem) => void;
  placeholder?: string;
  searchType: 'teams' | 'players' | 'games';
  sport?: string;
  disabled?: boolean;
  // SMART-PICK-BUILDER-027: Filter players to specific teams (from selected game)
  teamFilter?: string[];
}

export function SmartSearch({
  onSelect,
  placeholder = 'Start typing to search...',
  searchType,
  sport,
  disabled = false,
  teamFilter, // SMART-PICK-BUILDER-027: Filter players by teams
}: SmartSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SmartSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // SMART-PICK-BUILDER-027: AbortController ref for canceling stale requests
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Mock data for demonstration - SMART-PICK-BUILDER-027: Added team field for players
  const mockData: Record<string, SmartSearchItem[]> = {
    teams: [
      { id: '1', name: 'Los Angeles Lakers', type: 'team', sport: 'NBA', abbreviation: 'LAL' },
      { id: '2', name: 'Golden State Warriors', type: 'team', sport: 'NBA', abbreviation: 'GSW' },
      { id: '3', name: 'Boston Celtics', type: 'team', sport: 'NBA', abbreviation: 'BOS' },
      { id: '4', name: 'Kansas City Chiefs', type: 'team', sport: 'NFL', abbreviation: 'KC' },
      { id: '5', name: 'Buffalo Bills', type: 'team', sport: 'NFL', abbreviation: 'BUF' },
      { id: '6', name: 'Dallas Cowboys', type: 'team', sport: 'NFL', abbreviation: 'DAL' },
      { id: '7', name: 'Los Angeles Dodgers', type: 'team', sport: 'MLB', abbreviation: 'LAD' },
      { id: '8', name: 'New York Yankees', type: 'team', sport: 'MLB', abbreviation: 'NYY' },
      { id: '9', name: 'Houston Astros', type: 'team', sport: 'MLB', abbreviation: 'HOU' },
    ],
    players: [
      { id: '10', name: 'LeBron James', type: 'player', sport: 'NBA', position: 'SF', team: 'Los Angeles Lakers' },
      { id: '11', name: 'Stephen Curry', type: 'player', sport: 'NBA', position: 'PG', team: 'Golden State Warriors' },
      { id: '12', name: 'Jayson Tatum', type: 'player', sport: 'NBA', position: 'SF', team: 'Boston Celtics' },
      { id: '13', name: 'Patrick Mahomes', type: 'player', sport: 'NFL', position: 'QB', team: 'Kansas City Chiefs' },
      { id: '14', name: 'Josh Allen', type: 'player', sport: 'NFL', position: 'QB', team: 'Buffalo Bills' },
      { id: '15', name: 'Dak Prescott', type: 'player', sport: 'NFL', position: 'QB', team: 'Dallas Cowboys' },
      { id: '16', name: 'Mookie Betts', type: 'player', sport: 'MLB', position: 'OF', team: 'Los Angeles Dodgers' },
      { id: '17', name: 'Aaron Judge', type: 'player', sport: 'MLB', position: 'OF', team: 'New York Yankees' },
      { id: '18', name: 'Jose Altuve', type: 'player', sport: 'MLB', position: '2B', team: 'Houston Astros' },
    ],
    games: [
      { id: '19', name: 'Lakers vs Warriors', type: 'game', sport: 'NBA' },
      { id: '20', name: 'Celtics vs Heat', type: 'game', sport: 'NBA' },
      { id: '21', name: 'Chiefs vs Bills', type: 'game', sport: 'NFL' },
      { id: '22', name: 'Cowboys vs Giants', type: 'game', sport: 'NFL' },
      { id: '23', name: 'Dodgers vs Yankees', type: 'game', sport: 'MLB' },
      { id: '24', name: 'Astros vs Rangers', type: 'game', sport: 'MLB' },
    ],
  };

  // Filter results based on query, sport, and teamFilter
  // SMART-PICK-BUILDER-027: Added teamFilter support for cascading UX
  const filteredResults = useMemo(() => {
    if (query.length < 3) {
      return [];
    }

    const items = mockData[searchType] || [];
    return items
      .filter(item => {
        const matchesQuery =
          item.name.toLowerCase().includes(query.toLowerCase()) ||
          (item.abbreviation && item.abbreviation.toLowerCase().includes(query.toLowerCase()));
        const matchesSport = !sport || item.sport === sport;
        // SMART-PICK-BUILDER-027: Filter players by selected game's teams
        const matchesTeamFilter = !teamFilter || teamFilter.length === 0 ||
          (item.team && teamFilter.some(t =>
            item.team?.toLowerCase().includes(t.toLowerCase()) ||
            t.toLowerCase().includes(item.team?.toLowerCase() || '')
          ));
        return matchesQuery && matchesSport && matchesTeamFilter;
      })
      .slice(0, 8); // Limit to 8 results
  }, [query, searchType, sport, teamFilter]);

  // Real API calls with fallback to mock data
  // SMART-PICK-BUILDER-027: Added AbortController for stale request cancellation
  useEffect(() => {
    if (query.length >= 3 && sport) {
      setIsLoading(true);

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      const performSearch = async () => {
        try {
          // Check if aborted before starting
          if (signal.aborted) return;

          let searchResults: SmartSearchItem[] = [];

          if (searchType === 'teams') {
            const teams = await searchTeams(query, sport);
            if (signal.aborted) return;
            searchResults = teams.map(team => ({
              id: team.id,
              name: team.name,
              type: 'team' as const,
              sport: team.sport,
              abbreviation: team.abbreviation,
            }));
          } else if (searchType === 'players') {
            const players = await searchPlayers(query, sport);
            if (signal.aborted) return;
            // SMART-PICK-BUILDER-027: Include team info for auto-fill
            // Note: searchPlayers returns Player & { teams: Team } due to join
            searchResults = players.map(player => ({
              id: player.id,
              name: player.name,
              type: 'player' as const,
              sport: player.sport,
              position: player.position,
              team: player.teams?.name, // Extract team name from joined teams object
            }));
            // Apply teamFilter to API results as well
            if (teamFilter && teamFilter.length > 0) {
              searchResults = searchResults.filter(item =>
                item.team && teamFilter.some(t =>
                  item.team?.toLowerCase().includes(t.toLowerCase()) ||
                  t.toLowerCase().includes(item.team?.toLowerCase() || '')
                )
              );
            }
          } else {
            // For games, use mock data for now
            searchResults = filteredResults;
          }

          if (!signal.aborted) {
            setResults(searchResults);
            setIsOpen(true);
          }
        } catch (error) {
          if (signal.aborted) return;
          console.warn('Search failed, using mock data:', error);
          setResults(filteredResults);
          setIsOpen(true);
        } finally {
          if (!signal.aborted) {
            setIsLoading(false);
          }
        }
      };

      const timer = setTimeout(performSearch, 300);
      return () => {
        clearTimeout(timer);
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    } else {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
    }
  }, [query, searchType, sport, filteredResults, teamFilter]);

  const handleSelect = (item: SmartSearchItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect(item);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />

      {isLoading && query.length >= 3 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 p-2">
          <div className="text-gray-500 text-sm">Searching...</div>
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 max-h-60 overflow-y-auto">
          {results.map(item => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{item.name}</div>
                  <div className="text-sm text-gray-500">
                    {item.abbreviation && `${item.abbreviation} • `}
                    {item.position && `${item.position} • `}
                    {item.team && `${item.team} • `}
                    {item.sport}
                  </div>
                </div>
                <div className="text-xs text-gray-400 capitalize">{item.type}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && results.length === 0 && query.length >= 3 && !isLoading && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-md shadow-lg z-50 p-3">
          <div className="text-gray-500 text-sm">No results found for "{query}"</div>
        </div>
      )}

      {query.length > 0 && query.length < 3 && (
        <div className="absolute top-full left-0 right-0 bg-gray-50 border border-gray-200 rounded-b-md shadow-sm z-50 p-2">
          <div className="text-gray-400 text-xs">Type at least 3 characters to search</div>
        </div>
      )}
    </div>
  );
}
