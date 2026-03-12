'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from './input';
import { SportsAsset } from './sports-asset';

interface SmartSearchItem {
  id: string;
  name: string;
  type: 'team' | 'player' | 'game';
  sport?: string;
  abbreviation?: string;
  position?: string;
  team?: string;
  headshot_url?: string | null;
  logo_url?: string | null;
}

interface SmartSearchProps {
  onSelect: (item: SmartSearchItem) => void;
  placeholder?: string;
  searchType: 'teams' | 'players' | 'games';
  sport?: string;
  disabled?: boolean;
  teamFilter?: string[];
  value?: string;
  onClear?: () => void;
}

export function SmartSearch({
  onSelect,
  placeholder = 'Start typing to search...',
  searchType,
  sport,
  disabled = false,
  teamFilter,
  value = '',
  onClear,
}: SmartSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SmartSearchItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        setError(null);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setIsLoading(true);
      setError(null);

      try {
        let searchResults: SmartSearchItem[] = [];

        if (searchType === 'teams') {
          const params = new URLSearchParams();
          if (sport) params.set('sport', sport);
          params.set('q', searchQuery);

          const response = await fetch(`/api/catalog/teams?${params}`, { signal });
          if (signal.aborted) return;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Teams API error: ${response.status}`);
          }

          const data = await response.json();
          searchResults = (data.teams || []).map((team: any) => ({
            id: team.team_uuid || team.id,
            name: team.name,
            type: 'team' as const,
            sport: team.sport,
            abbreviation: team.abbr || team.abbreviation,
            logo_url: team.logo_url || null,
          }));
        } else if (searchType === 'players') {
          const params = new URLSearchParams();
          if (sport) params.set('sport', sport);
          params.set('q', searchQuery);

          const response = await fetch(`/api/catalog/players?${params}`, { signal });
          if (signal.aborted) return;

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Players API error: ${response.status}`);
          }

          const data = await response.json();
          searchResults = (data.players || []).map((player: any) => ({
            id: player.player_id || player.id || player.player_name,
            name: player.player_name || player.name,
            type: 'player' as const,
            sport: player.sport || sport,
            position: player.position || undefined,
            team: player.team_name || player.team,
            headshot_url: player.headshot_url || null,
          }));

          if (teamFilter && teamFilter.length > 0) {
            searchResults = searchResults.filter(
              item =>
                item.team &&
                teamFilter.some(
                  teamName =>
                    item.team?.toLowerCase().includes(teamName.toLowerCase()) ||
                    teamName.toLowerCase().includes(item.team?.toLowerCase() || '')
                )
            );
          }
        }

        if (!signal.aborted) {
          setResults(searchResults.slice(0, 10));
          setIsOpen(searchResults.length > 0);
        }
      } catch (err) {
        if (signal.aborted) return;

        const errorMessage = err instanceof Error ? err.message : 'Search failed';
        console.error('[SmartSearch] Error:', errorMessage);
        setError(errorMessage);
        setResults([]);
        setIsOpen(false);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [searchType, sport, teamFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void performSearch(query);
    }, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, performSearch]);

  const handleSelect = (item: SmartSearchItem) => {
    setQuery(item.name);
    setIsOpen(false);
    onSelect(item);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (e.target.value === '' && onClear) {
      onClear();
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full pr-8"
        />
        {query && !disabled ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        ) : null}
      </div>

      {isLoading && query.length >= 2 ? (
        <div className="absolute top-full left-0 right-0 z-50 rounded-b-md border border-gray-300 bg-white p-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Searching...
          </div>
        </div>
      ) : null}

      {error && query.length >= 2 && !isLoading ? (
        <div className="absolute top-full left-0 right-0 z-50 rounded-b-md border border-red-200 bg-red-50 p-2 shadow-lg">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      ) : null}

      {isOpen && results.length > 0 && !isLoading ? (
        <div className="absolute top-full left-0 right-0 z-50 max-h-60 overflow-y-auto rounded-b-md border border-gray-300 bg-white shadow-lg">
          {results.map((item, index) => (
            <button
              key={`${item.id}-${index}`}
              onClick={() => handleSelect(item)}
              className="w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-100 focus:bg-blue-50 focus:outline-none last:border-b-0"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <SportsAsset
                    label={item.name}
                    imageUrl={item.headshot_url || item.logo_url}
                    type={item.type === 'player' ? 'player' : 'team'}
                    shape={item.type === 'player' ? 'circle' : 'square'}
                    className="h-9 w-9 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      {item.abbreviation ? `${item.abbreviation} • ` : ''}
                      {item.position ? `${item.position} • ` : ''}
                      {item.team ? `${item.team} • ` : ''}
                      {item.sport}
                    </div>
                  </div>
                </div>
                <div className="text-xs capitalize text-gray-400">{item.type}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && !error ? (
        <div className="absolute top-full left-0 right-0 z-50 rounded-b-md border border-gray-300 bg-white p-3 shadow-lg">
          <div className="text-sm text-gray-500">No results found for "{query}"</div>
          <div className="mt-1 text-xs text-gray-400">
            Try a different spelling or use manual entry
          </div>
        </div>
      ) : null}

      {query.length > 0 && query.length < 2 ? (
        <div className="absolute top-full left-0 right-0 z-50 rounded-b-md border border-gray-200 bg-gray-50 p-2 shadow-sm">
          <div className="text-xs text-gray-400">Type at least 2 characters to search</div>
        </div>
      ) : null}
    </div>
  );
}
